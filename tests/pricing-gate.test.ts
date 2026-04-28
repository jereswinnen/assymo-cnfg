import { describe, it, expect } from 'vite-plus/test';
import {
  calculateTotalQuote,
  DEFAULT_PRICE_BOOK,
  gateLineItems,
} from '@/domain/pricing';
import type { PriceBook } from '@/domain/pricing';
import type { MaterialRow } from '@/domain/catalog';
import type { BuildingEntity, GateConfig } from '@/domain/building';
import { makeBuilding, makeRoof } from './fixtures';
import { CONFIG_VERSION } from '@/domain/config';

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

const STAAL_PER_SQM = 180;

const GATE_MATERIALS: MaterialRow[] = [
  row({
    categories: ['gate'],
    slug: 'staal',
    name: 'Staal',
    pricing: { gate: { perSqm: STAAL_PER_SQM } },
  }),
];

const FIXTURE_MATERIALS_FOR_MIXED: MaterialRow[] = [
  row({ categories: ['wall', 'door'], slug: 'wood', pricing: { wall: { perSqm: 45 }, door: { surcharge: 0 } } }),
  row({ categories: ['roof-cover'], slug: 'epdm', pricing: { 'roof-cover': { perSqm: 35 } } }),
  row({ categories: ['floor'], slug: 'beton', pricing: { floor: { perSqm: 30 } } }),
  ...GATE_MATERIALS,
];

function makeGate(overrides: Partial<GateConfig> = {}): GateConfig {
  return {
    partCount: 1,
    partWidthMm: 1500,
    heightMm: 2000,
    materialId: 'staal',
    swingDirection: 'inward',
    motorized: false,
    ...overrides,
  };
}

function makePoort(overrides: Partial<BuildingEntity> & { gateConfig?: GateConfig } = {}): BuildingEntity {
  return makeBuilding({
    id: 'g1',
    type: 'poort',
    walls: {},
    gateConfig: makeGate(overrides.gateConfig ?? {}),
    ...overrides,
  });
}

