import { describe, it, expect } from 'vite-plus/test';
import { buildConfigSnapshot, buildQuoteSnapshot } from '@/domain/orders';
import { DEFAULT_PRICE_BOOK } from '@/domain/pricing';
import type { PriceBook } from '@/domain/pricing';
import type { MaterialRow } from '@/domain/catalog';
import { createGateBuildingEntity } from '@/domain/building/defaults';
import { CONFIG_VERSION } from '@/domain/config';
import { makeBuilding, makeRoof, makeConfig } from './fixtures';

const STAAL_PER_SQM = 180;

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

const GATE_MATERIAL: MaterialRow = row({
  categories: ['gate'],
  slug: 'staal',
  name: 'Staal',
  pricing: { gate: { perSqm: STAAL_PER_SQM } },
});

const MIXED_MATERIALS: MaterialRow[] = [
  row({
    categories: ['wall', 'door'],
    slug: 'wood',
    pricing: { wall: { perSqm: 45 }, door: { surcharge: 0 } },
  }),
  row({ categories: ['roof-cover'], slug: 'epdm', pricing: { 'roof-cover': { perSqm: 35 } } }),
  row({ categories: ['floor'], slug: 'beton', pricing: { floor: { perSqm: 30 } } }),
  GATE_MATERIAL,
];

const CODE = 'TEST_GATE_SNAP';

describe('buildConfigSnapshot — gate building', () => {
  it('deep-clones the gate building including gateConfig (mutating source does not leak)', () => {
    const poort = createGateBuildingEntity({
      position: [3, 5],
      gateConfig: {
        partCount: 2,
        materialId: 'staal',
        swingDirection: 'sliding',
        motorized: true,
      },
    });
    const config = makeConfig({ buildings: [poort] });

    const snap = buildConfigSnapshot(CODE, config);

    const frozen = snap.items[0].config.buildings[0];
    expect(frozen.id).toBe(poort.id);
    expect(frozen.type).toBe('poort');
    expect(frozen.position).toEqual([3, 5]);
    expect(frozen.gateConfig).toEqual({
      partCount: 2,
      materialId: 'staal',
      swingDirection: 'sliding',
      motorized: true,
    });

    // Mutating the source must not leak into the snapshot.
    poort.gateConfig.partCount = 1;
    poort.gateConfig.materialId = 'mutated';
    expect(snap.items[0].config.buildings[0].gateConfig?.partCount).toBe(2);
    expect(snap.items[0].config.buildings[0].gateConfig?.materialId).toBe('staal');
  });
});

