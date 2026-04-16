import type { DoorSize } from '@/domain/building';

/** All scalar pricing dials a tenant can tweak. Catalog-driven prices
 *  (per-material €/m², door material surcharges) live on the material
 *  catalog for now and will move to the tenant in a later pass. */
export interface PriceBook {
  /** € per m² of insulated roof, per mm of insulation thickness. */
  insulationPerSqmPerMm: number;
  /** Base door price by door size. */
  doorBase: Record<DoorSize, number>;
  /** Flat surcharge when a door includes a window panel. */
  doorWindowSurcharge: number;
  /** Flat fee per wall window. */
  windowFee: number;
  /** Flat fee per roof skylight. */
  skylightFee: number;
  /** Price per structural post. */
  postPrice: number;
  /** Price per corner brace (building uses 8 when enabled). */
  bracePrice: number;
}

/** Current Assymo price list. New tenants start from this and override
 *  what they need to. */
export const DEFAULT_PRICE_BOOK: PriceBook = {
  insulationPerSqmPerMm: 0.12,
  doorBase: {
    enkel: 850,
    dubbel: 1350,
  },
  doorWindowSurcharge: 200,
  windowFee: 420,
  skylightFee: 780,
  postPrice: 120,
  bracePrice: 45,
};
