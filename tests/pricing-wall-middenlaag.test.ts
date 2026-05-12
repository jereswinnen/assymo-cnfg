import { describe, it, expect } from 'vite-plus/test';
import { calculateTotalQuote, DEFAULT_PRICE_BOOK } from '@/domain/pricing';
import { makeConfig } from './fixtures';
import type { MaterialRow } from '@/domain/catalog';

function makeWallMaterial(slug: string, perSqm: number): MaterialRow {
  return {
    id: `m-${slug}`, tenantId: 't1', categories: ['wall'], slug, name: slug,
    color: '#888', textures: null, tileSize: null,
    pricing: { wall: { perSqm } }, flags: {},
    archivedAt: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

function makePanel(slug: string, perSqm: number, thicknessMm = 100): MaterialRow {
  return {
    id: `m-${slug}`, tenantId: 't1', categories: ['middenlaag'], slug, name: slug,
    color: '#888', textures: null, tileSize: null,
    pricing: { middenlaag: { kind: 'panel', thicknessMm, perSqm } }, flags: {},
    archivedAt: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

function makeFrame(slug: string, beamSpacingMm: number, perBeam: number): MaterialRow {
  return {
    id: `m-${slug}`, tenantId: 't1', categories: ['middenlaag'], slug, name: slug,
    color: '#888', textures: null, tileSize: null,
    pricing: {
      middenlaag: {
        kind: 'frame', thicknessMm: 89, beamWidthMm: 38,
        beamSpacingMm, perBeam,
      },
    },
    flags: {},
    archivedAt: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

describe('wall pricing with middenlaag', () => {
  it('no middenlaag → no .middenlaag line items', () => {
    const config = makeConfig();
    const materials = [makeWallMaterial('wood', 100)];
    const quote = calculateTotalQuote(
      config.buildings,
      config.roof,
      config.connections,
      DEFAULT_PRICE_BOOK,
      materials,
      [],
      config.defaultHeight,
    );
    const middenlaags = quote.lineItems.filter(li => li.labelKey.endsWith('.middenlaag'));
    expect(middenlaags).toHaveLength(0);
  });

  it('panel middenlaag emits area × perSqm', () => {
    const config = makeConfig();
    config.buildings[0].primaryMaterialId = 'wood';
    config.buildings[0].walls.front.materialIdMiddenlaag = 'rockwool';
    const materials = [
      makeWallMaterial('wood', 100),
      makePanel('rockwool', 12, 100),
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
    const mid = quote.lineItems.find(li => li.labelKey === 'wall.front.middenlaag');
    expect(outer).toBeDefined();
    expect(mid).toBeDefined();
    expect(mid!.area).toBeCloseTo(outer!.area, 6);
    expect(mid!.materialCost).toBeCloseTo(outer!.area * 12, 4);
    expect(mid!.extrasCost).toBe(0);
  });

  it('frame middenlaag emits beamCount × perBeam', () => {
    // makeConfig fixture's berging has width 4m, depth 4m.
    // Front wall length = 4m. With 600mm h.o.h. → Math.ceil(4000/600)+1 = 7+1 = 8 beams.
    const config = makeConfig();
    config.buildings[0].walls.front.materialIdMiddenlaag = 'sls';
    const materials = [
      makeWallMaterial('wood', 100),
      makeFrame('sls', 600, 15),
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
    const frame = quote.lineItems.find(li => li.labelKey === 'wall.front.middenlaag.frame');
    expect(frame).toBeDefined();
    expect(frame!.materialCost).toBeCloseTo(8 * 15, 4);
    expect(frame!.area).toBe(0);
    expect(frame!.extrasCost).toBe(0);
    expect(frame!.labelParams).toEqual({ count: 8 });
  });
});
