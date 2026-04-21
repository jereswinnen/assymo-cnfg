'use client';
import { useMemo } from 'react';
import { useTenant } from '@/lib/TenantProvider';
import {
  buildWallCatalog,
  buildRoofTrimCatalog,
  buildRoofCoverCatalog,
  buildFloorCatalog,
  buildDoorCatalog,
  filterCatalogAllowing,
  type WallCatalogEntry,
  type RoofTrimCatalogEntry,
  type RoofCoveringCatalogEntry,
  type FloorCatalogEntry,
  type DoorCatalogEntry,
} from '@/domain/materials';

interface CurrentSelections {
  /** Currently selected wall/primary material — kept visible even if
   *  disabled by the tenant, so existing scenes can still be re-picked. */
  wall?: string | null;
  roofTrim?: string | null;
  roofCover?: string | null;
  floor?: string | null;
  door?: string | null;
}

export interface TenantCatalogs {
  wall: readonly WallCatalogEntry[];
  roofTrim: readonly RoofTrimCatalogEntry[];
  roofCover: readonly RoofCoveringCatalogEntry[];
  floor: readonly FloorCatalogEntry[];
  door: readonly DoorCatalogEntry[];
}

/** Returns the five per-category catalogs derived from the tenant's
 *  DB-backed `materials` rows. Signature preserved from Phase 4.5 so
 *  consumers don't change. Pass the current selection per category so
 *  it stays visible in the picker even if the admin has since archived
 *  the material. Phase 5.5.2 will add an optional `sourceProductId`
 *  argument to narrow by product constraints — not present yet. */
export function useTenantCatalogs(current: CurrentSelections = {}): TenantCatalogs {
  const { catalog } = useTenant();
  const materials = catalog.materials;

  return useMemo(() => {
    const wall = buildWallCatalog(materials);
    const roofTrim = buildRoofTrimCatalog(materials);
    const roofCover = buildRoofCoverCatalog(materials);
    const floor = buildFloorCatalog(materials);
    const door = buildDoorCatalog(materials);

    return {
      wall: filterCatalogAllowing(
        wall, current.wall ?? null, materials, 'wall',
        (m) => ({
          atomId: m.slug,
          pricePerSqm: m.pricing.perSqm ?? 0,
          ...(m.flags.clearsOpenings ? { clearsOpenings: true } : {}),
        }),
      ),
      roofTrim: filterCatalogAllowing(
        roofTrim, current.roofTrim ?? null, materials, 'roof-trim',
        (m) => ({ atomId: m.slug }),
      ),
      roofCover: filterCatalogAllowing(
        roofCover, current.roofCover ?? null, materials, 'roof-cover',
        (m) => ({ atomId: m.slug, pricePerSqm: m.pricing.perSqm ?? 0 }),
      ),
      floor: filterCatalogAllowing(
        floor, current.floor ?? null, materials, 'floor',
        (m) => ({
          atomId: m.slug,
          pricePerSqm: m.pricing.perSqm ?? 0,
          ...(m.flags.isVoid ? { isVoid: true } : {}),
        }),
      ),
      door: filterCatalogAllowing(
        door, current.door ?? null, materials, 'door',
        (m) => ({ atomId: m.slug, surcharge: m.pricing.surcharge ?? 0 }),
      ),
    };
  }, [materials, current.wall, current.roofTrim, current.roofCover, current.floor, current.door]);
}
