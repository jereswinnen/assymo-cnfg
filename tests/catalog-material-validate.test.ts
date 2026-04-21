import { describe, it, expect } from 'vite-plus/test';
import {
  validateMaterialCreate,
  validateMaterialPatch,
  type MaterialCreateInput,
} from '@/domain/catalog';

function base(overrides: Partial<MaterialCreateInput> = {}): MaterialCreateInput {
  return {
    category: 'wall',
    slug: 'oak',
    name: 'Oak',
    color: '#8B6914',
    pricing: { perSqm: 50 },
    ...overrides,
  };
}

describe('validateMaterialCreate', () => {
  it('accepts a minimal wall material', () => {
    const r = validateMaterialCreate(base());
    expect(r.ok).toBe(true);
  });

  it('rejects an unknown category', () => {
    const r = validateMaterialCreate(base({ category: 'ceiling' as never }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'category', code: 'category_invalid' });
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

  it('rejects tileSize with non-positive numbers', () => {
    const r = validateMaterialCreate(base({ tileSize: [0, 2] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'tileSize', code: 'tile_size_invalid' });
  });

  it('rejects tileSize outside allowed range', () => {
    const r = validateMaterialCreate(base({ tileSize: [0.05, 2] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'tileSize', code: 'tile_size_invalid' });
  });

  it('rejects wall material with surcharge instead of perSqm', () => {
    const r = validateMaterialCreate(base({ pricing: { surcharge: 50 } as never }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'pricing', code: 'pricing_invalid' });
  });

  it('rejects door material with perSqm instead of surcharge', () => {
    const r = validateMaterialCreate(base({ category: 'door', slug: 'alu', pricing: { perSqm: 50 } as never }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'pricing', code: 'pricing_invalid' });
  });

  it('accepts a roof-trim material with empty pricing', () => {
    const r = validateMaterialCreate(
      base({ category: 'roof-trim', slug: 'metal-trim', pricing: {} }),
    );
    expect(r.ok).toBe(true);
  });

  it('rejects clearsOpenings flag on non-wall material', () => {
    const r = validateMaterialCreate(
      base({ category: 'floor', slug: 'beton', pricing: { perSqm: 30 }, flags: { clearsOpenings: true } as never }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'flags', code: 'flags_invalid' });
  });

  it('rejects isVoid flag on non-floor material', () => {
    const r = validateMaterialCreate(base({ flags: { isVoid: true } as never }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'flags', code: 'flags_invalid' });
  });

  it('accepts clearsOpenings on wall', () => {
    const r = validateMaterialCreate(base({ flags: { clearsOpenings: true } }));
    expect(r.ok).toBe(true);
  });

  it('accepts isVoid on floor', () => {
    const r = validateMaterialCreate(
      base({ category: 'floor', slug: 'geen', pricing: { perSqm: 0 }, flags: { isVoid: true } }),
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

describe('validateMaterialPatch', () => {
  it('accepts an empty patch', () => {
    const r = validateMaterialPatch({});
    expect(r.ok).toBe(true);
  });

  it('rejects category if present (not changeable)', () => {
    const r = validateMaterialPatch({ category: 'door' as never });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'category', code: 'category_invalid' });
  });

  it('rejects an invalid slug on patch', () => {
    const r = validateMaterialPatch({ slug: 'Oak Wood' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'slug', code: 'slug_invalid' });
  });

  it('accepts a valid pricing patch', () => {
    const r = validateMaterialPatch({ pricing: { perSqm: 75 } });
    expect(r.ok).toBe(true);
  });

  it('accepts clearing textures to null', () => {
    const r = validateMaterialPatch({ textures: null });
    expect(r.ok).toBe(true);
  });
});
