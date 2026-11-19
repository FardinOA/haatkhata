import "server-only";
/**
 * Subscription billing (FR-SUB-01..05): usage against limits, checkout,
 * activation with VAT receipt numbers, referral credits, renewals and
 * downgrades. Payment state changes run on the owner connection because
 * gateway callbacks arrive without a signed-in user.
 */
import { randomBytes } from "node:crypto";
import { and, desc, eq, gte, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { db, schema } from "../db";
import * as billing from "../db/schema-billing";
import { HttpError } from "../http";
import { sendSms } from "../integrations/sms";
import { gatewayFor, type CheckoutMethod } from "../integrations/billing";
import { EXPIRED_PLAN, effectivePlan, isPaidPlan, jsonLimit, PLANS, quote, usageLevel, vatPct, type PlanId, type Term } from "./plans";

const { businesses, orders, products, memberships, notices, users } = schema;
const { subscriptionPayments, referralCredits } = billing;

const id = (p: string) => `${p}${randomBytes(9).toString("base64url")}`;
const DAY = 86_400_000;
/** Paid plans keep working this long after the renewal date before they lapse. */
export const GRACE_DAYS = 3;

function monthStart(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function counts(businessId: string) {
  const [[o], [p], [m]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.businessId, businessId), gte(orders.createdAt, monthStart()), ne(orders.status, "draft"))),
    db.select({ n: sql<number>`count(*)::int` }).from(products).where(eq(products.businessId, businessId)),
    db.select({ n: sql<number>`count(*)::int` }).from(memberships).where(and(eq(memberships.businessId, businessId), inArray(memberships.status, ["active", "invited"]))),
  ]);
  return { orders: o.n, products: p.n, staff: m.n };
}

export async function getUsage(businessId: string) {
  const [b] = await db.select().from(businesses).where(eq(businesses.id, businessId));
  if (!b) throw new HttpError(404, "Business not found");
  const plan = effectivePlan(b.plan);
  const c = await counts(businessId);
  const now = Date.now();
  const credits = await db.select().from(referralCredits).where(and(eq(referralCredits.businessId, businessId), isNull(referralCredits.usedAt)));
  const payments = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.businessId, businessId)).orderBy(desc(subscriptionPayments.createdAt)).limit(24);
  const meter = (used: number, limit: number) => ({ used, limit: jsonLimit(limit), level: usageLevel(used, limit) });
  const ends = b.plan === "trial" ? b.trialEndsAt : b.planRenewsAt;
  return {
    plan: b.plan,
    effective: plan.id,
    planName: b.plan === "trial" ? `${plan.name} trial` : plan.name,
    features: plan.features,
    trial: b.plan === "trial" ? { endsAt: b.trialEndsAt?.toISOString(), daysLeft: b.trialEndsAt ? Math.max(0, Math.ceil((b.trialEndsAt.getTime() - now) / DAY)) : 0 } : null,
    renewsAt: isPaidPlan(b.plan) ? b.planRenewsAt?.toISOString() : null,
    daysLeft: ends ? Math.ceil((ends.getTime() - now) / DAY) : null,
    usage: { orders: meter(c.orders, plan.limits.ordersPerMonth), products: meter(c.products, plan.limits.products), staff: meter(c.staff, plan.limits.staff) },
    referral: { code: b.referralCode, credits: credits.reduce((s, x) => s + x.months, 0), referredBy: !!b.referredBy },
    vatPct: vatPct(),
    payments: payments.map((p) => ({ id: p.id, plan: p.plan, term: p.term, months: p.months, creditMonths: p.creditMonths, amount: p.amount, vatAmount: p.vatAmount, status: p.status, method: p.method, invoiceNo: p.invoiceNo, createdAt: p.createdAt.toISOString(), paidAt: p.paidAt?.toISOString() ?? null, periodEnd: p.periodEnd?.toISOString() ?? null })),
  };
}

