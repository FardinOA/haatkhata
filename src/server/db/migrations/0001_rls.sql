-- Tenant isolation (SRS NFR-SEC-01).
-- Application queries for a business run as the non-owner role bk_app with
-- app.business_id set for the transaction; Postgres then filters every row.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bk_app') THEN
    CREATE ROLE bk_app NOLOGIN;
  END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO bk_app;
--> statement-breakpoint
GRANT SELECT ON users, businesses TO bk_app;
--> statement-breakpoint
GRANT UPDATE ON businesses TO bk_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bk_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "memberships" TO bk_app;
--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "memberships" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "categories" TO bk_app;
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "categories" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "products" TO bk_app;
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "products" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "variants" TO bk_app;
--> statement-breakpoint
ALTER TABLE "variants" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "variants" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "stock_movements" TO bk_app;
--> statement-breakpoint
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "stock_movements" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "suppliers" TO bk_app;
--> statement-breakpoint
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "suppliers" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "purchases" TO bk_app;
--> statement-breakpoint
ALTER TABLE "purchases" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "purchases" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "customers" TO bk_app;
--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "customers" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "orders" TO bk_app;
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "orders" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "order_lines" TO bk_app;
--> statement-breakpoint
ALTER TABLE "order_lines" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "order_lines" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "payments" TO bk_app;
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "payments" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "order_events" TO bk_app;
--> statement-breakpoint
ALTER TABLE "order_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "order_events" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "expenses" TO bk_app;
--> statement-breakpoint
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "expenses" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "notices" TO bk_app;
--> statement-breakpoint
ALTER TABLE "notices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "notices" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "command_log" TO bk_app;
--> statement-breakpoint
ALTER TABLE "command_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "command_log" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "tombstones" TO bk_app;
--> statement-breakpoint
ALTER TABLE "tombstones" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "tombstones" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "audit_log" TO bk_app;
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "audit_log" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY own_business ON businesses TO bk_app
  USING (id = current_setting('app.business_id', true))
  WITH CHECK (id = current_setting('app.business_id', true));
--> statement-breakpoint
-- Public, revocable invoice links (FR-INV-04): unguessable 128-bit tokens.
CREATE INDEX IF NOT EXISTS orders_public_token_idx ON orders (public_token) WHERE public_token IS NOT NULL;
