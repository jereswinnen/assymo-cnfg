export type SupplierProductKind = 'door' | 'window';

export interface SupplierRow {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  contact: SupplierContact;
  notes: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierContact {
  email?: string;
  phone?: string;
  website?: string;
}

export interface DoorMeta {
  swingDirection?: 'inward' | 'outward' | 'none';
  lockType?: 'cylinder' | 'multipoint' | 'none';
  glazing?: 'solid' | 'glass-panel' | 'half-glass';
  rValue?: number;
  leadTimeDays?: number;
}

export interface WindowMeta {
  glazingType?: 'double' | 'triple' | 'single';
  uValue?: number;
  frameMaterial?: string;
  openable?: boolean;
  leadTimeDays?: number;
}

export type SupplierProductMeta =
  | { kind: 'door'; meta: DoorMeta }
  | { kind: 'window'; meta: WindowMeta };

export interface SupplierProductRow {
  id: string;
  tenantId: string;
  supplierId: string;
  kind: SupplierProductKind;
  sku: string;
  name: string;
  heroImage: string | null;
  widthMm: number;
  heightMm: number;
  priceCents: number;
  meta: DoorMeta | WindowMeta;
  sortOrder: number;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Stable error code strings (do NOT rename — UI + tests depend on them). */
export const SUPPLIER_ERROR_CODES = {
  nameRequired: 'name_required',
  slugInvalid: 'slug_invalid',
  contactInvalid: 'contact_invalid',
  skuRequired: 'sku_required',
  nameMissing: 'name_missing',
  widthInvalid: 'width_invalid',
  heightInvalid: 'height_invalid',
  priceInvalid: 'price_invalid',
  kindInvalid: 'kind_invalid',
  metaInvalid: 'meta_invalid',
  supplierIdRequired: 'supplier_id_required',
} as const;
