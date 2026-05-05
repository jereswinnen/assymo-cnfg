import { describe, it, expect } from 'vite-plus/test';
import {
  dakbakRange,
  validateProductCreate,
  validateProductPatch,
  type MaterialRow,
  type ProductCreateInput,
  type ProductRow,
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

function gateMaterial(slug = 'staal-antraciet'): MaterialRow {
  return {
    id: `mat-${slug}`,
    tenantId: 't1',
    categories: ['gate'],
    slug,
    name: slug,
    color: '#222222',
    textures: null,
    tileSize: null,
    pricing: { gate: { perSqm: 100 } },
    flags: {},
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('validateProductCreate', () => {
  it('accepts a minimal valid product', () => {
    const r = validateProductCreate(base(), []);
    expect(r.ok).toBe(true);
  });

  it('rejects an unknown kind', () => {
    const r = validateProductCreate(base({ kind: 'paal' as never }), []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'kind', code: 'kind_invalid' });
  });

  it('rejects an invalid slug', () => {
    const r = validateProductCreate(base({ slug: 'Bad Slug!' }), []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'slug', code: 'slug_invalid' });
  });

  it('rejects an empty name', () => {
    const r = validateProductCreate(base({ name: '' }), []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'name', code: 'name_invalid' });
  });

  it('rejects description longer than 1000 chars', () => {
    const r = validateProductCreate(base({ description: 'x'.repeat(1001) }), []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'description', code: 'description_invalid' });
  });

  it('rejects a non-URL hero image', () => {
    const r = validateProductCreate(base({ heroImage: 'not a url' }), []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'heroImage', code: 'hero_image_invalid' });
  });

  it('accepts null hero image', () => {
    const r = validateProductCreate(base({ heroImage: null }), []);
    expect(r.ok).toBe(true);
  });

  it('rejects defaults.width below 0.5 or above 40', () => {
    const r1 = validateProductCreate(base({ defaults: { width: 0.1 } }), []);
    expect(r1.ok).toBe(false);
    const r2 = validateProductCreate(base({ defaults: { width: 100 } }), []);
    expect(r2.ok).toBe(false);
  });

  it('rejects constraints where minWidth > maxWidth', () => {
    const r = validateProductCreate(base({ constraints: { minWidth: 10, maxWidth: 5 } }), []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'constraints', code: 'constraints_invalid' });
  });

  it('rejects allow-list with non-string entries', () => {
    const r = validateProductCreate(
      base({ constraints: { allowedMaterialsBySlot: { wallCladding: [123 as never] } } }),
      [],
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'constraints', code: 'constraints_invalid' });
  });

  it('rejects negative basePriceCents', () => {
    const r = validateProductCreate(base({ basePriceCents: -1 }), []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ field: 'basePriceCents', code: 'base_price_invalid' });
  });

  it('accepts empty constraints object', () => {
    const r = validateProductCreate(base({ constraints: {} }), []);
    expect(r.ok).toBe(true);
  });

  it('returns the cleaned value with defaults filled', () => {
    const r = validateProductCreate(base(), []);
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.description).toBeNull();
    expect(r.value.heroImage).toBeNull();
    expect(r.value.basePriceCents).toBe(0);
    expect(r.value.sortOrder).toBe(0);
  });
});

