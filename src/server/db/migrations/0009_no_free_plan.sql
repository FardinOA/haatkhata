-- No free plan: shops on Free become "expired" (no new orders), and unpaid
-- invoice printing is counted per device, shop and IP. Idempotent: safe to run more than once.
UPDATE "businesses" SET "plan" = 'expired', "plan_order_limit" = 0 WHERE "plan" = 'free';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "print_quota" (
  "bucket" text NOT NULL,
  "order_key" text NOT NULL,
  "business_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "print_quota_pk" PRIMARY KEY ("bucket", "order_key")
);
