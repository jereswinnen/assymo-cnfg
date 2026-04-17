import { describe, it, expect } from 'vite-plus/test';
import {
  AuthError,
  requireRole,
  requireTenantScope,
} from '@/lib/auth-guards';
import type { Session } from '@/lib/auth';

// Fabricate just enough of a Session for the pure guards. The real
// session has many more fields but the guards only read user.role +
// user.tenantId, so this shape is sufficient.
function mkSession(role: string | null, tenantId: string | null): Session {
  return {
    session: {} as Session['session'],
    user: {
      role,
      tenantId,
    } as Session['user'],
  };
}

describe('requireRole', () => {
  it('passes when the role is allowed', () => {
    const s = mkSession('super_admin', null);
    expect(() => requireRole(s, ['super_admin'])).not.toThrow();
  });

  it('throws forbidden_role when the role is not in the list', () => {
    const s = mkSession('staff', 'assymo');
    try {
      requireRole(s, ['super_admin', 'tenant_admin']);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).code).toBe('forbidden_role');
      expect((err as AuthError).status).toBe(403);
    }
  });

  it('throws when the user has no role at all', () => {
    const s = mkSession(null, 'assymo');
    expect(() => requireRole(s, ['staff'])).toThrow(AuthError);
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

  it('staff can touch its own tenant only', () => {
    const s = mkSession('staff', 'assymo');
    expect(() => requireTenantScope(s, 'assymo')).not.toThrow();
    expect(() => requireTenantScope(s, 'other')).toThrow(AuthError);
  });

  it('throws forbidden_tenant when mismatched', () => {
    const s = mkSession('staff', 'assymo');
    try {
      requireTenantScope(s, 'other');
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as AuthError).code).toBe('forbidden_tenant');
    }
  });
});
