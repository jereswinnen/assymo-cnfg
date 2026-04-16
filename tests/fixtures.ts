import type {
  BuildingEntity,
  RoofConfig,
  SnapConnection,
} from '@/domain/building';
import { DEFAULT_ROOF } from '@/domain/building';
import type { ConfigData } from '@/domain/config';
import { CONFIG_VERSION } from '@/domain/config';

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
  return { ...DEFAULT_ROOF, ...overrides };
}

export function makeConfig(overrides: Partial<ConfigData> = {}): ConfigData {
  return {
    version: CONFIG_VERSION,
    buildings: [
      makeBuilding({
        id: 'b1',
        type: 'berging',
        walls: {
          front: {
            hasDoor: false,
            doorSize: 'enkel',
            doorHasWindow: false,
            doorPosition: 0.5,
            doorSwing: 'naar_buiten',
            windows: [],
          },
          back: {
            hasDoor: false,
            doorSize: 'enkel',
            doorHasWindow: false,
            doorPosition: 0.5,
            doorSwing: 'naar_buiten',
            windows: [],
          },
          left: {
            hasDoor: false,
            doorSize: 'enkel',
            doorHasWindow: false,
            doorPosition: 0.5,
            doorSwing: 'naar_buiten',
            windows: [],
          },
          right: {
            hasDoor: false,
            doorSize: 'enkel',
            doorHasWindow: false,
            doorPosition: 0.5,
            doorSwing: 'naar_buiten',
            windows: [],
          },
        },
      }),
    ],
    connections: [],
    roof: makeRoof(),
    defaultHeight: 2.6,
    ...overrides,
  };
}

export const EMPTY_CONNECTIONS: SnapConnection[] = [];
