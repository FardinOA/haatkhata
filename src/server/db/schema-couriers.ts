/**
 * Tables for couriers, payouts and payment links (SQL: migrations/0004_couriers.sql).
 * Every table is tenant-scoped by business_id with row-level security.
 */
import { boolean, jsonb, numeric, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const courierAccounts = pgTable(
  "courier_accounts",
  {
    businessId: text("business_id").notNull(),
    provider: text("provider").notNull(),
    credentialsEnc: text("credentials_enc").notNull(),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    webhookKey: text("webhook_key").notNull().unique(),
    status: text("status").notNull().default("connected"),
    lastCheckedAt: ts("last_checked_at"),
    lastError: text("last_error"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.provider] })],
);

export const courierPrefs = pgTable("courier_prefs", {
  businessId: text("business_id").primaryKey(),
  defaultProvider: text("default_provider"),
  pickup: jsonb("pickup").$type<{ name?: string; phone?: string; address?: string; district?: string }>().notNull().default({}),
  advanceOnHighRisk: boolean("advance_on_high_risk").notNull().default(true),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const consignments = pgTable(
  "consignments",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    orderId: text("order_id").notNull(),
    provider: text("provider").notNull(),
    consignmentId: text("consignment_id").notNull(),
    trackingCode: text("tracking_code"),
    rawStatus: text("raw_status"),
    status: text("status").notNull().default("booked"),
    fee: money("fee"),
    codAmount: money("cod_amount").notNull().default(0),
    district: text("district"),
    history: jsonb("history").$type<{ at: string; status: string; raw?: string }[]>().notNull().default([]),
    bookedAt: ts("booked_at").notNull().defaultNow(),
    lastStatusAt: ts("last_status_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] })],
);

export const paymentLinks = pgTable(
  "payment_links",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    orderId: text("order_id").notNull(),
    token: text("token").notNull().unique(),
    provider: text("provider").notNull(),
    amount: money("amount").notNull(),
    purpose: text("purpose").notNull().default("advance"),
    status: text("status").notNull().default("open"),
    providerRef: text("provider_ref"),
    trxId: text("trx_id"),
    createdBy: text("created_by").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    paidAt: ts("paid_at"),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] })],
);

export const paymentAccounts = pgTable(
  "payment_accounts",
  {
    businessId: text("business_id").notNull(),
    provider: text("provider").notNull(),
    credentialsEnc: text("credentials_enc").notNull(),
    status: text("status").notNull().default("connected"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.provider] })],
);

export const payoutImports = pgTable(
  "payout_imports",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    provider: text("provider").notNull(),
    fileName: text("file_name").notNull(),
    summary: jsonb("summary").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: text("created_by").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] })],
);
