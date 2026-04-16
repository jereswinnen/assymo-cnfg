import type { BuildingEntity, WallConfig } from '@/types/building';

/** Effective wall material slug — per-wall override if set, else the
 *  building's primary material. */
export function getEffectiveWallMaterial(
  wall: WallConfig,
  building: BuildingEntity,
): string {
  return wall.materialId ?? building.primaryMaterialId;
}

/** Effective door material slug — per-door override if set, else the
 *  building's primary material. */
export function getEffectiveDoorMaterial(
  wall: WallConfig,
  building: BuildingEntity,
): string {
  return wall.doorMaterialId ?? building.primaryMaterialId;
}

/** Effective pole material slug — always the building's primary today. */
export function getEffectivePoleMaterial(building: BuildingEntity): string {
  return building.primaryMaterialId;
}
