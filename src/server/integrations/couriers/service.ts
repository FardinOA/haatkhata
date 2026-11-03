import "server-only";
/**
 * Courier workflows. Every change to an order goes through applyCommand —
 * the same path a device uses — so stock effects, idempotency and the audit
 * log behave identically whether a person or a courier moved the parcel.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { codFor, OPEN_STATUSES, PROVIDERS, type CourierStatus } from "@/components/couriers/courier-meta";
import type { CommandPayload, CommandType } from "@/lib/commands";
import { can } from "@/lib/domain";
import type { CourierProvider, Order, Role } from "@/lib/types";
import { applyCommand, type CommandOutcome } from "../../apply";
import { db, withTenant } from "../../db";
import { consignments, courierAccounts, courierPrefs } from "../../db/schema-couriers";
import { HttpError } from "../../http";
import { loadWorkingSet } from "../../state-io";
import { decryptJson, encryptJson, mask } from "../secrets";
import { adapter } from ".";
import { CourierError, type ConsignmentRequest, type Credentials } from "./types";

export type Actor = { businessId: string; userId: string; userName: string; role: Role };

export const systemActor = (businessId: string, name = "Courier sync"): Actor => ({ businessId, userId: "system", userName: name, role: "owner" });

const sandboxAllowed = () => process.env.NODE_ENV !== "production" || process.env.COURIER_SANDBOX === "1";

const short = (s: string) => createHash("sha256").update(s).digest("base64url").slice(0, 22);

export function run<T extends CommandType>(actor: Actor, id: string, type: T, payload: CommandPayload<T>): Promise<CommandOutcome> {
  return applyCommand(actor, { id, type, payload, at: new Date().toISOString() });
}

/* ------------------------------------------------------------ accounts */

export async function listAccounts(businessId: string) {
  const rows = await withTenant(businessId, (tx) => tx.select().from(courierAccounts));
  const prefs = await getPrefs(businessId);
  return {
    sandboxAllowed: sandboxAllowed(),
    prefs,
    accounts: rows.map((r) => {
      let masked: Record<string, string> = {};
      try {
        const creds = decryptJson<Credentials>(r.credentialsEnc);
        masked = Object.fromEntries(Object.entries(creds).map(([k, v]) => [k, PROVIDERS[r.provider as CourierProvider]?.fields.find((f) => f.key === k)?.secret ? mask(v) : v]));
      } catch {
        masked = {};
      }
      return { provider: r.provider as CourierProvider, status: r.status, settings: r.settings, credentials: masked, webhookPath: `/api/webhooks/couriers/${r.provider}?key=${r.webhookKey}`, lastCheckedAt: r.lastCheckedAt, lastError: r.lastError };
    }),
  };
}

async function credsFor(businessId: string, provider: CourierProvider): Promise<Credentials> {
  if (provider === "sandbox") {
    if (!sandboxAllowed()) throw new HttpError(400, "The test courier is turned off in production");
    return {};
  }
  const [row] = await withTenant(businessId, (tx) => tx.select().from(courierAccounts).where(eq(courierAccounts.provider, provider)));
  if (!row || row.status !== "connected") throw new HttpError(400, `Connect ${PROVIDERS[provider].name} in Settings first`);
  return decryptJson<Credentials>(row.credentialsEnc);
}

