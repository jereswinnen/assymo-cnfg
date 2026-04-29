import type { GateSwingDirection } from '@/domain/building';

export type SupplierProductKind = 'door' | 'window' | 'gate';

export interface SupplierRow {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  contact: SupplierContact;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
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

export interface WindowMetaSegments {
  enabled: boolean;
  /** Width (mm) at which the FIRST divider appears. Required when enabled. */
  autoThresholdMm: number;
  /** When set, every additional `perAdditionalThresholdMm` mm of width adds
   *  one more divider. Absent → at most 1 divider. */
  perAdditionalThresholdMm?: number;
  /** Hard cap on divider count. Absent → unbounded. */
  maxCount?: number;
  /** Optional pricing hook — added per-divider when count > 0. */
  surchargeCentsPerDivider?: number;
}

export interface WindowMetaSchuifraam {
  enabled: boolean;
  /** Optional flat surcharge applied when this product is selected. */
  surchargeCents?: number;
}

export interface WindowMeta {
  glazingType?: 'double' | 'triple' | 'single';
  uValue?: number;
  frameMaterial?: string;
  openable?: boolean;
  leadTimeDays?: number;
  segments?: WindowMetaSegments;
  schuifraam?: WindowMetaSchuifraam;
}

export interface GateMetaOption {
  /** Stable id within this product, referenced by GateConfig.selected*Sku */
  sku: string;
  /** Optional i18n key; falls back to `label` when absent */
  labelKey?: string;
  /** Free-form display name; required when `labelKey` not set */
  label?: string;
  /** Color options only — e.g. "RAL 7016". Free-form display string. */
  ralCode?: string;
  /** Additive on the supplier-base price when this option is selected */
  surchargeCents?: number;
}

export type GatePartCount = 1 | 2 | 'configurable';
export type GateMotorized = boolean | 'optional';
export type GateGlazing = 'none' | 'partial' | 'full';

export interface GateMeta {
  partCount?: GatePartCount;
  motorized?: GateMotorized;
  /** Surcharge applied when motorized==='optional' AND customer ticks the toggle */
  motorizedSurchargeCents?: number;
  swingDirections?: GateSwingDirection[];
  defaultDimensions?: { widthMm: number; heightMm: number };
  maxDimensions?: { widthMm: number; heightMm: number };
  glazing?: GateGlazing;
  availableColors?: GateMetaOption[];
  availableLocks?: GateMetaOption[];
  availableHandles?: GateMetaOption[];
  rValue?: number;
  leadTimeDays?: number;
}

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
  meta: DoorMeta | WindowMeta | GateMeta;
  sortOrder: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Stable error code strings (do NOT rename — UI + tests depend on them). */
export const SUPPLIER_ERROR_CODES = {
  nameRequired: 'name_required',
  slugInvalid: 'slug_invalid',
  contactInvalid: 'contact_invalid',
  logoUrlInvalid: 'logo_url_invalid',
  notesInvalid: 'notes_invalid',
  bodyInvalid: 'body_invalid',
  skuRequired: 'sku_required',
  nameMissing: 'name_missing',
  widthInvalid: 'width_invalid',
  heightInvalid: 'height_invalid',
  priceInvalid: 'price_invalid',
  kindInvalid: 'kind_invalid',
  metaInvalid: 'meta_invalid',
  heroImageInvalid: 'hero_image_invalid',
  sortOrderInvalid: 'sort_order_invalid',
  supplierIdRequired: 'supplier_id_required',
  segmentsInvalid: 'segments_invalid',
  schuifraamInvalid: 'schuifraam_invalid',
} as const;
