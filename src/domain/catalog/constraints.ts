import type { MaterialRow } from './types';
import {
  PRODUCT_SLOT_TO_CATEGORY,
  type ProductRow,
  type ProductSlot,
} from './types';

/** Given the tenant's full material list and a (possibly null) source
 *  product, return materials that are (a) of the right category for
 *  the given slot and (b) allowed by the product's `allowedMaterialsBySlot`
 *  entry for that slot. Empty or missing allow-list = no narrowing. */
export function filterMaterialsForProduct(
  materials: MaterialRow[],
  product: ProductRow | null,
  slot: ProductSlot,
): MaterialRow[] {
  const category = PRODUCT_SLOT_TO_CATEGORY[slot];
  const byCategory = materials.filter((m) => m.category === category);
  if (!product) return byCategory;
  const allow = product.constraints.allowedMaterialsBySlot?.[slot];
  if (!allow || allow.length === 0) return byCategory;
  const allowSet = new Set(allow);
  return byCategory.filter((m) => allowSet.has(m.slug));
}

export interface ClampInput {
  width?: number;
  depth?: number;
  height?: number;
}

/** Clamp a subset of dimensions to a product's min/max. Unset fields
 *  pass through unchanged; missing constraints are no-ops. */
export function clampDimensions(
  input: ClampInput,
  product: ProductRow | null,
): ClampInput {
  if (!product) return input;
  const { minWidth, maxWidth, minDepth, maxDepth, minHeight, maxHeight } =
    product.constraints;
  const out: ClampInput = {};
  if (input.width !== undefined) {
    let w = input.width;
    if (minWidth !== undefined) w = Math.max(w, minWidth);
    if (maxWidth !== undefined) w = Math.min(w, maxWidth);
    out.width = w;
  }
  if (input.depth !== undefined) {
    let d = input.depth;
    if (minDepth !== undefined) d = Math.max(d, minDepth);
    if (maxDepth !== undefined) d = Math.min(d, maxDepth);
    out.depth = d;
  }
  if (input.height !== undefined) {
    let h = input.height;
    if (minHeight !== undefined) h = Math.max(h, minHeight);
    if (maxHeight !== undefined) h = Math.min(h, maxHeight);
    out.height = h;
  }
  return out;
}
