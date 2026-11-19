import "server-only";
/**
 * Outbound webhooks: signed with HMAC-SHA256, retried with backoff, logged.
 * Signature header: `X-HaatKhata-Signature: t=<unix seconds>,v1=<hex hmac of "<t>.<raw body>">`.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, lte, sql } from "drizzle-orm";
import { db, withTenant } from "../db";
import { webhookDeliveries, webhookEndpoints } from "../db/schema-platform";
import { decrypt } from "../messaging/crypto";

export const WEBHOOK_EVENTS = ["order.created", "order.status_changed", "payment.recorded"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
/** Minutes until each retry: 1m, 5m, 30m, 2h, 6h, 24h — then the delivery is marked failed. */
export const BACKOFF_MIN = [1, 5, 30, 120, 360, 1440];

export function signPayload(secret: string, body: string, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}

/** What a receiver runs: checks the signature and rejects anything older than `toleranceSec`. */
export function verifyWebhookSignature(secret: string, body: string, header: string, toleranceSec = 300, now = Math.floor(Date.now() / 1000)) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || !parts.v1 || Math.abs(now - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return parts.v1.length === expected.length && timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expected));
}

/** Blocks obvious internal targets (SSRF) in production. */
export function validateWebhookUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "Enter a full URL starting with https://";
  }
  const prod = process.env.NODE_ENV === "production";
  if (prod && u.protocol !== "https:") return "Webhook URLs must use https";
  if (!["http:", "https:"].includes(u.protocol)) return "Webhook URLs must use http or https";
  if (prod && /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|\[::1\])/.test(u.hostname)) return "That address isn't reachable from the internet";
  return null;
}

const newId = (p: string) => `${p}${randomBytes(9).toString("base64url")}`;

export async function enqueueEvent(businessId: string, event: WebhookEvent, data: unknown) {
  const ids = await withTenant(businessId, async (tx) => {
    const eps = await tx.select().from(webhookEndpoints).where(eq(webhookEndpoints.active, true));
    const subs = eps.filter((e) => e.events.includes(event));
    if (!subs.length) return [];
    const now = new Date();
    const rows = subs.map((e) => ({ businessId, id: newId("whd_"), endpointId: e.id, event, payload: { id: newId("evt_"), event, created: now.toISOString(), data } as object, nextAttemptAt: now }));
    await tx.insert(webhookDeliveries).values(rows);
    return rows.map((r) => r.id);
  });
  // Hooks already run off the request path, so deliver right away; failures fall to the retry worker.
  if (ids.length) await processDueDeliveries(20).catch(() => {});
  return ids.length;
}

async function deliverOne(d: typeof webhookDeliveries.$inferSelect) {
  const [ep] = await withTenant(d.businessId, (tx) => tx.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, d.endpointId)));
  const now = new Date();
  if (!ep || !ep.active) {
    await withTenant(d.businessId, (tx) => tx.update(webhookDeliveries).set({ status: "failed", lastError: "endpoint removed" }).where(eq(webhookDeliveries.id, d.id)));
    return "failed";
  }
  const body = JSON.stringify(d.payload);
  let status: number | null = null;
  let error: string | null = null;
  try {
    const res = await fetch(ep.url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "HaatKhata-Webhooks/1", "x-haatkhata-event": d.event, "x-haatkhata-delivery": d.id, "x-haatkhata-signature": signPayload(decrypt(ep.secretEnc), body) },
      body,
      signal: AbortSignal.timeout(10_000),
      redirect: "manual",
    });
    status = res.status;
    if (res.status < 200 || res.status >= 300) error = `HTTP ${res.status}`;
  } catch (e) {
    error = (e as Error).message;
  }
  const attempts = d.attempts + 1;
  const ok = !error;
  const giveUp = !ok && attempts > BACKOFF_MIN.length;
  await withTenant(d.businessId, (tx) =>
    tx
      .update(webhookDeliveries)
      .set({
        attempts,
        lastStatus: status,
        lastError: error,
        status: ok ? "delivered" : giveUp ? "failed" : "pending",
        deliveredAt: ok ? now : null,
        nextAttemptAt: ok || giveUp ? now : new Date(now.getTime() + BACKOFF_MIN[attempts - 1] * 60_000),
      })
      .where(eq(webhookDeliveries.id, d.id)),
  );
  return ok ? "delivered" : giveUp ? "failed" : "retrying";
}

/** Worker: delivers everything that's due. Runs after enqueue and from /api/cron/webhooks. */
export async function processDueDeliveries(limit = 50) {
  // Claim due rows across businesses (system worker, owner connection).
  const due = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(webhookDeliveries)
      .where(and(eq(webhookDeliveries.status, "pending"), lte(webhookDeliveries.nextAttemptAt, new Date())))
      .limit(limit)
      .for("update", { skipLocked: true });
    if (rows.length)
      await tx
        .update(webhookDeliveries)
        .set({ nextAttemptAt: sql`now() + interval '2 minutes'` })
        .where(sql`${webhookDeliveries.id} in (${sql.join(rows.map((r) => sql`${r.id}`), sql`, `)})`);
    return rows;
  });
  const results = await Promise.all(due.map(deliverOne));
  return { processed: due.length, delivered: results.filter((r) => r === "delivered").length };
}
