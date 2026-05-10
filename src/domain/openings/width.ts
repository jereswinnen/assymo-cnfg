import type { WallConfig, WallWindow } from '@/domain/building';
import { DOOR_W, DOUBLE_DOOR_W } from '@/domain/building';
import type { SupplierProductRow } from '@/domain/supplier';

/** Resolved width (meters) of a door, honouring a bound supplier product when
 *  set. Falls through to the default single/double constants when the product
 *  is missing (archived/deleted) so callers stay consistent with the rendered
 *  symbol. */
export function resolveDoorWidth(
  cfg: Pick<WallConfig, 'doorSize' | 'doorSupplierProductId'>,
  supplierProducts: SupplierProductRow[],
): number {
  if (cfg.doorSupplierProductId) {
    const sp = supplierProducts.find(p => p.id === cfg.doorSupplierProductId);
    if (sp) return sp.widthMm / 1000;
  }
  return cfg.doorSize === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W;
}

/** Resolved width (meters) of a window, honouring a bound supplier product
 *  when set. Falls through to the per-instance `width` when the product is
 *  missing. */
export function resolveWindowWidth(
  win: Pick<WallWindow, 'width' | 'supplierProductId'>,
  supplierProducts: SupplierProductRow[],
): number {
  if (win.supplierProductId) {
    const sp = supplierProducts.find(p => p.id === win.supplierProductId);
    if (sp) return sp.widthMm / 1000;
  }
  return win.width;
}
