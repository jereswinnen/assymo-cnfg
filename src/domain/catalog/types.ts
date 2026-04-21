/** Material categories — each maps 1:1 to a per-object picker in the
 *  configurator. Slug-collisions across categories are fine (a category
 *  namespace is expected — 'wood' wall material and 'wood' door material
 *  may coexist and point at different rows). */
export type MaterialCategory =
  | 'wall'
  | 'roof-cover'
  | 'roof-trim'
  | 'floor'
  | 'door';

/** Per-PBR texture set. Blob URLs on persisted rows; unknown during
 *  create-draft. All three are required when `textures` is non-null. */
export interface MaterialTextures {
  color: string;
  normal: string;
  roughness: string;
}

/** Per-category pricing shape. Only the fields relevant to the category
 *  are present. Per-category field presence is enforced by the
 *  `validateMaterialCreate` / `validateMaterialPatch` helpers in
 *  `src/domain/catalog/material.ts`. */
export interface MaterialPricing {
  /** €/m² for wall / roof-cover / floor. */
  perSqm?: number;
  /** Flat surcharge added to door base price. */
  surcharge?: number;
}

/** Per-category behaviour flags. Only the fields relevant to the category
 *  are present. Per-category field presence is enforced by the
 *  `validateMaterialCreate` / `validateMaterialPatch` helpers in
 *  `src/domain/catalog/material.ts`. */
export interface MaterialFlags {
  /** Wall only: selecting this material clears doors and windows on the wall. */
  clearsOpenings?: boolean;
  /** Floor only: the "Geen vloer" sentinel. At most one per tenant. */
  isVoid?: boolean;
}

/** Canonical shape of a material as it lives in the DB. This is the
 *  transport shape: API responses, seed data, and the materials array
 *  on TenantContext all use it. Consumer code (pickers, pricing,
 *  canvas) converts to per-category "view" types via helpers in
 *  `@/domain/materials`. */
export interface MaterialRow {
  id: string;
  tenantId: string;
  category: MaterialCategory;
  slug: string;
  name: string;
  color: string;
  textures: MaterialTextures | null;
  tileSize: [number, number] | null;
  pricing: MaterialPricing;
  flags: MaterialFlags;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Input shape for `validateMaterialCreate` — everything except DB-owned
 *  columns (id, tenantId, archivedAt, timestamps). */
export interface MaterialCreateInput {
  category: MaterialCategory;
  slug: string;
  name: string;
  color: string;
  textures?: MaterialTextures | null;
  tileSize?: [number, number] | null;
  pricing: MaterialPricing;
  flags?: MaterialFlags;
}

/** Input shape for `validateMaterialPatch` — all fields optional; whatever
 *  is absent is left alone. `category` cannot be changed (would invalidate
 *  references from products and break slug uniqueness scoping). */
export type MaterialPatchInput = Partial<Omit<MaterialCreateInput, 'category'>>;

/** Stable error codes surfaced by validators. Admin UI maps to i18n keys. */
export type MaterialValidationError =
  | 'slug_invalid'
  | 'slug_taken'
  | 'color_invalid'
  | 'textures_invalid'
  | 'tile_size_invalid'
  | 'pricing_invalid'
  | 'flags_invalid'
  | 'name_invalid'
  | 'category_invalid'
  | 'void_conflict';

export interface ValidationFieldError {
  field: string;
  code: MaterialValidationError;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ValidationFieldError[] };

export const MATERIAL_CATEGORIES: readonly MaterialCategory[] = [
  'wall',
  'roof-cover',
  'roof-trim',
  'floor',
  'door',
] as const;

// ─────────────────────────────────────────────────────────────────────
// Products (Phase 5.5.2)
// ─────────────────────────────────────────────────────────────────────

/** Engine primitives that can back a starter-kit Product. `paal` and
 *  `muur` are NEVER products — they are loose tray primitives. */
export type ProductKind = 'overkapping' | 'berging';

export const PRODUCT_KINDS: readonly ProductKind[] = ['overkapping', 'berging'] as const;

/** Slot keys a product may carry defaults + constraints for. Keys are
 *  stable identifiers — every category that feeds a picker gets one slot.
 *  Not every kind uses every slot (e.g. overkapping has no door on its
 *  default surfaces) but the model accepts all five and runtime code
 *  ignores slots that don't apply to the kind. */
export type ProductSlot = 'wallCladding' | 'roofCovering' | 'roofTrim' | 'floor' | 'door';

export const PRODUCT_SLOTS: readonly ProductSlot[] = [
  'wallCladding',
  'roofCovering',
  'roofTrim',
  'floor',
  'door',
] as const;

/** Mapping slot → material-category, used when validating that a default
 *  slug or an allow-list slug actually belongs to the right category. */
export const PRODUCT_SLOT_TO_CATEGORY: Record<ProductSlot, MaterialCategory> = {
  wallCladding: 'wall',
  roofCovering: 'roof-cover',
  roofTrim: 'roof-trim',
  floor: 'floor',
  door: 'door',
};

/** Default values a customer lands on when spawning a building from a
 *  product. Dimensions mirror `BuildingDimensions` from `@/domain/building`
 *  (copied here to avoid a reverse-dependency). `materials` keys are
 *  material slugs referencing rows in the same tenant's `materials`
 *  table. Every field is optional — missing defaults fall back to the
 *  engine's own `DEFAULT_WALL`/`DEFAULT_ROOF` legacy (removed in 5.5.3). */
export interface ProductDefaults {
  width?: number;
  depth?: number;
  height?: number;
  materials?: Partial<Record<ProductSlot, string>>;
}

/** Per-product constraints. Empty/missing = "no constraint". */
export interface ProductConstraints {
  minWidth?: number;
  maxWidth?: number;
  minDepth?: number;
  maxDepth?: number;
  minHeight?: number;
  maxHeight?: number;
  /** Map of slot → list of allowed material slugs. Empty array AND
   *  missing key both mean "all materials in that slot's category are
   *  allowed". Non-empty array = only those slugs. Slugs must exist as
   *  `materials` rows of the right category for this tenant (checked
   *  at route-handler time with a DB lookup). */
  allowedMaterialsBySlot?: Partial<Record<ProductSlot, string[]>>;
}

/** Transport shape of a product row. */
export interface ProductRow {
  id: string;
  tenantId: string;
  kind: ProductKind;
  slug: string;
  name: string;
  description: string | null;
  heroImage: string | null;
  defaults: ProductDefaults;
  constraints: ProductConstraints;
  basePriceCents: number;
  sortOrder: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Create-input shape: no DB-owned columns. */
export interface ProductCreateInput {
  kind: ProductKind;
  slug: string;
  name: string;
  description?: string | null;
  heroImage?: string | null;
  defaults: ProductDefaults;
  constraints: ProductConstraints;
  basePriceCents?: number;
  sortOrder?: number;
}

/** Patch-input shape: everything optional, `kind` cannot be changed. */
export type ProductPatchInput = Partial<Omit<ProductCreateInput, 'kind'>>;

export type ProductValidationError =
  | 'kind_invalid'
  | 'slug_invalid'
  | 'slug_taken'
  | 'name_invalid'
  | 'description_invalid'
  | 'hero_image_invalid'
  | 'dimensions_invalid'
  | 'base_price_invalid'
  | 'sort_order_invalid'
  | 'default_material_not_found'
  | 'allowed_material_not_found'
  | 'constraints_invalid';

export interface ProductValidationFieldError {
  field: string;
  code: ProductValidationError;
}

export type ProductValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ProductValidationFieldError[] };
