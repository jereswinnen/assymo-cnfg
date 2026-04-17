import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from './client';
import { tenantHosts, tenants, type TenantRow } from './schema';
import { DEFAULT_TENANT_ID, candidateHostKeys } from '@/domain/tenant';

/** Resolve a tenant row by host header, trying exact/bare/subdomain
 *  candidates against `tenant_hosts`. Returns null when no candidate
 *  matches — callers decide whether to fall back to the default tenant
 *  or 404. Wrapped in React `cache()` so the layout and API routes in
 *  the same request share one DB round-trip. */
export const resolveTenantByHost = cache(
  async (host: string | null | undefined): Promise<TenantRow | null> => {
    const candidates = candidateHostKeys(host);
    for (const key of candidates) {
      const rows = await db
        .select()
        .from(tenants)
        .innerJoin(tenantHosts, eq(tenantHosts.tenantId, tenants.id))
        .where(eq(tenantHosts.hostname, key))
        .limit(1);
      const row = rows[0]?.tenants;
      if (row) return row;
    }
    return null;
  },
);

/** Look up a tenant row by its stable slug. Returns null when missing. */
export const getTenantById = cache(
  async (id: string): Promise<TenantRow | null> => {
    const rows = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    return rows[0] ?? null;
  },
);

/** Convenience: resolve from host, falling back to the default tenant
 *  row when the host is unknown. Returns null only if the DB is empty
 *  or the default tenant is missing. */
export async function resolveTenantByHostOrDefault(
  host: string | null | undefined,
): Promise<TenantRow | null> {
  return (await resolveTenantByHost(host)) ?? getTenantById(DEFAULT_TENANT_ID);
}
