import { headers } from 'next/headers';
import type { TenantRow } from '@/db/schema';
import { resolveTenantByHostOrDefault } from '@/db/resolveTenant';

/** Resolve the current tenant for an API route from the host header.
 *  Falls back to the default tenant when the host isn't mapped — matches
 *  the root layout's behaviour, so the configurator UI and the API routes
 *  it talks to never disagree. (Most-public deployments — Vercel preview
 *  URLs, custom .vercel.app subdomains — aren't in `tenant_hosts`; the
 *  fallback keeps them working without per-deploy seed updates.)
 *
 *  Returns null only when the DB is empty / default tenant is missing —
 *  which would already be a fatal misconfiguration. */
export async function resolveApiTenant(): Promise<TenantRow | null> {
  const host = (await headers()).get('host');
  return resolveTenantByHostOrDefault(host);
}
