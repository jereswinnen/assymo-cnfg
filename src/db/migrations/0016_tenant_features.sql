-- Migration 0016: per-tenant feature flags (e.g. wallElevationView).
-- Stored as jsonb so future flags can be added without schema churn.
-- Defaults to '{}' so older rows resolve through resolveTenantFeatures()
-- against DEFAULT_TENANT_FEATURES at the application layer.
-- IF NOT EXISTS keeps the migration idempotent in environments where the
-- column was added out-of-band (e.g. manually via psql) before the
-- drizzle-kit runner caught up.

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "features" jsonb DEFAULT '{}'::jsonb NOT NULL;
