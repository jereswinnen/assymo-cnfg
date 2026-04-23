import type {
  BuildingEntity,
  WallId,
  WallConfig,
  RoofConfig,
} from '@/domain/building';
import {
  DOUBLE_DOOR_W,
  DOOR_AREA_CUTOUT,
  WIN_W_DEFAULT,
  WIN_H_DEFAULT,
  POST_SPACING,
  getWallLength,
} from '@/domain/building';
import type { MaterialRow } from '@/domain/catalog';
import {
  buildWallCatalog,
  buildRoofCoverCatalog,
  buildFloorCatalog,
  buildDoorCatalog,
  getEffectiveWallMaterial,
  getEffectiveDoorMaterial,
} from '@/domain/materials';
import type { SupplierProductRow } from '@/domain/supplier';
import {
  getSupplierDoorLineItem,
  getSupplierWindowLineItem,
} from '@/domain/supplier';
import type { SupplierProductSnapshot } from '@/domain/supplier/snapshot';
import { buildSupplierProductSnapshot } from '@/domain/supplier/snapshot';
import type { PriceBook } from './priceBook';

function findPrice(
  items: readonly { atomId: string; pricePerSqm: number }[],
  atomId: string,
): number {
  return items.find((m) => m.atomId === atomId)?.pricePerSqm ?? 0;
}

