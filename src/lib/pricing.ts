import type {
  BuildingConfig,
  WallId,
  WallConfig,
  RoofConfig,
} from '@/types/building';
import {
  WALL_MATERIALS,
  ROOF_COVERINGS,
  FLOOR_MATERIALS,
  INSULATION_PRICE_PER_SQM_PER_MM,
  DOOR_BASE_PRICE,
  DOOR_WINDOW_SURCHARGE,
  DOOR_MATERIALS,
  DOUBLE_DOOR_W,
  WINDOW_FLAT_FEE,
  SKYLIGHT_FLAT_FEE,
  DOOR_AREA_CUTOUT,
  WINDOW_AREA_CUTOUT,
  POST_PRICE,
  POST_SPACING,
  BRACE_PRICE,
} from './constants';
import { t } from './i18n';

function getWallMaterialPrice(materialId: string): number {
  return WALL_MATERIALS.find((m) => m.id === materialId)?.pricePerSqm ?? 0;
}

function getRoofCoveringPrice(coveringId: string): number {
  return ROOF_COVERINGS.find((c) => c.id === coveringId)?.pricePerSqm ?? 0;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Calculate the total roof area based on type
export function roofTotalArea(
  width: number,
  depth: number,
  roofPitch: number,
  roofType: 'flat' | 'pitched',
): number {
  if (roofType === 'flat') {
    return width * depth;
  }
  // Pitched: two panels
  const halfWidth = width / 2;
  const cosP = Math.cos(degToRad(roofPitch));
  if (cosP === 0) return 0;
  const panelArea = depth * (halfWidth / cosP);
  return 2 * panelArea;
}

// Wall gross area — accounts for bergingWidth in combined mode
export function wallGrossArea(
  wallId: WallId,
  config: BuildingConfig,
): number {
  const { width, depth, height, bergingWidth } = config.dimensions;
  const bt = config.buildingType;

  const overkappingWidth = width - bergingWidth;

  switch (wallId) {
    case 'front':
    case 'back':
      if (bt === 'combined') {
        // Only covers the berging section width
        return bergingWidth * height;
      }
      return width * height;
    case 'left':
    case 'right':
      return depth * height;
    case 'divider':
      return depth * height;
    case 'ov_front':
    case 'ov_back':
      return overkappingWidth * height;
    case 'ov_right':
      return depth * height;
  }
}

export function wallNetArea(
  wallId: WallId,
  config: BuildingConfig,
  wallCfg: WallConfig,
): number {
  let area = wallGrossArea(wallId, config);
  if (wallCfg.hasDoor) {
    const doorW = wallCfg.doorSize === 'dubbel' ? DOUBLE_DOOR_W : DOOR_AREA_CUTOUT / 2.1;
    area -= doorW * 2.1;
  }
  if (wallCfg.hasWindow) area -= WINDOW_AREA_CUTOUT * wallCfg.windowCount;
  return Math.max(0, area);
}

// Count posts for overkapping section
export function postCount(
  overkappingWidth: number,
  depth: number,
): number {
  // Posts along both long sides (depth), spaced POST_SPACING apart, plus corners
  const postsPerSide = Math.max(2, Math.floor(depth / POST_SPACING) + 1);
  // Posts along width at front and back
  const postsPerEnd = Math.max(2, Math.floor(overkappingWidth / POST_SPACING) + 1);
  // 4 corners counted once; two long sides + two short sides minus 4 corner overlaps
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
  divider: 'wall.divider',
  ov_front: 'wall.ov_front',
  ov_back: 'wall.ov_back',
  ov_right: 'wall.ov_right',
};

export function wallLineItem(
  wallId: WallId,
  config: BuildingConfig,
): LineItem {
  const wallCfg = config.walls[wallId];
  if (!wallCfg) {
    return { label: t(WALL_LABELS[wallId] ?? wallId), area: 0, materialCost: 0, insulationCost: 0, extrasCost: 0, total: 0 };
  }
  const area = wallNetArea(wallId, config, wallCfg);
  const materialCost = area * getWallMaterialPrice(wallCfg.materialId);
  let extrasCost = 0;
  if (wallCfg.hasDoor) {
    extrasCost += DOOR_BASE_PRICE[wallCfg.doorSize] ?? DOOR_BASE_PRICE.enkel;
    if (wallCfg.doorHasWindow) extrasCost += DOOR_WINDOW_SURCHARGE;
    const doorMatSurcharge = DOOR_MATERIALS.find((m) => m.id === wallCfg.doorMaterialId)?.surcharge ?? 0;
    extrasCost += doorMatSurcharge;
  }
  if (wallCfg.hasWindow) extrasCost += WINDOW_FLAT_FEE * wallCfg.windowCount;

  return {
    label: t(WALL_LABELS[wallId] ?? wallId),
    area,
    materialCost,
    insulationCost: 0,
    extrasCost,
    total: materialCost + extrasCost,
  };
}

export function roofLineItem(
  config: BuildingConfig,
): LineItem {
  const { width, depth, roofPitch } = config.dimensions;
  const roofCfg: RoofConfig = config.roof;
  const area = roofTotalArea(width, depth, roofPitch, roofCfg.type);
  const materialCost = area * getRoofCoveringPrice(roofCfg.coveringId);
  const insulationCost = roofCfg.insulation
    ? area * roofCfg.insulationThickness * INSULATION_PRICE_PER_SQM_PER_MM
    : 0;
  let extrasCost = 0;
  if (roofCfg.hasSkylight) extrasCost += SKYLIGHT_FLAT_FEE;

  return {
    label: t('quote.roof'),
    area,
    materialCost,
    insulationCost,
    extrasCost,
    total: materialCost + insulationCost + extrasCost,
  };
}

export function postLineItem(
  config: BuildingConfig,
): LineItem | null {
  const bt = config.buildingType;
  if (bt === 'berging') return null;

  const { width, depth, bergingWidth } = config.dimensions;
  const overkappingWidth = bt === 'combined' ? width - bergingWidth : width;
  const count = postCount(overkappingWidth, depth);
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

export function braceLineItem(
  config: BuildingConfig,
): LineItem | null {
  if (!config.hasCornerBraces) return null;
  // One brace per corner post (4 corners), 2 braces per corner (one per axis)
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

export function floorLineItem(config: BuildingConfig): LineItem | null {
  const { materialId } = config.floor;
  if (materialId === 'geen') return null;

  const { width, depth } = config.dimensions;
  const area = width * depth;
  const pricePerSqm = FLOOR_MATERIALS.find((m) => m.id === materialId)?.pricePerSqm ?? 0;
  const materialCost = area * pricePerSqm;

  return {
    label: t('floor.label'),
    area,
    materialCost,
    insulationCost: 0,
    extrasCost: 0,
    total: materialCost,
  };
}

export function calculateQuote(config: BuildingConfig): {
  lineItems: LineItem[];
  total: number;
} {
  const lineItems: LineItem[] = [];

  // Post line item for overkapping sections
  const posts = postLineItem(config);
  if (posts) lineItems.push(posts);

  // Brace line item
  const braces = braceLineItem(config);
  if (braces) lineItems.push(braces);

  // Wall line items
  const wallIds = Object.keys(config.walls) as WallId[];
  for (const id of wallIds) {
    const item = wallLineItem(id, config);
    if (item.total > 0) lineItems.push(item);
  }

  // Floor line item
  const floor = floorLineItem(config);
  if (floor) lineItems.push(floor);

  // Single roof line item
  lineItems.push(roofLineItem(config));

  const total = lineItems.reduce((sum, item) => sum + item.total, 0);
  return { lineItems, total };
}