export async function connectAccount(businessId: string, provider: CourierProvider, input: Credentials, settings: Record<string, unknown> = {}) {
  if (provider === "sandbox" && !sandboxAllowed()) throw new HttpError(400, "The test courier is turned off in production");
  const [existing] = await withTenant(businessId, (tx) => tx.select().from(courierAccounts).where(eq(courierAccounts.provider, provider)));
  // Blank secret fields keep the stored value, so editing settings never requires re-typing secrets.
  const prev = existing ? decryptJson<Credentials>(existing.credentialsEnc) : {};
  const creds: Credentials = { ...prev, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v?.trim())) };
  try {
    await adapter(provider).test(creds);
  } catch (e) {
    throw new HttpError(400, e instanceof CourierError ? `${PROVIDERS[provider].name} didn't accept these details: ${e.message.replace(/^\w+: /, "")}` : "Couldn't reach the courier. Try again.");
  }
  const now = new Date();
  await withTenant(businessId, (tx) =>
    tx
      .insert(courierAccounts)
      .values({ businessId, provider, credentialsEnc: encryptJson(creds), settings, webhookKey: existing?.webhookKey ?? randomBytes(18).toString("base64url"), status: "connected", lastCheckedAt: now, lastError: null })
      .onConflictDoUpdate({ target: [courierAccounts.businessId, courierAccounts.provider], set: { credentialsEnc: encryptJson(creds), settings, status: "connected", lastCheckedAt: now, lastError: null, updatedAt: now } }),
  );
}

export async function disconnectAccount(businessId: string, provider: CourierProvider) {
  await withTenant(businessId, (tx) => tx.delete(courierAccounts).where(eq(courierAccounts.provider, provider)));
}

export type Prefs = { defaultProvider: CourierProvider | null; pickup: { name?: string; phone?: string; address?: string; district?: string }; advanceOnHighRisk: boolean };

export async function getPrefs(businessId: string): Promise<Prefs> {
  const [p] = await withTenant(businessId, (tx) => tx.select().from(courierPrefs));
  return { defaultProvider: (p?.defaultProvider as CourierProvider) ?? null, pickup: p?.pickup ?? {}, advanceOnHighRisk: p?.advanceOnHighRisk ?? true };
}

export async function setPrefs(businessId: string, patch: Partial<Prefs>) {
  const cur = await getPrefs(businessId);
  const next = { ...cur, ...patch };
  await withTenant(businessId, (tx) =>
    tx
      .insert(courierPrefs)
      .values({ businessId, defaultProvider: next.defaultProvider, pickup: next.pickup, advanceOnHighRisk: next.advanceOnHighRisk })
      .onConflictDoUpdate({ target: courierPrefs.businessId, set: { defaultProvider: next.defaultProvider, pickup: next.pickup, advanceOnHighRisk: next.advanceOnHighRisk, updatedAt: new Date() } }),
  );
  return next;
}

/* ------------------------------------------------------------ booking */

function requestFor(o: Order): ConsignmentRequest {
  const addr = o.customer?.address;
  if (!o.customer || !addr?.line) throw new HttpError(400, `Order #${o.no} has no delivery address`);
  return {
    orderId: o.id,
    invoice: o.invoiceNo ?? `ORD-${o.no}`,
    recipientName: o.customer.name,
    recipientPhone: o.customer.phone,
    recipientAddress: addr.line,
    area: addr.area || addr.district,
    district: addr.district,
    codAmount: codFor(o),
    itemCount: o.lines.reduce((s, l) => s + l.qty, 0),
    itemDescription: o.lines.map((l) => `${l.name}${l.variantLabel ? ` (${l.variantLabel})` : ""} ×${l.qty}`).join(", "),
    note: o.notesInvoice,
  };
}

export type BookOutcome = { orderId: string; ok: boolean; no?: number; consignmentId?: string; trackingCode?: string; fee?: number; error?: string };

