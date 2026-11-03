/**
 * Tables for subscriptions, referrals, custom roles, admin and device PINs.
 * SQL lives in migrations/0008_billing.sql (idempotent).
 */
import { index, integer, jsonb, numeric, pgTable, primaryKey, serial, text, timestamp } from "drizzle-orm/pg-core";

const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** Owner-defined roles with granular permissions (FR-AUTH-06). */
export const customRoles = pgTable(
  "custom_roles",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    nameBn: text("name_bn"),
    permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
    maxDiscountPct: integer("max_discount_pct").notNull().default(15),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] })],
);

/** One checkout attempt for a plan; becomes the VAT receipt once paid (FR-SUB-03). */
export const subscriptionPayments = pgTable(
  "subscription_payments",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    plan: text("plan").notNull(),
    term: text("term").notNull(), // month | quarter | year
    months: integer("months").notNull(),
    creditMonths: integer("credit_months").notNull().default(0),
    amount: money("amount").notNull(), // VAT-inclusive total charged
    vatPct: money("vat_pct").notNull(),
    vatAmount: money("vat_amount").notNull(),
    gateway: text("gateway").notNull(), // sandbox | sslcommerz | bkash
    method: text("method").notNull(), // bkash | card | nagad …
    status: text("status").notNull().default("pending"), // pending | paid | failed | cancelled
    gatewayRef: text("gateway_ref"),
    gatewayPayload: jsonb("gateway_payload").$type<Record<string, unknown>>(),
    invoiceNo: text("invoice_no"),
    periodStart: ts("period_start"),
    periodEnd: ts("period_end"),
    createdBy: text("created_by").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    paidAt: ts("paid_at"),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] }), index("subpay_id_idx").on(t.id)],
);

/** Bonus months earned through referrals (FR-SUB-05). */
export const referralCredits = pgTable(
  "referral_credits",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    months: integer("months").notNull(),
    reason: text("reason").notNull(), // referred | referrer
    sourceBusinessId: text("source_business_id").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    usedAt: ts("used_at"),
    usedPaymentId: text("used_payment_id"),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] })],
);

/**
 * Orders whose invoices were printed while the shop had no paid plan (demo,
 * trial or lapsed). One row per bucket (`dev:` / `ip:` / `biz:`) and order, so
 * a reprint doesn't count again. Global table: owner connection only.
 */
export const printQuota = pgTable(
  "print_quota",
  {
    bucket: text("bucket").notNull(),
    orderKey: text("order_key").notNull(),
    businessId: text("business_id"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.bucket, t.orderKey] })],
);

/** Quick-unlock PIN for a signed-in device (FR-AUTH-08). One per session. */
export const sessionPins = pgTable("session_pins", {
  sessionId: text("session_id").primaryKey(),
  userId: text("user_id").notNull(),
  pinHash: text("pin_hash").notNull(),
  failed: integer("failed").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Everything a super-admin does is recorded with a reason (FR-ADM-01). */
export const adminActions = pgTable(
  "admin_actions",
  {
    id: serial("id").primaryKey(),
    adminUserId: text("admin_user_id").notNull(),
    action: text("action").notNull(),
    businessId: text("business_id"),
    reason: text("reason"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("admin_actions_at_idx").on(t.at)],
);

export const announcements = pgTable("announcements", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body"),
  href: text("href"),
  createdBy: text("created_by").notNull(),
  recipients: integer("recipients").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
});
