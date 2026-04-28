import { randomId } from '@/domain/random';
import type { BuildingDimensions, BuildingEntity, GateConfig } from './types';

export const GATE_DEFAULT_DIMENSIONS: BuildingDimensions = {
  width: 1.5,
  depth: 0.15,
  height: 2.0,
};

export function defaultGateConfig(): GateConfig {
  return {
    partCount: 1,
    materialId: '',
    swingDirection: 'inward',
    motorized: false,
  };
}

export interface CreateGateBuildingOverrides {
  position?: [number, number];
  dimensions?: Partial<BuildingDimensions>;
  gateConfig?: Partial<GateConfig>;
}

/** Pure factory for a poort `BuildingEntity`. The unified `BuildingEntity`
 *  shape still requires geometry/wall/floor fields — they're populated
 *  with sensible no-op defaults so existing consumers (drag preview,
 *  pricing fall-through, snapshot serialization) keep working without
 *  per-type guards. The entity's `dimensions` + `heightOverride` (resolved
 *  via `getEffectiveHeight`) are the source of truth for the gate's
 *  visible size; `gateConfig` carries only gate-specific knobs (parts,
 *  material, swing, motor). */
export function createGateBuildingEntity(
  overrides?: CreateGateBuildingOverrides,
): BuildingEntity & { type: 'poort'; gateConfig: GateConfig } {
  const gateConfig: GateConfig = {
    ...defaultGateConfig(),
    ...(overrides?.gateConfig ?? {}),
  };
  const dimensions: BuildingDimensions = {
    ...GATE_DEFAULT_DIMENSIONS,
    ...(overrides?.dimensions ?? {}),
  };

  return {
    id: randomId(),
    type: 'poort',
    position: overrides?.position ?? [0, 0],
    dimensions,
    primaryMaterialId: '',
    walls: {},
    hasCornerBraces: false,
    floor: { materialId: 'geen' },
    orientation: 'horizontal',
    heightOverride: null,
    gateConfig,
  };
}
