import "server-only";
/**
 * MFS payment links: a seller asks a buyer to pay an advance (usually the
 * delivery charge) or a due before shipping. The buyer opens /pay/<token>,
 * pays in bKash/Nagad, and the verified payment is recorded on the order
 * through the order.payment command.
 */
import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { orderTotals } from "@/lib/domain";
import { db, schema, withTenant } from "../../db";
import { paymentAccounts, paymentLinks } from "../../db/schema-couriers";
import { HttpError } from "../../http";
import { loadWorkingSet } from "../../state-io";
import { run, systemActor, type Actor } from "../couriers/service";
import { decryptJson, encryptJson, mask } from "../secrets";
import { PAY_ADAPTERS, payAdapter } from ".";
import type { PayCreds, PayProvider } from "./types";

const LINK_TTL_MS = 72 * 3_600_000;
const sandboxAllowed = () => process.env.NODE_ENV !== "production" || process.env.PAYMENTS_SANDBOX === "1";

/* ------------------------------------------------------------ accounts */

export async function listPaymentAccounts(businessId: string) {
  const rows = await withTenant(businessId, (tx) => tx.select().from(paymentAccounts));
  return {
    sandboxAllowed: sandboxAllowed(),
    accounts: rows.map((r) => {
      const creds = decryptJson<PayCreds>(r.credentialsEnc);
      const fields = PAY_ADAPTERS[r.provider as PayProvider]?.fields ?? [];
      return { provider: r.provider, status: r.status, credentials: Object.fromEntries(fields.map((f) => [f.key, f.secret ? mask(creds[f.key]) : (creds[f.key] ?? "").slice(0, 60)])) };
    }),
  };
}

export async function connectPaymentAccount(businessId: string, provider: PayProvider, input: PayCreds) {
  if (provider === "sandbox") throw new HttpError(400, "The test wallet needs no setup");
  const [existing] = await withTenant(businessId, (tx) => tx.select().from(paymentAccounts).where(eq(paymentAccounts.provider, provider)));
  const creds = { ...(existing ? decryptJson<PayCreds>(existing.credentialsEnc) : {}), ...Object.fromEntries(Object.entries(input).filter(([, v]) => v?.trim())) };
  try {
    await payAdapter(provider).test(creds);
  } catch (e) {
    throw new HttpError(400, `${provider === "bkash" ? "bKash" : "Nagad"} didn't accept these details: ${(e as Error).message}`);
  }
  await withTenant(businessId, (tx) =>
    tx
      .insert(paymentAccounts)
      .values({ businessId, provider, credentialsEnc: encryptJson(creds) })
      .onConflictDoUpdate({ target: [paymentAccounts.businessId, paymentAccounts.provider], set: { credentialsEnc: encryptJson(creds), status: "connected", updatedAt: new Date() } }),
  );
}

export async function disconnectPaymentAccount(businessId: string, provider: PayProvider) {
  await withTenant(businessId, (tx) => tx.delete(paymentAccounts).where(eq(paymentAccounts.provider, provider)));
}

async function credsFor(businessId: string, provider: PayProvider): Promise<PayCreds> {
  if (provider === "sandbox") {
    if (!sandboxAllowed()) throw new HttpError(400, "Test payments are turned off");
    return {};
  }
  const [row] = await withTenant(businessId, (tx) => tx.select().from(paymentAccounts).where(eq(paymentAccounts.provider, provider)));
  if (!row) throw new HttpError(400, `Connect ${provider === "bkash" ? "bKash" : "Nagad"} in Settings first`);
  return decryptJson<PayCreds>(row.credentialsEnc);
}

/* ------------------------------------------------------------ links */

export async function createLink(actor: Actor, input: { orderId: string; amount: number; purpose: "advance" | "due"; provider: PayProvider }) {
  const state = await withTenant(actor.businessId, (tx) => loadWorkingSet(tx, actor.businessId, "order.payment", { orderId: input.orderId }));
  const o = state.orders[0];
  if (!o) throw new HttpError(404, "Order not found");
  if (o.status === "cancelled" || o.status === "returned") throw new HttpError(400, "This order is closed");
  const remaining = orderTotals(o).remaining;
  if (!(input.amount > 0) || input.amount > remaining + 0.01) throw new HttpError(400, `Ask for between ৳1 and ৳${remaining}`);
  await credsFor(actor.businessId, input.provider);
  const id = `pl_${randomBytes(9).toString("base64url")}`;
  const token = randomBytes(16).toString("base64url"); // 128-bit, unguessable (NFR-SEC-05)
  await withTenant(actor.businessId, (tx) =>
    tx.insert(paymentLinks).values({ businessId: actor.businessId, id, orderId: o.id, token, provider: input.provider, amount: input.amount, purpose: input.purpose, createdBy: actor.userName, expiresAt: new Date(Date.now() + LINK_TTL_MS) }),
  );
  await run(actor, `pln${id}`, "order.note", { orderId: o.id, note: `Payment link sent: ৳${input.amount} via ${input.provider} (${input.purpose})` });
  return { id, token, path: `/pay/${token}` };
}

