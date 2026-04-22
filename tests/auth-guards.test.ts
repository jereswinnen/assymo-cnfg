import { describe, it, expect } from 'vite-plus/test';
import {
  AuthError,
  requireKind,
  requireTenantScope,
  requireBusiness,
  requireClient,
  type UserKind,
} from '@/lib/auth-guards';
import type { Session } from '@/lib/auth';

function mkSession(
  kind: UserKind | null,
  tenantId: string | null,
): Session {
  return {
    session: {} as Session['session'],
    user: { kind, tenantId } as Session['user'],
  };
}

describe('requireKind', () => {
  it('passes when the kind is allowed', () => {
    expect(() =>
      requireKind(mkSession('super_admin', null), ['super_admin']),
    ).not.toThrow();
  });

  it('throws forbidden_kind when the kind is not in the list', () => {
    try {
      requireKind(mkSession('tenant_admin', 'assymo'), ['super_admin']);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).code).toBe('forbidden_kind');
      expect((err as AuthError).status).toBe(403);
    }
  });

  it('throws when the user has no kind at all', () => {
    expect(() =>
      requireKind(mkSession(null, 'assymo'), ['tenant_admin']),
    ).toThrow(AuthError);
  });
});

describe('requireTenantScope', () => {
  it('super_admin can touch any tenant', () => {
    const s = mkSession('super_admin', null);
    expect(() => requireTenantScope(s, 'assymo')).not.toThrow();
    expect(() => requireTenantScope(s, 'other')).not.toThrow();
  });

  it('tenant_admin can touch its own tenant only', () => {
    const s = mkSession('tenant_admin', 'assymo');
    expect(() => requireTenantScope(s, 'assymo')).not.toThrow();
    expect(() => requireTenantScope(s, 'other')).toThrow(AuthError);
  });

  it('throws forbidden_tenant when mismatched', () => {
    try {
      requireTenantScope(mkSession('tenant_admin', 'assymo'), 'other');
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as AuthError).code).toBe('forbidden_tenant');
    }
  });
});

describe('requireBusiness', () => {
  it('passes for a tenant_admin with an allowed kind', () => {
    expect(() =>
      requireBusiness(mkSession('tenant_admin', 'assymo'), ['tenant_admin']),
    ).not.toThrow();
  });

  it('passes for a super_admin with an allowed kind', () => {
    expect(() =>
      requireBusiness(mkSession('super_admin', null), ['super_admin', 'tenant_admin']),
    ).not.toThrow();
  });

  it('throws forbidden_kind when the user is a client', () => {
    try {
      requireBusiness(mkSession('client', 'assymo'), ['tenant_admin']);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as AuthError).code).toBe('forbidden_kind');
    }
  });

  it('throws forbidden_kind when the kind is not allowed', () => {
    try {
      requireBusiness(mkSession('tenant_admin', 'assymo'), ['super_admin']);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as AuthError).code).toBe('forbidden_kind');
    }
  });
});

describe('requireClient', () => {
  it('passes for a client user', () => {
    expect(() =>
      requireClient(mkSession('client', 'assymo')),
    ).not.toThrow();
  });

  it('throws forbidden_kind for a business user', () => {
    try {
      requireClient(mkSession('tenant_admin', 'assymo'));
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as AuthError).code).toBe('forbidden_kind');
    }
  });
});
