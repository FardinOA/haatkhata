/**
 * Relational schema (SRS §6). Every tenant table carries `business_id` and is
 * protected by Postgres row-level security (see migrations/0001_rls.sql).
 * Ids are text and generated on the device, so offline-created records keep
 * their identity when they sync.
 */
import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, numeric, pgTable, primaryKey, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const updatedAt = () => ts("updated_at").notNull().defaultNow();

/* ------------------------------------------------------------ global */

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull().default(""),
  email: text("email"),
  lang: text("lang").notNull().default("en"),
  numerals: text("numerals").notNull().default("latin"),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: serial("id").primaryKey(),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    ip: text("ip"),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: ts("expires_at").notNull(),
    consumedAt: ts("consumed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("otp_phone_idx").on(t.phone, t.createdAt)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: text("user_id").notNull(),
    businessId: text("business_id"),
    userAgent: text("user_agent"),
    ip: text("ip"),
    impersonatedBy: text("impersonated_by"),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    revokedAt: ts("revoked_at"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const businesses = pgTable("businesses", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameBn: text("name_bn").notNull().default(""),
  tagline: text("tagline").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  address: text("address").notNull().default(""),
  facebook: text("facebook").notNull().default(""),
  logo: text("logo"),
  logoShape: text("logo_shape").notNull().default("rounded"),
  businessType: text("business_type").notNull().default("online"),
  channels: jsonb("channels").$type<string[]>().notNull().default([]),
  theme: jsonb("theme").$type<Record<string, unknown>>().notNull().default({}),
  invoice: jsonb("invoice").$type<Record<string, unknown>>().notNull().default({}),
  pos: jsonb("pos").$type<Record<string, unknown>>().notNull().default({}),
  monthlyGoal: money("monthly_goal").notNull().default(0),
  plan: text("plan").notNull().default("trial"),
  planOrderLimit: integer("plan_order_limit").notNull().default(2500),
  planRenewsAt: ts("plan_renews_at"),
  trialEndsAt: ts("trial_ends_at"),
  referralCode: text("referral_code").unique(),
  referredBy: text("referred_by"),
  nextOrderNo: integer("next_order_no").notNull().default(1001),
  nextInvoiceNo: integer("next_invoice_no").notNull().default(1),
  nextPurchaseNo: integer("next_purchase_no").notNull().default(1),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: updatedAt(),
});

export const memberships = pgTable(
  "memberships",
  {
    businessId: text("business_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull(),
    color: text("color").notNull().default("#0E6B53"),
    status: text("status").notNull().default("active"), // active | invited | removed
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.userId] }), index("memberships_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------ catalogue & stock */

export const categories = pgTable(
  "categories",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    nameBn: text("name_bn").notNull().default(""),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] })],
);

export const products = pgTable(
  "products",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    nameBn: text("name_bn"),
    categoryId: text("category_id").notNull(),
    unit: text("unit").notNull().default("pcs"),
    description: text("description"),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    art: jsonb("art").$type<{ hue: string; pattern: string }>().notNull(),
    optionTypes: jsonb("option_types").$type<{ name: string; values: string[] }[]>().notNull().default([]),
    status: text("status").notNull().default("active"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    extra: jsonb("extra").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] })],
);

export const variants = pgTable(
  "variants",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    productId: text("product_id").notNull(),
    position: integer("position").notNull().default(0),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    options: jsonb("options").$type<Record<string, string>>().notNull().default({}),
    price: money("price").notNull(),
    cost: money("cost").notNull().default(0),
    mrp: money("mrp"),
    onHand: integer("on_hand").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    inTransit: integer("in_transit").notNull().default(0),
    damaged: integer("damaged").notNull().default(0),
    lowStock: integer("low_stock").notNull().default(5),
    active: boolean("active").notNull().default(true),
    extra: jsonb("extra").$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] }), uniqueIndex("variants_sku_idx").on(t.businessId, t.sku), index("variants_product_idx").on(t.businessId, t.productId)],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    productId: text("product_id").notNull(),
    variantId: text("variant_id").notNull(),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    refLabel: text("ref_label"),
    refId: text("ref_id"),
    balance: integer("balance").notNull(),
    byName: text("by_name").notNull(),
    at: ts("at").notNull(),
    note: text("note"),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] }), index("movements_variant_idx").on(t.businessId, t.variantId, t.at)],
);

export const suppliers = pgTable(
  "suppliers",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull().default(""),
    address: text("address"),
    balance: money("balance").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] })],
);

export const purchases = pgTable(
  "purchases",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    ref: text("ref").notNull(),
    supplierId: text("supplier_id"),
    date: ts("date").notNull(),
    lines: jsonb("lines").$type<{ variantId: string; productId: string; qty: number; unitCost: number }[]>().notNull(),
    total: money("total").notNull(),
    paid: money("paid").notNull().default(0),
    note: text("note"),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] })],
);

