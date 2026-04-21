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
import {
  filterMaterialsForProduct,
  type ProductRow,
} from '@/domain/catalog';

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
  /** Resolved product when the hook was called with a matching
   *  `sourceProductId`. Useful for UI affordances like "Beperkt door
   *  bouwset" chips. Null when unconstrained. */
  sourceProduct: ProductRow | null;
}

export function useTenantCatalogs(
  current: CurrentSelections = {},
  sourceProductId?: string,
): TenantCatalogs {
  const { catalog } = useTenant();
  const materials = catalog.materials;
  const sourceProduct = sourceProductId
    ? catalog.products.find((p) => p.id === sourceProductId) ?? null
    : null;

  return useMemo(() => {
    const wallMats  = filterMaterialsForProduct(materials, sourceProduct, 'wallCladding');
    const rtrimMats = filterMaterialsForProduct(materials, sourceProduct, 'roofTrim');
    const rcovMats  = filterMaterialsForProduct(materials, sourceProduct, 'roofCovering');
    const floorMats = filterMaterialsForProduct(materials, sourceProduct, 'floor');
    const doorMats  = filterMaterialsForProduct(materials, sourceProduct, 'door');

    const wall      = buildWallCatalog(wallMats);
    const roofTrim  = buildRoofTrimCatalog(rtrimMats);
    const roofCover = buildRoofCoverCatalog(rcovMats);
    const floor     = buildFloorCatalog(floorMats);
    const door      = buildDoorCatalog(doorMats);

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
      sourceProduct,
    };
  }, [materials, sourceProduct, current.wall, current.roofTrim, current.roofCover, current.floor, current.door]);
}
