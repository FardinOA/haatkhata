-- Couriers, COD payouts, payment links and network return-risk (SRS Phase 2).
-- Idempotent: safe to run more than once.
CREATE TABLE IF NOT EXISTS courier_accounts (
  business_id text NOT NULL,
  provider text NOT NULL,
  credentials_enc text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  webhook_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'connected',
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, provider)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS courier_prefs (
  business_id text PRIMARY KEY,
  default_provider text,
  pickup jsonb NOT NULL DEFAULT '{}'::jsonb,
  advance_on_high_risk boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS consignments (
  business_id text NOT NULL,
  id text NOT NULL,
  order_id text NOT NULL,
  provider text NOT NULL,
  consignment_id text NOT NULL,
  tracking_code text,
  raw_status text,
  status text NOT NULL DEFAULT 'booked',
  fee numeric(14,2),
  cod_amount numeric(14,2) NOT NULL DEFAULT 0,
  district text,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  booked_at timestamptz NOT NULL DEFAULT now(),
  last_status_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS consignments_provider_cid_idx ON consignments (provider, consignment_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS consignments_order_idx ON consignments (business_id, order_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS consignments_open_idx ON consignments (status) WHERE status IN ('booked', 'in_transit', 'hold');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS payment_links (
  business_id text NOT NULL,
  id text NOT NULL,
  order_id text NOT NULL,
  token text NOT NULL UNIQUE,
  provider text NOT NULL,
  amount numeric(14,2) NOT NULL,
  purpose text NOT NULL DEFAULT 'advance',
  status text NOT NULL DEFAULT 'open',
  provider_ref text,
  trx_id text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (business_id, id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS payment_links_order_idx ON payment_links (business_id, order_id);
--> statement-breakpoint
-- The seller's own bKash / Nagad merchant credentials (money goes to the seller).
CREATE TABLE IF NOT EXISTS payment_accounts (
  business_id text NOT NULL,
  provider text NOT NULL,
  credentials_enc text NOT NULL,
  status text NOT NULL DEFAULT 'connected',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, provider)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS payout_imports (
  business_id text NOT NULL,
  id text NOT NULL,
  provider text NOT NULL,
  file_name text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, id)
);
--> statement-breakpoint
-- Lookups by the buyer's phone (network risk) and by district (courier performance).
CREATE INDEX IF NOT EXISTS orders_customer_phone_idx ON orders ((customer->>'phone'));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS orders_courier_district_idx ON orders ((customer->'address'->>'district'), (courier->>'name')) WHERE courier IS NOT NULL;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['courier_accounts', 'courier_prefs', 'consignments', 'payment_links', 'payment_accounts', 'payout_imports'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO bk_app', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = 'tenant_isolation') THEN
      EXECUTE format($p$CREATE POLICY tenant_isolation ON %I TO bk_app
        USING (business_id = current_setting('app.business_id', true))
        WITH CHECK (business_id = current_setting('app.business_id', true))$p$, t);
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
-- Network return-risk (FR-CUS-06).
-- A SECURITY DEFINER function rather than an aggregate table: it is always
-- current (no triggers or double bookkeeping), and it can only ever return
-- four counts — never another merchant's id, name, order or customer row.
-- Tenants call it as bk_app; it runs with the owner's rights only inside.
-- The caller's own business is excluded so "network" means other shops.
CREATE OR REPLACE FUNCTION bk_network_risk(p_phone text)
RETURNS TABLE (delivered int, returned int, cancelled int, merchants int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    count(*) FILTER (WHERE o.status IN ('delivered', 'partially_returned'))::int,
    count(*) FILTER (WHERE o.status = 'returned')::int,
    count(*) FILTER (WHERE o.status = 'cancelled')::int,
    count(DISTINCT o.business_id)::int
  FROM orders o
  WHERE o.customer->>'phone' = p_phone
    AND o.business_id IS DISTINCT FROM current_setting('app.business_id', true)
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION bk_network_risk(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION bk_network_risk(text) TO bk_app;
--> statement-breakpoint
-- Courier performance by district across all shops. A courier row is only
-- returned when at least 3 merchants contribute, so no single shop's
-- volumes can be inferred.
CREATE OR REPLACE FUNCTION bk_courier_network(p_district text)
RETURNS TABLE (courier text, delivered int, returned int, merchants int, avg_fee numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    o.courier->>'name',
    count(*) FILTER (WHERE o.status IN ('delivered', 'partially_returned'))::int,
    count(*) FILTER (WHERE o.status = 'returned')::int,
    count(DISTINCT o.business_id)::int,
    round(avg(nullif(o.courier->>'fee', '')::numeric), 0)
  FROM orders o
  WHERE o.courier IS NOT NULL
    AND o.customer->'address'->>'district' = p_district
    AND o.status IN ('delivered', 'partially_returned', 'returned')
  GROUP BY o.courier->>'name'
  HAVING count(DISTINCT o.business_id) >= 3
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION bk_courier_network(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION bk_courier_network(text) TO bk_app;