export async function linksForOrder(businessId: string, orderId: string) {
  return withTenant(businessId, (tx) => tx.select().from(paymentLinks).where(eq(paymentLinks.orderId, orderId)).orderBy(desc(paymentLinks.createdAt)));
}

export async function cancelLink(businessId: string, id: string) {
  await withTenant(businessId, (tx) => tx.update(paymentLinks).set({ status: "cancelled" }).where(and(eq(paymentLinks.id, id), eq(paymentLinks.status, "open"))));
}

/** Owner connection: the token is the only key a buyer has. */
async function byToken(token: string) {
  const [link] = await db.select().from(paymentLinks).where(eq(paymentLinks.token, token));
  if (!link) throw new HttpError(404, "This payment link doesn't exist");
  return link;
}

/** What the buyer's pay page may see: shop branding, amount and order number — nothing else. */
export async function publicInfo(token: string) {
  const link = await byToken(token);
  const [b] = await db.select({ name: schema.businesses.name, logo: schema.businesses.logo, theme: schema.businesses.theme, phone: schema.businesses.phone }).from(schema.businesses).where(eq(schema.businesses.id, link.businessId));
  const [o] = await db.select({ no: schema.orders.no, customer: schema.orders.customer }).from(schema.orders).where(and(eq(schema.orders.businessId, link.businessId), eq(schema.orders.id, link.orderId)));
  const expired = link.status === "open" && link.expiresAt < new Date();
  const buyer = (o?.customer as { name?: string } | null)?.name?.split(" ")[0];
  return {
    shop: { name: b?.name ?? "", logo: b?.logo ?? null, accent: (b?.theme as { accent?: string })?.accent ?? "#0E6B53", phone: b?.phone ?? "" },
    orderNo: o?.no,
    buyer,
    amount: link.amount,
    purpose: link.purpose,
    provider: link.provider,
    status: expired ? "expired" : link.status,
    paidAt: link.paidAt,
    trxId: link.status === "paid" ? link.trxId : null,
  };
}

export async function startPayment(token: string, origin: string, ip?: string) {
  const link = await byToken(token);
  if (link.status !== "open") throw new HttpError(400, link.status === "paid" ? "Already paid — thank you!" : "This link is no longer active");
  if (link.expiresAt < new Date()) throw new HttpError(400, "This link has expired. Ask the shop for a new one.");
  const creds = await credsFor(link.businessId, link.provider as PayProvider);
  const [o] = await db.select({ no: schema.orders.no, customer: schema.orders.customer }).from(schema.orders).where(and(eq(schema.orders.businessId, link.businessId), eq(schema.orders.id, link.orderId)));
  const res = await payAdapter(link.provider).start(creds, {
    token,
    amount: link.amount,
    reference: `Order ${o?.no ?? ""}`,
    payerReference: ((o?.customer as { phone?: string } | null)?.phone ?? "buyer").slice(-11),
    callbackUrl: `${origin}/api/payment-links/callback/${link.provider}?token=${encodeURIComponent(token)}`,
    ip,
  });
  if (res.providerRef) await db.update(paymentLinks).set({ providerRef: res.providerRef }).where(and(eq(paymentLinks.businessId, link.businessId), eq(paymentLinks.id, link.id)));
  return { redirectUrl: res.redirectUrl };
}

/**
 * Verifies with the provider and records the payment exactly once — the
 * command id is derived from the link, so a repeated callback is a no-op.
 */
export async function completePayment(token: string, params: URLSearchParams) {
  const link = await byToken(token);
  if (link.status === "paid") return { ok: true, already: true };
  if (link.status !== "open") return { ok: false, message: "This link is no longer active" };
  const creds = await credsFor(link.businessId, link.provider as PayProvider);
  const v = await payAdapter(link.provider).verify(creds, params, { providerRef: link.providerRef, amount: link.amount });
  if (!v.ok) return { ok: false, message: v.message };
  const actor = systemActor(link.businessId, link.provider === "bkash" ? "bKash" : link.provider === "nagad" ? "Nagad" : "Test wallet");
  const method = link.provider === "nagad" ? "nagad" : "bkash";
  const r = await run(actor, `plp${link.id}`, "order.payment", { orderId: link.orderId, payment: { method, amount: v.amount, txnId: v.trxId, kind: link.purpose === "advance" ? "advance" : "payment" } });
  if (r.status === "rejected") return { ok: false, message: r.error };
  await db.update(paymentLinks).set({ status: "paid", paidAt: new Date(), trxId: v.trxId ?? null, providerRef: v.providerRef ?? link.providerRef }).where(and(eq(paymentLinks.businessId, link.businessId), eq(paymentLinks.id, link.id)));
  const [o] = await db.select({ no: schema.orders.no }).from(schema.orders).where(and(eq(schema.orders.businessId, link.businessId), eq(schema.orders.id, link.orderId)));
  await run(actor, `pln${link.id}`, "notice.push", { kind: "new_order", title: `৳${v.amount} received for order #${o?.no ?? ""}`, body: `${method === "bkash" ? "bKash" : "Nagad"} ${v.trxId ?? ""}`.trim(), href: `/orders?id=${link.orderId}` });
  return { ok: true };
}
