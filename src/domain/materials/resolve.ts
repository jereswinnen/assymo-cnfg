import type { BuildingEntity, WallConfig } from '@/domain/building';

/** The first structural building in the scene (overkapping / berging). Used
 *  as the "main" primary-material source for any free-standing Muur or Paal
 *  that has no attachment or whose attachment chain never reaches one. */
function getAmbientHost(buildings: BuildingEntity[]): BuildingEntity | null {
  return buildings.find(b => b.type !== 'paal' && b.type !== 'muur' && b.type !== 'poort') ?? null;
}

/** The primary material a building renders with.
 *  - Structural buildings (overkapping / berging): their own primary.
 *  - Muur / Paal: walk the `attachedTo` chain until a structural building is
 *    found and use its primary. If the chain never reaches one, use the
 *    ambient host's primary. Falls back to the building's own primary only
 *    when no structural building exists in the scene.
 *  Recursive chain resolution is required because a Paal snapped onto a Muur
 *  should inherit the Muur's *effective* material (the ambient host's
 *  primary), not the Muur's raw default primaryMaterialId. */
export function getEffectivePrimaryMaterial(
  building: BuildingEntity,
  buildings?: BuildingEntity[],
): string {
  if (!buildings) return building.primaryMaterialId;
  if (building.type !== 'muur' && building.type !== 'paal') {
    return building.primaryMaterialId;
  }

  const visited = new Set<string>();
  let current: BuildingEntity = building;
  while (current.attachedTo && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = buildings.find(b => b.id === current.attachedTo);
    if (!parent) break;
    if (parent.type !== 'muur' && parent.type !== 'paal') {
      return parent.primaryMaterialId;
    }
    current = parent;
  }

  return getAmbientHost(buildings)?.primaryMaterialId ?? building.primaryMaterialId;
}

/** Effective wall material slug — per-wall override if set, else the
 *  building's effective primary material. */
export function getEffectiveWallMaterial(
  wall: WallConfig,
  building: BuildingEntity,
  buildings?: BuildingEntity[],
): string {
  if (wall.materialId) return wall.materialId;
  return getEffectivePrimaryMaterial(building, buildings);
}

/** Effective door material slug — per-door override if set, else the
 *  building's effective primary material. */
export function getEffectiveDoorMaterial(
  wall: WallConfig,
  building: BuildingEntity,
  buildings?: BuildingEntity[],
): string {
  if (wall.doorMaterialId) return wall.doorMaterialId;
  return getEffectivePrimaryMaterial(building, buildings);
}

/** Effective pole material slug — always the building's effective primary. */
export function getEffectivePoleMaterial(
  building: BuildingEntity,
  buildings?: BuildingEntity[],
): string {
  return getEffectivePrimaryMaterial(building, buildings);
}
