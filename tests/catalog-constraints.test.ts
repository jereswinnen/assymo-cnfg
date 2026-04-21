import { describe, it, expect } from 'vite-plus/test';
import {
  filterMaterialsForProduct,
  clampDimensions,
  type ProductConstraints,
  type ProductRow,
  type MaterialRow,
} from '@/domain/catalog';

const mat = (o: Partial<MaterialRow>): MaterialRow => ({
  id: 'm', tenantId: 't',
  category: 'wall', slug: 's', name: 'S', color: '#000000',
  textures: null, tileSize: null,
  pricing: { perSqm: 0 }, flags: {},
  archivedAt: null, createdAt: '', updatedAt: '',
  ...o,
});

const product = (c: ProductConstraints): ProductRow => ({
  id: 'p', tenantId: 't', kind: 'overkapping',
  slug: 's', name: 'S', description: null, heroImage: null,
  defaults: {}, constraints: c,
  basePriceCents: 0, sortOrder: 0,
  archivedAt: null, createdAt: '', updatedAt: '',
});

describe('filterMaterialsForProduct', () => {
  const materials: MaterialRow[] = [
    mat({ id: '1', category: 'wall', slug: 'wood' }),
    mat({ id: '2', category: 'wall', slug: 'brick' }),
    mat({ id: '3', category: 'wall', slug: 'glass' }),
    mat({ id: '4', category: 'floor', slug: 'hout' }),
  ];

  it('returns all wall materials when product is null', () => {
    const out = filterMaterialsForProduct(materials, null, 'wallCladding');
    expect(out.map((m) => m.slug)).toEqual(['wood', 'brick', 'glass']);
  });

  it('returns all wall materials when allow-list for slot is missing', () => {
    const p = product({ allowedMaterialsBySlot: {} });
    const out = filterMaterialsForProduct(materials, p, 'wallCladding');
    expect(out.map((m) => m.slug)).toEqual(['wood', 'brick', 'glass']);
  });

  it('returns all wall materials when allow-list for slot is empty array', () => {
    const p = product({ allowedMaterialsBySlot: { wallCladding: [] } });
    const out = filterMaterialsForProduct(materials, p, 'wallCladding');
    expect(out.map((m) => m.slug)).toEqual(['wood', 'brick', 'glass']);
  });

  it('narrows to allow-listed slugs when populated', () => {
    const p = product({ allowedMaterialsBySlot: { wallCladding: ['wood', 'brick'] } });
    const out = filterMaterialsForProduct(materials, p, 'wallCladding');
    expect(out.map((m) => m.slug)).toEqual(['wood', 'brick']);
  });

  it('ignores allow-list entries that do not exist in materials', () => {
    const p = product({ allowedMaterialsBySlot: { wallCladding: ['wood', 'ghost'] } });
    const out = filterMaterialsForProduct(materials, p, 'wallCladding');
    expect(out.map((m) => m.slug)).toEqual(['wood']);
  });

  it('only returns rows of the category mapped to the slot', () => {
    const p = product({ allowedMaterialsBySlot: { wallCladding: ['wood', 'hout'] } });
    const out = filterMaterialsForProduct(materials, p, 'wallCladding');
    expect(out.map((m) => m.slug)).toEqual(['wood']);
  });
});

describe('clampDimensions', () => {
  it('passes dimensions through when no product', () => {
    expect(clampDimensions({ width: 5, depth: 4, height: 2.6 }, null))
      .toEqual({ width: 5, depth: 4, height: 2.6 });
  });

  it('clamps width to maxWidth', () => {
    const p = product({ maxWidth: 6 });
    expect(clampDimensions({ width: 10 }, p).width).toBe(6);
  });

  it('clamps width to minWidth', () => {
    const p = product({ minWidth: 3 });
    expect(clampDimensions({ width: 1 }, p).width).toBe(3);
  });

  it('clamps all three independently', () => {
    const p = product({
      minWidth: 2, maxWidth: 8,
      minDepth: 2, maxDepth: 6,
      minHeight: 2.2, maxHeight: 3,
    });
    expect(clampDimensions({ width: 10, depth: 1, height: 4 }, p))
      .toEqual({ width: 8, depth: 2, height: 3 });
  });

  it('leaves undefined dimensions undefined', () => {
    const p = product({ maxWidth: 8 });
    expect(clampDimensions({ width: 10 }, p)).toEqual({ width: 8 });
  });
});
