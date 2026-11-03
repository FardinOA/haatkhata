-- Public surfaces: mini catalogue storefront + rate limits for public endpoints.
-- Idempotent: safe to run again.
CREATE TABLE IF NOT EXISTS "storefronts" (
  "business_id" text PRIMARY KEY,
  "slug" text NOT NULL UNIQUE,
  "enabled" boolean NOT NULL DEFAULT false,
  "show_stock" boolean NOT NULL DEFAULT false,
  "banner" text NOT NULL DEFAULT '',
  "delivery_inside" numeric(14, 2) NOT NULL DEFAULT 70,
  "delivery_outside" numeric(14, 2) NOT NULL DEFAULT 130,
  "whatsapp" text,
  "messenger" text,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "storefronts" TO bk_app;
--> statement-breakpoint
ALTER TABLE "storefronts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'storefronts' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON "storefronts" TO bk_app
      USING (business_id = current_setting('app.business_id', true))
      WITH CHECK (business_id = current_setting('app.business_id', true));
  END IF;
END $$;
--> statement-breakpoint
-- Sliding-window counters for anonymous endpoints (catalogue orders). Owner-only:
-- no grant to bk_app, never readable from a tenant transaction.
CREATE TABLE IF NOT EXISTS "public_rate_limits" (
  "id" bigserial PRIMARY KEY,
  "bucket" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "public_rate_limits_bucket_idx" ON "public_rate_limits" ("bucket", "created_at");
