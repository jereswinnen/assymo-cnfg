import { describe, it, expect } from 'vite-plus/test';
import {
  DEFAULT_TENANT_GEOMETRY,
  POST_SIZE_PRESETS_MM,
  resolveTenantGeometry,
  validateGeometryPatch,
} from '@/domain/tenant';

describe('TenantGeometry', () => {
  it('defaults postSizeMm to 150', () => {
    expect(DEFAULT_TENANT_GEOMETRY.postSizeMm).toBe(150);
  });

  it('exposes a small list of common presets', () => {
    expect(POST_SIZE_PRESETS_MM.length).toBeGreaterThan(0);
    expect(POST_SIZE_PRESETS_MM).toContain(150);
  });
});

describe('resolveTenantGeometry', () => {
  it('returns defaults for null / undefined', () => {
    expect(resolveTenantGeometry(null)).toEqual(DEFAULT_TENANT_GEOMETRY);
    expect(resolveTenantGeometry(undefined)).toEqual(DEFAULT_TENANT_GEOMETRY);
  });

  it('merges a partial value over defaults', () => {
    expect(resolveTenantGeometry({ postSizeMm: 140 })).toEqual({
      ...DEFAULT_TENANT_GEOMETRY,
      postSizeMm: 140,
    });
  });
});

describe('validateGeometryPatch', () => {
  it('accepts a sane postSizeMm', () => {
    const { geometry, errors } = validateGeometryPatch({ postSizeMm: 140 });
    expect(errors).toEqual([]);
    expect(geometry).toEqual({ postSizeMm: 140 });
  });

  it('rejects a non-object body', () => {
    expect(validateGeometryPatch(null).errors).toContain('body');
    expect(validateGeometryPatch('hello').errors).toContain('body');
  });

  it('rejects out-of-bounds postSizeMm', () => {
    expect(validateGeometryPatch({ postSizeMm: 20 }).errors).toContain('postSizeMm');
    expect(validateGeometryPatch({ postSizeMm: 1000 }).errors).toContain('postSizeMm');
    expect(validateGeometryPatch({ postSizeMm: 'big' }).errors).toContain('postSizeMm');
  });

  it('ignores unrelated fields without erroring', () => {
    const { geometry, errors } = validateGeometryPatch({ unrelated: 'x' });
    expect(errors).toEqual([]);
    expect(geometry).toEqual({});
  });
});
