import { describe, it, expect } from 'vite-plus/test';
import {
  calculateTotalQuote,
  DEFAULT_PRICE_BOOK,
  postCount,
  roofTotalArea,
  wallNetArea,
} from '@/domain/pricing';
import type { MaterialRow } from '@/domain/catalog';
import type { SnapConnection } from '@/domain/building';
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
      cfg.connections,
      DEFAULT_PRICE_BOOK,
      FIXTURE_MATERIALS,
      [],
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
      cfg.connections,
      DEFAULT_PRICE_BOOK,
      FIXTURE_MATERIALS,
      [],
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
      cfg.connections,
      DEFAULT_PRICE_BOOK,
      FIXTURE_MATERIALS,
      [],
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
    const a = calculateTotalQuote(withoutDoor.buildings, withoutDoor.roof, withoutDoor.connections, DEFAULT_PRICE_BOOK, FIXTURE_MATERIALS, [], withoutDoor.defaultHeight).total;
    const b = calculateTotalQuote(withDoor.buildings, withDoor.roof, withDoor.connections, DEFAULT_PRICE_BOOK, FIXTURE_MATERIALS, [], withDoor.defaultHeight).total;
    expect(b).toBeGreaterThan(a);
    expect(b - a).toBeLessThan(DEFAULT_PRICE_BOOK.doorBase.enkel);
  });

  it('adds skylight flat fee when roof has skylight', () => {
    const base = makeConfig();
    const withSkylight = makeConfig({ roof: makeRoof({ hasSkylight: true }) });
    const a = calculateTotalQuote(base.buildings, base.roof, base.connections, DEFAULT_PRICE_BOOK, FIXTURE_MATERIALS, [], base.defaultHeight).total;
    const b = calculateTotalQuote(withSkylight.buildings, withSkylight.roof, withSkylight.connections, DEFAULT_PRICE_BOOK, FIXTURE_MATERIALS, [], withSkylight.defaultHeight).total;
    expect(b - a).toBe(DEFAULT_PRICE_BOOK.skylightFee);
  });

  it('scales insulation cost with roof area and thickness', () => {
    const thin = makeConfig({
      roof: makeRoof({ insulation: true, insulationThickness: 100 }),
    });
    const thick = makeConfig({
      roof: makeRoof({ insulation: true, insulationThickness: 200 }),
    });
    const a = calculateTotalQuote(thin.buildings, thin.roof, thin.connections, DEFAULT_PRICE_BOOK, FIXTURE_MATERIALS, [], thin.defaultHeight).total;
    const b = calculateTotalQuote(thick.buildings, thick.roof, thick.connections, DEFAULT_PRICE_BOOK, FIXTURE_MATERIALS, [], thick.defaultHeight).total;
    expect(b).toBeGreaterThan(a);
  });

  it('uses a labelParams.count for post line items', () => {
    const cfg = makeConfig({
      buildings: [makeBuilding({ id: 'b1', type: 'overkapping', walls: {} })],
    });
    const { lineItems } = calculateTotalQuote(
      cfg.buildings,
      cfg.roof,
      cfg.connections,
      DEFAULT_PRICE_BOOK,
      FIXTURE_MATERIALS,
      [],
      cfg.defaultHeight,
    );
    const posts = lineItems.find((i) => i.labelKey === 'quote.posts');
    expect(posts).toBeDefined();
    expect(posts?.labelParams?.count).toBeGreaterThan(0);
  });
});