function findSurcharge(
  doorCatalog: readonly { atomId: string; surcharge: number }[],
  id: string,
): number {
  return doorCatalog.find((m) => m.atomId === id)?.surcharge ?? 0;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function roofTotalArea(
  width: number,
  depth: number,
  roofPitch: number,
  roofType: 'flat' | 'pitched',
): number {
  if (roofType === 'flat') {
    return width * depth;
  }
  const halfSpan = depth / 2;
  const cosP = Math.cos(degToRad(roofPitch));
  if (cosP === 0) return 0;
  const panelArea = width * (halfSpan / cosP);
  return 2 * panelArea;
}

export function wallGrossArea(wallId: WallId, building: BuildingEntity, effectiveHeight: number): number {
  const wallLength = getWallLength(wallId, building.dimensions);
  return wallLength * effectiveHeight;
}

export function wallNetArea(wallId: WallId, building: BuildingEntity, wallCfg: WallConfig, effectiveHeight: number): number {
  let area = wallGrossArea(wallId, building, effectiveHeight);
  if (wallCfg.hasDoor) {
    const doorW = wallCfg.doorSize === 'dubbel' ? DOUBLE_DOOR_W : DOOR_AREA_CUTOUT / 2.1;
    area -= doorW * 2.1;
  }
  for (const win of wallCfg.windows ?? []) {
    area -= (win.width ?? WIN_W_DEFAULT) * (win.height ?? WIN_H_DEFAULT);
  }
  return Math.max(0, area);
}

export function postCount(width: number, depth: number): number {
  const postsPerSide = Math.max(2, Math.floor(depth / POST_SPACING) + 1);
  const postsPerEnd = Math.max(2, Math.floor(width / POST_SPACING) + 1);
  return 2 * postsPerSide + 2 * postsPerEnd - 4;
}

/** Source annotation for line items produced from a supplier-product
 *  lookup rather than the material-based pricing path. */
export interface LineItemSource {
  kind: 'supplierProduct';
  productId: string;
  sku: string;
}

/** Structured line item — label formatting deferred to the caller so the
 *  quote can be rendered in any locale or surface (configurator UI, PDF,
 *  API response). The optional `source` field is present on supplier-
 *  product line items; `supplierProduct` carries the full frozen product
 *  data (added at snapshot time by `buildQuoteSnapshot`). */
export interface LineItem {
  labelKey: string;
  labelParams?: Record<string, string | number>;
  area: number;
  materialCost: number;
  insulationCost: number;
  extrasCost: number;
  total: number;
  source?: LineItemSource;
  /** Frozen snapshot of the supplier product (set by buildQuoteSnapshot;
   *  absent on plain material-based line items). */
  supplierProduct?: SupplierProductSnapshot;
}

const WALL_LABEL_KEY: Record<WallId, string> = {
  front: 'wall.front',
  back: 'wall.back',
  left: 'wall.left',
  right: 'wall.right',
};

function wallLineItem(
  wallId: WallId,
  building: BuildingEntity,
  effectiveHeight: number,
  priceBook: PriceBook,
  wallCatalog: readonly { atomId: string; pricePerSqm: number }[],
  doorCatalog: readonly { atomId: string; surcharge: number }[],
  supplierProducts: readonly SupplierProductRow[],
  buildings?: BuildingEntity[],
): LineItem[] {
  const wallCfg = building.walls[wallId];
  if (!wallCfg) {
    return [{
      labelKey: WALL_LABEL_KEY[wallId] ?? wallId,
      area: 0,
      materialCost: 0,
      insulationCost: 0,
      extrasCost: 0,
      total: 0,
    }];
  }
  const area = wallNetArea(wallId, building, wallCfg, effectiveHeight);
  const materialCost = area * findPrice(wallCatalog, getEffectiveWallMaterial(wallCfg, building, buildings));

  const lineItems: LineItem[] = [];

  // Wall surface item (always emitted; covers the net area after openings)
  let extrasCost = 0;

  // Door: supplier path vs. material-based path
  if (wallCfg.hasDoor) {
    if (wallCfg.doorSupplierProductId) {
      // Supplier-product door: push a dedicated line item; skip the
      // material-based doorBase + materialSurcharge + doorWindowSurcharge chain.
      const doorItem = getSupplierDoorLineItem(wallCfg.doorSupplierProductId, supplierProducts);
      if (doorItem) {
        lineItems.push({
          labelKey: doorItem.labelKey,
          labelParams: doorItem.labelParams,
          area: 0,
          materialCost: 0,
          insulationCost: 0,
          extrasCost: doorItem.total,
          total: doorItem.total,
          source: doorItem.source,
        });
      }
    } else {
      // Standard material-based door pricing
      extrasCost += priceBook.doorBase[wallCfg.doorSize] ?? priceBook.doorBase.enkel;
      if (wallCfg.doorHasWindow) extrasCost += priceBook.doorWindowSurcharge;
      extrasCost += findSurcharge(doorCatalog, getEffectiveDoorMaterial(wallCfg, building, buildings));
    }
  }

  // Windows: per-window, supplier path vs. windowFee path
  for (const win of wallCfg.windows ?? []) {
    if (win.supplierProductId) {
      const winItem = getSupplierWindowLineItem(win.supplierProductId, supplierProducts);
      if (winItem) {
        lineItems.push({
          labelKey: winItem.labelKey,
          labelParams: winItem.labelParams,
          area: 0,
          materialCost: 0,
          insulationCost: 0,
          extrasCost: winItem.total,
          total: winItem.total,
          source: winItem.source,
        });
      }
    } else {
      extrasCost += priceBook.windowFee;
    }
  }

  // Always emit the wall surface item (even when extasCost == 0, it carries
  // the net area which other parts of the UI display)
  lineItems.unshift({
    labelKey: WALL_LABEL_KEY[wallId] ?? wallId,
    area,
    materialCost,
    insulationCost: 0,
    extrasCost,
    total: materialCost + extrasCost,
  });

  return lineItems;
}

function roofLineItem(
  building: BuildingEntity,
  roof: RoofConfig,
  priceBook: PriceBook,
  roofCoverCatalog: readonly { atomId: string; pricePerSqm: number }[],
): LineItem {
  const { width, depth } = building.dimensions;
  const area = roofTotalArea(width, depth, roof.pitch, roof.type);
  const materialCost = area * findPrice(roofCoverCatalog, roof.coveringId);
  const insulationCost = roof.insulation
    ? area * roof.insulationThickness * priceBook.insulationPerSqmPerMm
    : 0;
  let extrasCost = 0;
  if (roof.hasSkylight) extrasCost += priceBook.skylightFee;

  return {
    labelKey: 'quote.roof',
    area,
    materialCost,
    insulationCost,
    extrasCost,
    total: materialCost + insulationCost + extrasCost,
  };
}

function postLineItem(building: BuildingEntity, priceBook: PriceBook): LineItem | null {
  if (building.type === 'berging' || building.type === 'paal') return null;
  const { width, depth } = building.dimensions;
  const count = postCount(width, depth);
  const total = count * priceBook.postPrice;
  return {
    labelKey: 'quote.posts',
    labelParams: { count },
    area: 0,
    materialCost: total,
    insulationCost: 0,
    extrasCost: 0,
    total,
  };
}

function braceLineItem(building: BuildingEntity, priceBook: PriceBook): LineItem | null {
  if (!building.hasCornerBraces) return null;
  const count = 8;
  const total = count * priceBook.bracePrice;
  return {
    labelKey: 'quote.braces',
    labelParams: { count },
    area: 0,
    materialCost: total,
    insulationCost: 0,
    extrasCost: 0,
    total,
  };
}

function floorLineItem(
  building: BuildingEntity,
  floorCatalog: readonly { atomId: string; pricePerSqm: number }[],
): LineItem | null {
  const { materialId } = building.floor;
  if (materialId === 'geen') return null;
  const { width, depth } = building.dimensions;
  const area = width * depth;
  const materialCost = area * findPrice(floorCatalog, materialId);
  return {
    labelKey: 'floor.label',
    area,
    materialCost,
    insulationCost: 0,
    extrasCost: 0,
    total: materialCost,
  };
}

export function calculateBuildingQuote(
  building: BuildingEntity,
  roof: RoofConfig,
  defaultHeight: number,
  priceBook: PriceBook,
  materials: MaterialRow[],
  supplierProducts: SupplierProductRow[],
  buildings?: BuildingEntity[],
): {
  lineItems: LineItem[];
  total: number;
} {
  const wallCatalog = buildWallCatalog(materials);
  const roofCoverCatalog = buildRoofCoverCatalog(materials);
  const floorCatalog = buildFloorCatalog(materials);
  const doorCatalog = buildDoorCatalog(materials);

  const effectiveHeight = building.heightOverride ?? defaultHeight;

  if (building.type === 'paal') {
    const item: LineItem = {
      labelKey: 'quote.pole',
      area: 0,
      materialCost: priceBook.postPrice,
      insulationCost: 0,
      extrasCost: 0,
      total: priceBook.postPrice,
    };
    return { lineItems: [item], total: priceBook.postPrice };
  }

  /** Supplier-sourced line items (stubs with total=0 included) are always
   *  emitted so the UI can show "product missing" rows. Plain material
   *  items with total=0 are still filtered — they represent empty walls. */
  const shouldEmit = (item: LineItem) => item.total > 0 || item.source !== undefined;

  if (building.type === 'muur') {
    const lineItems: LineItem[] = [];
    const wallIds = Object.keys(building.walls) as WallId[];
    for (const id of wallIds) {
      const items = wallLineItem(id, building, effectiveHeight, priceBook, wallCatalog, doorCatalog, supplierProducts, buildings);
      for (const item of items) {
        if (shouldEmit(item)) lineItems.push(item);
      }
    }
    const total = lineItems.reduce((sum, item) => sum + item.total, 0);
    return { lineItems, total };
  }

  const lineItems: LineItem[] = [];

  const posts = postLineItem(building, priceBook);
  if (posts) lineItems.push(posts);

  const braces = braceLineItem(building, priceBook);
  if (braces) lineItems.push(braces);

  const wallIds = Object.keys(building.walls) as WallId[];
  for (const id of wallIds) {
    const items = wallLineItem(id, building, effectiveHeight, priceBook, wallCatalog, doorCatalog, supplierProducts, buildings);
    for (const item of items) {
      if (shouldEmit(item)) lineItems.push(item);
    }
  }

  const floor = floorLineItem(building, floorCatalog);
  if (floor) lineItems.push(floor);

  lineItems.push(roofLineItem(building, roof, priceBook, roofCoverCatalog));

  const total = lineItems.reduce((sum, item) => sum + item.total, 0);
  return { lineItems, total };
}

export function calculateTotalQuote(
  buildings: BuildingEntity[],
  roof: RoofConfig,
  priceBook: PriceBook,
  materials: MaterialRow[],
  supplierProducts: SupplierProductRow[],
  defaultHeight = 3,
): {
  lineItems: LineItem[];
  total: number;
} {
  const lineItems: LineItem[] = [];
  for (const building of buildings) {
    const { lineItems: items } = calculateBuildingQuote(building, roof, defaultHeight, priceBook, materials, supplierProducts, buildings);
    lineItems.push(...items);
  }
  const total = lineItems.reduce((sum, item) => sum + item.total, 0);
  return { lineItems, total };
}
