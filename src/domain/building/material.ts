import { BUILDING_KIND_META } from './kinds';
import type { BuildingEntity } from './types';

/** Single canonical reader for a building's bound material. Resolves the
 *  storage location (primaryMaterialId vs gateConfig.materialId vs whatever
 *  a future kind invents) via `BUILDING_KIND_META[type].material.kind`.
 *  Returns the empty string when the entity hasn't been seeded yet — callers
 *  decide how to handle that (universal Material picker delegates to the
 *  spawn-time default; pricing emits a "missing material" stub). */
export function getEntityMaterial(building: BuildingEntity): string {
  const meta = BUILDING_KIND_META[building.type];
  switch (meta.material.kind) {
    case 'gate':
      return building.gateConfig?.materialId ?? '';
    case 'building':
      return building.primaryMaterialId ?? '';
  }
}
