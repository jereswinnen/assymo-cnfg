import type { Session } from './auth';

export type UserKind = 'super_admin' | 'tenant_admin' | 'client';
export type BusinessKind = 'super_admin' | 'tenant_admin';

export const ALL_USER_KINDS = ['super_admin', 'tenant_admin', 'client'] as const satisfies readonly UserKind[];
export const ALL_BUSINESS_KINDS = ['super_admin', 'tenant_admin'] as const satisfies readonly BusinessKind[];

export type AuthErrorCode =
  | 'unauthenticated'
  | 'forbidden_kind'
  | 'forbidden_tenant';

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    public readonly status: number,
  ) {
    super(code);
  }
}

export function requireKind(session: Session, kinds: readonly UserKind[]): void {
  const kind = session.user.kind as UserKind | null | undefined;
  if (!kind || !kinds.includes(kind)) {
    throw new AuthError('forbidden_kind', 403);
  }
}

export function requireBusiness(session: Session, kinds: readonly BusinessKind[]): void {
  requireKind(session, kinds);
}

export function requireClient(session: Session): void {
  requireKind(session, ['client']);
}

/** Tenant-scope check. super_admin bypasses; everyone else must match
 *  their own tenantId. */
export function requireTenantScope(session: Session, tenantId: string): void {
  const kind = session.user.kind as UserKind | null | undefined;
  if (kind === 'super_admin') return;
  if (session.user.tenantId !== tenantId) {
    throw new AuthError('forbidden_tenant', 403);
  }
}
