'use client';
import { useMemo } from 'react';
import { useTenant } from '@/lib/TenantProvider';
import {
  buildWallCatalog,
  buildRoofTrimCatalog,
  buildRoofCoverCatalog,
  buildFloorCatalog,
  buildDoorCatalog,
  buildGateCatalog,
  filterCatalogAllowing,
  type WallCatalogEntry,
  type RoofTrimCatalogEntry,
  type RoofCoveringCatalogEntry,
  type FloorCatalogEntry,
  type DoorCatalogEntry,
  type GateCatalogEntry,
} from '@/domain/materials';
import {
  filterMaterialsForProduct,
  type MaterialCategory,
  type ProductRow,
} from '@/domain/catalog';
import type { MaterialDefaults } from '@/domain/config';
import type { SupplierProductKind, SupplierProductRow } from '@/domain/supplier';

interface CurrentSelections {
  /** Currently selected wall/primary material — kept visible even if
   *  disabled by the tenant, so existing scenes can still be re-picked. */
  wall?: string | null;
  roofTrim?: string | null;
  roofCover?: string | null;
  floor?: string | null;
  door?: string | null;
  gate?: string | null;
}

export interface TenantCatalogs {
  wall: readonly WallCatalogEntry[];
  roofTrim: readonly RoofTrimCatalogEntry[];
  roofCover: readonly RoofCoveringCatalogEntry[];
  floor: readonly FloorCatalogEntry[];
  door: readonly DoorCatalogEntry[];
  gate: readonly GateCatalogEntry[];
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
    const gate      = buildGateCatalog(materials);

    return {
      wall: filterCatalogAllowing(
        wall, current.wall ?? null, materials, 'wall',
        (m) => ({
          atomId: m.slug,
          pricePerSqm: m.pricing.wall?.perSqm ?? 0,
          ...(m.flags.clearsOpenings ? { clearsOpenings: true } : {}),
        }),
      ),
      roofTrim: filterCatalogAllowing(
        roofTrim, current.roofTrim ?? null, materials, 'roof-trim',
        (m) => ({ atomId: m.slug, pricePerSqm: m.pricing['roof-trim']?.perSqm ?? 0 }),
      ),
      roofCover: filterCatalogAllowing(
        roofCover, current.roofCover ?? null, materials, 'roof-cover',
        (m) => ({ atomId: m.slug, pricePerSqm: m.pricing['roof-cover']?.perSqm ?? 0 }),
      ),
      floor: filterCatalogAllowing(
        floor, current.floor ?? null, materials, 'floor',
        (m) => ({
          atomId: m.slug,
          pricePerSqm: m.pricing.floor?.perSqm ?? 0,
          ...(m.flags.isVoid ? { isVoid: true } : {}),
        }),
      ),
      door: filterCatalogAllowing(
        door, current.door ?? null, materials, 'door',
        (m) => ({ atomId: m.slug, surcharge: m.pricing.door?.surcharge ?? 0 }),
      ),
      gate: filterCatalogAllowing(
        gate, current.gate ?? null, materials, 'gate',
        (m) => ({ atomId: m.slug, pricePerSqm: m.pricing.gate?.perSqm ?? 0 }),
      ),
      sourceProduct,
    };
  }, [materials, sourceProduct, current.wall, current.roofTrim, current.roofCover, current.floor, current.door, current.gate]);
}

/** Memoised list of active (non-archived) supplier products of a given
 *  kind for the current tenant. Used by the configurator's gate panel to
 *  populate the SKU picker. Returns a stable empty array when the tenant
 *  has no products of that kind. */
export function useTenantSupplierProducts(
  kind: SupplierProductKind,
): SupplierProductRow[] {
  const { supplierCatalog } = useTenant();
  return useMemo(
    () =>
      supplierCatalog.products.filter(
        (p) => p.kind === kind && p.archivedAt === null,
      ),
    [supplierCatalog.products, kind],
  );
}

/** Memoised "first available material per category" map for the current
 *  tenant. Threaded into spawn calls so freshly-created entities have a
 *  valid material from frame 1 — no useEffect race, no empty trigger. The
 *  selection is stable per render: first non-archived row whose `categories`
 *  array contains the key. Categories without any matching row are omitted
 *  (caller falls back to the kind's hardcoded default). */
export function useFirstAvailableMaterials(): MaterialDefaults {
  const { catalog } = useTenant();
  const materials = catalog.materials;
  return useMemo(() => {
    const out: MaterialDefaults = {};
    const categories: MaterialCategory[] = [
      'wall',
      'roof-cover',
      'roof-trim',
      'floor',
      'door',
      'gate',
    ];
    for (const cat of categories) {
      const first = materials.find(
        (m) => m.archivedAt === null && m.categories.includes(cat),
      );
      if (first) out[cat] = first.slug;
    }
    return out;
  }, [materials]);
}
