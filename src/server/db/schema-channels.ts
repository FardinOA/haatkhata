/**
 * Tables for public surfaces (storefront catalogue, public rate limits).
 * SQL lives in src/server/db/migrations/0006_channels.sql.
 */
import { bigserial, boolean, index, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const storefronts = pgTable("storefronts", {
  businessId: text("business_id").primaryKey(),
  slug: text("slug").notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  showStock: boolean("show_stock").notNull().default(false),
  banner: text("banner").notNull().default(""),
  deliveryInside: numeric("delivery_inside", { precision: 14, scale: 2, mode: "number" }).notNull().default(70),
  deliveryOutside: numeric("delivery_outside", { precision: 14, scale: 2, mode: "number" }).notNull().default(130),
  whatsapp: text("whatsapp"),
  messenger: text("messenger"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const publicRateLimits = pgTable(
  "public_rate_limits",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    bucket: text("bucket").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("public_rate_limits_bucket_idx").on(t.bucket, t.createdAt)],
);
