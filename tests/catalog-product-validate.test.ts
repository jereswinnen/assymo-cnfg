import { describe, it, expect } from 'vite-plus/test';
import {
  validateProductCreate,
  validateProductPatch,
  type ProductCreateInput,
} from '@/domain/catalog';

function base(overrides: Partial<ProductCreateInput> = {}): ProductCreateInput {
  return {
    kind: 'overkapping',
    slug: 'pergola-standaard',
    name: 'Standaard Pergola',
    defaults: { width: 4, depth: 3, height: 2.6 },
    constraints: {},
    ...overrides,
  };
}

describe('validateProductCreate', () => {
  it('accepts a minimal valid product', () => {
    const r = validateProductCreate(base());
    expect(r.ok).toBe(true);
  });

  it('rejects an unknown kind', () => {
    const r = validateProductCreate(base({ kind: 'paal' as never }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'kind', code: 'kind_invalid' });
  });

  it('rejects an invalid slug', () => {
    const r = validateProductCreate(base({ slug: 'Bad Slug!' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'slug', code: 'slug_invalid' });
  });

  it('rejects an empty name', () => {
    const r = validateProductCreate(base({ name: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'name', code: 'name_invalid' });
  });

  it('rejects description longer than 1000 chars', () => {
    const r = validateProductCreate(base({ description: 'x'.repeat(1001) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'description', code: 'description_invalid' });
  });

  it('rejects a non-URL hero image', () => {
    const r = validateProductCreate(base({ heroImage: 'not a url' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'heroImage', code: 'hero_image_invalid' });
  });

  it('accepts null hero image', () => {
    const r = validateProductCreate(base({ heroImage: null }));
    expect(r.ok).toBe(true);
  });

  it('rejects defaults.width below 0.5 or above 40', () => {
    const r1 = validateProductCreate(base({ defaults: { width: 0.1 } }));
    expect(r1.ok).toBe(false);
    const r2 = validateProductCreate(base({ defaults: { width: 100 } }));
    expect(r2.ok).toBe(false);
  });

  it('rejects constraints where minWidth > maxWidth', () => {
    const r = validateProductCreate(base({ constraints: { minWidth: 10, maxWidth: 5 } }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'constraints', code: 'constraints_invalid' });
  });

  it('rejects allow-list with non-string entries', () => {
    const r = validateProductCreate(
      base({ constraints: { allowedMaterialsBySlot: { wallCladding: [123 as never] } } }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'constraints', code: 'constraints_invalid' });
  });

  it('rejects negative basePriceCents', () => {
    const r = validateProductCreate(base({ basePriceCents: -1 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'basePriceCents', code: 'base_price_invalid' });
  });

  it('accepts empty constraints object', () => {
    const r = validateProductCreate(base({ constraints: {} }));
    expect(r.ok).toBe(true);
  });

  it('returns the cleaned value with defaults filled', () => {
    const r = validateProductCreate(base());
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.description).toBeNull();
    expect(r.value.heroImage).toBeNull();
    expect(r.value.basePriceCents).toBe(0);
    expect(r.value.sortOrder).toBe(0);
  });
});

describe('validateProductPatch', () => {
  it('accepts an empty patch', () => {
    const r = validateProductPatch({});
    expect(r.ok).toBe(true);
  });

  it('rejects kind presence (not changeable)', () => {
    const r = validateProductPatch({ kind: 'berging' as never });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'kind', code: 'kind_invalid' });
  });

  it('accepts a slug-only patch', () => {
    const r = validateProductPatch({ slug: 'new-slug' });
    expect(r.ok).toBe(true);
  });

  it('rejects invalid slug on patch', () => {
    const r = validateProductPatch({ slug: 'Bad!' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'slug', code: 'slug_invalid' });
  });
});
