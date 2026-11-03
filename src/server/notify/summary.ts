import "server-only";
/**
 * Daily summary (SRS FR-RPT-09) with low-stock digest (FR-STK-07), composed
 * per business in Asia/Dhaka time and sent by push and/or SMS at each user's
 * chosen hour. Profit is included only for roles that may see costs.
 */
import { and, eq, gte, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { can } from "@/lib/domain";
import { toBanglaDigits } from "@/lib/format";
import type { Role } from "@/lib/types";
import { db, schema, withTenant, type Tx } from "../db";
import { notificationPrefs, smsCredits } from "../db/schema-platform";
import { sendSms } from "../integrations/sms";
import { notifyUsers } from "./push";
import { creditBalance, smsParts } from "./sms";

const DHAKA_MS = 6 * 3_600_000;

/** Start/end of the Dhaka calendar day containing `now`, as UTC instants. */
export function dhakaDay(now = new Date()) {
  const local = new Date(now.getTime() + DHAKA_MS);
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - DHAKA_MS);
  return { start, end: new Date(start.getTime() + 86_400_000), date: local.toISOString().slice(0, 10), hour: local.getUTCHours() };
}

export type SummaryData = { date: string; sales: number; orders: number; profit: number | null; returns: number; codPending: number; codOverdue: number; lowStock: { name: string; available: number }[] };

export async function summaryData(tx: Tx, role: Role, now = new Date()): Promise<SummaryData> {
  const { start, end, date } = dhakaDay(now);
  const { orders, orderLines, orderEvents, variants, products, payments } = schema;
  const sold = and(gte(orders.createdAt, start), lt(orders.createdAt, end), ne(orders.status, "draft"), ne(orders.status, "cancelled"));
  const [agg] = await tx.select({ n: sql<number>`count(*)::int`, sales: sql<number>`coalesce(sum(${orders.total} - ${orders.deliveryCharge}), 0)::float` }).from(orders).where(sold);
  let profit: number | null = null;
  if (can(role, "view_cost")) {
    const [p] = await tx
      .select({ p: sql<number>`coalesce(sum((${orderLines.qty} - ${orderLines.returnedQty}) * (${orderLines.price} - ${orderLines.cost}) - ${orderLines.discount}), 0)::float` })
      .from(orderLines)
      .innerJoin(orders, and(eq(orders.id, orderLines.orderId), eq(orders.businessId, orderLines.businessId)))
      .where(sold);
    profit = Math.round(p.p);
  }
  const [ret] = await tx
    .select({ n: sql<number>`count(distinct ${orderEvents.orderId})::int` })
    .from(orderEvents)
    .where(and(gte(orderEvents.at, start), lt(orderEvents.at, end), inArray(orderEvents.toStatus, ["returned", "partially_returned"])));
  const paid = sql`coalesce((select sum(${payments.amount}) from ${payments} where ${payments.orderId} = ${orders.id} and ${payments.businessId} = ${orders.businessId}), 0)`;
  const codRows = await tx
    .select({ due: sql<number>`(${orders.total} - ${paid})::float`, updatedAt: orders.updatedAt })
    .from(orders)
    .where(and(eq(orders.status, "delivered"), eq(orders.settlement, "cod"), isNull(orders.codReceived)));
  const overdueBefore = new Date(now.getTime() - 5 * 86_400_000);
  const low = await tx
    .select({ name: products.name, options: variants.options, available: sql<number>`(${variants.onHand} - ${variants.reserved})::int` })
    .from(variants)
    .innerJoin(products, and(eq(products.id, variants.productId), eq(products.businessId, variants.businessId)))
    .where(and(eq(variants.active, true), eq(products.status, "active"), sql`${variants.onHand} - ${variants.reserved} <= ${variants.lowStock}`))
    .orderBy(sql`${variants.onHand} - ${variants.reserved}`)
    .limit(5);
  return {
    date,
    sales: Math.round(agg.sales),
    orders: agg.n,
    profit,
    returns: ret.n,
    codPending: Math.round(codRows.reduce((s, r) => s + Math.max(0, r.due), 0)),
    codOverdue: Math.round(codRows.filter((r) => r.updatedAt < overdueBefore).reduce((s, r) => s + Math.max(0, r.due), 0)),
    lowStock: low.map((l) => ({ name: [l.name, Object.values(l.options).join(" / ")].filter(Boolean).join(" "), available: l.available })),
  };
}