export async function bookOrders(actor: Actor, orderIds: string[], provider: CourierProvider): Promise<BookOutcome[]> {
  if (!can(actor.role, "pack_ship")) throw new HttpError(403, "Your role can't ship orders");
  const creds = await credsFor(actor.businessId, provider);
  const a = adapter(provider);

  const prepared: { order: Order; req: ConsignmentRequest }[] = [];
  const out: BookOutcome[] = [];
  for (const orderId of [...new Set(orderIds)].slice(0, 200)) {
    const state = await withTenant(actor.businessId, (tx) => loadWorkingSet(tx, actor.businessId, "order.transition", { orderId }));
    const o = state.orders[0];
    if (!o) out.push({ orderId, ok: false, error: "Order not found" });
    else if (o.courier?.consignmentId) out.push({ orderId, ok: false, no: o.no, error: `#${o.no} is already booked (${o.courier.name} ${o.courier.tracking ?? ""})` });
    else if (o.status !== "confirmed" && o.status !== "packed") out.push({ orderId, ok: false, no: o.no, error: `#${o.no} must be confirmed or packed first` });
    else
      try {
        prepared.push({ order: o, req: requestFor(o) });
      } catch (e) {
        out.push({ orderId, ok: false, no: o.no, error: (e as Error).message });
      }
  }
  if (!prepared.length) return out;

  let results: (Awaited<ReturnType<typeof a.create>> | Error)[];
  if (prepared.length > 1 && a.bulkCreate) {
    try {
      results = await a.bulkCreate(creds, prepared.map((p) => p.req));
    } catch (e) {
      results = prepared.map(() => e as Error);
    }
  } else {
    results = [];
    for (const p of prepared)
      results.push(
        await a.create(creds, p.req).catch((e: Error) => e),
      );
  }

  for (const [i, { order: o, req }] of prepared.entries()) {
    const r = results[i];
    if (r instanceof Error) {
      out.push({ orderId: o.id, ok: false, no: o.no, error: r.message.replace(/^\w+: /, "") });
      continue;
    }
    const courier = { name: PROVIDERS[provider].name, tracking: r.trackingCode, fee: r.fee, provider, consignmentId: r.consignmentId };
    const res = await run(actor, `bk${short(`${o.id}:${r.consignmentId}`)}`, "order.transition", { orderId: o.id, to: "shipped", courier });
    if (res.status === "rejected") {
      await a.cancel?.(creds, r.consignmentId).catch(() => {});
      out.push({ orderId: o.id, ok: false, no: o.no, error: res.error });
      continue;
    }
    await withTenant(actor.businessId, (tx) =>
      tx
        .insert(consignments)
        .values({ businessId: actor.businessId, id: `cs_${short(`${provider}:${r.consignmentId}`)}`, orderId: o.id, provider, consignmentId: r.consignmentId, trackingCode: r.trackingCode, rawStatus: "booked", status: "booked", fee: r.fee ?? null, codAmount: req.codAmount, district: req.district, history: [{ at: new Date().toISOString(), status: "booked" }] })
        .onConflictDoNothing(),
    );
    out.push({ orderId: o.id, ok: true, no: o.no, consignmentId: r.consignmentId, trackingCode: r.trackingCode, fee: r.fee });
  }
  return out;
}

/* ------------------------------------------------------------ status updates */

type ConsignmentRow = typeof consignments.$inferSelect;

/**
 * Applies a courier status to the order. Delivered parcels complete the
 * order; returned ones raise a notice so the shop records what came back
 * (restock or damaged) when the parcel physically arrives.
 */
export async function applyCourierStatus(businessId: string, row: ConsignmentRow, status: CourierStatus, raw: string) {
  if (row.status === status && row.rawStatus === raw) return { changed: false };
  const at = new Date();
  await withTenant(businessId, (tx) =>
    tx
      .update(consignments)
      .set({ status, rawStatus: raw, lastStatusAt: at, history: sql`${consignments.history} || ${JSON.stringify([{ at: at.toISOString(), status, raw }])}::jsonb` })
      .where(eq(consignments.id, row.id)),
  );
  if (row.status === status) return { changed: true };

  const actor = systemActor(businessId, `${PROVIDERS[row.provider as CourierProvider]?.name ?? row.provider} update`);
  const base = `cs${short(`${row.id}:${status}`)}`;
  const state = await withTenant(businessId, (tx) => loadWorkingSet(tx, businessId, "order.transition", { orderId: row.orderId }));
  const o = state.orders[0];
  if (!o) return { changed: true };
  const name = PROVIDERS[row.provider as CourierProvider]?.name ?? row.provider;

  await run(actor, `${base}c`, "order.courier", { orderId: o.id, courier: { ...(o.courier ?? { name }), courierStatus: raw } });
  if ((status === "delivered" || status === "partial") && o.status === "shipped") {
    await run(actor, `${base}d`, "order.transition", { orderId: o.id, to: "delivered", note: `${name}: ${raw}` });
    if (status === "partial")
      await run(actor, `${base}n`, "notice.push", { kind: "return", title: `Order #${o.no} was partly delivered`, body: `${name} is bringing some items back. Record what returns to restock it.`, href: `/orders?id=${o.id}` });
  } else if (status === "returned" && (o.status === "shipped" || o.status === "delivered")) {
    await run(actor, `${base}n`, "notice.push", { kind: "return", title: `Order #${o.no} is coming back`, body: `${name} marked it “${raw}”. Record the return when the parcel arrives so stock is restocked.`, href: `/orders?id=${o.id}` });
    await run(actor, `${base}t`, "order.note", { orderId: o.id, note: `${name}: return in progress (${raw})` });
  } else if (status === "hold") {
    await run(actor, `${base}t`, "order.note", { orderId: o.id, note: `${name} put the parcel on hold (${raw})` });
  }
  return { changed: true };
}

