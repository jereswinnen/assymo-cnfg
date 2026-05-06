import type {
  BuildingEntity,
  RoofConfig,
  SnapConnection,
} from '@/domain/building';
import type { ConfigData } from '@/domain/config';
import { CONFIG_VERSION } from '@/domain/config';

const DEFAULT_FIXTURE_ROOF: RoofConfig = {
  type: 'flat',
  pitch: 0,
  coveringId: 'epdm',
  trimMaterialId: 'wood',
  insulation: true,
  insulationThickness: 150,
  hasSkylight: false,
  fasciaHeight: 0.36,
  fasciaOverhang: 0,
};

/** Deterministic test fixtures — avoid crypto.randomUUID() so snapshots
 *  and assertions stay stable. */
export function makeBuilding(
  overrides: Partial<BuildingEntity> & Pick<BuildingEntity, 'id' | 'type'>,
): BuildingEntity {
  return {
    position: [0, 0],
    dimensions: { width: 4, depth: 4, height: 2.6 },
    primaryMaterialId: 'wood',
    walls: {},
    hasCornerBraces: false,
    floor: { materialId: 'beton' },
    orientation: 'horizontal',
    heightOverride: null,
    ...overrides,
  };
}

export function makeRoof(overrides: Partial<RoofConfig> = {}): RoofConfig {
  return { ...DEFAULT_FIXTURE_ROOF, ...overrides };
}

export function makeConfig(overrides: Partial<ConfigData> = {}): ConfigData {
  const blankWall = {
    hasDoor: false,
    doorSize: 'enkel' as const,
    doorHasWindow: false,
    doorPosition: 0.5,
    doorSwing: 'naar_buiten' as const,
    windows: [],
  };
  return {
    version: CONFIG_VERSION,
    buildings: [
      makeBuilding({
        id: 'b1',
        type: 'berging',
        walls: { front: { ...blankWall }, back: { ...blankWall }, left: { ...blankWall }, right: { ...blankWall } },
      }),
    ],
    connections: [],
    roof: makeRoof(),
    defaultHeight: 2.6,
    ...overrides,
  };
}

export const EMPTY_CONNECTIONS: SnapConnection[] = [];
