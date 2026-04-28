import { randomId } from '@/domain/random';
import type { BuildingEntity, GateConfig } from './types';

export function defaultGateConfig(): GateConfig {
  return {
    partCount: 1,
    partWidthMm: 1500,
    heightMm: 2000,
    materialId: '',
    swingDirection: 'inward',
    motorized: false,
  };
}

export interface CreateGateBuildingOverrides {
  position?: [number, number];
  gateConfig?: Partial<GateConfig>;
}

/** Pure factory for a poort `BuildingEntity`. The unified `BuildingEntity`
 *  shape still requires geometry/wall/floor fields — they're populated
 *  with sensible no-op defaults so existing consumers (drag preview,
 *  pricing fall-through, snapshot serialization) keep working without
 *  per-type guards. The `gateConfig` is the source of truth for the
 *  poort's actual size + behavior. */
export function createGateBuildingEntity(
  overrides?: CreateGateBuildingOverrides,
): BuildingEntity & { type: 'poort'; gateConfig: GateConfig } {
  const gateConfig: GateConfig = {
    ...defaultGateConfig(),
    ...(overrides?.gateConfig ?? {}),
  };
  const totalWidthM = (gateConfig.partCount * gateConfig.partWidthMm) / 1000;
  const heightM = gateConfig.heightMm / 1000;

  return {
    id: randomId(),
    type: 'poort',
    position: overrides?.position ?? [0, 0],
    dimensions: { width: totalWidthM, depth: 0.15, height: heightM },
    primaryMaterialId: '',
    walls: {},
    hasCornerBraces: false,
    floor: { materialId: 'geen' },
    orientation: 'horizontal',
    heightOverride: null,
    gateConfig,
  };
}
