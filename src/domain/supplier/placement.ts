import type { BuildingEntity } from '@/domain/building';
import { EDGE_CLEARANCE, getWallLength } from '@/domain/building';
import type { GateMeta, SupplierProductRow } from './types';

export interface PlacementIssue {
  code: 'too_tall' | 'too_wide' | 'gate_too_tall' | 'gate_too_wide';
  buildingId: string;
  /** Wall side for door/window issues; '' for gate-primitive issues. */
  wallSide: string;
  productId: string;
  details: {
    width_m: number;
    height_m: number;
    wall_length: number;
    wall_height: number;
  };
}

/** Pure domain validator: walks every building's walls and checks that
 *  any assigned supplier product physically fits in that wall opening.
 *
 *  - too_tall: product.heightMm / 1000 > effective wall height
 *  - too_wide: product.widthMm / 1000 + 2 × EDGE_CLEARANCE > wall length
 *    (mirrors the usable-span check used by clampOpeningPosition)
 *
 *  Missing or archived products are silently skipped — the submit-time
 *  existence/archive checks handle that case separately. */
export function validateSupplierPlacements(
  buildings: BuildingEntity[],
  supplierProducts: SupplierProductRow[],
  defaultHeight: number,
): PlacementIssue[] {
  const issues: PlacementIssue[] = [];

  const productMap = new Map(supplierProducts.map((p) => [p.id, p]));

  for (const building of buildings) {
    const effectiveHeight = building.heightOverride ?? defaultHeight;

    // Gate-primitive supplier-product fit check (Phase 5.8.3).
    // Gates are standalone BuildingEntities, not openings on walls. The
    // placed gate's footprint must fit within the SKU's GateMeta.maxDimensions.
    if (building.type === 'poort' && building.gateConfig?.supplierProductId) {
      const product = productMap.get(building.gateConfig.supplierProductId);
      if (product && product.archivedAt === null) {
        const placedWidthMm = building.dimensions.width * 1000;
        const placedHeightMm = effectiveHeight * 1000;
        const max = (product.meta as GateMeta).maxDimensions;
        if (max) {
          if (placedHeightMm > max.heightMm) {
            issues.push({
              code: 'gate_too_tall',
              buildingId: building.id,
              wallSide: '',
              productId: product.id,
              details: {
                width_m: placedWidthMm / 1000,
                height_m: placedHeightMm / 1000,
                wall_length: max.widthMm / 1000,
                wall_height: max.heightMm / 1000,
              },
            });
          }
          if (placedWidthMm > max.widthMm) {
            issues.push({
              code: 'gate_too_wide',
              buildingId: building.id,
              wallSide: '',
              productId: product.id,
              details: {
                width_m: placedWidthMm / 1000,
                height_m: placedHeightMm / 1000,
                wall_length: max.widthMm / 1000,
                wall_height: max.heightMm / 1000,
              },
            });
          }
        }
      }
    }

    for (const [wallSide, wallCfg] of Object.entries(building.walls)) {
      if (!wallCfg) continue;
      const wallLength = getWallLength(wallSide as Parameters<typeof getWallLength>[0], building.dimensions);

      // Door supplier product check
      if (wallCfg.hasDoor && wallCfg.doorSupplierProductId) {
        const product = productMap.get(wallCfg.doorSupplierProductId);
        if (product && product.archivedAt === null) {
          const width_m = product.widthMm / 1000;
          const height_m = product.heightMm / 1000;
          if (height_m > effectiveHeight) {
            issues.push({
              code: 'too_tall',
              buildingId: building.id,
              wallSide,
              productId: product.id,
              details: { width_m, height_m, wall_length: wallLength, wall_height: effectiveHeight },
            });
          }
          if (width_m + 2 * EDGE_CLEARANCE > wallLength) {
            issues.push({
              code: 'too_wide',
              buildingId: building.id,
              wallSide,
              productId: product.id,
              details: { width_m, height_m, wall_length: wallLength, wall_height: effectiveHeight },
            });
          }
        }
      }

      // Window supplier product checks (one per window slot)
      for (const win of wallCfg.windows ?? []) {
        if (!win.supplierProductId) continue;
        const product = productMap.get(win.supplierProductId);
        if (!product || product.archivedAt !== null) continue;
        const width_m = product.widthMm / 1000;
        const height_m = product.heightMm / 1000;
        if (height_m > effectiveHeight) {
          issues.push({
            code: 'too_tall',
            buildingId: building.id,
            wallSide,
            productId: product.id,
            details: { width_m, height_m, wall_length: wallLength, wall_height: effectiveHeight },
          });
        }
        if (width_m + 2 * EDGE_CLEARANCE > wallLength) {
          issues.push({
            code: 'too_wide',
            buildingId: building.id,
            wallSide,
            productId: product.id,
            details: { width_m, height_m, wall_length: wallLength, wall_height: effectiveHeight },
          });
        }
      }
    }
  }

  return issues;
}
