import { describe, it, expect } from 'vite-plus/test';
import {
  AuthError,
  requireRole,
  requireTenantScope,
  requireBusiness,
  requireClient,
  type UserType,
} from '@/lib/auth-guards';
import type { Session } from '@/lib/auth';

function mkSession(
  role: string | null,
  tenantId: string | null,
  userType: UserType | null = 'business',
): Session {
  return {
    session: {} as Session['session'],
    user: { role, tenantId, userType } as Session['user'],
  };
}

describe('requireRole', () => {
  it('passes when the role is allowed', () => {
    expect(() =>
      requireRole(mkSession('super_admin', null), ['super_admin']),
    ).not.toThrow();
  });

  it('throws forbidden_role when the role is not in the list', () => {
    try {
      requireRole(mkSession('tenant_admin', 'assymo'), ['super_admin']);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).code).toBe('forbidden_role');
      expect((err as AuthError).status).toBe(403);
    }
  });

  it('throws when the user has no role at all', () => {
    expect(() =>
      requireRole(mkSession(null, 'assymo'), ['tenant_admin']),
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
  it('passes for a business user with an allowed role', () => {
    expect(() =>
      requireBusiness(mkSession('tenant_admin', 'assymo', 'business'), ['tenant_admin']),
    ).not.toThrow();
  });

  it('throws forbidden_user_type when the user is a client', () => {
    try {
      requireBusiness(mkSession('tenant_admin', 'assymo', 'client'), ['tenant_admin']);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as AuthError).code).toBe('forbidden_user_type');
    }
  });

  it('throws forbidden_role when the role is not allowed', () => {
    try {
      requireBusiness(mkSession('tenant_admin', 'assymo', 'business'), ['super_admin']);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as AuthError).code).toBe('forbidden_role');
    }
  });
});

describe('requireClient', () => {
  it('passes for a client user', () => {
    expect(() =>
      requireClient(mkSession(null, 'assymo', 'client')),
    ).not.toThrow();
  });

  it('throws forbidden_user_type for a business user', () => {
    try {
      requireClient(mkSession('tenant_admin', 'assymo', 'business'));
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as AuthError).code).toBe('forbidden_user_type');
    }
  });
});
