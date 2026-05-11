import { describe, it, expect } from 'vite-plus/test';
import { calculateTotalQuote } from '@/domain/pricing';
import { DEFAULT_PRICE_BOOK } from '@/domain/pricing';
import { makeConfig } from './fixtures';
import type { MaterialRow } from '@/domain/catalog';

function makeWallMaterial(id: string, slug: string, perSqm: number): MaterialRow {
  return {
    id, tenantId: 't1', categories: ['wall'], slug, name: slug,
    color: '#888', textures: null, tileSize: null,
    pricing: { wall: { perSqm } }, flags: {},
    archivedAt: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

describe('wall pricing with inner cladding', () => {
  it('emits one wall.<side> line item per wall when inner is not set', () => {
    const config = makeConfig();
    const materials = [makeWallMaterial('m1', 'wood', 100)];
    const quote = calculateTotalQuote(
      config.buildings,
      config.roof,
      config.connections,
      DEFAULT_PRICE_BOOK,
      materials,
      [],
      config.defaultHeight,
    );
    const fronts = quote.lineItems.filter(li => li.labelKey === 'wall.front');
    const fronts_inner = quote.lineItems.filter(li => li.labelKey === 'wall.front.inner');
    expect(fronts).toHaveLength(1);
    expect(fronts_inner).toHaveLength(0);
  });

  it('emits a second wall.<side>.inner line item with the inner material cost', () => {
    const config = makeConfig();
    config.buildings[0].primaryMaterialId = 'wood';
    config.buildings[0].walls.front.materialIdInner = 'osb';
    const materials = [
      makeWallMaterial('m1', 'wood', 100),
      makeWallMaterial('m2', 'osb',  40),
    ];
    const quote = calculateTotalQuote(
      config.buildings,
      config.roof,
      config.connections,
      DEFAULT_PRICE_BOOK,
      materials,
      [],
      config.defaultHeight,
    );
    const outer = quote.lineItems.find(li => li.labelKey === 'wall.front');
    const inner = quote.lineItems.find(li => li.labelKey === 'wall.front.inner');
    expect(outer).toBeDefined();
    expect(inner).toBeDefined();
    expect(inner!.area).toBeCloseTo(outer!.area, 6);
    expect(inner!.materialCost).toBeCloseTo(outer!.area * 40, 4);
    expect(inner!.extrasCost).toBe(0);
  });
});
