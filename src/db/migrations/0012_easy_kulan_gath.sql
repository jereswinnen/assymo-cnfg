-- Phase 5.5.3: share-code format changed to server-minted nanoid(10) + content-hash dedup.
-- Pre-existing configs rows have no hash; truncate to allow the NOT NULL column.
TRUNCATE TABLE "configs" CASCADE;
ALTER TABLE "configs" ADD COLUMN "content_hash" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "configs_tenant_content_hash_idx" ON "configs" USING btree ("tenant_id","content_hash");