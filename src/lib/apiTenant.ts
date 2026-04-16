import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { tenants as tenantsTable, type TenantRow } from '@/db/schema';
import { resolveTenantFromHost } from '@/domain/tenant';

/** Resolve the current tenant for an API route — first from the host
 *  header (via the in-memory lookup), then cross-checked against the
 *  tenants table so prices / catalog come from the DB source of truth.
 *  Returns null when the DB row is missing (treat as 404 upstream). */
export async function resolveApiTenant(): Promise<TenantRow | null> {
  const host = (await headers()).get('host');
  const tenant = resolveTenantFromHost(host);
  const rows = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenant.id))
    .limit(1);
  return rows[0] ?? null;
}
