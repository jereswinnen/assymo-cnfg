-- Migration 0015: collapse user_type + role into a single kind column
-- Execution order:
--   1. Add kind (nullable initially)
--   2. Backfill from existing user_type / role
--   3. Make kind NOT NULL
--   4. Drop old columns
--   5. Add CHECK constraint enforcing kind ↔ tenant_id consistency

ALTER TABLE "user" ADD COLUMN "kind" text;
--> statement-breakpoint
UPDATE "user" SET "kind" = 'client' WHERE user_type = 'client';
--> statement-breakpoint
UPDATE "user" SET "kind" = 'super_admin' WHERE user_type = 'business' AND role = 'super_admin';
--> statement-breakpoint
UPDATE "user" SET "kind" = 'tenant_admin' WHERE user_type = 'business' AND role = 'tenant_admin';
--> statement-breakpoint
UPDATE "user" SET "kind" = 'tenant_admin' WHERE "kind" IS NULL AND user_type = 'business';
--> statement-breakpoint
UPDATE "user" SET "kind" = 'client' WHERE "kind" IS NULL;
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "kind" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "role";
--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "user_type";
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_kind_tenant_check" CHECK (
  (kind = 'super_admin' AND tenant_id IS NULL) OR
  (kind = 'tenant_admin' AND tenant_id IS NOT NULL) OR
  (kind = 'client' AND tenant_id IS NOT NULL)
);
