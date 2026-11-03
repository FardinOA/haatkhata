import "server-only";
/**
 * Invoice printing without a paid plan. The demo, a trial and a lapsed shop
 * can print (or save / share) invoices for PRINT_QUOTA orders, counted for
 * good — never reset monthly — against three buckets at once:
 *   - the device (a long-lived cookie), so switching Wi-Fi to mobile data doesn't reset it;
 *   - the shop, so a new browser doesn't reset it for a signed-up seller;
 *   - the IP, with a looser PRINT_QUOTA_IP, which catches incognito resets without
 *     locking out strangers who share one carrier IP (CGNAT is common on BD mobile data).
 * The tightest bucket wins. Paid plans are never counted, and reprinting an
 * order a bucket already counted is allowed.
 */
import { eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { printQuota } from "../db/schema-billing";
import { isPaidPlan } from "./plans";

const { businesses } = schema;

const envInt = (name: string, fallback: number) => {
  const v = Number(process.env[name] ?? fallback);
  return Number.isInteger(v) && v >= 0 ? v : fallback;
};
export const printLimit = () => envInt("PRINT_QUOTA", 5);
const ipLimit = () => Math.max(printLimit(), envInt("PRINT_QUOTA_IP", 15));

export type PrintWho = { ip: string; device: string; businessId: string | null };
export type PrintAllowance = { paid: boolean; used: number; limit: number; left: number };

async function hasPaidPlan(businessId: string | null) {
  if (!businessId) return false;
  const [b] = await db.select({ plan: businesses.plan }).from(businesses).where(eq(businesses.id, businessId));
  return !!b && isPaidPlan(b.plan);
}

function bucketsOf(who: PrintWho) {
  const list = [
    { bucket: `dev:${who.device}`, limit: printLimit() },
    { bucket: `ip:${who.ip}`, limit: ipLimit() },
  ];
  if (who.businessId) list.push({ bucket: `biz:${who.businessId}`, limit: printLimit() });
  return list;
}

/** Demo orders share ids across devices, so account orders are keyed by their business. */
const keyOf = (businessId: string | null, orderId: string) => (businessId ? `${businessId}:${orderId}` : `demo:${orderId}`);

/** What the UI shows: the tightest bucket, on the PRINT_QUOTA scale. */
function summarize(rows: { limit: number; used: number }[]): PrintAllowance {
  const limit = printLimit();
  const left = Math.max(0, Math.min(limit, ...rows.map((r) => r.limit - r.used)));
  return { paid: false, used: limit - left, limit, left };
}

export async function printAllowance(who: PrintWho): Promise<PrintAllowance> {
  if (await hasPaidPlan(who.businessId)) return { paid: true, used: 0, limit: printLimit(), left: printLimit() };
  const buckets = bucketsOf(who);
  const counts = await db
    .select({ bucket: printQuota.bucket, n: sql<number>`count(*)::int` })
    .from(printQuota)
    .where(inArray(printQuota.bucket, buckets.map((b) => b.bucket)))
    .groupBy(printQuota.bucket);
  return summarize(buckets.map((b) => ({ limit: b.limit, used: counts.find((c) => c.bucket === b.bucket)?.n ?? 0 })));
}

/**
 * Counts these orders against every bucket. All-or-nothing: if the batch
 * doesn't fit one of them, nothing is counted and `ok` is false.
 */
export async function claimPrints(who: PrintWho, orderIds: string[]): Promise<PrintAllowance & { ok: boolean }> {
  if (await hasPaidPlan(who.businessId)) return { ok: true, paid: true, used: 0, limit: printLimit(), left: printLimit() };
  const keys = [...new Set(orderIds.map((id) => keyOf(who.businessId, id)))];
  const buckets = bucketsOf(who);
  return db.transaction(async (tx) => {
    // Two tabs printing at once must not both squeeze past a limit; lock in a fixed order.
    for (const b of [...buckets].sort((x, y) => x.bucket.localeCompare(y.bucket))) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`print:${b.bucket}`}))`);
    const rows = await tx
      .select({ bucket: printQuota.bucket, key: printQuota.orderKey })
      .from(printQuota)
      .where(inArray(printQuota.bucket, buckets.map((b) => b.bucket)));
    const state = buckets.map((b) => {
      const seen = new Set(rows.filter((r) => r.bucket === b.bucket).map((r) => r.key));
      return { ...b, used: seen.size, fresh: keys.filter((k) => !seen.has(k)) };
    });
    if (state.some((b) => b.used + b.fresh.length > b.limit)) return { ok: false, ...summarize(state) };
    const values = state.flatMap((b) => b.fresh.map((orderKey) => ({ bucket: b.bucket, orderKey, businessId: who.businessId })));
    if (values.length) await tx.insert(printQuota).values(values).onConflictDoNothing();
    return { ok: true, ...summarize(state.map((b) => ({ limit: b.limit, used: b.used + b.fresh.length }))) };
  });
}
