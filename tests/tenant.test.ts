import { describe, it, expect } from 'vite-plus/test';
import {
  DEFAULT_TENANT_ID,
  getTenantById,
  resolveTenantFromHost,
} from '@/domain/tenant';

describe('tenant resolver', () => {
  it('resolves localhost to the default assymo tenant', () => {
    expect(resolveTenantFromHost('localhost').id).toBe('assymo');
    expect(resolveTenantFromHost('localhost:3000').id).toBe('assymo');
  });

  it('falls back to the default tenant for unknown hosts', () => {
    expect(resolveTenantFromHost('unregistered.example.com').id).toBe(DEFAULT_TENANT_ID);
  });

  it('falls back for null/undefined host', () => {
    expect(resolveTenantFromHost(null).id).toBe(DEFAULT_TENANT_ID);
    expect(resolveTenantFromHost(undefined).id).toBe(DEFAULT_TENANT_ID);
  });

  it('handles uppercase host values', () => {
    expect(resolveTenantFromHost('ASSYMO.BE').id).toBe('assymo');
  });
});

describe('getTenantById', () => {
  it('returns the assymo tenant with a priceBook attached', () => {
    const tenant = getTenantById('assymo');
    expect(tenant.id).toBe('assymo');
    expect(tenant.priceBook.postPrice).toBeGreaterThan(0);
    expect(tenant.priceBook.doorBase.enkel).toBeGreaterThan(0);
  });

  it('falls back to the default tenant for unknown ids', () => {
    const tenant = getTenantById('no-such-tenant');
    expect(tenant.id).toBe(DEFAULT_TENANT_ID);
  });
});
