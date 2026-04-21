'use client';
import { useMemo } from 'react';
import { useTenant } from '@/lib/TenantProvider';
import {
  WALL_CATALOG,
  ROOF_TRIM_CATALOG,
  ROOF_COVERING_CATALOG,
  FLOOR_CATALOG,
  DOOR_CATALOG,
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

/** Returns the five per-category catalogs, filtered against the current
 *  tenant's `enabledMaterials` allow-list. Pass the current selection
 *  per category so it stays visible in the picker even if the admin
 *  has since disabled it. */
export function useTenantCatalogs(current: CurrentSelections = {}): TenantCatalogs {
  const { enabledMaterials } = useTenant();
  return useMemo(
    () => ({
      wall: filterCatalogAllowing(WALL_CATALOG, enabledMaterials, current.wall ?? null),
      roofTrim: filterCatalogAllowing(ROOF_TRIM_CATALOG, enabledMaterials, current.roofTrim ?? null),
      roofCover: filterCatalogAllowing(ROOF_COVERING_CATALOG, enabledMaterials, current.roofCover ?? null),
      floor: filterCatalogAllowing(FLOOR_CATALOG, enabledMaterials, current.floor ?? null),
      door: filterCatalogAllowing(DOOR_CATALOG, enabledMaterials, current.door ?? null),
    }),
    [
      enabledMaterials,
      current.wall,
      current.roofTrim,
      current.roofCover,
      current.floor,
      current.door,
    ],
  );
}
