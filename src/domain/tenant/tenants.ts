import { DEFAULT_PRICE_BOOK } from '@/domain/pricing';
import type { TenantContext, TenantId } from './types';

/** Seeded tenant registry. Eventually replaced by a DB-backed resolver; the
 *  shape of the returned object stays the same so callers don't change. */
const TENANTS: Record<TenantId, TenantContext> = {
  assymo: {
    id: 'assymo',
    displayName: 'Assymo',
    locale: 'nl',
    currency: 'EUR',
    priceBook: DEFAULT_PRICE_BOOK,
  },
};

export const DEFAULT_TENANT_ID: TenantId = 'assymo';

/** Host → tenant lookup. Supports exact host match (for custom domains like
 *  shop.partner.be) and subdomain match (partner.configurator.com). Unknown
 *  hosts fall back to the default tenant — safer than throwing during
 *  route rendering. */
const HOST_TO_TENANT: Record<string, TenantId> = {
  'localhost': 'assymo',
  'localhost:3000': 'assymo',
  'assymo.be': 'assymo',
};

export function getTenantById(id: TenantId): TenantContext {
  return TENANTS[id] ?? TENANTS[DEFAULT_TENANT_ID];
}

export function resolveTenantFromHost(host: string | null | undefined): TenantContext {
  if (!host) return TENANTS[DEFAULT_TENANT_ID];

  const normalized = host.toLowerCase();
  const direct = HOST_TO_TENANT[normalized];
  if (direct) return TENANTS[direct];

  const bareHost = normalized.split(':')[0];
  const bareDirect = HOST_TO_TENANT[bareHost];
  if (bareDirect) return TENANTS[bareDirect];

  const parts = bareHost.split('.');
  if (parts.length >= 3) {
    const sub = parts[0];
    const bySub = HOST_TO_TENANT[sub];
    if (bySub) return TENANTS[bySub];
  }

  return TENANTS[DEFAULT_TENANT_ID];
}
