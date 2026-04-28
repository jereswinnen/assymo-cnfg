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

  describe('kind="poort"', () => {
    it('sets type and emits a full gateConfig override when all six fields are set', () => {
      const p = mk({
        kind: 'poort',
        defaults: {
          poort: {
            partCount: 2,
            partWidthMm: 1800,
            heightMm: 2400,
            swingDirection: 'sliding',
            motorized: true,
            materialId: 'staal-antraciet',
          },
        },
      });
      const r = applyProductDefaults(p);
      expect(r.type).toBe('poort');
      expect(r.gateConfig).toEqual({
        partCount: 2,
        partWidthMm: 1800,
        heightMm: 2400,
        swingDirection: 'sliding',
        motorized: true,
        materialId: 'staal-antraciet',
      });
    });

    it('emits only the explicitly-set fields when defaults.poort is partial', () => {
      const p = mk({
        kind: 'poort',
        defaults: { poort: { partCount: 2, motorized: true } },
      });
      const r = applyProductDefaults(p);
      expect(r.gateConfig).toEqual({ partCount: 2, motorized: true });
    });

    it('emits no gateConfig when the product has no defaults.poort key', () => {
      const p = mk({ kind: 'poort', defaults: {} });
      const r = applyProductDefaults(p);
      expect(r.type).toBe('poort');
      expect(r.gateConfig).toBeUndefined();
    });

    it('omits structural-kit fields for poort products', () => {
      const p = mk({
        kind: 'poort',
        defaults: { poort: { partCount: 1 } },
      });
      const r = applyProductDefaults(p);
      expect(r.dimensions).toEqual({});
      expect(r.primaryMaterialId).toBeUndefined();
      expect(r.floor).toBeUndefined();
      expect(r.roof).toBeUndefined();
      expect(r.door).toBeUndefined();
    });
  });
});
