import { describe, it, expect } from 'vite-plus/test';
import { validateSupplierPlacements } from '@/domain/supplier';
import type { SupplierProductRow } from '@/domain/supplier';
import { makeBuilding } from './fixtures';

// ── Helpers ──────────────────────────────────────────────────────────

function makeProduct(
  overrides: Partial<SupplierProductRow> & Pick<SupplierProductRow, 'id' | 'kind'>,
): SupplierProductRow {
  return {
    tenantId: 't',
    supplierId: 's1',
    sku: `SKU-${overrides.id}`,
    name: `Product ${overrides.id}`,
    heroImage: null,
    // Default: 900mm wide × 2100mm tall = 0.9m × 2.1m — fits a standard 4m wall / 2.6m height
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

const DEFAULT_HEIGHT = 2.6;

// ── Tests ─────────────────────────────────────────────────────────────

describe('validateSupplierPlacements', () => {
  it('returns no issues when door fits the wall (normal case)', () => {
    const product = makeProduct({ id: 'door-fits', kind: 'door', widthMm: 900, heightMm: 2100 });
    const building = makeBuilding({
      id: 'b1',
      type: 'berging',
      dimensions: { width: 4, depth: 3, height: 2.6 },
      walls: {
        front: {
          hasDoor: true,
          doorSize: 'enkel' as const,
          doorHasWindow: false,
          doorPosition: 0.5,
          doorSwing: 'naar_buiten' as const,
          doorSupplierProductId: product.id,
          windows: [],
        },
      },
    });
    const issues = validateSupplierPlacements([building], [product], DEFAULT_HEIGHT);
    expect(issues).toHaveLength(0);
  });

  it('returns too_tall when door product height exceeds wall height', () => {
    // Product: 3000mm tall (3m) > 2.6m default height
    const product = makeProduct({ id: 'door-tall', kind: 'door', widthMm: 900, heightMm: 3000 });
    const building = makeBuilding({
      id: 'b1',
      type: 'berging',
      dimensions: { width: 4, depth: 3, height: 2.6 },
      walls: {
        front: {
          hasDoor: true,
          doorSize: 'enkel' as const,
          doorHasWindow: false,
          doorPosition: 0.5,
          doorSwing: 'naar_buiten' as const,
          doorSupplierProductId: product.id,
          windows: [],
        },
      },
    });
    const issues = validateSupplierPlacements([building], [product], DEFAULT_HEIGHT);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('too_tall');
    expect(issues[0].buildingId).toBe('b1');
    expect(issues[0].wallSide).toBe('front');
    expect(issues[0].productId).toBe(product.id);
  });

  it('returns too_wide when door product width + 2×EDGE_CLEARANCE exceeds wall length', () => {
    // EDGE_CLEARANCE = 0.1m; wall = 1.1m; product = 1.0m wide → 1.0 + 2*0.1 = 1.2 > 1.1
    const product = makeProduct({ id: 'door-wide', kind: 'door', widthMm: 1000, heightMm: 2100 });
    const building = makeBuilding({
      id: 'b1',
      type: 'berging',
      dimensions: { width: 1.1, depth: 3, height: 2.6 },
      walls: {
        front: {
          hasDoor: true,
          doorSize: 'enkel' as const,
          doorHasWindow: false,
          doorPosition: 0.5,
          doorSwing: 'naar_buiten' as const,
          doorSupplierProductId: product.id,
          windows: [],
        },
      },
    });
    const issues = validateSupplierPlacements([building], [product], DEFAULT_HEIGHT);
    const tooWide = issues.filter((i) => i.code === 'too_wide');
    expect(tooWide).toHaveLength(1);
    expect(tooWide[0].productId).toBe(product.id);
  });

  it('returns too_wide when window product is too wide (window placement)', () => {
    // Wall depth side (left wall) = 3m; product = 3500mm wide → 3.5 + 2*0.5 = 4.5 > 3.0
    const product = makeProduct({ id: 'win-wide', kind: 'window', widthMm: 3500, heightMm: 1000 });
    const building = makeBuilding({
      id: 'b1',
      type: 'berging',
      dimensions: { width: 4, depth: 3, height: 2.6 },
      walls: {
        left: {
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
              supplierProductId: product.id,
            },
          ],
        },
      },
    });
    const issues = validateSupplierPlacements([building], [product], DEFAULT_HEIGHT);
    const tooWide = issues.filter((i) => i.code === 'too_wide');
    expect(tooWide).toHaveLength(1);
    expect(tooWide[0].wallSide).toBe('left');
  });

  it('skips missing products (no crash, no issues)', () => {
    const building = makeBuilding({
      id: 'b1',
      type: 'berging',
      dimensions: { width: 4, depth: 3, height: 2.6 },
      walls: {
        front: {
          hasDoor: true,
          doorSize: 'enkel' as const,
          doorHasWindow: false,
          doorPosition: 0.5,
          doorSwing: 'naar_buiten' as const,
          doorSupplierProductId: 'non-existent',
          windows: [],
        },
      },
    });
    // Empty supplier product list — product not found → skipped
    expect(() => {
      const issues = validateSupplierPlacements([building], [], DEFAULT_HEIGHT);
      expect(issues).toHaveLength(0);
    }).not.toThrow();
  });

  it('a wall with both a door and a window supplier product reports issues for each', () => {
    // Door: 3.9m wide → too_wide on a 4m wall (3.9 + 2*0.1 = 4.1 > 4)
    // Window: 3.1m tall → too_tall (3.1 > 2.6)
    const doorProduct = makeProduct({ id: 'dp', kind: 'door', widthMm: 3900, heightMm: 2100 });
    const winProduct = makeProduct({ id: 'wp', kind: 'window', widthMm: 500, heightMm: 3100 });
    const building = makeBuilding({
      id: 'b1',
      type: 'berging',
      dimensions: { width: 4, depth: 3, height: 2.6 },
      walls: {
        front: {
          hasDoor: true,
          doorSize: 'enkel' as const,
          doorHasWindow: false,
          doorPosition: 0.5,
          doorSwing: 'naar_buiten' as const,
          doorSupplierProductId: doorProduct.id,
          windows: [
            {
              id: 'w1',
              position: 0.8,
              width: 0.5,
              height: 1.0,
              sillHeight: 1.0,
              supplierProductId: winProduct.id,
            },
          ],
        },
      },
    });
    const issues = validateSupplierPlacements([building], [doorProduct, winProduct], DEFAULT_HEIGHT);
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(issues.some((i) => i.code === 'too_wide' && i.productId === doorProduct.id)).toBe(true);
    expect(issues.some((i) => i.code === 'too_tall' && i.productId === winProduct.id)).toBe(true);
  });

  // ── Gate-primitive placement (Phase 5.8.3) ──────────────────────────

  describe('gate primitive', () => {
    function makeGateBuilding(
      overrides: { width?: number; height?: number; supplierProductId?: string } = {},
    ) {
      const { width = 3, height = 2, supplierProductId = 'gate-prod' } = overrides;
      return makeBuilding({
        id: 'gate-1',
        type: 'poort',
        dimensions: { width, depth: 0.1, height },
        heightOverride: height,
        gateConfig: {
          partCount: 1,
          materialId: 'staal-antraciet',
          swingDirection: 'inward',
          motorized: false,
          supplierProductId,
        },
      });
    }

    it('returns no issues when gate fits the SKU max dimensions', () => {
      const product = makeProduct({
        id: 'gate-prod',
        kind: 'gate',
        widthMm: 3000,
        heightMm: 2000,
        meta: { maxDimensions: { widthMm: 4000, heightMm: 2500 } },
      });
      const building = makeGateBuilding({ width: 3, height: 2 });
      const issues = validateSupplierPlacements([building], [product], DEFAULT_HEIGHT);
      expect(issues).toHaveLength(0);
    });

    it('returns gate_too_tall when placed gate exceeds maxDimensions.heightMm', () => {
      const product = makeProduct({
        id: 'gate-prod',
        kind: 'gate',
        widthMm: 3000,
        heightMm: 2000,
        meta: { maxDimensions: { widthMm: 4000, heightMm: 2200 } },
      });
      const building = makeGateBuilding({ width: 3, height: 2.5 });
      const issues = validateSupplierPlacements([building], [product], DEFAULT_HEIGHT);
      expect(issues).toHaveLength(1);
      expect(issues[0].code).toBe('gate_too_tall');
      expect(issues[0].buildingId).toBe('gate-1');
    });

    it('returns gate_too_wide when placed gate exceeds maxDimensions.widthMm', () => {
      const product = makeProduct({
        id: 'gate-prod',
        kind: 'gate',
        widthMm: 3000,
        heightMm: 2000,
        meta: { maxDimensions: { widthMm: 3500, heightMm: 2500 } },
      });
      const building = makeGateBuilding({ width: 4 });
      const issues = validateSupplierPlacements([building], [product], DEFAULT_HEIGHT);
      expect(issues).toHaveLength(1);
      expect(issues[0].code).toBe('gate_too_wide');
    });

    it('skips check when SKU has no maxDimensions in meta', () => {
      const product = makeProduct({
        id: 'gate-prod',
        kind: 'gate',
        widthMm: 3000,
        heightMm: 2000,
        meta: {},
      });
      const building = makeGateBuilding({ width: 50, height: 50 });
      const issues = validateSupplierPlacements([building], [product], DEFAULT_HEIGHT);
      expect(issues).toHaveLength(0);
    });

    it('skips check when gate is naked (no supplierProductId)', () => {
      const product = makeProduct({
        id: 'gate-prod',
        kind: 'gate',
        widthMm: 3000,
        heightMm: 2000,
        meta: { maxDimensions: { widthMm: 1000, heightMm: 1000 } },
      });
      const building = makeBuilding({
        id: 'gate-1',
        type: 'poort',
        dimensions: { width: 5, depth: 0.1, height: 5 },
        heightOverride: 5,
        gateConfig: {
          partCount: 1,
          materialId: 'staal-antraciet',
          swingDirection: 'inward',
          motorized: false,
        },
      });
      const issues = validateSupplierPlacements([building], [product], DEFAULT_HEIGHT);
      expect(issues).toHaveLength(0);
    });

    it('silently skips when SKU is archived', () => {
      const product = makeProduct({
        id: 'gate-prod',
        kind: 'gate',
        widthMm: 3000,
        heightMm: 2000,
        meta: { maxDimensions: { widthMm: 1000, heightMm: 1000 } },
        archivedAt: '2026-01-01T00:00:00Z',
      });
      const building = makeGateBuilding({ width: 5, height: 5 });
      const issues = validateSupplierPlacements([building], [product], DEFAULT_HEIGHT);
      expect(issues).toHaveLength(0);
    });
  });
});
