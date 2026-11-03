-- Platform & messaging (AI parsing, inbox, SMS, push, summaries, public API, webhooks).
-- Idempotent: safe to run more than once.
CREATE TABLE IF NOT EXISTS ai_usage (
  business_id text NOT NULL, month text NOT NULL,
  requests integer NOT NULL DEFAULT 0, input_tokens integer NOT NULL DEFAULT 0, output_tokens integer NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, month)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS channel_accounts (
  business_id text NOT NULL, id text NOT NULL, platform text NOT NULL, external_id text NOT NULL, name text NOT NULL,
  token_enc text, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS channel_accounts_external_idx ON channel_accounts (platform, external_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS conversations (
  business_id text NOT NULL, id text NOT NULL, account_id text NOT NULL, platform text NOT NULL, external_user_id text NOT NULL,
  name text NOT NULL DEFAULT '', phone text, customer_id text, last_text text NOT NULL DEFAULT '',
  last_message_at timestamptz NOT NULL DEFAULT now(), last_inbound_at timestamptz, unread integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open', created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS conversations_user_idx ON conversations (business_id, account_id, external_user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS conversations_recent_idx ON conversations (business_id, last_message_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS messages (
  business_id text NOT NULL, id text NOT NULL, conversation_id text NOT NULL, direction text NOT NULL,
  text text NOT NULL DEFAULT '', attachments jsonb NOT NULL DEFAULT '[]'::jsonb, external_id text,
  status text NOT NULL DEFAULT 'received', error text, by_name text, at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS messages_conv_idx ON messages (business_id, conversation_id, at);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS messages_external_idx ON messages (business_id, external_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS saved_replies (
  business_id text NOT NULL, id text NOT NULL, title text NOT NULL, text text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sms_templates (
  business_id text NOT NULL, key text NOT NULL, lang text NOT NULL DEFAULT 'bn', body text NOT NULL,
  enabled boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, key)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sms_credits (
  id serial PRIMARY KEY, business_id text NOT NULL, delta integer NOT NULL, reason text NOT NULL, ref text,
  at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sms_credits_business_idx ON sms_credits (business_id, at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sms_log (
  id serial PRIMARY KEY, business_id text NOT NULL, to_phone text NOT NULL, template_key text, body text NOT NULL,
  status text NOT NULL, provider text, error text, order_id text, parts integer NOT NULL DEFAULT 1,
  at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sms_log_business_idx ON sms_log (business_id, at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS push_subscriptions (
  business_id text NOT NULL, id text NOT NULL, user_id text NOT NULL, endpoint text NOT NULL, p256dh text NOT NULL,
  auth text NOT NULL, user_agent text, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS push_endpoint_idx ON push_subscriptions (business_id, endpoint);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS notification_prefs (
  business_id text NOT NULL, user_id text NOT NULL,
  daily_summary boolean NOT NULL DEFAULT true, summary_hour integer NOT NULL DEFAULT 21, via text NOT NULL DEFAULT 'push',
  lang text NOT NULL DEFAULT 'bn', low_stock_digest boolean NOT NULL DEFAULT true,
  push_new_orders boolean NOT NULL DEFAULT true, push_low_stock boolean NOT NULL DEFAULT true, push_cod_overdue boolean NOT NULL DEFAULT true,
  last_summary_date text,
  PRIMARY KEY (business_id, user_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS api_keys (
  business_id text NOT NULL, id text NOT NULL, name text NOT NULL, prefix text NOT NULL, key_hash text NOT NULL,
  scopes jsonb NOT NULL DEFAULT '["read"]'::jsonb, created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz, revoked_at timestamptz,
  PRIMARY KEY (business_id, id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_hash_idx ON api_keys (key_hash);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  business_id text NOT NULL, id text NOT NULL, url text NOT NULL, secret_enc text NOT NULL,
  events jsonb NOT NULL DEFAULT '[]'::jsonb, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  business_id text NOT NULL, id text NOT NULL, endpoint_id text NOT NULL, event text NOT NULL, payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_status integer, last_error text, created_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz,
  PRIMARY KEY (business_id, id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS webhook_due_idx ON webhook_deliveries (status, next_attempt_at);
--> statement-breakpoint
GRANT USAGE, SELECT ON SEQUENCE sms_credits_id_seq, sms_log_id_seq TO bk_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "ai_usage" TO bk_app;
--> statement-breakpoint
ALTER TABLE "ai_usage" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "ai_usage";
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "ai_usage" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "channel_accounts" TO bk_app;
--> statement-breakpoint
ALTER TABLE "channel_accounts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "channel_accounts";
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "channel_accounts" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "conversations" TO bk_app;
--> statement-breakpoint
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "conversations";
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "conversations" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "messages" TO bk_app;
--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "messages";
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "messages" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "saved_replies" TO bk_app;
--> statement-breakpoint
ALTER TABLE "saved_replies" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "saved_replies";
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "saved_replies" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "sms_templates" TO bk_app;
--> statement-breakpoint
ALTER TABLE "sms_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "sms_templates";
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "sms_templates" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "sms_credits" TO bk_app;
--> statement-breakpoint
ALTER TABLE "sms_credits" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "sms_credits";
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "sms_credits" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "sms_log" TO bk_app;
--> statement-breakpoint
ALTER TABLE "sms_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "sms_log";
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "sms_log" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "push_subscriptions" TO bk_app;
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "push_subscriptions";
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "push_subscriptions" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "notification_prefs" TO bk_app;
--> statement-breakpoint
ALTER TABLE "notification_prefs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "notification_prefs";
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "notification_prefs" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "api_keys" TO bk_app;
--> statement-breakpoint
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "api_keys";
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "api_keys" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "webhook_endpoints" TO bk_app;
--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "webhook_endpoints";
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "webhook_endpoints" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "webhook_deliveries" TO bk_app;
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "webhook_deliveries";
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "webhook_deliveries" TO bk_app
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
