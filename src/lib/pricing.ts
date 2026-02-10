import type {
  BuildingConfig,
  WallId,
  RoofId,
  WallConfig,
} from '@/types/building';
import {
  MATERIALS,
  INSULATION_PRICE_PER_SQM_PER_MM,
  DOOR_FLAT_FEE,
  WINDOW_FLAT_FEE,
  SKYLIGHT_FLAT_FEE,
  DOOR_AREA_CUTOUT,
  WINDOW_AREA_CUTOUT,
} from './constants';

function getMaterialPrice(materialId: string): number {
  return MATERIALS.find((m) => m.id === materialId)?.pricePerSqm ?? 0;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function wallGrossArea(
  wallId: WallId,
  width: number,
  depth: number,
  height: number,
): number {
  if (wallId === 'front' || wallId === 'back') return width * height;
  return depth * height;
}

export function wallNetArea(
  wallId: WallId,
  width: number,
  depth: number,
  height: number,
  wallCfg: WallConfig,
): number {
  let area = wallGrossArea(wallId, width, depth, height);
  if (wallCfg.hasDoor) area -= DOOR_AREA_CUTOUT;
  if (wallCfg.hasWindow) area -= WINDOW_AREA_CUTOUT * wallCfg.windowCount;
  return Math.max(0, area);
}

export function roofPanelArea(
  depth: number,
  halfWidth: number,
  pitchDeg: number,
): number {
  const pitchRad = degToRad(pitchDeg);
  const cosP = Math.cos(pitchRad);
  if (cosP === 0) return 0;
  return depth * (halfWidth / cosP);
}

export interface LineItem {
  label: string;
  area: number;
  materialCost: number;
  insulationCost: number;
  extrasCost: number;
  total: number;
}

export function wallLineItem(
  wallId: WallId,
  config: BuildingConfig,
): LineItem {
  const { width, depth, height } = config.dimensions;
  const wallCfg = config.walls[wallId];
  const area = wallNetArea(wallId, width, depth, height, wallCfg);
  const materialCost = area * getMaterialPrice(wallCfg.materialId);
  const insulationCost = wallCfg.insulation
    ? area * wallCfg.insulationThickness * INSULATION_PRICE_PER_SQM_PER_MM
    : 0;
  let extrasCost = 0;
  if (wallCfg.hasDoor) extrasCost += DOOR_FLAT_FEE;
  if (wallCfg.hasWindow) extrasCost += WINDOW_FLAT_FEE * wallCfg.windowCount;

  const label = `${wallId.charAt(0).toUpperCase() + wallId.slice(1)} wall`;

  return {
    label,
    area,
    materialCost,
    insulationCost,
    extrasCost,
    total: materialCost + insulationCost + extrasCost,
  };
}

export function roofLineItem(
  roofId: RoofId,
  config: BuildingConfig,
): LineItem {
  const { width, depth, roofPitch } = config.dimensions;
  const roofCfg = config.roofs[roofId];
  const area = roofPanelArea(depth, width / 2, roofPitch);
  const materialCost = area * getMaterialPrice(roofCfg.materialId);
  const insulationCost = roofCfg.insulation
    ? area * roofCfg.insulationThickness * INSULATION_PRICE_PER_SQM_PER_MM
    : 0;
  let extrasCost = 0;
  if (roofCfg.hasSkylight) extrasCost += SKYLIGHT_FLAT_FEE;

  const label = roofId === 'left-panel' ? 'Left roof panel' : 'Right roof panel';

  return {
    label,
    area,
    materialCost,
    insulationCost,
    extrasCost,
    total: materialCost + insulationCost + extrasCost,
  };
}

export function calculateQuote(config: BuildingConfig): {
  lineItems: LineItem[];
  total: number;
} {
  const wallIds: WallId[] = ['front', 'back', 'left', 'right'];
  const roofIds: RoofId[] = ['left-panel', 'right-panel'];

  const lineItems = [
    ...wallIds.map((id) => wallLineItem(id, config)),
    ...roofIds.map((id) => roofLineItem(id, config)),
  ];

  const total = lineItems.reduce((sum, item) => sum + item.total, 0);
  return { lineItems, total };
}
