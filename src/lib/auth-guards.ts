import type { Session } from './auth';

export type Role = 'super_admin' | 'tenant_admin';
export type UserType = 'business' | 'client';

export const ALL_ROLES = ['super_admin', 'tenant_admin'] as const satisfies readonly Role[];
export const ALL_USER_TYPES = ['business', 'client'] as const satisfies readonly UserType[];

export type AuthErrorCode =
  | 'unauthenticated'
  | 'forbidden_role'
  | 'forbidden_tenant'
  | 'forbidden_user_type';

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    public readonly status: number,
  ) {
    super(code);
  }
}

/** Require the session's user role to be one of the given values. */
export function requireRole(session: Session, roles: readonly Role[]): void {
  const role = session.user.role as Role | null | undefined;
  if (!role || !roles.includes(role)) {
    throw new AuthError('forbidden_role', 403);
  }
}

/** Tenant-scope check. super_admin bypasses; everyone else must match
 *  their own tenantId. */
export function requireTenantScope(session: Session, tenantId: string): void {
  const role = session.user.role as Role | null | undefined;
  if (role === 'super_admin') return;
  if (session.user.tenantId !== tenantId) {
    throw new AuthError('forbidden_tenant', 403);
  }
}

/** Require a business userType + an allowed business role. Used by
 *  every /api/admin/* endpoint. */
export function requireBusiness(session: Session, roles: readonly Role[]): void {
  const userType = session.user.userType as UserType | null | undefined;
  if (userType !== 'business') {
    throw new AuthError('forbidden_user_type', 403);
  }
  requireRole(session, roles);
}

/** Require a client userType. Used by every /api/shop/* endpoint
 *  (added in Phase 2 — guard ships here so the API and UI can
 *  rely on it consistently). */
export function requireClient(session: Session): void {
  const userType = session.user.userType as UserType | null | undefined;
  if (userType !== 'client') {
    throw new AuthError('forbidden_user_type', 403);
  }
}
