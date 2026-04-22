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
