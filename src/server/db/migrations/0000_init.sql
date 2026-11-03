CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"user_id" text,
	"user_name" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_bn" text DEFAULT '' NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"facebook" text DEFAULT '' NOT NULL,
	"logo" text,
	"logo_shape" text DEFAULT 'rounded' NOT NULL,
	"business_type" text DEFAULT 'online' NOT NULL,
	"channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"theme" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"invoice" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pos" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"monthly_goal" numeric(14, 2) DEFAULT 0 NOT NULL,
	"plan" text DEFAULT 'trial' NOT NULL,
	"plan_order_limit" integer DEFAULT 2500 NOT NULL,
	"plan_renews_at" timestamp with time zone,
	"trial_ends_at" timestamp with time zone,
	"referral_code" text,
	"referred_by" text,
	"next_order_no" integer DEFAULT 1001 NOT NULL,
	"next_invoice_no" integer DEFAULT 1 NOT NULL,
	"next_purchase_no" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"business_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"name_bn" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_business_id_id_pk" PRIMARY KEY("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "command_log" (
	"business_id" text NOT NULL,
	"id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"result" jsonb,
	"client_at" timestamp with time zone,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "command_log_business_id_id_pk" PRIMARY KEY("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"business_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"alt_phone" text,
	"address" jsonb NOT NULL,
	"channel" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"risky" boolean DEFAULT false NOT NULL,
	"fb_link" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_business_id_id_pk" PRIMARY KEY("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"business_id" text NOT NULL,
	"id" text NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"method" text NOT NULL,
	"note" text,
	"ref_order_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_business_id_id_pk" PRIMARY KEY("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"business_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"color" text DEFAULT '#0E6B53' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_business_id_user_id_pk" PRIMARY KEY("business_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"business_id" text NOT NULL,
	"id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text,
	"read" boolean DEFAULT false NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notices_business_id_id_pk" PRIMARY KEY("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"business_id" text NOT NULL,
	"id" text NOT NULL,
	"order_id" text NOT NULL,
	"type" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"note" text,
	"by_name" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "order_events_business_id_id_pk" PRIMARY KEY("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"business_id" text NOT NULL,
	"id" text NOT NULL,
	"order_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"name" text NOT NULL,
	"variant_label" text DEFAULT '' NOT NULL,
	"sku" text NOT NULL,
	"qty" integer NOT NULL,
	"price" numeric(14, 2) NOT NULL,
	"discount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"cost" numeric(14, 2) DEFAULT 0 NOT NULL,
	"returned_qty" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "order_lines_business_id_id_pk" PRIMARY KEY("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"business_id" text NOT NULL,
	"id" text NOT NULL,
	"no" integer NOT NULL,
	"invoice_no" text,
	"channel" text NOT NULL,
	"customer_id" text,
	"customer" jsonb,
	"discount" jsonb NOT NULL,
	"delivery_charge" numeric(14, 2) DEFAULT 0 NOT NULL,
	"other_charges" numeric(14, 2) DEFAULT 0 NOT NULL,
	"settlement" text NOT NULL,
	"status" text NOT NULL,
	"courier" jsonb,
	"cod_received" jsonb,
	"notes_internal" text,
	"notes_invoice" text,
	"returns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"total" numeric(14, 2) DEFAULT 0 NOT NULL,
	"public_token" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_business_id_id_pk" PRIMARY KEY("business_id","id"),
	CONSTRAINT "orders_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"ip" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"business_id" text NOT NULL,
	"id" text NOT NULL,
	"order_id" text NOT NULL,
	"method" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"txn_id" text,
	"kind" text NOT NULL,
	"by_name" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "payments_business_id_id_pk" PRIMARY KEY("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"business_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"name_bn" text,
	"category_id" text NOT NULL,
	"unit" text DEFAULT 'pcs' NOT NULL,
	"description" text,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"art" jsonb NOT NULL,
	"option_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_business_id_id_pk" PRIMARY KEY("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"business_id" text NOT NULL,
	"id" text NOT NULL,
	"ref" text NOT NULL,
	"supplier_id" text,
	"date" timestamp with time zone NOT NULL,
	"lines" jsonb NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"paid" numeric(14, 2) DEFAULT 0 NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchases_business_id_id_pk" PRIMARY KEY("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" text NOT NULL,
	"business_id" text,
	"user_agent" text,
	"ip" text,
	"impersonated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"business_id" text NOT NULL,
	"id" text NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"ref_label" text,
	"ref_id" text,
	"balance" integer NOT NULL,
	"by_name" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"note" text,
	CONSTRAINT "stock_movements_business_id_id_pk" PRIMARY KEY("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"business_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"address" text,
	"balance" numeric(14, 2) DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_business_id_id_pk" PRIMARY KEY("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "tombstones" (
	"business_id" text NOT NULL,
	"entity" text NOT NULL,
	"id" text NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tombstones_business_id_entity_id_pk" PRIMARY KEY("business_id","entity","id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text,
	"lang" text DEFAULT 'en' NOT NULL,
	"numerals" text DEFAULT 'latin' NOT NULL,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"business_id" text NOT NULL,
	"id" text NOT NULL,
	"product_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"sku" text NOT NULL,
	"barcode" text,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price" numeric(14, 2) NOT NULL,
	"cost" numeric(14, 2) DEFAULT 0 NOT NULL,
	"mrp" numeric(14, 2),
	"on_hand" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"in_transit" integer DEFAULT 0 NOT NULL,
	"damaged" integer DEFAULT 0 NOT NULL,
	"low_stock" integer DEFAULT 5 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variants_business_id_id_pk" PRIMARY KEY("business_id","id")
);
--> statement-breakpoint
CREATE INDEX "audit_business_idx" ON "audit_log" USING btree ("business_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_phone_idx" ON "customers" USING btree ("business_id","phone");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "events_order_idx" ON "order_events" USING btree ("business_id","order_id");--> statement-breakpoint
CREATE INDEX "lines_order_idx" ON "order_lines" USING btree ("business_id","order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_no_idx" ON "orders" USING btree ("business_id","no");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("business_id","status","created_at");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("business_id","customer_id");--> statement-breakpoint
CREATE INDEX "otp_phone_idx" ON "otp_codes" USING btree ("phone","created_at");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("business_id","order_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "movements_variant_idx" ON "stock_movements" USING btree ("business_id","variant_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "variants_sku_idx" ON "variants" USING btree ("business_id","sku");--> statement-breakpoint
CREATE INDEX "variants_product_idx" ON "variants" USING btree ("business_id","product_id");