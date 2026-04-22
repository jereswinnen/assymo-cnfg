import type { SupplierProductKind, SupplierProductRow } from './types';

export interface SupplierProductSnapshot {
  id: string;
  supplierId: string;
  kind: SupplierProductKind;
  sku: string;
  name: string;
  widthMm: number;
  heightMm: number;
  priceCents: number;
}

export function buildSupplierProductSnapshot(row: SupplierProductRow): SupplierProductSnapshot {
  return {
    id: row.id,
    supplierId: row.supplierId,
    kind: row.kind,
    sku: row.sku,
    name: row.name,
    widthMm: row.widthMm,
    heightMm: row.heightMm,
    priceCents: row.priceCents,
  };
}
