import { describe, it, expect } from 'vite-plus/test';
import { buildWallCatalog, buildGateCatalog, filterCatalogAllowing } from '@/domain/materials';
import type { MaterialRow } from '@/domain/catalog';

const row = (
  over: Partial<Omit<MaterialRow, 'categories'>> & {
    category?: MaterialRow['categories'][number];
    categories?: MaterialRow['categories'];
  },
): MaterialRow => {
  const { category, categories: cats, ...rest } = over;
  return {
    id: 'x', tenantId: 't',
    categories: cats ?? (category ? [category] : ['wall']),
    slug: 's', name: 'S', color: '#000000',
    textures: null, tileSize: null,
    pricing: { wall: { perSqm: 10 } }, flags: {},
    archivedAt: null, createdAt: '', updatedAt: '',
    ...rest,
  };
};

describe('buildWallCatalog', () => {
  it('returns one entry per non-archived wall material', () => {
    const rows = [
      row({ id: 'a', slug: 'wood' }),
      row({ id: 'b', slug: 'brick' }),
      row({ id: 'c', slug: 'old', archivedAt: '2026-01-01T00:00:00Z' }),
      row({ id: 'd', slug: 'pane', category: 'floor', pricing: { floor: { perSqm: 10 } } }),
    ];
    const out = buildWallCatalog(rows);
    expect(out.map((e) => e.atomId)).toEqual(['wood', 'brick']);
  });

  it('maps clearsOpenings flag through', () => {
    const rows = [row({ slug: 'glass', flags: { clearsOpenings: true } })];
    const out = buildWallCatalog(rows);
    expect(out[0].clearsOpenings).toBe(true);
  });
});

describe('buildGateCatalog', () => {
  it('returns one entry per non-archived gate material, skipping other categories', () => {
    const rows = [
      row({ id: 'a', slug: 'sectional', category: 'gate', pricing: { gate: { perSqm: 180 } } }),
      row({ id: 'b', slug: 'mesh', category: 'gate', pricing: { gate: { perSqm: 120 } } }),
      row({ id: 'c', slug: 'old', category: 'gate', archivedAt: '2026-01-01T00:00:00Z', pricing: { gate: { perSqm: 90 } } }),
      row({ id: 'd', slug: 'wood' }),
    ];
    const out = buildGateCatalog(rows);
    expect(out.map((e) => e.atomId)).toEqual(['sectional', 'mesh']);
  });

  it('maps gate.perSqm pricing through', () => {
    const rows = [row({ slug: 'sectional', category: 'gate', pricing: { gate: { perSqm: 180 } } })];
    const out = buildGateCatalog(rows);
    expect(out[0]).toEqual({ atomId: 'sectional', pricePerSqm: 180 });
  });

  it('defaults pricePerSqm to 0 when gate pricing is missing', () => {
    const rows = [row({ slug: 'plain', category: 'gate', pricing: {} })];
    const out = buildGateCatalog(rows);
    expect(out[0].pricePerSqm).toBe(0);
  });
});

describe('filterCatalogAllowing — archived current selection', () => {
  it('keeps archived current selection visible at the front', () => {
    const rows = [
      row({ id: 'a', slug: 'wood' }),
      row({ id: 'b', slug: 'old', archivedAt: '2026-01-01T00:00:00Z' }),
    ];
    const wall = buildWallCatalog(rows);
    const out = filterCatalogAllowing(
      wall, 'old', rows, 'wall',
      (m) => ({ atomId: m.slug, pricePerSqm: m.pricing.wall?.perSqm ?? 0 }),
    );
    expect(out[0].atomId).toBe('old');
    expect(out.length).toBe(2);
  });

  it('returns the catalog unchanged when the selection is present', () => {
    const rows = [row({ slug: 'wood' })];
    const wall = buildWallCatalog(rows);
    const out = filterCatalogAllowing(
      wall, 'wood', rows, 'wall',
      (m) => ({ atomId: m.slug, pricePerSqm: m.pricing.wall?.perSqm ?? 0 }),
    );
    expect(out.length).toBe(1);
  });

  it('returns the catalog unchanged when the selection is null', () => {
    const rows = [row({ slug: 'wood' })];
    const wall = buildWallCatalog(rows);
    const out = filterCatalogAllowing(
      wall, null, rows, 'wall',
      (m) => ({ atomId: m.slug, pricePerSqm: m.pricing.wall?.perSqm ?? 0 }),
    );
    expect(out.length).toBe(1);
  });
});
