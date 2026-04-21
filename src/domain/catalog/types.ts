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
