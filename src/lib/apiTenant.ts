import { headers } from 'next/headers';
import type { TenantRow } from '@/db/schema';
import { resolveTenantByHost } from '@/db/resolveTenant';

/** Resolve the current tenant for an API route from the host header.
 *  Returns null when the host isn't mapped — API routes typically 404
 *  in that case rather than silently serving the default tenant. */
export async function resolveApiTenant(): Promise<TenantRow | null> {
  const host = (await headers()).get('host');
  return resolveTenantByHost(host);
}
