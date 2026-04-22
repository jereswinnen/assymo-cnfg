import { describe, it, expect } from 'vite-plus/test';
import { getSupplierDoorLineItem, getSupplierWindowLineItem } from '@/domain/supplier';
import type { SupplierProductRow } from '@/domain/supplier';

function makeProduct(overrides: Partial<SupplierProductRow> = {}): SupplierProductRow {
  return {
    id: 'prod-1',
    tenantId: 'tenant-1',
    supplierId: 'sup-1',
    kind: 'door',
    sku: 'DOOR-001',
    name: 'Steel Entry Door',
    heroImage: null,
    widthMm: 900,
    heightMm: 2100,
    priceCents: 75000,
    meta: {},
    sortOrder: 0,
    archivedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('getSupplierDoorLineItem', () => {
  it('returns a door line item for a present non-archived product', () => {
    const products = [makeProduct()];
    const item = getSupplierDoorLineItem('prod-1', products);
    expect(item?.labelKey).toBe('quote.line.supplierDoor');
    expect(item?.labelParams.name).toBe('Steel Entry Door');
    expect(item?.labelParams.sku).toBe('DOOR-001');
    expect(item?.total).toBe(75000);
    expect(item?.source.kind).toBe('supplierProduct');
    expect(item?.source.productId).toBe('prod-1');
  });

  it('returns a stub when the product id is not found', () => {
    const item = getSupplierDoorLineItem('missing-id', []);
    expect(item?.labelKey).toBe('quote.line.supplierMissing');
    expect(item?.labelParams.id).toBe('missing-id');
    expect(item?.labelParams.kind).toBe('door');
    expect(item?.total).toBe(0);
  });

  it('returns a stub when the product is archived', () => {
    const products = [makeProduct({ archivedAt: new Date('2026-03-01') })];
    const item = getSupplierDoorLineItem('prod-1', products);
    expect(item?.labelKey).toBe('quote.line.supplierMissing');
    expect(item?.labelParams.kind).toBe('door');
    expect(item?.total).toBe(0);
  });
});

describe('getSupplierWindowLineItem', () => {
  it('returns a window line item for a present non-archived product', () => {
    const products = [makeProduct({ id: 'win-1', kind: 'window', sku: 'WIN-001', name: 'Triple Glazed Window', priceCents: 45000 })];
    const item = getSupplierWindowLineItem('win-1', products);
    expect(item?.labelKey).toBe('quote.line.supplierWindow');
    expect(item?.labelParams.name).toBe('Triple Glazed Window');
    expect(item?.total).toBe(45000);
  });

  it('returns a stub when the product is missing', () => {
    const item = getSupplierWindowLineItem('ghost-id', []);
    expect(item?.labelKey).toBe('quote.line.supplierMissing');
    expect(item?.labelParams.kind).toBe('window');
    expect(item?.total).toBe(0);
  });
});
