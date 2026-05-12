import { describe, it, expect } from 'vite-plus/test';
import { applyProductDefaults } from '@/domain/catalog';
import type { ProductRow } from '@/domain/catalog';

function makeProduct(extras: Partial<ProductRow> = {}): ProductRow {
  return {
    id: 'p1', tenantId: 't1', kind: 'berging', slug: 'std', name: 'Std',
    description: null,
    heroImage: null, basePriceCents: 0, sortOrder: 0,
    archivedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01',
    defaults: { materials: { wallCladding: 'wood', wallMiddenlaag: 'rockwool-100' } },
    constraints: {},
    ...extras,
  };
}

describe('applyProductDefaults — middenlaag', () => {
  it('surfaces wallMiddenlaag on the returned defaults', () => {
    const out = applyProductDefaults(makeProduct());
    expect(out.materialIdMiddenlaag).toBe('rockwool-100');
  });

  it('returns no middenlaag when the product omits wallMiddenlaag', () => {
    const p = makeProduct();
    delete p.defaults.materials!.wallMiddenlaag;
    const out = applyProductDefaults(p);
    expect(out.materialIdMiddenlaag).toBeUndefined();
  });
});