/* ------------------------------------------------------------ customers & orders */

export const customers = pgTable(
  "customers",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    altPhone: text("alt_phone"),
    address: jsonb("address").$type<{ line: string; area: string; district: string }>().notNull(),
    channel: text("channel").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    notes: text("notes"),
    risky: boolean("risky").notNull().default(false),
    fbLink: text("fb_link"),
    extra: jsonb("extra").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] }), uniqueIndex("customers_phone_idx").on(t.businessId, t.phone)],
);

export const orders = pgTable(
  "orders",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    no: integer("no").notNull(),
    invoiceNo: text("invoice_no"),
    channel: text("channel").notNull(),
    customerId: text("customer_id"),
    customer: jsonb("customer").$type<Record<string, unknown> | null>(),
    discount: jsonb("discount").$type<{ type: "flat" | "pct"; value: number }>().notNull(),
    deliveryCharge: money("delivery_charge").notNull().default(0),
    otherCharges: money("other_charges").notNull().default(0),
    settlement: text("settlement").notNull(),
    status: text("status").notNull(),
    courier: jsonb("courier").$type<Record<string, unknown> | null>(),
    codReceived: jsonb("cod_received").$type<{ at: string; ref?: string } | null>(),
    notesInternal: text("notes_internal"),
    notesInvoice: text("notes_invoice"),
    returns: jsonb("returns").$type<unknown[]>().notNull().default([]),
    extra: jsonb("extra").$type<Record<string, unknown>>().notNull().default({}),
    // Denormalised for SQL reporting; maintained on every write.
    total: money("total").notNull().default(0),
    publicToken: text("public_token").unique(),
    createdBy: text("created_by").notNull(),
    createdAt: ts("created_at").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.businessId, t.id] }),
    uniqueIndex("orders_no_idx").on(t.businessId, t.no),
    index("orders_status_idx").on(t.businessId, t.status, t.createdAt),
    index("orders_customer_idx").on(t.businessId, t.customerId),
  ],
);

export const orderLines = pgTable(
  "order_lines",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    orderId: text("order_id").notNull(),
    position: integer("position").notNull().default(0),
    productId: text("product_id").notNull(),
    variantId: text("variant_id").notNull(),
    name: text("name").notNull(),
    variantLabel: text("variant_label").notNull().default(""),
    sku: text("sku").notNull(),
    qty: integer("qty").notNull(),
    price: money("price").notNull(),
    discount: money("discount").notNull().default(0),
    cost: money("cost").notNull().default(0),
    returnedQty: integer("returned_qty").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] }), index("lines_order_idx").on(t.businessId, t.orderId)],
);

export const payments = pgTable(
  "payments",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    orderId: text("order_id").notNull(),
    method: text("method").notNull(),
    amount: money("amount").notNull(),
    txnId: text("txn_id"),
    kind: text("kind").notNull(),
    byName: text("by_name").notNull(),
    at: ts("at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] }), index("payments_order_idx").on(t.businessId, t.orderId)],
);

export const orderEvents = pgTable(
  "order_events",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    orderId: text("order_id").notNull(),
    type: text("type").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    note: text("note"),
    byName: text("by_name").notNull(),
    at: ts("at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] }), index("events_order_idx").on(t.businessId, t.orderId)],
);

export const expenses = pgTable(
  "expenses",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    category: text("category").notNull(),
    amount: money("amount").notNull(),
    date: ts("date").notNull(),
    method: text("method").notNull(),
    note: text("note"),
    refOrderId: text("ref_order_id"),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] })],
);

export const notices = pgTable(
  "notices",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    read: boolean("read").notNull().default(false),
    at: ts("at").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] })],
);

/* ------------------------------------------------------------ sync & audit */

/** Every command a device sends. The primary key is the idempotency key (NFR-REL-04). */
export const commandLog = pgTable(
  "command_log",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull(), // applied | rejected
    error: text("error"),
    result: jsonb("result"),
    clientAt: ts("client_at"),
    appliedAt: ts("applied_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] })],
);

/** Deletions, so devices can drop records on their next pull. */
export const tombstones = pgTable(
  "tombstones",
  {
    businessId: text("business_id").notNull(),
    entity: text("entity").notNull(),
    id: text("id").notNull(),
    deletedAt: ts("deleted_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.entity, t.id] })],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    businessId: text("business_id").notNull(),
    userId: text("user_id"),
    userName: text("user_name"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("audit_business_idx").on(t.businessId, t.at)],
);

export const TENANT_TABLES = [
  "memberships",
  "categories",
  "products",
  "variants",
  "stock_movements",
  "suppliers",
  "purchases",
  "customers",
  "orders",
  "order_lines",
  "payments",
  "order_events",
  "expenses",
  "notices",
  "command_log",
  "tombstones",
  "audit_log",
] as const;

export const nowSql = sql`now()`;
