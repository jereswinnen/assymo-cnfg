import { describe, it, expect } from 'vite-plus/test';
import {
  validateMaterialCreate,
  validateMaterialPatch,
  type MaterialCreateInput,
} from '@/domain/catalog';

function base(overrides: Partial<MaterialCreateInput> = {}): MaterialCreateInput {
  return {
    categories: ['wall'],
    slug: 'oak',
    name: 'Oak',
    color: '#8B6914',
    pricing: { wall: { perSqm: 50 } },
    ...overrides,
  };
}

describe('validateMaterialCreate', () => {
  it('accepts a minimal wall material', () => {
    const r = validateMaterialCreate(base());
    expect(r.ok).toBe(true);
  });

  it('rejects an empty categories array', () => {
    const r = validateMaterialCreate(base({ categories: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'categories', code: 'categories_empty' });
  });

  it('rejects an unknown category', () => {
    const r = validateMaterialCreate(base({ categories: ['ceiling'] as never }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'categories', code: 'categories_invalid' });
  });

  it('rejects an invalid slug', () => {
    const r = validateMaterialCreate(base({ slug: 'Oak Wood' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'slug', code: 'slug_invalid' });
  });

  it('rejects an empty name', () => {
    const r = validateMaterialCreate(base({ name: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'name', code: 'name_invalid' });
  });

  it('rejects a malformed color', () => {
    const r = validateMaterialCreate(base({ color: 'red' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'color', code: 'color_invalid' });
  });

  it('rejects textures with missing slot', () => {
    const r = validateMaterialCreate(
      base({ textures: { color: 'https://blob/c.jpg', normal: '', roughness: 'https://blob/r.jpg' } as never }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'textures', code: 'textures_invalid' });
  });

  it('rejects tileSize outside allowed range', () => {
    const r = validateMaterialCreate(base({ tileSize: [0.05, 2] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'tileSize', code: 'tile_size_invalid' });
  });

  it('rejects wall material with door pricing shape', () => {
    const r = validateMaterialCreate(
      base({ pricing: { wall: { surcharge: 50 } } as never }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'pricing_invalid')).toBe(true);
  });

  it('rejects pricing entries for categories the material does not claim', () => {
    const r = validateMaterialCreate(
      base({ pricing: { wall: { perSqm: 50 }, floor: { perSqm: 30 } } as never }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'pricing_category_mismatch')).toBe(true);
  });

  it('accepts a multi-category material with per-category pricing', () => {
    const r = validateMaterialCreate(
      base({
        categories: ['wall', 'door', 'roof-trim'],
        pricing: { wall: { perSqm: 50 }, door: { surcharge: 20 } },
      }),
    );
    expect(r.ok).toBe(true);
  });

  it('accepts a roof-trim-only material with empty pricing', () => {
    const r = validateMaterialCreate(
      base({ categories: ['roof-trim'], slug: 'metal-trim', pricing: {} }),
    );
    expect(r.ok).toBe(true);
  });

  it('requires pricing for every pricing-bearing category', () => {
    // Material claims wall + door but only provides wall pricing.
    const r = validateMaterialCreate(
      base({
        categories: ['wall', 'door'],
        pricing: { wall: { perSqm: 50 } },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'pricing_invalid')).toBe(true);
  });

  it('rejects clearsOpenings flag on non-wall material', () => {
    const r = validateMaterialCreate(
      base({
        categories: ['floor'],
        slug: 'beton',
        pricing: { floor: { perSqm: 30 } },
        flags: { clearsOpenings: true },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'flags', code: 'flags_invalid' });
  });

  it('rejects isVoid flag on non-floor material', () => {
    const r = validateMaterialCreate(base({ flags: { isVoid: true } }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'flags', code: 'flags_invalid' });
  });

  it('accepts clearsOpenings on wall', () => {
    const r = validateMaterialCreate(base({ flags: { clearsOpenings: true } }));
    expect(r.ok).toBe(true);
  });

  it('accepts isVoid on floor', () => {
    const r = validateMaterialCreate(
      base({
        categories: ['floor'],
        slug: 'geen',
        pricing: { floor: { perSqm: 0 } },
        flags: { isVoid: true },
      }),
    );
    expect(r.ok).toBe(true);
  });

  it('returns the cleaned value on success with default flags and nullable slots', () => {
    const r = validateMaterialCreate(base());
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.textures).toBeNull();
    expect(r.value.tileSize).toBeNull();
    expect(r.value.flags).toEqual({});
  });
});

describe('validateMaterialCreate — gate category', () => {
  it('accepts a valid gate material with perSqm pricing', () => {
    const r = validateMaterialCreate(
      base({
        categories: ['gate'],
        slug: 'staal-antraciet',
        name: 'Staal antraciet',
        color: '#3a3d40',
        pricing: { gate: { perSqm: 18000 } },
      }),
    );
    expect(r.ok).toBe(true);
  });

  it('rejects negative gate.perSqm', () => {
    const r = validateMaterialCreate(
      base({
        categories: ['gate'],
        slug: 'staal',
        pricing: { gate: { perSqm: -1 } },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'pricing.gate', code: 'pricing_invalid' });
  });

  it('rejects non-finite gate.perSqm', () => {
    const r = validateMaterialCreate(
      base({
        categories: ['gate'],
        slug: 'staal',
        pricing: { gate: { perSqm: Number.POSITIVE_INFINITY } },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'pricing.gate', code: 'pricing_invalid' });
  });

  it('rejects gate pricing on a wall-only material', () => {
    const r = validateMaterialCreate(
      base({
        categories: ['wall'],
        pricing: { wall: { perSqm: 50 }, gate: { perSqm: 18000 } } as never,
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'pricing_category_mismatch')).toBe(true);
  });

  it('rejects gate material with door-shaped pricing', () => {
    const r = validateMaterialCreate(
      base({
        categories: ['gate'],
        slug: 'staal',
        pricing: { gate: { surcharge: 18000 } } as never,
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'pricing.gate', code: 'pricing_invalid' });
  });

  it('rejects clearsOpenings flag on a gate-only material', () => {
    const r = validateMaterialCreate(
      base({
        categories: ['gate'],
        slug: 'staal',
        pricing: { gate: { perSqm: 18000 } },
        flags: { clearsOpenings: true },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'flags', code: 'flags_invalid' });
  });
});

describe('validateMaterialPatch', () => {
  it('accepts an empty patch', () => {
    const r = validateMaterialPatch({});
    expect(r.ok).toBe(true);
  });

  it('accepts a categories patch', () => {
    const r = validateMaterialPatch({ categories: ['wall', 'door'] });
    expect(r.ok).toBe(true);
  });

  it('rejects an empty categories array on patch', () => {
    const r = validateMaterialPatch({ categories: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'categories', code: 'categories_empty' });
  });

  it('rejects an invalid slug on patch', () => {
    const r = validateMaterialPatch({ slug: 'Oak Wood' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'slug', code: 'slug_invalid' });
  });

  it('accepts a pricing patch (shape-only — coherence checked in route)', () => {
    const r = validateMaterialPatch({ pricing: { wall: { perSqm: 75 } } });
    expect(r.ok).toBe(true);
  });

  it('accepts clearing textures to null', () => {
    const r = validateMaterialPatch({ textures: null });
    expect(r.ok).toBe(true);
  });

  it('accepts a patch that adds gate pricing (shape-only)', () => {
    const r = validateMaterialPatch({ pricing: { gate: { perSqm: 18000 } } });
    expect(r.ok).toBe(true);
  });
});
