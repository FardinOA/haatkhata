import "server-only";
/**
 * Internal super-admin console (FR-ADM-01). Runs on the owner connection
 * (across tenants) and records every action with its reason.
 */
import { randomBytes } from "node:crypto";
import { and, desc, eq, gte, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { adminActions, announcements, printQuota, subscriptionPayments } from "../db/schema-billing";
import { counts } from "../billing/service";
import { EXPIRED_PLAN, effectivePlan, isPaidPlan, PLANS, type PlanId } from "../billing/plans";
import { printLimit } from "../billing/print-quota";
import { HttpError } from "../http";
import type { AuthContext } from "../auth/session";

const { businesses, memberships, users, orders, commandLog, auditLog } = schema;
const DAY = 86_400_000;

export function requireSuperAdmin(auth: AuthContext | null): asserts auth is AuthContext {
  if (!auth) throw new HttpError(401, "Please sign in");
  // While impersonating, the session belongs to the shop owner — admin tools stay off.
  if (!auth.user.isSuperAdmin || auth.impersonatedBy) throw new HttpError(403, "This area is for BechaKena staff only");
}

export async function logAdmin(adminUserId: string, action: string, businessId: string | null, reason: string | null, details?: Record<string, unknown>) {
  await db.insert(adminActions).values({ adminUserId, action, businessId, reason, details });
}

export async function overview(now = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const [[tenants], [active], [trials], planRows, weeks, mrrRows, [signups]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(businesses),
    db.select({ n: sql<number>`count(distinct ${orders.businessId})::int` }).from(orders).where(gte(orders.createdAt, weekAgo)),
    db.select({ n: sql<number>`count(*)::int` }).from(businesses).where(eq(businesses.plan, "trial")),
    db.select({ plan: businesses.plan, n: sql<number>`count(*)::int` }).from(businesses).groupBy(businesses.plan),
    db.execute(sql`
      select date_trunc('week', created_at) as week, count(*)::int as n
      from orders where status <> 'draft' and created_at > now() - interval '8 weeks'
      group by 1 order by 1`),
    // Monthly-equivalent of each business's latest paid period that's still running.
    db.execute(sql`
      select coalesce(sum(amount / nullif(months + credit_months, 0)), 0)::float as mrr
      from (select distinct on (business_id) amount, months, credit_months from subscription_payments
            where status = 'paid' and period_end > now() order by business_id, paid_at desc) p`),
    db.select({ n: sql<number>`count(*)::int` }).from(businesses).where(gte(businesses.createdAt, weekAgo)),
  ]);
  return {
    tenants: tenants.n,
    activeThisWeek: active.n,
    trials: trials.n,
    signupsThisWeek: signups.n,
    plans: Object.fromEntries(planRows.map((r) => [r.plan, r.n])),
    ordersPerWeek: (weeks.rows as { week: string; n: number }[]).map((r) => ({ week: new Date(r.week).toISOString(), n: r.n })),
    mrr: Math.round((mrrRows.rows[0] as { mrr: number }).mrr),
  };
}