export async function handleWebhook(provider: CourierProvider, key: string, body: unknown, headers: Headers) {
  // Owner connection: the key is the only thing that identifies the business.
  const [acct] = await db.select().from(courierAccounts).where(and(eq(courierAccounts.provider, provider), eq(courierAccounts.webhookKey, key)));
  if (!acct) throw new HttpError(404, "Unknown webhook");
  const creds = { ...decryptJson<Credentials>(acct.credentialsEnc), __webhookKey: key };
  let ev;
  try {
    ev = adapter(provider).parseWebhook(body, headers, creds);
  } catch (e) {
    throw new HttpError(e instanceof CourierError && e.status === 401 ? 401 : 400, (e as Error).message);
  }
  if (!ev) return { ignored: true };
  const [row] = await withTenant(acct.businessId, (tx) => tx.select().from(consignments).where(and(eq(consignments.provider, provider), eq(consignments.consignmentId, ev.consignmentId))));
  if (!row) return { ignored: true, reason: "unknown consignment" };
  return applyCourierStatus(acct.businessId, row, ev.status, ev.raw);
}

/** Polls couriers for parcels still on the move (cron). */
export async function syncOpenConsignments(limit = 300, businessId?: string) {
  const where = businessId ? and(inArray(consignments.status, OPEN_STATUSES), eq(consignments.businessId, businessId)) : inArray(consignments.status, OPEN_STATUSES);
  const open = await db.select().from(consignments).where(where).orderBy(asc(consignments.lastStatusAt)).limit(limit);
  const credCache = new Map<string, Credentials | null>();
  let checked = 0;
  let changed = 0;
  const errors: string[] = [];
  for (const row of open) {
    const key = `${row.businessId}:${row.provider}`;
    if (!credCache.has(key)) credCache.set(key, await credsFor(row.businessId, row.provider as CourierProvider).catch(() => null));
    const creds = credCache.get(key);
    if (!creds) continue;
    try {
      const s = await adapter(row.provider).status(creds, row.consignmentId);
      checked++;
      if ((await applyCourierStatus(row.businessId, row, s.status, s.raw)).changed) changed++;
    } catch (e) {
      errors.push(`${row.provider} ${row.consignmentId}: ${(e as Error).message}`);
    }
  }
  return { open: open.length, checked, changed, errors: errors.slice(0, 20) };
}

export async function consignmentsFor(businessId: string, orderId: string) {
  return withTenant(businessId, (tx) => tx.select().from(consignments).where(eq(consignments.orderId, orderId)));
}

/** Delivery success by courier for one district, from shops across the network (anonymised). */
export async function networkInsights(businessId: string, district: string) {
  const res = await withTenant(businessId, (tx) => tx.execute(sql`select * from bk_courier_network(${district})`));
  return (res.rows as { courier: string; delivered: number; returned: number; merchants: number; avg_fee: string | null }[]).map((r) => ({ courier: r.courier, delivered: r.delivered, returned: r.returned, merchants: r.merchants, avgFee: r.avg_fee === null ? null : Number(r.avg_fee) }));
}
