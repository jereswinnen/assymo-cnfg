import { describe, it, expect } from 'vite-plus/test';
import { buildSupplierProductSnapshot } from '@/domain/supplier';
import type { SupplierProductRow } from '@/domain/supplier';

function makeRow(overrides: Partial<SupplierProductRow> = {}): SupplierProductRow {
  return {
    id: 'prod-1',
    tenantId: 'tenant-1',
    supplierId: 'sup-1',
    kind: 'door',
    sku: 'DOOR-001',
    name: 'Steel Entry Door',
    heroImage: 'https://cdn.example.com/door.jpg',
    widthMm: 900,
    heightMm: 2100,
    priceCents: 75000,
    meta: { swingDirection: 'inward' },
    sortOrder: 0,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildSupplierProductSnapshot', () => {
  it('returns the correct snapshot shape without runtime meta or timestamps', () => {
    const snapshot = buildSupplierProductSnapshot(makeRow());
    expect(snapshot).toEqual({
      id: 'prod-1',
      supplierId: 'sup-1',
      kind: 'door',
      sku: 'DOOR-001',
      name: 'Steel Entry Door',
      widthMm: 900,
      heightMm: 2100,
      priceCents: 75000,
    });
    expect('heroImage' in snapshot).toBe(false);
    expect('meta' in snapshot).toBe(false);
    expect('createdAt' in snapshot).toBe(false);
  });

  it('works for a window product', () => {
    const snapshot = buildSupplierProductSnapshot(
      makeRow({ id: 'win-1', kind: 'window', sku: 'WIN-001', name: 'Triple Glazed Window', priceCents: 45000 }),
    );
    expect(snapshot.kind).toBe('window');
    expect(snapshot.sku).toBe('WIN-001');
    expect(snapshot.priceCents).toBe(45000);
  });
});
