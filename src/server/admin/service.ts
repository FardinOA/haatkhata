import "server-only";
/**
 * Internal super-admin console (FR-ADM-01). Runs on the owner connection
 * (across tenants) and records every action with its reason.
 */
import { randomBytes } from "node:crypto";
import { and, desc, eq, gte, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { adminActions, announcements, printQuota, subscriptionPayments } from "../db/schema-billing";
import { aiUsage, smsCredits, smsLog } from "../db/schema-platform";
import { AI_CREDITS, currentMonth } from "../ai/parse-order";
import { counts } from "../billing/service";
import { EXPIRED_PLAN, effectivePlan, isPaidPlan, PLAN_ORDER, PLANS, type PlanId, type StoredPlan } from "../billing/plans";
import { printLimit } from "../billing/print-quota";
import { HttpError } from "../http";
import { readHandoff, requestOtp, signHandoff, type AuthContext } from "../auth/session";
import { normalizePhone } from "@/lib/domain";

const { businesses, memberships, users, orders, commandLog, auditLog, otpCodes } = schema;
const DAY = 86_400_000;

/**
 * What the platform pays per unit, for the running-cost estimate. Haiku 5.5 list
 * prices (US$ per million tokens), the business plan's ৳122 = $1, and a typical
 * non-masked OTP rate. Customer SMS isn't here: shops prepay it as credits.
 */
export const UNIT_COST = { aiInputPerMTok: 0.1, aiOutputPerMTok: 0.5, bdtPerUsd: 122, otpSms: 0.35 };

/** Start of the current month in Dhaka, matching how ai_usage counts months. */
const monthStart = (now: Date) => new Date(`${currentMonth(now)}-01T00:00:00+06:00`);
export function requireSuperAdmin(auth: AuthContext | null): asserts auth is AuthContext {
  if (!auth) throw new HttpError(401, "Please sign in");
  // While impersonating, the session belongs to the shop owner — admin tools stay off.
  if (!auth.user.isSuperAdmin || auth.impersonatedBy) throw new HttpError(403, "This area is for HaatKhata staff only");
}

/**
 * Sign-in codes for the admin console go only to staff numbers. Anyone else
 * gets the same answer and no SMS, so the form says nothing about who is staff
 * and can't be used to run up the SMS bill.
 */
export async function requestAdminOtp(rawPhone: string, ip: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new HttpError(400, "Enter a Bangladeshi mobile number like 017XXXXXXXX");
  const [u] = await db.select({ isSuperAdmin: users.isSuperAdmin }).from(users).where(eq(users.phone, phone));
  if (!u?.isSuperAdmin) return { phone, devCode: undefined };
  return requestOtp(phone, ip);
}

/** A ticket that opens this shop as its owner in the shop app, logged with the reason. */
export async function startImpersonation(adminUserId: string, businessId: string, reason: string) {
  const owner = await impersonationTarget(adminUserId, businessId, reason);
  return signHandoff({ owner, admin: adminUserId, business: businessId });
}

/**
 * The shop app redeems a ticket once: it must be signed, unexpired, unused,
 * and its admin must still be staff. Returns who to sign in as.
 */
export async function claimImpersonation(ticket: string) {
  const t = readHandoff(ticket);
  if (!t) throw new HttpError(400, "This link has expired. Start again from the admin console.");
  const [admin] = await db.select({ isSuperAdmin: users.isSuperAdmin }).from(users).where(eq(users.id, t.admin));
  if (!admin?.isSuperAdmin) throw new HttpError(403, "This area is for HaatKhata staff only");
  const used = await db.select({ id: adminActions.id }).from(adminActions).where(and(eq(adminActions.action, "impersonate.claim"), sql`${adminActions.details}->>'nonce' = ${t.nonce}`));
  if (used.length) throw new HttpError(400, "This link has already been used. Start again from the admin console.");
  await logAdmin(t.admin, "impersonate.claim", t.business, null, { nonce: t.nonce, ownerUserId: t.owner });
  return t;
}

export async function logAdmin(adminUserId: string, action: string, businessId: string | null, reason: string | null, details?: Record<string, unknown>) {
  await db.insert(adminActions).values({ adminUserId, action, businessId, reason, details });
}

export async function overview(now = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const month = currentMonth(now);
  const since = monthStart(now);
  const [[tenants], [active], [trials], planRows, weeks, mrrRows, [signups], [ai], [otp], [sms], size] = await Promise.all([
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
    db.select({ reads: sql<number>`coalesce(sum(${aiUsage.requests}), 0)::int`, input: sql<number>`coalesce(sum(${aiUsage.inputTokens}), 0)::float`, output: sql<number>`coalesce(sum(${aiUsage.outputTokens}), 0)::float` }).from(aiUsage).where(eq(aiUsage.month, month)),
    db.select({ n: sql<number>`count(*)::int` }).from(otpCodes).where(gte(otpCodes.createdAt, since)),
    db.select({ parts: sql<number>`coalesce(sum(${smsLog.parts}), 0)::int` }).from(smsLog).where(and(eq(smsLog.status, "sent"), gte(smsLog.at, since))),
    db.execute(sql`select pg_database_size(current_database())::float as bytes`),
  ]);
  const aiUsd = (ai.input * UNIT_COST.aiInputPerMTok + ai.output * UNIT_COST.aiOutputPerMTok) / 1e6;
  return {
    tenants: tenants.n,
    activeThisWeek: active.n,
    trials: trials.n,
    signupsThisWeek: signups.n,
    plans: Object.fromEntries(planRows.map((r) => [r.plan, r.n])),
    ordersPerWeek: (weeks.rows as { week: string; n: number }[]).map((r) => ({ week: new Date(r.week).toISOString(), n: r.n })),
    mrr: Math.round((mrrRows.rows[0] as { mrr: number }).mrr),
    costs: {
      month,
      aiReads: ai.reads,
      aiBdt: Math.round(aiUsd * UNIT_COST.bdtPerUsd),
      otpTexts: otp.n,
      otpBdt: Math.round(otp.n * UNIT_COST.otpSms),
      customerSms: sms.parts,
      dbBytes: (size.rows[0] as { bytes: number }).bytes,
    },
  };
}

/** Lists to work through: who needs a nudge, who is about to pay, who is slipping away. */
export const SEGMENTS = ["all", "trial_ending", "never_ordered", "paying", "going_quiet"] as const;
export type Segment = (typeof SEGMENTS)[number];

function segmentWhere(segment: Segment, now: Date) {
  const hasOrders = sql`exists (select 1 from orders o where o.business_id = ${businesses.id} and o.status <> 'draft')`;
  const recentlyActive = sql`exists (select 1 from command_log c where c.business_id = ${businesses.id} and c.applied_at > ${new Date(now.getTime() - 7 * DAY)})`;
  switch (segment) {
    case "trial_ending":
      return and(eq(businesses.plan, "trial"), sql`${businesses.trialEndsAt} < ${new Date(now.getTime() + 3 * DAY)}`);
    case "never_ordered":
      return and(sql`not ${hasOrders}`, sql`${businesses.createdAt} < ${new Date(now.getTime() - DAY)}`);
    case "paying":
      return inArray(businesses.plan, PLAN_ORDER);
    case "going_quiet":
      return and(inArray(businesses.plan, PLAN_ORDER), sql`not ${recentlyActive}`);
    default:
      return undefined;
  }
}

/** How many shops are in each work list right now, for the overview's "needs attention" queue. */
export async function segmentCounts(now = new Date()) {
  const lists = SEGMENTS.filter((x): x is Exclude<Segment, "all"> => x !== "all");
  const rows = await Promise.all(lists.map((seg) => db.select({ n: sql<number>`count(*)::int` }).from(businesses).where(segmentWhere(seg, now))));
  return Object.fromEntries(lists.map((seg, i) => [seg, rows[i][0].n])) as Record<Exclude<Segment, "all">, number>;
}

export async function searchBusinesses(q: string, segment: Segment = "all", now = new Date()) {
  const term = q.trim();
  const ownerPhones = term.replace(/\D/g, "").length >= 4 ? await db.select({ b: memberships.businessId }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(ilike(users.phone, `%${term.replace(/\D/g, "")}%`)) : [];
  const where = term
    ? or(ilike(businesses.name, `%${term}%`), eq(businesses.id, term), eq(businesses.referralCode, term.toUpperCase()), ownerPhones.length ? inArray(businesses.id, ownerPhones.map((r) => r.b)) : undefined)
    : undefined;
  const rows = await db.select().from(businesses).where(and(where, segmentWhere(segment, now))).orderBy(desc(businesses.createdAt)).limit(50);
  const ids = rows.map((r) => r.id);
  const [orderCounts, lastSeen] = ids.length
    ? await Promise.all([
        db
          .select({ b: orders.businessId, n: sql<number>`count(*)::int` })
          .from(orders)
          .where(and(inArray(orders.businessId, ids), gte(orders.createdAt, new Date(now.getTime() - 30 * DAY)), ne(orders.status, "draft")))
          .groupBy(orders.businessId),
        db.select({ b: commandLog.businessId, at: sql<Date>`max(${commandLog.appliedAt})` }).from(commandLog).where(inArray(commandLog.businessId, ids)).groupBy(commandLog.businessId),
      ])
    : [[], []];
  const byId = new Map(orderCounts.map((r) => [r.b, r.n]));
  const seenById = new Map(lastSeen.map((r) => [r.b, new Date(r.at).toISOString()]));
  return rows.map((b) => ({
    id: b.id,
    name: b.name,
    phone: b.phone,
    plan: b.plan,
    createdAt: b.createdAt.toISOString(),
    orders30d: byId.get(b.id) ?? 0,
    lastActiveAt: seenById.get(b.id) ?? null,
    renewsAt: (b.plan === "trial" ? b.trialEndsAt : b.planRenewsAt)?.toISOString() ?? null,
  }));
}

export async function businessDetail(businessId: string) {
  const [b] = await db.select().from(businesses).where(eq(businesses.id, businessId));
  if (!b) throw new HttpError(404, "Business not found");
  const month = currentMonth();
  const [members, usage, activity, audit, payments, actions, [prints], [ai], [sms], [credits]] = await Promise.all([
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
    db.select().from(aiUsage).where(and(eq(aiUsage.businessId, businessId), eq(aiUsage.month, month))),
    db.select({ parts: sql<number>`coalesce(sum(${smsLog.parts}), 0)::int` }).from(smsLog).where(and(eq(smsLog.businessId, businessId), eq(smsLog.status, "sent"), gte(smsLog.at, monthStart(new Date())))),
    db.select({ balance: sql<number>`coalesce(sum(${smsCredits.delta}), 0)::int` }).from(smsCredits).where(eq(smsCredits.businessId, businessId)),
  ]);
  const plan = effectivePlan(b.plan);
  return {
    business: { id: b.id, name: b.name, phone: b.phone, address: b.address, plan: b.plan, planName: plan.name, renewsAt: b.planRenewsAt?.toISOString() ?? null, trialEndsAt: b.trialEndsAt?.toISOString() ?? null, createdAt: b.createdAt.toISOString(), referralCode: b.referralCode, logo: b.logo },
    limits: plan.limits,
    usage,
    prints: isPaidPlan(b.plan) ? null : { used: prints.n, limit: printLimit() },
    ai: { used: ai?.requests ?? 0, limit: AI_CREDITS[b.plan as StoredPlan] ?? 0 },
    sms: { sentThisMonth: sms.parts, balance: credits.balance },
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