export async function startCheckout(input: { businessId: string; userId: string; plan: PlanId; term: Term; method: CheckoutMethod; origin: string }) {
  if (!isPaidPlan(input.plan)) throw new HttpError(400, "Pick Starter, Business or Pro");
  const [b] = await db.select().from(businesses).where(eq(businesses.id, input.businessId));
  const [u] = await db.select().from(users).where(eq(users.id, input.userId));
  const q = quote(input.plan, input.term);
  const gateway = gatewayFor(input.method);
  const paymentId = id("sp_");
  await db.insert(subscriptionPayments).values({
    businessId: input.businessId,
    id: paymentId,
    plan: input.plan,
    term: input.term,
    months: q.months,
    amount: q.total,
    vatPct: q.vatPct,
    vatAmount: q.vatAmount,
    gateway: gateway.id,
    method: input.method,
    createdBy: input.userId,
  });
  const app = (process.env.APP_URL ?? input.origin).replace(/\/$/, "");
  const start = await gateway.create({
    paymentId,
    amount: q.total,
    description: `HaatKhata ${q.plan.name} — ${q.months} month${q.months > 1 ? "s" : ""} (${b.name})`,
    customer: { name: u?.name || b.name, phone: u?.phone ?? b.phone, email: b.email || undefined },
    urls: {
      success: `${app}/api/billing/return/sslcommerz`,
      fail: `${app}/api/billing/return/sslcommerz`,
      cancel: `${app}/api/billing/return/sslcommerz`,
      ipn: `${app}/api/billing/ipn/sslcommerz`,
      callback: `${app}/api/billing/return/bkash`,
      sandbox: `${app}/api/billing/sandbox`,
    },
  });
  if (start.ref) await db.update(subscriptionPayments).set({ gatewayRef: start.ref }).where(eq(subscriptionPayments.id, paymentId));
  return { paymentId, redirectUrl: start.redirectUrl, gateway: gateway.id };
}

export async function findPayment(paymentId: string) {
  const [p] = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.id, paymentId));
  return p ?? null;
}

async function nextInvoiceNo() {
  const r = await db.execute(sql`select nextval('billing_invoice_seq')::int as n`);
  const n = (r.rows[0] as { n: number }).n;
  return `BK-${new Date().getFullYear()}-${String(n).padStart(6, "0")}`;
}

/**
 * Marks a payment paid and activates the plan. Idempotent: gateways retry
 * callbacks, and the IPN and the browser return can both arrive.
 */
export async function completePayment(paymentId: string, evidence: { amount?: number; ref?: string; payload?: Record<string, unknown> }) {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(subscriptionPayments).where(eq(subscriptionPayments.id, paymentId)).for("update");
    if (!p) throw new HttpError(404, "Payment not found");
    if (p.status === "paid") return p;
    if (evidence.amount !== undefined && Math.abs(evidence.amount - p.amount) > 0.5) throw new HttpError(400, "Paid amount doesn't match");
    const [b] = await tx.select().from(businesses).where(eq(businesses.id, p.businessId)).for("update");
    const now = new Date();

    // Bonus months earned through referrals are added to this period.
    const credits = await tx.select().from(referralCredits).where(and(eq(referralCredits.businessId, p.businessId), isNull(referralCredits.usedAt)));
    const creditMonths = credits.reduce((s, c) => s + c.months, 0);
    if (credits.length) await tx.update(referralCredits).set({ usedAt: now, usedPaymentId: p.id }).where(and(eq(referralCredits.businessId, p.businessId), isNull(referralCredits.usedAt)));

    // Renewing the same plan early extends from the current end date.
    const extendFrom = b.plan === p.plan && b.planRenewsAt && b.planRenewsAt > now ? b.planRenewsAt : now;
    const end = new Date(extendFrom);
    end.setMonth(end.getMonth() + p.months + creditMonths);
    const plan = PLANS[p.plan as PlanId];
    const invoiceNo = await nextInvoiceNo();
    const [paid] = await tx
      .update(subscriptionPayments)
      .set({ status: "paid", paidAt: now, invoiceNo, creditMonths, periodStart: extendFrom, periodEnd: end, gatewayRef: evidence.ref ?? p.gatewayRef, gatewayPayload: evidence.payload ?? null })
      .where(eq(subscriptionPayments.id, p.id))
      .returning();
    await tx.update(businesses).set({ plan: p.plan, planOrderLimit: plan.limits.ordersPerMonth, planRenewsAt: end, trialEndsAt: null, updatedAt: now }).where(eq(businesses.id, p.businessId));

    // First paid month of a referred business: one bonus month for both sides (FR-SUB-05).
    if (b.referredBy) {
      const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(subscriptionPayments).where(and(eq(subscriptionPayments.businessId, p.businessId), eq(subscriptionPayments.status, "paid")));
      const [already] = await tx.select().from(referralCredits).where(and(eq(referralCredits.businessId, b.referredBy), eq(referralCredits.sourceBusinessId, p.businessId)));
      if (n === 1 && !already) {
        await tx.insert(referralCredits).values([
          { businessId: b.referredBy, id: id("rc_"), months: 1, reason: "referrer", sourceBusinessId: p.businessId },
          { businessId: p.businessId, id: id("rc_"), months: 1, reason: "referred", sourceBusinessId: b.referredBy },
        ]);
        await tx.insert(notices).values({ businessId: b.referredBy, id: id("n_"), kind: "plan", title: `${b.name} joined with your code — you earned a bonus month`, body: "It's added to your next payment automatically.", href: "/settings?tab=plan", at: now });
      }
    }
    await tx.insert(notices).values({ businessId: p.businessId, id: id("n_"), kind: "plan", title: `${plan.name} plan is active until ${end.toDateString().slice(4)}`, body: `Receipt ${invoiceNo}`, href: "/settings?tab=plan", at: now });
    return paid;
  });
}

