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

function makeRoofCover(slug: string, perSqm: number): MaterialRow {
  return {
    id: `m-${slug}`, tenantId: 't1', categories: ['roof-cover'], slug, name: slug,
    color: '#888', textures: null, tileSize: null,
    pricing: { 'roof-cover': { perSqm } }, flags: {},
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

describe('roof pricing with middenlaag + binnenbekleding', () => {
  it('no middenlaag and no inner → no roof.middenlaag / roof.inner line items', () => {
    const config = makeConfig();
    const materials = [makeWallMaterial('wood', 100), makeRoofCover('epdm', 20)];
    const quote = calculateTotalQuote(
      config.buildings, config.roof, config.connections,
      DEFAULT_PRICE_BOOK, materials, [], config.defaultHeight,
    );
    expect(quote.lineItems.find(li => li.labelKey === 'roof.middenlaag')).toBeUndefined();
    expect(quote.lineItems.find(li => li.labelKey === 'roof.middenlaag.frame')).toBeUndefined();
    expect(quote.lineItems.find(li => li.labelKey === 'roof.inner')).toBeUndefined();
  });

  it('panel middenlaag emits roof footprint area × perSqm', () => {
    const config = makeConfig();
    // 4×4 flat roof → 16 m².
    config.roof.middenlaagSlug = 'rockwool';
    const materials = [
      makeWallMaterial('wood', 100),
      makeRoofCover('epdm', 20),
      makePanel('rockwool', 12, 100),
    ];
    const quote = calculateTotalQuote(
      config.buildings, config.roof, config.connections,
      DEFAULT_PRICE_BOOK, materials, [], config.defaultHeight,
    );
    const mid = quote.lineItems.find(li => li.labelKey === 'roof.middenlaag');
    expect(mid).toBeDefined();
    expect(mid!.area).toBeCloseTo(16, 4);
    expect(mid!.materialCost).toBeCloseTo(16 * 12, 4);
  });

  it('frame middenlaag emits beamCount × perBeam (beams across longer side)', () => {
    // 4×4 building — spread = max(4, 4) = 4m. With 600mm spacing →
    // ceil(4000/600)+1 = 7+1 = 8 beams.
    const config = makeConfig();
    config.roof.middenlaagSlug = 'sls';
    const materials = [
      makeWallMaterial('wood', 100),
      makeRoofCover('epdm', 20),
      makeFrame('sls', 600, 15),
    ];
    const quote = calculateTotalQuote(
      config.buildings, config.roof, config.connections,
      DEFAULT_PRICE_BOOK, materials, [], config.defaultHeight,
    );
    const frame = quote.lineItems.find(li => li.labelKey === 'roof.middenlaag.frame');
    expect(frame).toBeDefined();
    expect(frame!.materialCost).toBeCloseTo(8 * 15, 4);
    expect(frame!.area).toBe(0);
    expect(frame!.labelParams).toEqual({ count: 8 });
  });

  it('inner cladding emits roof area × wall perSqm', () => {
    const config = makeConfig();
    config.roof.innerCladdingSlug = 'pine-plank';
    const materials = [
      makeWallMaterial('wood', 100),
      makeWallMaterial('pine-plank', 30),
      makeRoofCover('epdm', 20),
    ];
    const quote = calculateTotalQuote(
      config.buildings, config.roof, config.connections,
      DEFAULT_PRICE_BOOK, materials, [], config.defaultHeight,
    );
    const inner = quote.lineItems.find(li => li.labelKey === 'roof.inner');
    expect(inner).toBeDefined();
    expect(inner!.area).toBeCloseTo(16, 4);
    expect(inner!.materialCost).toBeCloseTo(16 * 30, 4);
  });

  it('pitched roof: panel area uses slope area, not footprint', () => {
    const config = makeConfig();
    config.roof.type = 'pitched';
    config.roof.pitch = 30;
    config.roof.middenlaagSlug = 'rockwool';
    const materials = [
      makeWallMaterial('wood', 100),
      makeRoofCover('epdm', 20),
      makePanel('rockwool', 12, 100),
    ];
    const quote = calculateTotalQuote(
      config.buildings, config.roof, config.connections,
      DEFAULT_PRICE_BOOK, materials, [], config.defaultHeight,
    );
    const mid = quote.lineItems.find(li => li.labelKey === 'roof.middenlaag');
    expect(mid).toBeDefined();
    // Pitched 4×4 @ 30°: 2 × (4 × (2 / cos 30°)) = 16 / cos 30° ≈ 18.475
    const expectedArea = 16 / Math.cos((30 * Math.PI) / 180);
    expect(mid!.area).toBeCloseTo(expectedArea, 4);
    expect(mid!.materialCost).toBeCloseTo(expectedArea * 12, 4);
  });
});
