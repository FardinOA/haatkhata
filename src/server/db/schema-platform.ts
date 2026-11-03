/**
 * Tables for the "platform" feature area: AI usage, the unified inbox,
 * customer SMS, web push, daily summaries, API keys and outbound webhooks.
 * The SQL (with RLS policies and grants) lives in migrations/0007_platform.sql.
 */
import { boolean, index, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/* ------------------------------------------------------------ AI */

export const aiUsage = pgTable(
  "ai_usage",
  {
    businessId: text("business_id").notNull(),
    month: text("month").notNull(), // YYYY-MM (Asia/Dhaka)
    requests: integer("requests").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.month] })],
);

/* ------------------------------------------------------------ inbox */

export const channelAccounts = pgTable(
  "channel_accounts",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    platform: text("platform").notNull(), // messenger | instagram | whatsapp
    externalId: text("external_id").notNull(), // page id / IG account id / phone_number_id
    name: text("name").notNull(),
    tokenEnc: text("token_enc"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] }), uniqueIndex("channel_accounts_external_idx").on(t.platform, t.externalId)],
);

export const conversations = pgTable(
  "conversations",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    accountId: text("account_id").notNull(),
    platform: text("platform").notNull(),
    externalUserId: text("external_user_id").notNull(),
    name: text("name").notNull().default(""),
    phone: text("phone"),
    customerId: text("customer_id"),
    lastText: text("last_text").notNull().default(""),
    lastMessageAt: ts("last_message_at").notNull().defaultNow(),
    lastInboundAt: ts("last_inbound_at"),
    unread: integer("unread").notNull().default(0),
    status: text("status").notNull().default("open"), // open | done
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] }), uniqueIndex("conversations_user_idx").on(t.businessId, t.accountId, t.externalUserId), index("conversations_recent_idx").on(t.businessId, t.lastMessageAt)],
);

export const messages = pgTable(
  "messages",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    conversationId: text("conversation_id").notNull(),
    direction: text("direction").notNull(), // in | out
    text: text("text").notNull().default(""),
    attachments: jsonb("attachments").$type<{ type: string; url?: string; title?: string; price?: number }[]>().notNull().default([]),
    externalId: text("external_id"),
    status: text("status").notNull().default("received"), // received | sent | failed
    error: text("error"),
    byName: text("by_name"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] }), index("messages_conv_idx").on(t.businessId, t.conversationId, t.at), uniqueIndex("messages_external_idx").on(t.businessId, t.externalId)],
);

export const savedReplies = pgTable(
  "saved_replies",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    title: text("title").notNull(),
    text: text("text").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] })],
);

/* ------------------------------------------------------------ SMS */

export const smsTemplates = pgTable(
  "sms_templates",
  {
    businessId: text("business_id").notNull(),
    key: text("key").notNull(), // order_confirmed | order_shipped | order_delivered | due_reminder
    lang: text("lang").notNull().default("bn"),
    body: text("body").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.key] })],
);

export const smsCredits = pgTable(
  "sms_credits",
  {
    id: serial("id").primaryKey(),
    businessId: text("business_id").notNull(),
    delta: integer("delta").notNull(), // + purchase / grant, − sent
    reason: text("reason").notNull(), // purchase | grant | sent | refund
    ref: text("ref"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("sms_credits_business_idx").on(t.businessId, t.at)],
);

export const smsLog = pgTable(
  "sms_log",
  {
    id: serial("id").primaryKey(),
    businessId: text("business_id").notNull(),
    toPhone: text("to_phone").notNull(),
    templateKey: text("template_key"),
    body: text("body").notNull(),
    status: text("status").notNull(), // sent | failed | skipped
    provider: text("provider"),
    error: text("error"),
    orderId: text("order_id"),
    parts: integer("parts").notNull().default(1),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("sms_log_business_idx").on(t.businessId, t.at)],
);

/* ------------------------------------------------------------ push & summaries */

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    userId: text("user_id").notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] }), uniqueIndex("push_endpoint_idx").on(t.businessId, t.endpoint)],
);

export const notificationPrefs = pgTable(
  "notification_prefs",
  {
    businessId: text("business_id").notNull(),
    userId: text("user_id").notNull(),
    dailySummary: boolean("daily_summary").notNull().default(true),
    summaryHour: integer("summary_hour").notNull().default(21), // Asia/Dhaka
    via: text("via").notNull().default("push"), // push | sms | both
    lang: text("lang").notNull().default("bn"),
    lowStockDigest: boolean("low_stock_digest").notNull().default(true),
    pushNewOrders: boolean("push_new_orders").notNull().default(true),
    pushLowStock: boolean("push_low_stock").notNull().default(true),
    pushCodOverdue: boolean("push_cod_overdue").notNull().default(true),
    lastSummaryDate: text("last_summary_date"),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.userId] })],
);

/* ------------------------------------------------------------ public API */

export const apiKeys = pgTable(
  "api_keys",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    scopes: jsonb("scopes").$type<("read" | "write")[]>().notNull().default(["read"]),
    createdBy: text("created_by"),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastUsedAt: ts("last_used_at"),
    revokedAt: ts("revoked_at"),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] }), uniqueIndex("api_keys_hash_idx").on(t.keyHash)],
);

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    url: text("url").notNull(),
    secretEnc: text("secret_enc").notNull(),
    events: jsonb("events").$type<string[]>().notNull().default([]),
    active: boolean("active").notNull().default(true),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] })],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    businessId: text("business_id").notNull(),
    id: text("id").notNull(),
    endpointId: text("endpoint_id").notNull(),
    event: text("event").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("pending"), // pending | delivered | failed
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: ts("next_attempt_at").notNull().defaultNow(),
    lastStatus: integer("last_status"),
    lastError: text("last_error"),
    createdAt: ts("created_at").notNull().defaultNow(),
    deliveredAt: ts("delivered_at"),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.id] }), index("webhook_due_idx").on(t.status, t.nextAttemptAt)],
);

export const PLATFORM_TABLES = [
  "ai_usage",
  "channel_accounts",
  "conversations",
  "messages",
  "saved_replies",
  "sms_templates",
  "sms_credits",
  "sms_log",
  "push_subscriptions",
  "notification_prefs",
  "api_keys",
  "webhook_endpoints",
  "webhook_deliveries",
] as const;
