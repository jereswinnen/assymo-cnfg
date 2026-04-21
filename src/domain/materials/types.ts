/** Primitives shared across all object-type catalogs. Maps 1:1 to a future
 *  `materials` DB table row. */
export interface MaterialAtom {
  /** Stable slug (kebab or snake). Becomes DB `slug` column. */
  id: string;
  /** i18n key for the human-readable name. */
  labelKey: string;
  /** Fallback colour if no texture, or tint colour when texture present. */
  color: string;
  /** Optional PBR texture set. */
  textures?: {
    color: string;
    normal: string;
    roughness: string;
  };
  /** Meters each texture tile covers (controls repeat density). */
  tileSize?: [number, number];
  /** Soft-delete placeholder. Admin will set this; configurator treats
   *  non-null as "hide from picker, still render in existing configs". */
  archivedAt?: string | null;
}

/** Per-object catalog entry — references an atom by slug and adds
 *  object-specific context. Each object type has its own entry shape. */
export interface BaseCatalogEntry {
  atomId: string;
}

export interface WallCatalogEntry extends BaseCatalogEntry {
  pricePerSqm: number;
  /** If true, selecting this material clears doors and windows
   *  (currently used by `glass`). */
  clearsOpenings?: boolean;
}

export interface RoofTrimCatalogEntry extends BaseCatalogEntry {
  // No price or flags today — trim is visual-only in the pricing model.
  // Kept as a distinct type so admin/catalog can evolve independently.
}

export interface RoofCoveringCatalogEntry extends BaseCatalogEntry {
  pricePerSqm: number;
}

export interface FloorCatalogEntry extends BaseCatalogEntry {
  pricePerSqm: number;
  /** Marks the "none" option — renders no floor geometry, no swatch. */
  isVoid?: boolean;
}

export interface DoorCatalogEntry extends BaseCatalogEntry {
  /** Flat surcharge added to door base price. */
  surcharge: number;
}
