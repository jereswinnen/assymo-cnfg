import { describe, it, expect } from 'vite-plus/test';
import { resolveDoorWidth, resolveWindowWidth } from '@/domain/openings';
import { DOOR_W, DOUBLE_DOOR_W } from '@/domain/building';
import type { WallWindow } from '@/domain/building';
import type { SupplierProductRow } from '@/domain/supplier';

function makeProduct(overrides: Partial<SupplierProductRow> = {}): SupplierProductRow {
  return {
    id: 'p1', tenantId: 't1', supplierId: 's1', kind: 'window',
    sku: 'W1', name: 'W1', heroImage: null,
    widthMm: 1800, heightMm: 1200, priceCents: 0,
    meta: {}, sortOrder: 0, archivedAt: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    ...overrides,
  };
}

function makeWindow(extras: Partial<WallWindow> = {}): WallWindow {
  return { id: 'w1', position: 0.5, width: 1.2, height: 1.5, sillHeight: 0.9, ...extras };
}

describe('resolveDoorWidth', () => {
  it('returns single-door default when no override', () => {
    expect(resolveDoorWidth({ doorSize: 'enkel', doorSupplierProductId: null }, [])).toBe(DOOR_W);
  });

  it('returns double-door default when no override', () => {
    expect(resolveDoorWidth({ doorSize: 'dubbel', doorSupplierProductId: null }, [])).toBe(DOUBLE_DOOR_W);
  });

  it('uses supplier product width when bound', () => {
    const sp = makeProduct({ id: 'd1', kind: 'door', widthMm: 1100 });
    expect(resolveDoorWidth({ doorSize: 'enkel', doorSupplierProductId: 'd1' }, [sp])).toBeCloseTo(1.1);
  });

  it('falls back to default when supplier product is missing', () => {
    expect(resolveDoorWidth({ doorSize: 'dubbel', doorSupplierProductId: 'gone' }, [])).toBe(DOUBLE_DOOR_W);
  });
});

describe('resolveWindowWidth', () => {
  it('returns the per-window width when no supplier bound', () => {
    expect(resolveWindowWidth(makeWindow({ width: 1.6 }), [])).toBe(1.6);
  });

  it('uses supplier product width when bound', () => {
    const sp = makeProduct({ id: 'p1', widthMm: 2400 });
    expect(resolveWindowWidth(makeWindow({ supplierProductId: 'p1' }), [sp])).toBeCloseTo(2.4);
  });

  it('falls back to per-window width when supplier product is missing', () => {
    expect(resolveWindowWidth(makeWindow({ width: 1.6, supplierProductId: 'gone' }), [])).toBe(1.6);
  });
});
