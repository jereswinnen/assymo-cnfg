import { describe, it, expect } from 'vite-plus/test';
import {
  DEFAULT_TENANT_FEATURES,
  resolveTenantFeatures,
  validateFeaturesPatch,
} from '@/domain/tenant';

describe('resolveTenantFeatures', () => {
  it('returns the canonical defaults when stored value is null', () => {
    expect(resolveTenantFeatures(null)).toEqual(DEFAULT_TENANT_FEATURES);
  });

  it('returns the canonical defaults when stored value is undefined', () => {
    expect(resolveTenantFeatures(undefined)).toEqual(DEFAULT_TENANT_FEATURES);
  });

  it('merges a partial stored value over defaults', () => {
    const merged = resolveTenantFeatures({ wallElevationView: true });
    expect(merged.wallElevationView).toBe(true);
  });

  it('does not mutate the defaults', () => {
    resolveTenantFeatures({ wallElevationView: true });
    expect(DEFAULT_TENANT_FEATURES.wallElevationView).toBe(false);
  });
});

describe('validateFeaturesPatch', () => {
  it('rejects non-object input', () => {
    expect(validateFeaturesPatch(null).errors).toEqual(['body']);
    expect(validateFeaturesPatch('nope').errors).toEqual(['body']);
    expect(validateFeaturesPatch([]).errors).toEqual(['body']);
  });

  it('accepts a wallElevationView boolean', () => {
    expect(validateFeaturesPatch({ wallElevationView: true })).toEqual({
      features: { wallElevationView: true },
      errors: [],
    });
    expect(validateFeaturesPatch({ wallElevationView: false })).toEqual({
      features: { wallElevationView: false },
      errors: [],
    });
  });

  it('rejects a non-boolean wallElevationView', () => {
    const r = validateFeaturesPatch({ wallElevationView: 'yes' });
    expect(r.errors).toContain('wallElevationView');
    expect(r.features).toEqual({});
  });

  it('returns an empty patch for an empty object (caller decides handling)', () => {
    expect(validateFeaturesPatch({})).toEqual({ features: {}, errors: [] });
  });

  it('ignores unknown keys silently', () => {
    const r = validateFeaturesPatch({ wallElevationView: true, unknown: 42 });
    expect(r.errors).toEqual([]);
    expect(r.features).toEqual({ wallElevationView: true });
  });
});
