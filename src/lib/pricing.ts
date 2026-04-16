import type {
  BuildingEntity,
  WallId,
  WallConfig,
  RoofConfig,
} from '@/types/building';
import {
  INSULATION_PRICE_PER_SQM_PER_MM,
  DOOR_BASE_PRICE,
  DOOR_WINDOW_SURCHARGE,
  DOUBLE_DOOR_W,
  WINDOW_FLAT_FEE,
  SKYLIGHT_FLAT_FEE,
  DOOR_AREA_CUTOUT,
  WIN_W_DEFAULT,
  WIN_H_DEFAULT,
  POST_PRICE,
  POST_SPACING,
  BRACE_PRICE,
  getWallLength,
} from './constants';
import { WALL_CATALOG, ROOF_COVERING_CATALOG, FLOOR_CATALOG, DOOR_CATALOG } from './materials';
import { t } from './i18n';

function findPrice(
  items: readonly { atomId: string; pricePerSqm: number }[],
  atomId: string,
): number {
  return items.find((m) => m.atomId === atomId)?.pricePerSqm ?? 0;
}

function findSurcharge(id: string): number {
  return DOOR_CATALOG.find((m) => m.atomId === id)?.surcharge ?? 0;
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

export interface LineItem {
  label: string;
  area: number;
  materialCost: number;
  insulationCost: number;
  extrasCost: number;
  total: number;
}

const WALL_LABELS: Record<string, string> = {
  front: 'wall.front',
  back: 'wall.back',
  left: 'wall.left',
  right: 'wall.right',
};

function wallLineItem(wallId: WallId, building: BuildingEntity, effectiveHeight: number): LineItem {
  const wallCfg = building.walls[wallId];
  if (!wallCfg) {
    return { label: t(WALL_LABELS[wallId] ?? wallId), area: 0, materialCost: 0, insulationCost: 0, extrasCost: 0, total: 0 };
  }
  const area = wallNetArea(wallId, building, wallCfg, effectiveHeight);
  const materialCost = area * findPrice(WALL_CATALOG, wallCfg.materialId);
  let extrasCost = 0;
  if (wallCfg.hasDoor) {
    extrasCost += DOOR_BASE_PRICE[wallCfg.doorSize] ?? DOOR_BASE_PRICE.enkel;
    if (wallCfg.doorHasWindow) extrasCost += DOOR_WINDOW_SURCHARGE;
    extrasCost += findSurcharge(wallCfg.doorMaterialId);
  }
  extrasCost += WINDOW_FLAT_FEE * (wallCfg.windows ?? []).length;

  return {
    label: t(WALL_LABELS[wallId] ?? wallId),
    area,
    materialCost,
    insulationCost: 0,
    extrasCost,
    total: materialCost + extrasCost,
  };
}

function roofLineItem(building: BuildingEntity, roof: RoofConfig): LineItem {
  const { width, depth } = building.dimensions;
  const area = roofTotalArea(width, depth, roof.pitch, roof.type);
  const materialCost = area * findPrice(ROOF_COVERING_CATALOG, roof.coveringId);
  const insulationCost = roof.insulation
    ? area * roof.insulationThickness * INSULATION_PRICE_PER_SQM_PER_MM
    : 0;
  let extrasCost = 0;
  if (roof.hasSkylight) extrasCost += SKYLIGHT_FLAT_FEE;

  return {
    label: t('quote.roof'),
    area,
    materialCost,
    insulationCost,
    extrasCost,
    total: materialCost + insulationCost + extrasCost,
  };
}

function postLineItem(building: BuildingEntity): LineItem | null {
  if (building.type === 'berging' || building.type === 'paal') return null;
  const { width, depth } = building.dimensions;
  const count = postCount(width, depth);
  const total = count * POST_PRICE;
  return {
    label: `${t('quote.posts')} (${count}×)`,
    area: 0,
    materialCost: total,
    insulationCost: 0,
    extrasCost: 0,
    total,
  };
}

function braceLineItem(building: BuildingEntity): LineItem | null {
  if (!building.hasCornerBraces) return null;
  const count = 8;
  const total = count * BRACE_PRICE;
  return {
    label: `${t('quote.braces')} (${count}×)`,
    area: 0,
    materialCost: total,
    insulationCost: 0,
    extrasCost: 0,
    total,
  };
}

function floorLineItem(building: BuildingEntity): LineItem | null {
  const { materialId } = building.floor;
  if (materialId === 'geen') return null;
  const { width, depth } = building.dimensions;
  const area = width * depth;
  const materialCost = area * findPrice(FLOOR_CATALOG, materialId);
  return {
    label: t('floor.label'),
    area,
    materialCost,
    insulationCost: 0,
    extrasCost: 0,
    total: materialCost,
  };
}

export function calculateBuildingQuote(building: BuildingEntity, roof: RoofConfig, defaultHeight: number): {
  lineItems: LineItem[];
  total: number;
} {
  const effectiveHeight = building.heightOverride ?? defaultHeight;

  // Pole: single post price
  if (building.type === 'paal') {
    const item: LineItem = {
      label: t('quote.pole'),
      area: 0,
      materialCost: POST_PRICE,
      insulationCost: 0,
      extrasCost: 0,
      total: POST_PRICE,
    };
    return { lineItems: [item], total: POST_PRICE };
  }

  // Muur: wall material + extras only (no roof, floor, posts)
  if (building.type === 'muur') {
    const lineItems: LineItem[] = [];
    const wallIds = Object.keys(building.walls) as WallId[];
    for (const id of wallIds) {
      const item = wallLineItem(id, building, effectiveHeight);
      if (item.total > 0) lineItems.push(item);
    }
    const total = lineItems.reduce((sum, item) => sum + item.total, 0);
    return { lineItems, total };
  }

  const lineItems: LineItem[] = [];

  const posts = postLineItem(building);
  if (posts) lineItems.push(posts);

  const braces = braceLineItem(building);
  if (braces) lineItems.push(braces);

  const wallIds = Object.keys(building.walls) as WallId[];
  for (const id of wallIds) {
    const item = wallLineItem(id, building, effectiveHeight);
    if (item.total > 0) lineItems.push(item);
  }

  const floor = floorLineItem(building);
  if (floor) lineItems.push(floor);

  lineItems.push(roofLineItem(building, roof));

  const total = lineItems.reduce((sum, item) => sum + item.total, 0);
  return { lineItems, total };
}

export function calculateTotalQuote(buildings: BuildingEntity[], roof: RoofConfig, defaultHeight = 3): {
  lineItems: LineItem[];
  total: number;
} {
  const lineItems: LineItem[] = [];
  for (const building of buildings) {
    const { lineItems: items } = calculateBuildingQuote(building, roof, defaultHeight);
    lineItems.push(...items);
  }
  const total = lineItems.reduce((sum, item) => sum + item.total, 0);
  return { lineItems, total };
}
