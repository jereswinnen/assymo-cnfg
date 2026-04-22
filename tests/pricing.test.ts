import { describe, it, expect } from 'vite-plus/test';
import {
  calculateTotalQuote,
  DEFAULT_PRICE_BOOK,
  postCount,
  roofTotalArea,
  wallNetArea,
} from '@/domain/pricing';
import type { MaterialRow } from '@/domain/catalog';
import { makeBuilding, makeConfig, makeRoof } from './fixtures';

const BLANK_WALL = {
  hasDoor: false,
  doorSize: 'enkel' as const,
  doorHasWindow: false,
  doorPosition: 0.5,
  doorSwing: 'naar_buiten' as const,
  windows: [],
};

function row(
  o: Partial<MaterialRow> & Pick<MaterialRow, 'categories' | 'slug' | 'pricing'>,
): MaterialRow {
  return {
    id: 'x',
    tenantId: 't',
    name: o.slug,
    color: '#808080',
    textures: null,
    tileSize: null,
    flags: {},
    archivedAt: null,
    createdAt: '',
    updatedAt: '',
    ...o,
  };
}

/** Minimal material rows covering every slug the default test fixtures reference. */
const FIXTURE_MATERIALS: MaterialRow[] = [
  row({ categories: ['wall', 'door'], slug: 'wood', pricing: { wall: { perSqm: 45 }, door: { surcharge: 0 } } }),
  row({ categories: ['wall'], slug: 'glass', pricing: { wall: { perSqm: 120 } }, flags: { clearsOpenings: true } }),
  row({ categories: ['roof-cover'], slug: 'epdm', pricing: { 'roof-cover': { perSqm: 35 } } }),
  row({ categories: ['roof-cover'], slug: 'dakpannen', pricing: { 'roof-cover': { perSqm: 55 } } }),
  row({ categories: ['floor'], slug: 'geen', pricing: { floor: { perSqm: 0 } }, flags: { isVoid: true } }),
  row({ categories: ['floor'], slug: 'beton', pricing: { floor: { perSqm: 30 } } }),
  row({ categories: ['floor'], slug: 'hout', pricing: { floor: { perSqm: 55 } } }),
];

describe('calculateTotalQuote', () => {
  it('returns a positive total for the default berging', () => {
    const cfg = makeConfig();
    const { total, lineItems } = calculateTotalQuote(
      cfg.buildings,
      cfg.roof,
      DEFAULT_PRICE_BOOK,
      FIXTURE_MATERIALS,
      cfg.defaultHeight,
    );
    expect(total).toBeGreaterThan(0);
    expect(lineItems.length).toBeGreaterThan(0);
  });

  it('emits structured line items with labelKey, never a pre-formatted label', () => {
    const cfg = makeConfig();
    const { lineItems } = calculateTotalQuote(
      cfg.buildings,
      cfg.roof,
      DEFAULT_PRICE_BOOK,
      FIXTURE_MATERIALS,
      cfg.defaultHeight,
    );
    for (const item of lineItems) {
      expect(item.labelKey).toMatch(/^[a-z]+\.[a-z]+$/);
      expect(item).not.toHaveProperty('label');
    }
  });

  it('charges a single post for a standalone pole', () => {
    const cfg = makeConfig({
      buildings: [makeBuilding({ id: 'p1', type: 'paal' })],
    });
    const { total, lineItems } = calculateTotalQuote(
      cfg.buildings,
      cfg.roof,
      DEFAULT_PRICE_BOOK,
      FIXTURE_MATERIALS,
      cfg.defaultHeight,
    );
    expect(total).toBe(DEFAULT_PRICE_BOOK.postPrice);
    expect(lineItems).toHaveLength(1);
    expect(lineItems[0].labelKey).toBe('quote.pole');
  });

  it('adding a door raises the total (door base exceeds the wall material credit)', () => {
    const withoutDoor = makeConfig();
    const withDoor = makeConfig({
      buildings: [
        makeBuilding({
          ...withoutDoor.buildings[0],
          id: withoutDoor.buildings[0].id,
          type: withoutDoor.buildings[0].type,
          walls: {
            ...withoutDoor.buildings[0].walls,
            front: { ...withoutDoor.buildings[0].walls.front, hasDoor: true },
          },
        }),
      ],
    });
    const a = calculateTotalQuote(withoutDoor.buildings, withoutDoor.roof, DEFAULT_PRICE_BOOK, FIXTURE_MATERIALS, withoutDoor.defaultHeight).total;
    const b = calculateTotalQuote(withDoor.buildings, withDoor.roof, DEFAULT_PRICE_BOOK, FIXTURE_MATERIALS, withDoor.defaultHeight).total;
    expect(b).toBeGreaterThan(a);
    expect(b - a).toBeLessThan(DEFAULT_PRICE_BOOK.doorBase.enkel);
  });

  it('adds skylight flat fee when roof has skylight', () => {
    const base = makeConfig();
    const withSkylight = makeConfig({ roof: makeRoof({ hasSkylight: true }) });
    const a = calculateTotalQuote(base.buildings, base.roof, DEFAULT_PRICE_BOOK, FIXTURE_MATERIALS, base.defaultHeight).total;
    const b = calculateTotalQuote(withSkylight.buildings, withSkylight.roof, DEFAULT_PRICE_BOOK, FIXTURE_MATERIALS, withSkylight.defaultHeight).total;
    expect(b - a).toBe(DEFAULT_PRICE_BOOK.skylightFee);
  });

  it('scales insulation cost with roof area and thickness', () => {
    const thin = makeConfig({
      roof: makeRoof({ insulation: true, insulationThickness: 100 }),
    });
    const thick = makeConfig({
      roof: makeRoof({ insulation: true, insulationThickness: 200 }),
    });
    const a = calculateTotalQuote(thin.buildings, thin.roof, DEFAULT_PRICE_BOOK, FIXTURE_MATERIALS, thin.defaultHeight).total;
    const b = calculateTotalQuote(thick.buildings, thick.roof, DEFAULT_PRICE_BOOK, FIXTURE_MATERIALS, thick.defaultHeight).total;
    expect(b).toBeGreaterThan(a);
  });

  it('uses a labelParams.count for post line items', () => {
    const cfg = makeConfig({
      buildings: [makeBuilding({ id: 'b1', type: 'overkapping', walls: {} })],
    });
    const { lineItems } = calculateTotalQuote(
      cfg.buildings,
      cfg.roof,
      DEFAULT_PRICE_BOOK,
      FIXTURE_MATERIALS,
      cfg.defaultHeight,
    );
    const posts = lineItems.find((i) => i.labelKey === 'quote.posts');
    expect(posts).toBeDefined();
    expect(posts?.labelParams?.count).toBeGreaterThan(0);
  });
});

