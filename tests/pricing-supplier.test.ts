import { describe, it, expect } from 'vite-plus/test';
import { calculateTotalQuote, DEFAULT_PRICE_BOOK } from '@/domain/pricing';
import type { MaterialRow } from '@/domain/catalog';
import type { SupplierProductRow } from '@/domain/supplier';
import { makeBuilding, makeConfig, makeRoof } from './fixtures';

// ── Helpers ──────────────────────────────────────────────────────────

function matRow(
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

const FIXTURE_MATERIALS: MaterialRow[] = [
  matRow({ categories: ['wall', 'door'], slug: 'wood', pricing: { wall: { perSqm: 45 }, door: { surcharge: 0 } } }),
  matRow({ categories: ['roof-cover'], slug: 'epdm', pricing: { 'roof-cover': { perSqm: 35 } } }),
  matRow({ categories: ['floor'], slug: 'beton', pricing: { floor: { perSqm: 30 } } }),
  matRow({ categories: ['floor'], slug: 'geen', pricing: { floor: { perSqm: 0 } }, flags: { isVoid: true } }),
];

function makeSupplierProduct(overrides: Partial<SupplierProductRow> & Pick<SupplierProductRow, 'id' | 'kind'>): SupplierProductRow {
  return {
    tenantId: 't',
    supplierId: 's1',
    sku: `SKU-${overrides.id}`,
    name: `Product ${overrides.id}`,
    heroImage: null,
    widthMm: 900,
    heightMm: 2100,
    priceCents: 50000,
    meta: {},
    sortOrder: 0,
    archivedAt: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

const DOOR_PRODUCT = makeSupplierProduct({ id: 'door-1', kind: 'door', priceCents: 75000 });
const WINDOW_PRODUCT = makeSupplierProduct({ id: 'win-1', kind: 'window', priceCents: 30000 });

// ── Tests ─────────────────────────────────────────────────────────────

describe('pricing — supplier product branches', () => {
  it('wall with doorSupplierProductId emits a supplierProduct-sourced door line item instead of doorBase', () => {
    const cfg = makeConfig({
      buildings: [
        makeBuilding({
          id: 'b1',
          type: 'berging',
          walls: {
            front: {
              hasDoor: true,
              doorSize: 'enkel' as const,
              doorHasWindow: false,
              doorPosition: 0.5,
              doorSwing: 'naar_buiten' as const,
              doorSupplierProductId: DOOR_PRODUCT.id,
              windows: [],
            },
          },
        }),
      ],
    });
    const { lineItems } = calculateTotalQuote(
      cfg.buildings,
      cfg.roof,
      cfg.connections,
      DEFAULT_PRICE_BOOK,
      FIXTURE_MATERIALS,
      [DOOR_PRODUCT],
      cfg.defaultHeight,
    );

    const doorItem = lineItems.find((i) => i.source?.kind === 'supplierProduct');
    expect(doorItem).toBeDefined();
    const doorSource = doorItem?.source;
    expect(doorSource?.kind === 'supplierProduct' && doorSource.productId).toBe(DOOR_PRODUCT.id);
    expect(doorItem?.total).toBe(DOOR_PRODUCT.priceCents / 100);

    // No doorBase line item should appear (that key only appears on wall items)
    const wallItem = lineItems.find((i) => i.labelKey === 'wall.front');
    // The wall item's extrasCost should NOT include doorBase since supplier path took over
    // (extrasCost on the wall item is 0 when door is supplier-handled)
    expect(wallItem?.extrasCost).toBe(0);
  });

  it('wall without supplier ref uses the material-based door path (regression guard)', () => {
    const cfg = makeConfig({
      buildings: [
        makeBuilding({
          id: 'b1',
          type: 'berging',
          walls: {
            front: {
              hasDoor: true,
              doorSize: 'enkel' as const,
              doorHasWindow: false,
              doorPosition: 0.5,
              doorSwing: 'naar_buiten' as const,
              windows: [],
            },
          },
        }),
      ],
    });
    const withDoor = calculateTotalQuote(
      cfg.buildings,
      cfg.roof,
      cfg.connections,
      DEFAULT_PRICE_BOOK,
      FIXTURE_MATERIALS,
      [],
      cfg.defaultHeight,
    );
    // Should contain no supplier-sourced items
    expect(withDoor.lineItems.every((i) => !i.source)).toBe(true);
    // Wall item should have extrasCost > 0 (door base + surcharge)
    const wallItem = withDoor.lineItems.find((i) => i.labelKey === 'wall.front');
    expect(wallItem?.extrasCost).toBeGreaterThan(0);
  });

  it('window with supplierProductId emits a supplier line item replacing windowFee', () => {
    const cfg = makeConfig({
      buildings: [
        makeBuilding({
          id: 'b1',
          type: 'berging',
          walls: {
            front: {
              hasDoor: false,
              doorSize: 'enkel' as const,
              doorHasWindow: false,
              doorPosition: 0.5,
              doorSwing: 'naar_buiten' as const,
              windows: [
                {
                  id: 'w1',
                  position: 0.5,
                  width: 1.0,
                  height: 1.0,
                  sillHeight: 1.0,
                  supplierProductId: WINDOW_PRODUCT.id,
                },
              ],
            },
          },
        }),
      ],
    });
    const { lineItems } = calculateTotalQuote(
      cfg.buildings,
      cfg.roof,
      cfg.connections,
      DEFAULT_PRICE_BOOK,
      FIXTURE_MATERIALS,
      [WINDOW_PRODUCT],
      cfg.defaultHeight,
    );

    const winItem = lineItems.find((i) => i.source?.kind === 'supplierProduct');
    expect(winItem).toBeDefined();
    const winSource = winItem?.source;
    expect(winSource?.kind === 'supplierProduct' && winSource.productId).toBe(WINDOW_PRODUCT.id);
    expect(winItem?.total).toBe(WINDOW_PRODUCT.priceCents / 100);

    // Wall item should have extrasCost 0 (windowFee skipped for supplier windows)
    const wallItem = lineItems.find((i) => i.labelKey === 'wall.front');
    expect(wallItem?.extrasCost).toBe(0);
  });

  it('missing supplier product id returns supplierMissing stub with total 0 (no crash)', () => {
    const cfg = makeConfig({
      buildings: [
        makeBuilding({
          id: 'b1',
          type: 'berging',
          walls: {
            front: {
              hasDoor: true,
              doorSize: 'enkel' as const,
              doorHasWindow: false,
              doorPosition: 0.5,
              doorSwing: 'naar_buiten' as const,
              doorSupplierProductId: 'non-existent-id',
              windows: [],
            },
          },
        }),
      ],
    });
    // Pass empty supplier product list — the id will not be found
    expect(() => {
      const { lineItems } = calculateTotalQuote(
        cfg.buildings,
        cfg.roof,
        cfg.connections,
        DEFAULT_PRICE_BOOK,
        FIXTURE_MATERIALS,
        [],
        cfg.defaultHeight,
      );
      const stubItem = lineItems.find((i) => i.labelKey === 'quote.line.supplierMissing');
      expect(stubItem).toBeDefined();
      expect(stubItem?.total).toBe(0);
    }).not.toThrow();
  });

  it('window with segments enabled and segmentCountOverride applies per-divider surcharge', () => {
    const winProduct = makeSupplierProduct({
      id: 'win-seg',
      kind: 'window',
      priceCents: 30000,
      meta: {
        segments: {
          enabled: true,
          autoThresholdMm: 1500,
          surchargeCentsPerDivider: 5000,
        },
      },
    });
    const cfg = makeConfig({
      buildings: [
        makeBuilding({
          id: 'b1',
          type: 'berging',
          walls: {
            front: {
              hasDoor: false,
              doorSize: 'enkel' as const,
              doorHasWindow: false,
              doorPosition: 0.5,
              doorSwing: 'naar_buiten' as const,
              windows: [
                {
                  id: 'w1',
                  position: 0.5,
                  width: 1.0,
                  height: 1.0,
                  sillHeight: 1.0,
                  supplierProductId: winProduct.id,
                  segmentCountOverride: 2,
                },
              ],
            },
          },
        }),
      ],
    });
    const { lineItems } = calculateTotalQuote(
      cfg.buildings,
      cfg.roof,
      cfg.connections,
      DEFAULT_PRICE_BOOK,
      FIXTURE_MATERIALS,
      [winProduct],
      cfg.defaultHeight,
    );
    const winItem = lineItems.find((i) => i.source?.kind === 'supplierProduct');
    expect(winItem).toBeDefined();
    // 30000 + 2 × 5000 = 40000 cents → 400
    expect(winItem?.total).toBe((winProduct.priceCents + 2 * 5000) / 100);
  });

  it('window with schuifraam enabled applies flat surcharge', () => {
    const winProduct = makeSupplierProduct({
      id: 'win-schuif',
      kind: 'window',
      priceCents: 30000,
      meta: {
        schuifraam: {
          enabled: true,
          surchargeCents: 25000,
        },
      },
    });
    const cfg = makeConfig({
      buildings: [
        makeBuilding({
          id: 'b1',
          type: 'berging',
          walls: {
            front: {
              hasDoor: false,
              doorSize: 'enkel' as const,
              doorHasWindow: false,
              doorPosition: 0.5,
              doorSwing: 'naar_buiten' as const,
              windows: [
                {
                  id: 'w1',
                  position: 0.5,
                  width: 1.0,
                  height: 1.0,
                  sillHeight: 1.0,
                  supplierProductId: winProduct.id,
                },
              ],
            },
          },
        }),
      ],
    });
    const { lineItems } = calculateTotalQuote(
      cfg.buildings,
      cfg.roof,
      cfg.connections,
      DEFAULT_PRICE_BOOK,
      FIXTURE_MATERIALS,
      [winProduct],
      cfg.defaultHeight,
    );
    const winItem = lineItems.find((i) => i.source?.kind === 'supplierProduct');
    expect(winItem).toBeDefined();
    expect(winItem?.total).toBe((winProduct.priceCents + 25000) / 100);
  });

  it('window with naked meta has no surcharges', () => {
    const winProduct = makeSupplierProduct({
      id: 'win-bare',
      kind: 'window',
      priceCents: 30000,
      meta: {},
    });
    const cfg = makeConfig({
      buildings: [
        makeBuilding({
          id: 'b1',
          type: 'berging',
          walls: {
            front: {
              hasDoor: false,
              doorSize: 'enkel' as const,
              doorHasWindow: false,
              doorPosition: 0.5,
              doorSwing: 'naar_buiten' as const,
              windows: [
                {
                  id: 'w1',
                  position: 0.5,
                  width: 1.0,
                  height: 1.0,
                  sillHeight: 1.0,
                  supplierProductId: winProduct.id,
                },
              ],
            },
          },
        }),
      ],
    });
    const { lineItems } = calculateTotalQuote(
      cfg.buildings,
      cfg.roof,
      cfg.connections,
      DEFAULT_PRICE_BOOK,
      FIXTURE_MATERIALS,
      [winProduct],
      cfg.defaultHeight,
    );
    const winItem = lineItems.find((i) => i.source?.kind === 'supplierProduct');
    expect(winItem).toBeDefined();
    expect(winItem?.total).toBe(winProduct.priceCents / 100);
  });

  it('archived supplier product returns supplierMissing stub with total 0', () => {
    const archived = makeSupplierProduct({
      id: 'archived-door',
      kind: 'door',
      archivedAt: '2024-01-01T00:00:00.000Z',
    });
    const cfg = makeConfig({
      buildings: [
        makeBuilding({
          id: 'b1',
          type: 'berging',
          walls: {
            front: {
              hasDoor: true,
              doorSize: 'enkel' as const,
              doorHasWindow: false,
              doorPosition: 0.5,
              doorSwing: 'naar_buiten' as const,
              doorSupplierProductId: archived.id,
              windows: [],
            },
          },
        }),
      ],
    });
    const { lineItems } = calculateTotalQuote(
      cfg.buildings,
      cfg.roof,
      cfg.connections,
      DEFAULT_PRICE_BOOK,
      FIXTURE_MATERIALS,
      [archived],
      cfg.defaultHeight,
    );
    const stubItem = lineItems.find((i) => i.labelKey === 'quote.line.supplierMissing');
    expect(stubItem).toBeDefined();
    expect(stubItem?.total).toBe(0);
    const stubSource = stubItem?.source;
    expect(stubSource?.kind === 'supplierProduct' && stubSource.productId).toBe(archived.id);
  });
});
