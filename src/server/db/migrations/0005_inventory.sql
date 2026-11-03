-- Inventory & documents: stock locations, purchase orders, quotations, recurring expenses.
-- Idempotent; tenant-isolated with the same RLS pattern as 0001_rls.sql.
CREATE TABLE IF NOT EXISTS "locations" (
  "business_id" text NOT NULL,
  "id" text NOT NULL,
  "name" text NOT NULL,
  "name_bn" text DEFAULT '' NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("business_id", "id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_orders" (
  "business_id" text NOT NULL,
  "id" text NOT NULL,
  "no" text NOT NULL,
  "supplier_id" text,
  "status" text NOT NULL,
  "lines" jsonb NOT NULL,
  "expected_at" timestamp with time zone,
  "location_id" text,
  "note" text,
  "history" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("business_id", "id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotes" (
  "business_id" text NOT NULL,
  "id" text NOT NULL,
  "no" text NOT NULL,
  "status" text NOT NULL,
  "customer" jsonb,
  "channel" text NOT NULL,
  "lines" jsonb NOT NULL,
  "discount" jsonb NOT NULL,
  "delivery_charge" numeric(14, 2) DEFAULT 0 NOT NULL,
  "valid_until" text NOT NULL,
  "notes" text,
  "order_id" text,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("business_id", "id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recurring_expenses" (
  "business_id" text NOT NULL,
  "id" text NOT NULL,
  "category" text NOT NULL,
  "amount" numeric(14, 2) NOT NULL,
  "method" text NOT NULL,
  "note" text,
  "day_of_month" integer NOT NULL,
  "last_run" text,
  "active" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("business_id", "id")
);
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['locations', 'purchase_orders', 'quotes', 'recurring_expenses'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO bk_app', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = 'tenant_isolation') THEN
      EXECUTE format($p$CREATE POLICY tenant_isolation ON %I TO bk_app
        USING (business_id = current_setting('app.business_id', true))
        WITH CHECK (business_id = current_setting('app.business_id', true))$p$, t);
    END IF;
  END LOOP;
END $$;