describe('roofTotalArea', () => {
  it('returns width × depth for a flat roof', () => {
    expect(roofTotalArea(6, 4, 0, 'flat')).toBe(24);
  });

  it('returns the same area as flat when pitched at 0°', () => {
    // cos(0) = 1 → each panel is width * (depth/2); two panels give width * depth.
    expect(roofTotalArea(6, 4, 0, 'pitched')).toBeCloseTo(24, 4);
  });

  it('scales the pitched area by 1/cos(pitch)', () => {
    // At 45° the slanted depth is depth / cos(45°) ≈ depth × √2.
    const flat = roofTotalArea(6, 4, 0, 'flat');
    const pitched = roofTotalArea(6, 4, 45, 'pitched');
    expect(pitched / flat).toBeCloseTo(Math.SQRT2, 3);
  });
});

describe('postCount', () => {
  it('returns 4 posts for a small 4×4 overkapping (corners only)', () => {
    expect(postCount(4, 4)).toBe(4);
  });

  it('adds intermediate posts as spans exceed POST_SPACING', () => {
    // 9×4: long side needs 4 posts (3m spacing), short side stays at 2.
    // 2*2 + 2*4 - 4 = 8.
    expect(postCount(9, 4)).toBe(8);
  });

  it('is symmetric in width/depth', () => {
    expect(postCount(9, 4)).toBe(postCount(4, 9));
  });
});

describe('wallNetArea', () => {
  const building = makeBuilding({
    id: 'b1',
    type: 'berging',
    dimensions: { width: 4, depth: 3, height: 2.6 },
  });

  it('equals gross area for a wall with no door or windows', () => {
    const area = wallNetArea('front', building, { ...BLANK_WALL }, 2.6);
    expect(area).toBeCloseTo(4 * 2.6, 4);
  });

  it('subtracts a single-door cutout', () => {
    const area = wallNetArea('front', building, { ...BLANK_WALL, hasDoor: true }, 2.6);
    expect(area).toBeLessThan(4 * 2.6);
  });

  it('subtracts window area proportional to window size', () => {
    const withWindow = wallNetArea(
      'front',
      building,
      {
        ...BLANK_WALL,
        windows: [{ id: 'w', position: 0.5, width: 1.2, height: 1.0, sillHeight: 1.2 }],
      },
      2.6,
    );
    // 4 × 2.6 = 10.4; window is 1.2 × 1.0 = 1.2 → 9.2
    expect(withWindow).toBeCloseTo(9.2, 3);
  });

  it('never returns a negative area', () => {
    const area = wallNetArea(
      'left',
      makeBuilding({ id: 'b1', type: 'berging', dimensions: { width: 4, depth: 1, height: 2.6 } }),
      { ...BLANK_WALL, hasDoor: true, doorSize: 'dubbel' },
      2.6,
    );
    expect(area).toBeGreaterThanOrEqual(0);
  });
});