describe('gateLineItems', () => {
  it('computes per-m² material cost for a 1-part gate', () => {
    const building = makePoort({
      gateConfig: makeGate({ partCount: 1, partWidthMm: 1500, heightMm: 2000 }),
    });
    const items = gateLineItems(building, GATE_MATERIALS, DEFAULT_PRICE_BOOK);
    expect(items).toHaveLength(1);
    const mat = items[0];
    expect(mat.labelKey).toBe('quote.line.gateMaterial');
    expect(mat.labelParams?.sqm).toBe('3.00');
    expect(mat.labelParams?.materialName).toBe('Staal');
    expect(mat.total).toBeCloseTo(3.0 * STAAL_PER_SQM, 4);
    expect(mat.source).toEqual({ kind: 'gate', buildingId: 'g1', materialSlug: 'staal' });
  });

  it('scales with partCount for a 2-part gate', () => {
    const building = makePoort({
      gateConfig: makeGate({ partCount: 2, partWidthMm: 1500, heightMm: 2000 }),
    });
    const items = gateLineItems(building, GATE_MATERIALS, DEFAULT_PRICE_BOOK);
    const mat = items.find((i) => i.labelKey === 'quote.line.gateMaterial');
    expect(mat).toBeDefined();
    expect(mat!.area).toBeCloseTo(6.0, 4);
    expect(mat!.total).toBeCloseTo(6.0 * STAAL_PER_SQM, 4);
  });

  it('emits a missing-material stub when materialId does not resolve', () => {
    const building = makePoort({
      gateConfig: makeGate({ materialId: 'not-in-list' }),
    });
    const items = gateLineItems(building, GATE_MATERIALS, DEFAULT_PRICE_BOOK);
    expect(items).toHaveLength(1);
    expect(items[0].labelKey).toBe('quote.line.gateMaterialMissing');
    expect(items[0].labelParams?.materialId).toBe('not-in-list');
    expect(items[0].total).toBe(0);
    expect(items[0].source).toEqual({ kind: 'gate', buildingId: 'g1', materialSlug: '' });
  });

  it('adds per-leaf base × partCount when priceBook.poort.perLeafBase > 0', () => {
    const priceBook: PriceBook = {
      ...DEFAULT_PRICE_BOOK,
      poort: { ...DEFAULT_PRICE_BOOK.poort, perLeafBase: 100 },
    };
    const building = makePoort({ gateConfig: makeGate({ partCount: 2 }) });
    const items = gateLineItems(building, GATE_MATERIALS, priceBook);
    const perLeaf = items.find((i) => i.labelKey === 'quote.line.gatePerLeaf');
    expect(perLeaf).toBeDefined();
    expect(perLeaf!.labelParams?.count).toBe(2);
    expect(perLeaf!.total).toBe(200);
  });

  it('adds motor surcharge only when motorized', () => {
    const priceBook: PriceBook = {
      ...DEFAULT_PRICE_BOOK,
      poort: { ...DEFAULT_PRICE_BOOK.poort, motorSurcharge: 850 },
    };
    const motor = makePoort({ gateConfig: makeGate({ motorized: true }) });
    const noMotor = makePoort({ gateConfig: makeGate({ motorized: false }) });

    const motorItems = gateLineItems(motor, GATE_MATERIALS, priceBook);
    const noMotorItems = gateLineItems(noMotor, GATE_MATERIALS, priceBook);

    const motorLine = motorItems.find((i) => i.labelKey === 'quote.line.gateMotor');
    expect(motorLine).toBeDefined();
    expect(motorLine!.total).toBe(850);

    expect(noMotorItems.find((i) => i.labelKey === 'quote.line.gateMotor')).toBeUndefined();
  });

  it('adds sliding surcharge only when swingDirection is sliding', () => {
    const priceBook: PriceBook = {
      ...DEFAULT_PRICE_BOOK,
      poort: { ...DEFAULT_PRICE_BOOK.poort, slidingSurcharge: 450 },
    };
    const sliding = makePoort({ gateConfig: makeGate({ swingDirection: 'sliding' }) });
    const inward = makePoort({ gateConfig: makeGate({ swingDirection: 'inward' }) });

    const slidingItems = gateLineItems(sliding, GATE_MATERIALS, priceBook);
    const inwardItems = gateLineItems(inward, GATE_MATERIALS, priceBook);

    const slidingLine = slidingItems.find((i) => i.labelKey === 'quote.line.gateSliding');
    expect(slidingLine).toBeDefined();
    expect(slidingLine!.total).toBe(450);

    expect(inwardItems.find((i) => i.labelKey === 'quote.line.gateSliding')).toBeUndefined();
  });

  it('emits only the material line when all priceBook.poort dials are zero', () => {
    const building = makePoort({
      gateConfig: makeGate({ partCount: 2, motorized: true, swingDirection: 'sliding' }),
    });
    const items = gateLineItems(building, GATE_MATERIALS, DEFAULT_PRICE_BOOK);
    expect(items).toHaveLength(1);
    expect(items[0].labelKey).toBe('quote.line.gateMaterial');
  });
});

describe('calculateTotalQuote — mixed scene with poort', () => {
  it('integrates gate line items with other building types', () => {
    const overkapping = makeBuilding({
      id: 'o1',
      type: 'overkapping',
      walls: {},
    });
    const poort = makePoort({
      gateConfig: makeGate({ partCount: 1, partWidthMm: 1500, heightMm: 2000 }),
    });
    const cfg = {
      version: CONFIG_VERSION,
      buildings: [overkapping, poort],
      connections: [],
      roof: makeRoof(),
      defaultHeight: 2.6,
    };
    const { lineItems, total } = calculateTotalQuote(
      cfg.buildings,
      cfg.roof,
      DEFAULT_PRICE_BOOK,
      FIXTURE_MATERIALS_FOR_MIXED,
      [],
      cfg.defaultHeight,
    );
    const gateLine = lineItems.find((i) => i.labelKey === 'quote.line.gateMaterial');
    const postsLine = lineItems.find((i) => i.labelKey === 'quote.posts');
    const roofLine = lineItems.find((i) => i.labelKey === 'quote.roof');
    expect(gateLine).toBeDefined();
    expect(postsLine).toBeDefined();
    expect(roofLine).toBeDefined();
    expect(total).toBeCloseTo(
      lineItems.reduce((s, i) => s + i.total, 0),
      4,
    );
    expect(gateLine!.total).toBeCloseTo(3.0 * STAAL_PER_SQM, 4);
  });
});
