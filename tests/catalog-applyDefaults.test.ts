import { describe, it, expect } from 'vite-plus/test';
import { applyProductDefaults, type ProductRow } from '@/domain/catalog';

function mk(overrides: Partial<ProductRow>): ProductRow {
  return {
    id: 'p', tenantId: 't', kind: 'overkapping',
    slug: 's', name: 'S', description: null, heroImage: null,
    defaults: {}, constraints: {},
    basePriceCents: 0, sortOrder: 0,
    archivedAt: null, createdAt: '', updatedAt: '',
    ...overrides,
  };
}

describe('applyProductDefaults', () => {
  it('returns sourceProductId + kind for a bare product', () => {
    const p = mk({ id: 'abc', kind: 'overkapping' });
    const r = applyProductDefaults(p);
    expect(r.sourceProductId).toBe('abc');
    expect(r.type).toBe('overkapping');
  });

  it('fills dimensions from product defaults', () => {
    const p = mk({ defaults: { width: 5, depth: 4, height: 2.8 } });
    const r = applyProductDefaults(p);
    expect(r.dimensions).toEqual({ width: 5, depth: 4, height: 2.8 });
  });

  it('omits dimensions keys when product defaults lack them', () => {
    const p = mk({ defaults: { width: 5 } });
    const r = applyProductDefaults(p);
    expect(r.dimensions).toEqual({ width: 5 });
  });

  it('fills primaryMaterialId from defaults.materials.wallCladding', () => {
    const p = mk({ defaults: { materials: { wallCladding: 'wood' } } });
    const r = applyProductDefaults(p);
    expect(r.primaryMaterialId).toBe('wood');
  });

  it('fills floor.materialId from defaults.materials.floor', () => {
    const p = mk({ defaults: { materials: { floor: 'hout' } } });
    const r = applyProductDefaults(p);
    expect(r.floor?.materialId).toBe('hout');
  });

  it('produces no walls / roof overrides (configurator layer fills those)', () => {
    const p = mk({ defaults: { width: 4 } });
    const r = applyProductDefaults(p);
    expect('walls' in r).toBe(false);
  });
});
