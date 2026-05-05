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
  /** Per-m² price. 0 = no fascia line item is emitted. */
  pricePerSqm: number;
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

export interface GateCatalogEntry extends BaseCatalogEntry {
  pricePerSqm: number;
}
