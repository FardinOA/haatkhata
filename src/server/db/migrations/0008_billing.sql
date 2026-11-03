-- Billing, referrals, custom roles, admin console and device PINs.
-- Idempotent: safe to run more than once.
CREATE TABLE IF NOT EXISTS "custom_roles" (
  "business_id" text NOT NULL,
  "id" text NOT NULL,
  "name" text NOT NULL,
  "name_bn" text,
  "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "max_discount_pct" integer DEFAULT 15 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "custom_roles_pk" PRIMARY KEY ("business_id", "id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_payments" (
  "business_id" text NOT NULL,
  "id" text NOT NULL,
  "plan" text NOT NULL,
  "term" text NOT NULL,
  "months" integer NOT NULL,
  "credit_months" integer DEFAULT 0 NOT NULL,
  "amount" numeric(14, 2) NOT NULL,
  "vat_pct" numeric(14, 2) NOT NULL,
  "vat_amount" numeric(14, 2) NOT NULL,
  "gateway" text NOT NULL,
  "method" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "gateway_ref" text,
  "gateway_payload" jsonb,
  "invoice_no" text,
  "period_start" timestamp with time zone,
  "period_end" timestamp with time zone,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "paid_at" timestamp with time zone,
  CONSTRAINT "subscription_payments_pk" PRIMARY KEY ("business_id", "id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subpay_id_idx" ON "subscription_payments" ("id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subpay_invoice_idx" ON "subscription_payments" ("invoice_no") WHERE "invoice_no" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referral_credits" (
  "business_id" text NOT NULL,
  "id" text NOT NULL,
  "months" integer NOT NULL,
  "reason" text NOT NULL,
  "source_business_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "used_at" timestamp with time zone,
  "used_payment_id" text,
  CONSTRAINT "referral_credits_pk" PRIMARY KEY ("business_id", "id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session_pins" (
  "session_id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "pin_hash" text NOT NULL,
  "failed" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_actions" (
  "id" serial PRIMARY KEY NOT NULL,
  "admin_user_id" text NOT NULL,
  "action" text NOT NULL,
  "business_id" text,
  "reason" text,
  "details" jsonb,
  "at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_actions_at_idx" ON "admin_actions" ("at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "announcements" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "href" text,
  "created_by" text NOT NULL,
  "recipients" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Sequential, gap-free per issue: subscription receipt numbers BK-YYYY-000001.
CREATE SEQUENCE IF NOT EXISTS billing_invoice_seq;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "custom_roles", "subscription_payments", "referral_credits" TO bk_app;
--> statement-breakpoint
ALTER TABLE "custom_roles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "subscription_payments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "referral_credits" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'custom_roles' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON "custom_roles" TO bk_app
      USING (business_id = current_setting('app.business_id', true))
      WITH CHECK (business_id = current_setting('app.business_id', true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscription_payments' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON "subscription_payments" TO bk_app
      USING (business_id = current_setting('app.business_id', true))
      WITH CHECK (business_id = current_setting('app.business_id', true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'referral_credits' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON "referral_credits" TO bk_app
      USING (business_id = current_setting('app.business_id', true))
      WITH CHECK (business_id = current_setting('app.business_id', true));
  END IF;
END $$;
