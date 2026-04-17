import { NextResponse } from 'next/server';
import type { Session } from './auth';

export type Role = 'super_admin' | 'tenant_admin' | 'staff';

export const ALL_ROLES = ['super_admin', 'tenant_admin', 'staff'] as const satisfies readonly Role[];

/** Machine-readable error codes returned by the guards. Kept stable so
 *  the client can branch on them (401 vs 403 vs 403_tenant). */
export type AuthErrorCode =
  | 'unauthenticated'
  | 'forbidden_role'
  | 'forbidden_tenant';

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    public readonly status: number,
  ) {
    super(code);
  }
}

/** Require the session's user role to be one of the given values.
 *  Throws AuthError('forbidden_role', 403) otherwise. */
export function requireRole(session: Session, roles: readonly Role[]): void {
  const role = session.user.role as Role | null | undefined;
  if (!role || !roles.includes(role)) {
    throw new AuthError('forbidden_role', 403);
  }
}

/** Enforce tenant-scope access. `super_admin` can touch any tenant;
 *  everyone else is limited to their own `tenantId`. Throws
 *  AuthError('forbidden_tenant', 403) otherwise. */
export function requireTenantScope(session: Session, tenantId: string): void {
  const role = session.user.role as Role | null | undefined;
  if (role === 'super_admin') return;
  if (session.user.tenantId !== tenantId) {
    throw new AuthError('forbidden_tenant', 403);
  }
}

/** Convert any thrown error into a JSON response: AuthError becomes
 *  its declared status + code, anything else re-throws so Next's
 *  error boundary renders a 500. */
export function toAuthErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.code }, { status: err.status });
  }
  throw err;
}
