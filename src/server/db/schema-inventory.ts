/**
 * Tables for the "inventory" feature area: stock locations, purchase orders,
 * quotations and recurring expense templates. The SQL (with RLS) lives in
 * migrations/0005_inventory.sql.
 */
import { boolean, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const locations = pgTable(
  "locations",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    nameBn: text("name_bn").notNull().default(""),
    isDefault: boolean("is_default").notNull().default(false),
    active: boolean("active").notNull().default(true),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] })],
);

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    no: text("no").notNull(),
    supplierId: text("supplier_id"),
    status: text("status").notNull(),
    lines: jsonb("lines").$type<{ variantId: string; productId: string; qty: number; received: number; unitCost: number }[]>().notNull(),
    expectedAt: ts("expected_at"),
    locationId: text("location_id"),
    note: text("note"),
    history: jsonb("history").$type<{ at: string; by: string; note: string }[]>().notNull().default([]),
    createdBy: text("created_by").notNull(),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] })],
);

export const quotes = pgTable(
  "quotes",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    no: text("no").notNull(),
    status: text("status").notNull(),
    customer: jsonb("customer").$type<Record<string, unknown> | null>(),
    channel: text("channel").notNull(),
    lines: jsonb("lines").$type<unknown[]>().notNull(),
    discount: jsonb("discount").$type<{ type: "flat" | "pct"; value: number }>().notNull(),
    deliveryCharge: money("delivery_charge").notNull().default(0),
    validUntil: text("valid_until").notNull(),
    notes: text("notes"),
    orderId: text("order_id"),
    createdBy: text("created_by").notNull(),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] })],
);

export const recurringExpenses = pgTable(
  "recurring_expenses",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    category: text("category").notNull(),
    amount: money("amount").notNull(),
    method: text("method").notNull(),
    note: text("note"),
    dayOfMonth: integer("day_of_month").notNull(),
    lastRun: text("last_run"),
    active: boolean("active").notNull().default(true),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] })],
);