describe('roof pricing — overhang footprint', () => {
  it('grows roof area linearly with overhang on isolated buildings', () => {
    const baseRoof = makeRoof({ fasciaOverhang: 0 });
    const fatRoof  = makeRoof({ fasciaOverhang: 0.5 });
    const cfg0 = makeConfig({ roof: baseRoof });
    const cfg1 = makeConfig({ roof: fatRoof });

    const q0 = calculateTotalQuote(cfg0.buildings, cfg0.roof, [], DEFAULT_PRICE_BOOK, FIXTURE_MATERIALS, [], cfg0.defaultHeight);
    const q1 = calculateTotalQuote(cfg1.buildings, cfg1.roof, [], DEFAULT_PRICE_BOOK, FIXTURE_MATERIALS, [], cfg1.defaultHeight);

    const roofItem0 = q0.lineItems.find(i => i.labelKey === 'quote.roof');
    const roofItem1 = q1.lineItems.find(i => i.labelKey === 'quote.roof');
    expect(roofItem0!.area).toBe(4 * 4);     // 16
    expect(roofItem1!.area).toBe(5 * 5);     // 25 (each side +0.5)
  });

  it('does not grow roof footprint on connected sides', () => {
    const cfg = makeConfig({
      buildings: [
        makeBuilding({ id: 'a', type: 'overkapping', dimensions: { width: 4, depth: 4, height: 2.6 }, position: [0, 0],
          walls: { front: BLANK_WALL, back: BLANK_WALL, left: BLANK_WALL, right: BLANK_WALL } }),
        makeBuilding({ id: 'b', type: 'overkapping', dimensions: { width: 4, depth: 4, height: 2.6 }, position: [4, 0],
          walls: { front: BLANK_WALL, back: BLANK_WALL, left: BLANK_WALL, right: BLANK_WALL } }),
      ],
      connections: [
        { buildingAId: 'a', sideA: 'right', buildingBId: 'b', sideB: 'left' } as SnapConnection,
      ],
      roof: makeRoof({ fasciaOverhang: 0.5 }),
    });
    const q = calculateTotalQuote(cfg.buildings, cfg.roof, cfg.connections, DEFAULT_PRICE_BOOK, FIXTURE_MATERIALS, [], cfg.defaultHeight);
    const roofItems = q.lineItems.filter(i => i.labelKey === 'quote.roof');
    // Each building has overhang on 3 sides only (right of A and left of B are connected).
    // Building A: width = 4 + 0.5 (left) + 0 (right) = 4.5; depth = 4 + 0.5 + 0.5 = 5 → 22.5
    // Building B: width = 4 + 0 + 0.5 = 4.5; depth = 5 → 22.5
    expect(roofItems[0].area).toBeCloseTo(22.5, 5);
    expect(roofItems[1].area).toBeCloseTo(22.5, 5);
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

describe('fasciaLineItem', () => {
  // Add an aluminium-trim row to the fixture set with optional pricing.
  const matsWithTrim = (perSqm: number | undefined): MaterialRow[] => [
    ...FIXTURE_MATERIALS,
    row({
      categories: ['roof-trim'],
      slug: 'alu-trim',
      pricing: perSqm !== undefined ? { 'roof-trim': { perSqm } } : {},
    }),
  ];

  it('emits no fascia line when trim has no roof-trim pricing', () => {
    const cfg = makeConfig({ roof: makeRoof({ trimMaterialId: 'alu-trim' }) });
    const q = calculateTotalQuote(cfg.buildings, cfg.roof, cfg.connections,
      DEFAULT_PRICE_BOOK, matsWithTrim(undefined), [], cfg.defaultHeight);
    expect(q.lineItems.find(i => i.labelKey === 'pricing.lineItems.fascia')).toBeUndefined();
  });

  it('emits a fascia line equal to perimeter * fasciaHeight * perSqm', () => {
    const cfg = makeConfig({ roof: makeRoof({ trimMaterialId: 'alu-trim', fasciaHeight: 0.4, fasciaOverhang: 0 }) });
    // 4×4 building, isolated → perimeter = 4*4 = 16, area = 16 * 0.4 = 6.4, cost = 6.4 * 25 = 160
    const q = calculateTotalQuote(cfg.buildings, cfg.roof, cfg.connections,
      DEFAULT_PRICE_BOOK, matsWithTrim(25), [], cfg.defaultHeight);
    const f = q.lineItems.find(i => i.labelKey === 'pricing.lineItems.fascia');
    expect(f).toBeDefined();
    expect(f!.area).toBeCloseTo(6.4, 5);
    expect(f!.total).toBeCloseTo(160, 5);
  });

  it('emits 2 fascia lines on connected pair, each only counting non-connected sides', () => {
    const cfg = makeConfig({
      buildings: [
        makeBuilding({ id: 'a', type: 'overkapping',
          dimensions: { width: 4, depth: 4, height: 2.6 }, position: [0, 0],
          walls: { front: BLANK_WALL, back: BLANK_WALL, left: BLANK_WALL, right: BLANK_WALL } }),
        makeBuilding({ id: 'b', type: 'overkapping',
          dimensions: { width: 4, depth: 4, height: 2.6 }, position: [4, 0],
          walls: { front: BLANK_WALL, back: BLANK_WALL, left: BLANK_WALL, right: BLANK_WALL } }),
      ],
      connections: [
        { buildingAId: 'a', sideA: 'right', buildingBId: 'b', sideB: 'left', isOpen: false } as SnapConnection,
      ],
      roof: makeRoof({ trimMaterialId: 'alu-trim', fasciaHeight: 0.4 }),
    });
    const q = calculateTotalQuote(cfg.buildings, cfg.roof, cfg.connections,
      DEFAULT_PRICE_BOOK, matsWithTrim(25), [], cfg.defaultHeight);
    const fascias = q.lineItems.filter(i => i.labelKey === 'pricing.lineItems.fascia');
    expect(fascias.length).toBe(2);
    // Each building has 3 free sides (front, back, plus one of left/right):
    //   building a: free = front (4) + back (4) + left (4) = 12 → area = 4.8 → 120
    //   building b: free = front (4) + back (4) + right (4) = 12 → 120
    expect(fascias[0].total).toBeCloseTo(120, 5);
    expect(fascias[1].total).toBeCloseTo(120, 5);
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