describe('validateProductCreate — poort branch', () => {
  function poortBase(overrides: Partial<ProductCreateInput> = {}): ProductCreateInput {
    return {
      kind: 'poort',
      slug: 'standaard-poort',
      name: 'Standaard Poort',
      defaults: {
        poort: {
          partCount: 2,
          partWidthMm: 1500,
          heightMm: 2000,
          swingDirection: 'inward',
          motorized: false,
          materialId: 'staal-antraciet',
        },
      },
      constraints: {
        poort: {
          partCountAllowed: [1, 2],
          partWidthMinMm: 500,
          partWidthMaxMm: 3000,
          heightMinMm: 1500,
          heightMaxMm: 2500,
          swingsAllowed: ['inward', 'outward'],
          motorizedAllowed: true,
          allowedMaterialSlugs: ['staal-antraciet'],
        },
      },
      ...overrides,
    };
  }

  it('accepts a valid poort product when tenant has a gate material', () => {
    const r = validateProductCreate(poortBase(), [gateMaterial()]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.defaults.poort?.partCount).toBe(2);
      expect(r.value.constraints.poort?.allowedMaterialSlugs).toEqual(['staal-antraciet']);
    }
  });

  it('rejects poort when tenant has no gate materials', () => {
    const r = validateProductCreate(poortBase(), []);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors).toContainEqual({ field: 'kind', code: 'kind_unsupported_for_tenant' });
  });

  it('rejects poort when only gate materials are archived', () => {
    const archived = { ...gateMaterial(), archivedAt: '2026-01-02T00:00:00.000Z' };
    const r = validateProductCreate(poortBase(), [archived]);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors).toContainEqual({ field: 'kind', code: 'kind_unsupported_for_tenant' });
  });

  it('rejects defaults.poort.partCount = 3', () => {
    const input = poortBase({
      defaults: { poort: { partCount: 3 as never, partWidthMm: 1500, heightMm: 2000 } },
    });
    const r = validateProductCreate(input, [gateMaterial()]);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors).toContainEqual({
        field: 'defaults.poort.partCount',
        code: 'poort_part_count_invalid',
      });
  });

  it('rejects defaults.poort.heightMm below the envelope', () => {
    const input = poortBase({
      defaults: { poort: { heightMm: 50 } },
    });
    const r = validateProductCreate(input, [gateMaterial()]);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors).toContainEqual({
        field: 'defaults.poort.heightMm',
        code: 'poort_height_invalid',
      });
  });

  it('rejects an invalid swingDirection', () => {
    const input = poortBase({
      defaults: { poort: { swingDirection: 'whatever' as never } },
    });
    const r = validateProductCreate(input, [gateMaterial()]);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors).toContainEqual({
        field: 'defaults.poort.swingDirection',
        code: 'poort_swing_invalid',
      });
  });

  it('rejects defaults.poort.materialId pointing at unknown slug', () => {
    const input = poortBase({
      defaults: { poort: { materialId: 'no-such-slug' } },
    });
    const r = validateProductCreate(input, [gateMaterial()]);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors).toContainEqual({
        field: 'defaults.poort.materialId',
        code: 'poort_material_invalid',
      });
  });

  it('rejects constraints with partWidthMinMm > partWidthMaxMm', () => {
    const input = poortBase({
      constraints: {
        poort: { partWidthMinMm: 3000, partWidthMaxMm: 1500 },
      },
    });
    const r = validateProductCreate(input, [gateMaterial()]);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors).toContainEqual({
        field: 'constraints.poort',
        code: 'constraints_invalid',
      });
  });

  it('rejects allowedMaterialSlugs referencing unknown gate slug', () => {
    const input = poortBase({
      constraints: {
        poort: { allowedMaterialSlugs: ['no-such-slug'] },
      },
    });
    const r = validateProductCreate(input, [gateMaterial()]);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors).toContainEqual({
        field: 'constraints.poort.allowedMaterialSlugs',
        code: 'poort_material_invalid',
      });
  });

  it('rejects cross-kind contamination: overkapping with defaults.poort', () => {
    const input = base({
      defaults: { width: 4, depth: 3, height: 2.6, poort: { partCount: 2 } },
    });
    const r = validateProductCreate(input, [gateMaterial()]);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors).toContainEqual({ field: 'defaults.poort', code: 'kind_field_mismatch' });
  });

  it('rejects poort with non-poort structural fields (defaults.width)', () => {
    const input = poortBase({
      defaults: { width: 4, poort: { partCount: 2 } },
    });
    const r = validateProductCreate(input, [gateMaterial()]);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors).toContainEqual({ field: 'defaults', code: 'kind_field_mismatch' });
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

describe('validateProductCreate — dakbak', () => {
  it('accepts in-range defaults and constraints', () => {
    const r = validateProductCreate(
      base({
        defaults: { width: 4, depth: 3, height: 2.6, dakbak: { fasciaHeight: 0.4, fasciaOverhang: 0.2 } },
        constraints: {
          dakbak: {
            fasciaHeightMin: 0.36,
            fasciaHeightMax: 0.5,
            fasciaOverhangMin: 0.1,
            fasciaOverhangMax: 0.3,
          },
        },
      }),
      [],
    );
    expect(r.ok).toBe(true);
  });

  it('rejects fasciaHeightMin below global MIN', () => {
    const r = validateProductCreate(
      base({ constraints: { dakbak: { fasciaHeightMin: 0.05 } } }),
      [],
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual({
        field: 'constraints.dakbak.fasciaHeightMin',
        code: 'fascia_height_invalid',
      });
    }
  });

  it('rejects fasciaHeightMax above global MAX', () => {
    const r = validateProductCreate(
      base({ constraints: { dakbak: { fasciaHeightMax: 0.9 } } }),
      [],
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual({
        field: 'constraints.dakbak.fasciaHeightMax',
        code: 'fascia_height_invalid',
      });
    }
  });

  it('rejects min > max', () => {
    const r = validateProductCreate(
      base({ constraints: { dakbak: { fasciaHeightMin: 0.55, fasciaHeightMax: 0.40 } } }),
      [],
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual({
        field: 'constraints.dakbak.fasciaHeightMin',
        code: 'fascia_height_range_invalid',
      });
    }
  });

  it('accepts min === max (locked)', () => {
    const r = validateProductCreate(
      base({
        defaults: { width: 4, depth: 3, height: 2.6, dakbak: { fasciaHeight: 0.4 } },
        constraints: { dakbak: { fasciaHeightMin: 0.4, fasciaHeightMax: 0.4 } },
      }),
      [],
    );
    expect(r.ok).toBe(true);
  });

  it('rejects default outside the product-narrowed range', () => {
    const r = validateProductCreate(
      base({
        defaults: { width: 4, depth: 3, height: 2.6, dakbak: { fasciaHeight: 0.55 } },
        constraints: { dakbak: { fasciaHeightMin: 0.3, fasciaHeightMax: 0.5 } },
      }),
      [],
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual({
        field: 'defaults.dakbak.fasciaHeight',
        code: 'fascia_default_invalid',
      });
    }
  });

  it('rejects fasciaOverhang default below global MIN', () => {
    const r = validateProductCreate(
      base({ defaults: { width: 4, depth: 3, height: 2.6, dakbak: { fasciaOverhang: -0.05 } } }),
      [],
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual({
        field: 'defaults.dakbak.fasciaOverhang',
        code: 'fascia_default_invalid',
      });
    }
  });

  it('rejects defaults.dakbak on poort products', () => {
    const r = validateProductCreate(
      {
        kind: 'poort',
        slug: 'g1',
        name: 'Gate',
        description: null,
        heroImage: null,
        defaults: { dakbak: { fasciaHeight: 0.4 } },
        constraints: {},
        basePriceCents: 0,
        sortOrder: 0,
      },
      [gateMaterial()],
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual({
        field: 'defaults.dakbak',
        code: 'kind_field_mismatch',
      });
    }
  });

  it('rejects constraints.dakbak on poort products', () => {
    const r = validateProductCreate(
      {
        kind: 'poort',
        slug: 'g2',
        name: 'Gate',
        description: null,
        heroImage: null,
        defaults: {},
        constraints: { dakbak: { fasciaHeightMin: 0.3, fasciaHeightMax: 0.5 } },
        basePriceCents: 0,
        sortOrder: 0,
      },
      [gateMaterial()],
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual({
        field: 'constraints.dakbak',
        code: 'kind_field_mismatch',
      });
    }
  });
});

describe('dakbakRange', () => {
  const productRow = (constraints: Partial<ProductRow['constraints']>): ProductRow => ({
    id: 'p', tenantId: 't', kind: 'overkapping', slug: 's', name: 'n',
    description: null, heroImage: null,
    defaults: {},
    constraints: constraints as ProductRow['constraints'],
    basePriceCents: 0, sortOrder: 0,
    archivedAt: null, createdAt: '', updatedAt: '',
  });

  it('returns global range for null product', () => {
    expect(dakbakRange(null)).toEqual({
      height:   { min: 0.36, max: 0.60 },
      overhang: { min: 0,    max: 0.80 },
    });
  });

  it('returns global range for product with no dakbak constraints', () => {
    expect(dakbakRange(productRow({}))).toEqual({
      height:   { min: 0.36, max: 0.60 },
      overhang: { min: 0,    max: 0.80 },
    });
  });

  it('intersects with product constraints when present', () => {
    const r = dakbakRange(productRow({
      dakbak: { fasciaHeightMin: 0.30, fasciaHeightMax: 0.50, fasciaOverhangMin: 0.10, fasciaOverhangMax: 0.40 },
    }));
    expect(r).toEqual({
      height:   { min: 0.30, max: 0.50 },
      overhang: { min: 0.10, max: 0.40 },
    });
  });

  it('respects partial narrowing — only the provided bound moves', () => {
    const r = dakbakRange(productRow({
      dakbak: { fasciaHeightMin: 0.40 },
    }));
    expect(r).toEqual({
      height:   { min: 0.40, max: 0.60 },
      overhang: { min: 0,    max: 0.80 },
    });
  });

  it('returns equal min and max when product locks the value', () => {
    const r = dakbakRange(productRow({
      dakbak: { fasciaHeightMin: 0.45, fasciaHeightMax: 0.45 },
    }));
    expect(r.height).toEqual({ min: 0.45, max: 0.45 });
  });
});