const money = (n: number, bn: boolean) => {
  const s = `৳${new Intl.NumberFormat("en-IN").format(n)}`;
  return bn ? toBanglaDigits(s) : s;
};

export function composeSummary(d: SummaryData, shop: string, lang: "en" | "bn", opts: { lowStock?: boolean } = {}) {
  const bn = lang === "bn";
  const n = (x: number) => (bn ? toBanglaDigits(String(x)) : String(x));
  const lines = bn
    ? [`${shop} — আজকের হিসাব`, `বিক্রি ${money(d.sales, true)} · ${n(d.orders)}টি অর্ডার`]
    : [`${shop} — today`, `Sales ${money(d.sales, false)} · ${d.orders} ${d.orders === 1 ? "order" : "orders"}`];
  if (d.profit !== null) lines.push(bn ? `মোট লাভ ${money(d.profit, true)}` : `Gross profit ${money(d.profit, false)}`);
  if (d.returns) lines.push(bn ? `ফেরত ${n(d.returns)}টি` : `${d.returns} ${d.returns === 1 ? "return" : "returns"}`);
  if (d.codPending) lines.push(bn ? `কুরিয়ারের কাছে ${money(d.codPending, true)}${d.codOverdue ? ` (দেরি ${money(d.codOverdue, true)})` : ""}` : `With couriers ${money(d.codPending, false)}${d.codOverdue ? ` (${money(d.codOverdue, false)} overdue)` : ""}`);
  if (opts.lowStock !== false && d.lowStock.length) {
    const items = d.lowStock.slice(0, 3).map((l) => `${l.name} (${n(Math.max(0, l.available))})`).join(", ");
    lines.push(bn ? `স্টক কম: ${items}` : `Low stock: ${items}`);
  }
  const title = lines[0];
  return { title, body: lines.slice(1).join("\n"), text: lines.join("\n") };
}

/** Hourly cron: sends each user's summary at their chosen Dhaka hour, once per day. */
export async function runDailySummaries(now = new Date()) {
  const { date, hour } = dhakaDay(now);
  // System job: read prefs across businesses with the owner connection.
  const due = await db
    .select({ p: notificationPrefs, role: schema.memberships.role, phone: schema.users.phone, shop: schema.businesses.name })
    .from(notificationPrefs)
    .innerJoin(schema.memberships, and(eq(schema.memberships.businessId, notificationPrefs.businessId), eq(schema.memberships.userId, notificationPrefs.userId), eq(schema.memberships.status, "active")))
    .innerJoin(schema.users, eq(schema.users.id, notificationPrefs.userId))
    .innerJoin(schema.businesses, eq(schema.businesses.id, notificationPrefs.businessId))
    .where(and(eq(notificationPrefs.dailySummary, true), eq(notificationPrefs.summaryHour, hour), sql`coalesce(${notificationPrefs.lastSummaryDate}, '') <> ${date}`));
  let sent = 0;
  for (const row of due) {
    const { p } = row;
    const role = row.role as Role;
    const data = await withTenant(p.businessId, (tx) => summaryData(tx, role, now));
    const msg = composeSummary(data, row.shop, p.lang === "en" ? "en" : "bn", { lowStock: p.lowStockDigest });
    if (p.via === "push" || p.via === "both") {
      const r = await notifyUsers(p.businessId, "summary", { title: msg.title, body: msg.body, url: "/dashboard", tag: `summary-${date}` }, { userIds: [p.userId] });
      if (r.sent) sent++;
      if (data.codOverdue > 0)
        await notifyUsers(p.businessId, "cod_overdue", { title: p.lang === "en" ? "COD payout overdue" : "COD টাকা আসতে দেরি", body: money(data.codOverdue, p.lang !== "en"), url: "/money?tab=cod", tag: `cod-${date}` }, { userIds: [p.userId] });
    }
    if (p.via === "sms" || p.via === "both") {
      const parts = smsParts(msg.text);
      const enough = await withTenant(p.businessId, async (tx) => (await creditBalance(tx)) >= parts);
      if (enough) {
        const r = await sendSms(row.phone, msg.text);
        if (r.ok) {
          sent++;
          await withTenant(p.businessId, (tx) => tx.insert(smsCredits).values({ businessId: p.businessId, delta: -parts, reason: "sent", ref: `summary ${date}` }));
        }
      }
    }
    await db.update(notificationPrefs).set({ lastSummaryDate: date }).where(and(eq(notificationPrefs.businessId, p.businessId), eq(notificationPrefs.userId, p.userId)));
  }
  return { date, hour, considered: due.length, sent };
}