export async function failPayment(paymentId: string, status: "failed" | "cancelled", payload?: Record<string, unknown>) {
  await db
    .update(subscriptionPayments)
    .set({ status, gatewayPayload: payload ?? null })
    .where(and(eq(subscriptionPayments.id, paymentId), eq(subscriptionPayments.status, "pending")));
}

/** Apply someone's referral code after sign-up (within 30 days, once). */
export async function applyReferral(businessId: string, code: string) {
  const [b] = await db.select().from(businesses).where(eq(businesses.id, businessId));
  if (b.referredBy) throw new HttpError(409, "A referral code is already applied");
  if (Date.now() - b.createdAt.getTime() > 30 * DAY) throw new HttpError(400, "Referral codes can be added in your first 30 days");
  const [ref] = await db.select({ id: businesses.id, name: businesses.name }).from(businesses).where(eq(businesses.referralCode, code.trim().toUpperCase()));
  if (!ref || ref.id === businessId) throw new HttpError(404, "That code doesn't match any shop");
  await db.update(businesses).set({ referredBy: ref.id, updatedAt: new Date() }).where(eq(businesses.id, businessId));
  return { referrer: ref.name };
}

/**
 * Daily housekeeping (call from a scheduler via /api/billing/cron):
 * renewal reminders 7 and 1 days ahead, then lapse unpaid plans.
 * Data is never deleted by a lapse and stays readable (FR-SUB-02).
 */
export async function runBillingHousekeeping(now = new Date()) {
  const soon = new Date(now.getTime() + 7 * DAY + DAY);
  const due = await db
    .select()
    .from(businesses)
    .where(and(inArray(businesses.plan, ["starter", "business", "pro"]), lt(businesses.planRenewsAt, soon)));
  let reminded = 0;
  let downgraded = 0;
  for (const b of due) {
    if (!b.planRenewsAt) continue;
    const daysLeft = Math.ceil((b.planRenewsAt.getTime() - now.getTime()) / DAY);
    if (daysLeft < -GRACE_DAYS) {
      await db.update(businesses).set({ plan: "expired", planOrderLimit: EXPIRED_PLAN.limits.ordersPerMonth, updatedAt: now }).where(eq(businesses.id, b.id));
      await db.insert(notices).values({ businessId: b.id, id: id("n_"), kind: "plan", title: "Your plan ended — new orders are paused", body: "Everything you recorded is still here. Renew to keep selling and printing.", href: "/settings?tab=plan", at: now });
      downgraded++;
      continue;
    }
    for (const mark of [7, 1]) {
      if (daysLeft !== mark) continue;
      const key = `n_renew_${b.id}_${b.planRenewsAt.toISOString().slice(0, 10)}_${mark}`;
      const inserted = await db
        .insert(notices)
        .values({ businessId: b.id, id: key, kind: "plan", title: `${effectivePlan(b.plan).name} plan renews in ${mark} day${mark > 1 ? "s" : ""}`, body: "Pay with bKash, Nagad or card from Settings → Plan & billing.", href: "/settings?tab=plan", at: now })
        .onConflictDoNothing()
        .returning();
      if (inserted.length && b.phone) {
        await sendSms(b.phone, `HaatKhata: your ${effectivePlan(b.plan).name} plan renews in ${mark} day${mark > 1 ? "s" : ""}. Renew from Settings to keep your limits.`);
        reminded++;
      }
    }
  }
  return { reminded, downgraded };
}

/** Paid plans lapse after the grace period (checked on each request, like the trial). */
export async function expireLapsedPlan(businessId: string) {
  await db
    .update(businesses)
    .set({ plan: "expired", planOrderLimit: EXPIRED_PLAN.limits.ordersPerMonth, updatedAt: new Date() })
    .where(and(eq(businesses.id, businessId), inArray(businesses.plan, ["starter", "business", "pro"]), sql`${businesses.planRenewsAt} < now() - make_interval(days => ${GRACE_DAYS})`));
}
