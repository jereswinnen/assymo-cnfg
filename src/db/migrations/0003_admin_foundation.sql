ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'tenant_admin';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "user_type" text DEFAULT 'business';--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "user_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "branding" jsonb;--> statement-breakpoint
UPDATE "tenants" SET "branding" = '{
  "displayName": "Assymo",
  "logoUrl": "/logo-assymo.svg",
  "primaryColor": "#1f2937",
  "accentColor": "#0ea5e9",
  "footer": { "contactEmail": "info@assymo.be", "address": "TBD", "vatNumber": null }
}'::jsonb WHERE "branding" IS NULL;--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "branding" SET NOT NULL;--> statement-breakpoint
UPDATE "user" SET "role" = 'tenant_admin' WHERE "role" = 'staff';
