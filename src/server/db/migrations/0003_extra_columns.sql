ALTER TABLE "customers" ADD COLUMN "extra" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "extra" jsonb DEFAULT '{}'::jsonb NOT NULL;