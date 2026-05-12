-- Migration 0017: per-tenant structural geometry (postSizeMm — the post /
-- lumber cross-section that drives every visible structural element).
-- Stored as jsonb so future geometry knobs (e.g. roof beam dimensions)
-- can be added without schema churn.
-- Defaults to '{"postSizeMm": 150}' so older rows resolve to the previous
-- hard-coded value at the application layer.
-- IF NOT EXISTS keeps the migration idempotent.

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "geometry" jsonb DEFAULT '{"postSizeMm": 150}'::jsonb NOT NULL;
