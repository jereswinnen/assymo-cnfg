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
    materialId: 'staal',
    swingDirection: 'inward',
    motorized: false,
    ...overrides,
  };
}

interface MakePoortOpts {
  gateConfig?: GateConfig;
  dimensions?: { width?: number; depth?: number; height?: number };
}

/** Default fixture: 1.5m × 0.15m × 2.0m → 3.0 sqm at the standard
 *  effectiveHeight test value of 2.0m. */
function makePoort(opts: MakePoortOpts = {}): BuildingEntity {
  return makeBuilding({
    id: 'g1',
    type: 'poort',
    walls: {},
    gateConfig: makeGate(opts.gateConfig ?? {}),
    dimensions: {
      width: opts.dimensions?.width ?? 1.5,
      depth: opts.dimensions?.depth ?? 0.15,
      height: opts.dimensions?.height ?? 2.0,
    },
  });
}

/** Test default for effectiveHeight — gates render at this height in the
 *  3D pipeline (matches the default building.dimensions.height). */
const TEST_EFFECTIVE_HEIGHT = 2.0;

describe('gateLineItems', () => {
  it('computes per-m² material cost for a 1-part gate', () => {
    const building = makePoort();
    const items = gateLineItems(building, GATE_MATERIALS, DEFAULT_PRICE_BOOK, TEST_EFFECTIVE_HEIGHT, []);
    expect(items).toHaveLength(1);
    const mat = items[0];
    expect(mat.labelKey).toBe('quote.line.gateMaterial');
    expect(mat.labelParams?.sqm).toBe('3.00');
    expect(mat.labelParams?.materialName).toBe('Staal');
    expect(mat.total).toBeCloseTo(3.0 * STAAL_PER_SQM, 4);
    expect(mat.source).toEqual({ kind: 'gate', buildingId: 'g1', materialSlug: 'staal' });
  });

  it('scales with the gate footprint (3m wide × 2m tall = 6 m²)', () => {
    const building = makePoort({
      gateConfig: makeGate({ partCount: 2 }),
      dimensions: { width: 3.0 },
    });
    const items = gateLineItems(building, GATE_MATERIALS, DEFAULT_PRICE_BOOK, TEST_EFFECTIVE_HEIGHT, []);
    const mat = items.find((i) => i.labelKey === 'quote.line.gateMaterial');
    expect(mat).toBeDefined();
    expect(mat!.area).toBeCloseTo(6.0, 4);
    expect(mat!.total).toBeCloseTo(6.0 * STAAL_PER_SQM, 4);
  });

  it('emits a missing-material stub when materialId does not resolve', () => {
    const building = makePoort({
      gateConfig: makeGate({ materialId: 'not-in-list' }),
    });
    const items = gateLineItems(building, GATE_MATERIALS, DEFAULT_PRICE_BOOK, TEST_EFFECTIVE_HEIGHT, []);
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
    const items = gateLineItems(building, GATE_MATERIALS, priceBook, TEST_EFFECTIVE_HEIGHT, []);
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

    const motorItems = gateLineItems(motor, GATE_MATERIALS, priceBook, TEST_EFFECTIVE_HEIGHT, []);
    const noMotorItems = gateLineItems(noMotor, GATE_MATERIALS, priceBook, TEST_EFFECTIVE_HEIGHT, []);

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

    const slidingItems = gateLineItems(sliding, GATE_MATERIALS, priceBook, TEST_EFFECTIVE_HEIGHT, []);
    const inwardItems = gateLineItems(inward, GATE_MATERIALS, priceBook, TEST_EFFECTIVE_HEIGHT, []);

    const slidingLine = slidingItems.find((i) => i.labelKey === 'quote.line.gateSliding');
    expect(slidingLine).toBeDefined();
    expect(slidingLine!.total).toBe(450);

    expect(inwardItems.find((i) => i.labelKey === 'quote.line.gateSliding')).toBeUndefined();
  });

  it('emits only the material line when all priceBook.poort dials are zero', () => {
    const building = makePoort({
      gateConfig: makeGate({ partCount: 2, motorized: true, swingDirection: 'sliding' }),
    });
    const items = gateLineItems(building, GATE_MATERIALS, DEFAULT_PRICE_BOOK, TEST_EFFECTIVE_HEIGHT, []);
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
    // heightOverride pins effectiveHeight to 2.0m so the gate's area stays a
    // predictable 1.5 × 2.0 = 3.0 m² regardless of the scene defaultHeight.
    const poort = {
      ...makePoort({ gateConfig: makeGate({ partCount: 1 }) }),
      heightOverride: 2.0,
    };
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

// ── SKU-driven gate pricing (Phase 5.8.3) ──────────────────────────────

import type { GateMeta, SupplierProductRow } from '@/domain/supplier';

function makeGateProduct(overrides: Partial<SupplierProductRow> = {}): SupplierProductRow {
  return {
    id: 'gp-1',
    tenantId: 't',
    supplierId: 's1',
    sku: 'GATE-001',
    name: 'Vleugelpoort Standaard',
    kind: 'gate',
    heroImage: null,
    widthMm: 3000,
    heightMm: 2000,
    priceCents: 145000, // €1450
    meta: {} as GateMeta,
    sortOrder: 0,
    archivedAt: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('gateLineItems — SKU path', () => {
  it('emits supplier base + per-leaf when an active SKU is referenced', () => {
    const product = makeGateProduct({
      meta: { motorized: 'optional', motorizedSurchargeCents: 85000 } as GateMeta,
    });
    const building = makePoort({
      gateConfig: makeGate({ supplierProductId: 'gp-1' }),
    });
    const priceBook: PriceBook = {
      ...DEFAULT_PRICE_BOOK,
      poort: { motorSurcharge: 850, slidingSurcharge: 450, perLeafBase: 125 },
    };
    const items = gateLineItems(building, GATE_MATERIALS, priceBook, TEST_EFFECTIVE_HEIGHT, [product]);
    const baseLine = items.find((i) => i.labelKey === 'quote.line.gateSupplier');
    expect(baseLine?.total).toBe(1450);
    expect(baseLine?.source?.kind).toBe('supplierProduct');
    // Naked-path material line is NOT emitted when SKU resolves
    expect(items.some((i) => i.labelKey === 'quote.line.gateMaterial')).toBe(false);
    // Per-leaf still applies (priceBook-level dial)
    const leafLine = items.find((i) => i.labelKey === 'quote.line.gatePerLeaf');
    expect(leafLine?.total).toBe(125);
  });

  it('emits a line per selected option with non-zero surcharge', () => {
    const product = makeGateProduct({
      meta: {
        availableColors: [
          { sku: 'ral-7016', label: 'Antraciet' },
          { sku: 'ral-9005', label: 'Zwart', surchargeCents: 5000 },
        ],
        availableLocks: [
          { sku: 'cyl', label: 'Cilinderslot' },
          { sku: 'mp', label: 'Meerpuntsslot', surchargeCents: 12500 },
        ],
        availableHandles: [{ sku: 'std', label: 'Standaard' }],
      } as GateMeta,
    });
    const building = makePoort({
      gateConfig: makeGate({
        supplierProductId: 'gp-1',
        selectedColorSku: 'ral-9005',
        selectedLockSku: 'mp',
        selectedHandleSku: 'std', // no surcharge
      }),
    });
    const items = gateLineItems(building, GATE_MATERIALS, DEFAULT_PRICE_BOOK, TEST_EFFECTIVE_HEIGHT, [product]);
    const optionLines = items.filter((i) => i.labelKey === 'quote.line.gateOption');
    expect(optionLines).toHaveLength(2);
    const totals = optionLines.map((i) => i.total).sort((a, b) => a - b);
    expect(totals).toEqual([50, 125]);
  });

  it('applies motor surcharge only when meta.motorized==="optional" AND gate.motorized=true', () => {
    const product = makeGateProduct({
      meta: { motorized: 'optional', motorizedSurchargeCents: 85000 } as GateMeta,
    });
    const motorized = makePoort({
      gateConfig: makeGate({ supplierProductId: 'gp-1', motorized: true }),
    });
    const noMotor = makePoort({
      gateConfig: makeGate({ supplierProductId: 'gp-1', motorized: false }),
    });
    const motorItems = gateLineItems(motorized, GATE_MATERIALS, DEFAULT_PRICE_BOOK, TEST_EFFECTIVE_HEIGHT, [product]);
    const noMotorItems = gateLineItems(noMotor, GATE_MATERIALS, DEFAULT_PRICE_BOOK, TEST_EFFECTIVE_HEIGHT, [product]);
    const motorLine = motorItems.find((i) => i.labelKey === 'quote.line.gateMotor');
    expect(motorLine?.total).toBe(850);
    expect(noMotorItems.some((i) => i.labelKey === 'quote.line.gateMotor')).toBe(false);
  });

  it('does NOT emit motor surcharge when meta.motorized is forced (true or false)', () => {
    const forced = makeGateProduct({
      meta: { motorized: true, motorizedSurchargeCents: 85000 } as GateMeta,
    });
    const building = makePoort({
      gateConfig: makeGate({ supplierProductId: 'gp-1', motorized: true }),
    });
    const items = gateLineItems(building, GATE_MATERIALS, DEFAULT_PRICE_BOOK, TEST_EFFECTIVE_HEIGHT, [forced]);
    expect(items.some((i) => i.labelKey === 'quote.line.gateMotor')).toBe(false);
  });

  it('still emits priceBook sliding surcharge on the SKU path', () => {
    const product = makeGateProduct();
    const building = makePoort({
      gateConfig: makeGate({ supplierProductId: 'gp-1', swingDirection: 'sliding' }),
    });
    const priceBook: PriceBook = {
      ...DEFAULT_PRICE_BOOK,
      poort: { motorSurcharge: 0, slidingSurcharge: 450, perLeafBase: 0 },
    };
    const items = gateLineItems(building, GATE_MATERIALS, priceBook, TEST_EFFECTIVE_HEIGHT, [product]);
    const slidingLine = items.find((i) => i.labelKey === 'quote.line.gateSliding');
    expect(slidingLine?.total).toBe(450);
  });

  it('falls back to naked-gate path when supplier product is archived', () => {
    const product = makeGateProduct({ archivedAt: '2026-01-01T00:00:00Z' });
    const building = makePoort({
      gateConfig: makeGate({ supplierProductId: 'gp-1' }),
    });
    const items = gateLineItems(building, GATE_MATERIALS, DEFAULT_PRICE_BOOK, TEST_EFFECTIVE_HEIGHT, [product]);
    expect(items.some((i) => i.labelKey === 'quote.line.gateMaterial')).toBe(true);
    expect(items.some((i) => i.labelKey === 'quote.line.gateSupplier')).toBe(false);
  });

  it('falls back to naked-gate path when supplier product is missing from list', () => {
    const building = makePoort({
      gateConfig: makeGate({ supplierProductId: 'unknown' }),
    });
    const items = gateLineItems(building, GATE_MATERIALS, DEFAULT_PRICE_BOOK, TEST_EFFECTIVE_HEIGHT, []);
    expect(items.some((i) => i.labelKey === 'quote.line.gateMaterial')).toBe(true);
  });

  it('silently drops a selected option SKU not present in meta', () => {
    const product = makeGateProduct({
      meta: {
        availableColors: [{ sku: 'a', label: 'A', surchargeCents: 100 }],
      } as GateMeta,
    });
    const building = makePoort({
      gateConfig: makeGate({ supplierProductId: 'gp-1', selectedColorSku: 'phantom' }),
    });
    const items = gateLineItems(building, GATE_MATERIALS, DEFAULT_PRICE_BOOK, TEST_EFFECTIVE_HEIGHT, [product]);
    expect(items.some((i) => i.labelKey === 'quote.line.gateOption')).toBe(false);
  });
});