export async function searchBusinesses(q: string) {
  const term = q.trim();
  const ownerPhones = term.replace(/\D/g, "").length >= 4 ? await db.select({ b: memberships.businessId }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(ilike(users.phone, `%${term.replace(/\D/g, "")}%`)) : [];
  const where = term
    ? or(ilike(businesses.name, `%${term}%`), eq(businesses.id, term), eq(businesses.referralCode, term.toUpperCase()), ownerPhones.length ? inArray(businesses.id, ownerPhones.map((r) => r.b)) : undefined)
    : undefined;
  const rows = await db.select().from(businesses).where(where).orderBy(desc(businesses.createdAt)).limit(50);
  const ids = rows.map((r) => r.id);
  const orderCounts = ids.length
    ? await db
        .select({ b: orders.businessId, n: sql<number>`count(*)::int` })
        .from(orders)
        .where(and(inArray(orders.businessId, ids), gte(orders.createdAt, new Date(Date.now() - 30 * DAY)), ne(orders.status, "draft")))
        .groupBy(orders.businessId)
    : [];
  const byId = new Map(orderCounts.map((r) => [r.b, r.n]));
  return rows.map((b) => ({ id: b.id, name: b.name, phone: b.phone, plan: b.plan, createdAt: b.createdAt.toISOString(), orders30d: byId.get(b.id) ?? 0, renewsAt: (b.plan === "trial" ? b.trialEndsAt : b.planRenewsAt)?.toISOString() ?? null }));
}

export async function businessDetail(businessId: string) {
  const [b] = await db.select().from(businesses).where(eq(businesses.id, businessId));
  if (!b) throw new HttpError(404, "Business not found");
  const [members, usage, activity, audit, payments, actions, [prints]] = await Promise.all([
    db
      .select({ userId: users.id, name: users.name, phone: users.phone, role: memberships.role, status: memberships.status })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.businessId, businessId)),
    counts(businessId),
    db.select({ id: commandLog.id, type: commandLog.type, status: commandLog.status, error: commandLog.error, at: commandLog.appliedAt }).from(commandLog).where(eq(commandLog.businessId, businessId)).orderBy(desc(commandLog.appliedAt)).limit(25),
    db.select().from(auditLog).where(eq(auditLog.businessId, businessId)).orderBy(desc(auditLog.at)).limit(15),
    db.select().from(subscriptionPayments).where(eq(subscriptionPayments.businessId, businessId)).orderBy(desc(subscriptionPayments.createdAt)).limit(12),
    db.select().from(adminActions).where(eq(adminActions.businessId, businessId)).orderBy(desc(adminActions.at)).limit(15),
    db.select({ n: sql<number>`count(*)::int` }).from(printQuota).where(eq(printQuota.bucket, `biz:${businessId}`)),
  ]);
  const plan = effectivePlan(b.plan);
  return {
    business: { id: b.id, name: b.name, phone: b.phone, address: b.address, plan: b.plan, planName: plan.name, renewsAt: b.planRenewsAt?.toISOString() ?? null, trialEndsAt: b.trialEndsAt?.toISOString() ?? null, createdAt: b.createdAt.toISOString(), referralCode: b.referralCode, logo: b.logo },
    limits: plan.limits,
    usage,
    prints: isPaidPlan(b.plan) ? null : { used: prints.n, limit: printLimit() },
    members,
    activity: activity.map((a) => ({ ...a, at: a.at.toISOString() })),
    audit: audit.map((a) => ({ id: a.id, action: a.action, user: a.userName, at: a.at.toISOString() })),
    payments: payments.map((p) => ({ id: p.id, plan: p.plan, amount: p.amount, status: p.status, invoiceNo: p.invoiceNo, at: (p.paidAt ?? p.createdAt).toISOString() })),
    adminActions: actions.map((a) => ({ id: a.id, action: a.action, reason: a.reason, at: a.at.toISOString(), details: a.details })),
  };
}

export async function overridePlan(adminUserId: string, businessId: string, plan: PlanId | "trial" | "expired", days: number, reason: string) {
  const until = new Date(Date.now() + days * DAY);
  const p = plan === "trial" ? PLANS.business : plan === "expired" ? EXPIRED_PLAN : PLANS[plan];
  await db
    .update(businesses)
    .set({ plan, planOrderLimit: p.limits.ordersPerMonth, planRenewsAt: plan === "trial" || plan === "expired" ? null : until, trialEndsAt: plan === "trial" ? until : null, updatedAt: new Date() })
    .where(eq(businesses.id, businessId));
  await logAdmin(adminUserId, "plan.override", businessId, reason, { plan, days });
}

/**
 * Support: give a shop its trial prints back (e.g. a shared carrier IP used
 * them up). Clears every bucket row this shop's prints wrote — shop, device and IP.
 */
export async function resetPrints(adminUserId: string, businessId: string, reason: string) {
  const cleared = await db.delete(printQuota).where(eq(printQuota.businessId, businessId)).returning({ bucket: printQuota.bucket });
  await logAdmin(adminUserId, "prints.reset", businessId, reason, { rows: cleared.length });
  return { cleared: cleared.length };
}

/** The owner whose session an admin borrows; logged with the reason. */
export async function impersonationTarget(adminUserId: string, businessId: string, reason: string) {
  const [owner] = await db.select({ userId: memberships.userId }).from(memberships).where(and(eq(memberships.businessId, businessId), eq(memberships.role, "owner"), eq(memberships.status, "active")));
  if (!owner) throw new HttpError(404, "This business has no active owner");
  await logAdmin(adminUserId, "impersonate.start", businessId, reason, { ownerUserId: owner.userId });
  return owner.userId;
}

export async function announce(adminUserId: string, title: string, body: string | null, href: string | null) {
  const annId = `an_${randomBytes(8).toString("base64url")}`;
  const r = await db.execute(sql`
    insert into notices (business_id, id, kind, title, body, href, read, at, updated_at)
    select id, ${annId} || '_' || id, 'plan', ${title}, ${body}, ${href}, false, now(), now() from businesses`);
  await db.insert(announcements).values({ id: annId, title, body, href, createdBy: adminUserId, recipients: r.rowCount ?? 0 });
  await logAdmin(adminUserId, "announce", null, null, { title, recipients: r.rowCount });
  return { id: annId, recipients: r.rowCount ?? 0 };
}

export async function listAnnouncements() {
  return db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(20);
}

