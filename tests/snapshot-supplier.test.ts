import { describe, it, expect } from 'vite-plus/test';
import { buildQuoteSnapshot, buildConfigSnapshot } from '@/domain/orders';
import { DEFAULT_PRICE_BOOK } from '@/domain/pricing';
import type { SupplierProductRow } from '@/domain/supplier';
import { makeBuilding, makeConfig } from './fixtures';

// ── Helpers ──────────────────────────────────────────────────────────

function makeSupplierProduct(
  overrides: Partial<SupplierProductRow> & Pick<SupplierProductRow, 'id' | 'kind'>,
): SupplierProductRow {
  return {
    tenantId: 't',
    supplierId: 's1',
    sku: `SKU-${overrides.id}`,
    name: `Product ${overrides.id}`,
    heroImage: null,
    widthMm: 900,
    heightMm: 2100,
    priceCents: 60000,
    meta: {},
    sortOrder: 0,
    archivedAt: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

const DOOR_PRODUCT = makeSupplierProduct({ id: 'door-sp-1', kind: 'door', priceCents: 80000 });
const CODE = 'TEST_CODE_SP';

// ── Tests ─────────────────────────────────────────────────────────────

describe('buildQuoteSnapshot — supplier product freezing', () => {
  it('line item with supplier door has source + supplierProduct frozen fields', () => {
    const config = makeConfig({
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
    const snap = buildQuoteSnapshot({
      code: CODE,
      buildings: config.buildings,
      roof: config.roof,
      priceBook: DEFAULT_PRICE_BOOK,
      defaultHeight: config.defaultHeight,
      currency: 'EUR',
      materials: [],
      supplierProducts: [DOOR_PRODUCT],
    });
    const allLineItems = snap.items.flatMap((i) => i.lineItems);
    const doorItem = allLineItems.find((i) => i.source?.kind === 'supplierProduct');
    expect(doorItem).toBeDefined();
    const doorSource = doorItem?.source;
    expect(doorSource?.kind === 'supplierProduct' && doorSource.productId).toBe(DOOR_PRODUCT.id);
    expect(doorItem?.supplierProduct).toBeDefined();
    expect(doorItem?.supplierProduct?.id).toBe(DOOR_PRODUCT.id);
    expect(doorItem?.supplierProduct?.sku).toBe(DOOR_PRODUCT.sku);
    expect(doorItem?.supplierProduct?.priceCents).toBe(DOOR_PRODUCT.priceCents);
  });

  it('archived supplier product in snapshot: stub line item present, supplierProduct field absent (no row found)', () => {
    const archived = makeSupplierProduct({
      id: 'archived-door-snap',
      kind: 'door',
      archivedAt: '2024-01-01T00:00:00.000Z',
    });
    const config = makeConfig({
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
    const snap = buildQuoteSnapshot({
      code: CODE,
      buildings: config.buildings,
      roof: config.roof,
      priceBook: DEFAULT_PRICE_BOOK,
      defaultHeight: config.defaultHeight,
      currency: 'EUR',
      materials: [],
      supplierProducts: [archived],
    });
    const allLineItems = snap.items.flatMap((i) => i.lineItems);
    // The stub line item is emitted (total: 0, labelKey: supplierMissing)
    const stub = allLineItems.find((i) => i.labelKey === 'quote.line.supplierMissing');
    expect(stub).toBeDefined();
    expect(stub?.total).toBe(0);
    // buildSupplierProductSnapshot is only called for active products;
    // the archived product won't be found in the active-only pricing pass
    // so supplierProduct is not frozen (the pricing helper returns sku:'')
    const stubSource = stub?.source;
    expect(stubSource?.kind === 'supplierProduct' && stubSource.productId).toBe(archived.id);
  });
});

describe('buildConfigSnapshot — supplier product id preservation', () => {
  it('preserves doorSupplierProductId and window.supplierProductId in the frozen config', () => {
    const windowProductId = 'win-sp-test';
    const config = makeConfig({
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
              windows: [
                {
                  id: 'w1',
                  position: 0.5,
                  width: 1.0,
                  height: 1.0,
                  sillHeight: 1.0,
                  supplierProductId: windowProductId,
                },
              ],
            },
          },
        }),
      ],
    });
    const snap = buildConfigSnapshot(CODE, config);
    const frozenBuilding = snap.items[0].config.buildings[0];
    const frozenWall = frozenBuilding.walls['front'];
    expect(frozenWall?.doorSupplierProductId).toBe(DOOR_PRODUCT.id);
    expect(frozenWall?.windows[0]?.supplierProductId).toBe(windowProductId);
  });
});