describe('buildQuoteSnapshot — gate line items', () => {
  it("freezes a gate's material line with source.kind='gate', buildingId, and materialSlug", () => {
    const poort = {
      ...createGateBuildingEntity({
        gateConfig: {
          partCount: 1,
          materialId: 'staal',
          swingDirection: 'inward',
          motorized: false,
        },
      }),
      heightOverride: 2.0,
    };
    const config = makeConfig({ buildings: [poort] });

    const snap = buildQuoteSnapshot({
      code: CODE,
      buildings: config.buildings,
      roof: config.roof,
      connections: config.connections,
      priceBook: DEFAULT_PRICE_BOOK,
      defaultHeight: config.defaultHeight,
      currency: 'EUR',
      materials: [GATE_MATERIAL],
      supplierProducts: [],
    });

    const lineItems = snap.items.flatMap((i) => i.lineItems);
    const matLine = lineItems.find((i) => i.labelKey === 'quote.line.gateMaterial');
    expect(matLine).toBeDefined();
    const source = matLine!.source;
    expect(source).toBeDefined();
    if (source?.kind !== 'gate') throw new Error('expected gate source');
    expect(source.buildingId).toBe(poort.id);
    expect(source.materialSlug).toBe('staal');
    expect(matLine!.total).toBeCloseTo(3.0 * STAAL_PER_SQM, 4);
  });

  it('freezes all four gate line shapes (material + perLeaf + motor + sliding) with gate source', () => {
    const priceBook: PriceBook = {
      ...DEFAULT_PRICE_BOOK,
      poort: {
        ...DEFAULT_PRICE_BOOK.poort,
        perLeafBase: 100,
        motorSurcharge: 850,
        slidingSurcharge: 450,
      },
    };
    const poort = {
      ...createGateBuildingEntity({
        gateConfig: {
          partCount: 2,
          materialId: 'staal',
          swingDirection: 'sliding',
          motorized: true,
        },
      }),
      heightOverride: 2.0,
    };
    const config = makeConfig({ buildings: [poort] });

    const snap = buildQuoteSnapshot({
      code: CODE,
      buildings: config.buildings,
      roof: config.roof,
      connections: config.connections,
      priceBook,
      defaultHeight: config.defaultHeight,
      currency: 'EUR',
      materials: [GATE_MATERIAL],
      supplierProducts: [],
    });

    const lineItems = snap.items.flatMap((i) => i.lineItems);
    const expectedKeys = [
      'quote.line.gateMaterial',
      'quote.line.gatePerLeaf',
      'quote.line.gateMotor',
      'quote.line.gateSliding',
    ];
    for (const key of expectedKeys) {
      const line = lineItems.find((i) => i.labelKey === key);
      expect(line, `missing line: ${key}`).toBeDefined();
      const source = line!.source;
      expect(source, `missing source on: ${key}`).toBeDefined();
      if (source?.kind !== 'gate') throw new Error(`expected gate source on ${key}`);
      expect(source.buildingId).toBe(poort.id);
      expect(source.materialSlug).toBe('staal');
    }
  });
});

describe('buildQuoteSnapshot — mixed scene (overkapping + poort)', () => {
  it('snapshot contains both kinds of line items and totalCents matches the priced sum', () => {
    const overkapping = makeBuilding({ id: 'o1', type: 'overkapping', walls: {} });
    const poort = {
      ...createGateBuildingEntity({
        gateConfig: {
          partCount: 1,
          materialId: 'staal',
          swingDirection: 'inward',
          motorized: false,
        },
      }),
      heightOverride: 2.0,
    };
    const config = {
      version: CONFIG_VERSION,
      buildings: [overkapping, poort],
      connections: [],
      roof: makeRoof(),
      defaultHeight: 2.6,
    };

    const snap = buildQuoteSnapshot({
      code: CODE,
      buildings: config.buildings,
      roof: config.roof,
      connections: config.connections,
      priceBook: DEFAULT_PRICE_BOOK,
      defaultHeight: config.defaultHeight,
      currency: 'EUR',
      materials: MIXED_MATERIALS,
      supplierProducts: [],
    });

    const lineItems = snap.items.flatMap((i) => i.lineItems);

    const gateLine = lineItems.find(
      (i) => i.source?.kind === 'gate' && i.labelKey === 'quote.line.gateMaterial',
    );
    expect(gateLine).toBeDefined();
    const gateSource = gateLine!.source;
    if (gateSource?.kind !== 'gate') throw new Error('expected gate source');
    expect(gateSource.buildingId).toBe(poort.id);

    // Overkapping contributes structural lines (posts + roof) that have no `source`.
    const postsLine = lineItems.find((i) => i.labelKey === 'quote.posts');
    const roofLine = lineItems.find((i) => i.labelKey === 'quote.roof');
    expect(postsLine).toBeDefined();
    expect(roofLine).toBeDefined();
    expect(postsLine!.source).toBeUndefined();
    expect(roofLine!.source).toBeUndefined();

    const sumEuros = lineItems.reduce((s, i) => s + i.total, 0);
    expect(snap.totalCents).toBe(Math.round(sumEuros * 100));
    expect(snap.items[0].subtotalCents).toBe(snap.totalCents);
  });
});
