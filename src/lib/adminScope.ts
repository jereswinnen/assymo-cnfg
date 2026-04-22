import type { Session } from './auth';
import { DEFAULT_TENANT_ID } from '@/domain/tenant';

/** Resolve the tenant scope for an admin page.
 *
 *  tenant_admin: always scoped to their own tenant (session.user.tenantId).
 *  super_admin: tenantId is NULL on their row; default to DEFAULT_TENANT_ID
 *    as a stopgap until a proper scope switcher exists. This is the same
 *    tenant `resolveTenantByHostOrDefault` falls back to on unknown hosts.
 *
 *  Returns null only for unauthenticated sessions — callers should have
 *  already gated on that. */
export function resolveAdminTenantScope(session: Session): string {
  return session.user.tenantId ?? DEFAULT_TENANT_ID;
}
