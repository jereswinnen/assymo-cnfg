import type {
  BuildingEntity,
  BuildingDimensions,
  BuildingType,
  FloorConfig,
  FloorMaterialId,
  Orientation,
  PolesConfig,
  RoofConfig,
  RoofType,
  SnapConnection,
  WallConfig,
  WallId,
  WallSide,
} from '@/domain/building';
import {
  DEFAULT_DIMENSIONS,
  DEFAULT_FLOOR,
  DEFAULT_PRIMARY_MATERIAL,
  DEFAULT_ROOF,
  DEFAULT_WALL,
  POLE_DIMENSIONS,
  WALL_DIMENSIONS,
  getDefaultWalls,
} from '@/domain/building';
import type { ProductBuildingDefaults } from '@/domain/catalog';
import type { ConfigData } from './types';
import { CONFIG_VERSION } from './types';

export const INITIAL_DEFAULT_HEIGHT = 2.6;

export function createBuilding(type: BuildingType, position: [number, number]): BuildingEntity {
  const dimensions = type === 'paal'
    ? { ...POLE_DIMENSIONS }
    : type === 'muur'
    ? { ...WALL_DIMENSIONS }
    : { ...DEFAULT_DIMENSIONS };

  return {
    id: crypto.randomUUID(),
    type,
    position,
    dimensions,
    primaryMaterialId: DEFAULT_PRIMARY_MATERIAL,
    walls: getDefaultWalls(type),
    hasCornerBraces: false,
    floor: (type === 'berging' || type === 'overkapping')
      ? { materialId: 'beton' }
      : { ...DEFAULT_FLOOR },
    orientation: 'horizontal',
    heightOverride: null,
  };
}

export function makeInitialConfig(): ConfigData {
  return {
    version: CONFIG_VERSION,
    buildings: [createBuilding('berging', [-2, -2])],
    connections: [],
    roof: { ...DEFAULT_ROOF },
    defaultHeight: INITIAL_DEFAULT_HEIGHT,
  };
}

export function addBuilding(
  cfg: ConfigData,
  type: BuildingType,
  position?: [number, number],
  productDefaults?: ProductBuildingDefaults,
): { cfg: ConfigData; id: string } {
  let resolvedPos: [number, number] = position ?? [0, 0];
  if (!position && cfg.buildings.length > 0) {
    const maxX = Math.max(...cfg.buildings.map((e) => e.position[0] + e.dimensions.width));
    resolvedPos = [maxX + 2, 0];
  }

  let building: BuildingEntity;
  if (productDefaults) {
    const baseDims = type === 'paal'
      ? { ...POLE_DIMENSIONS }
      : type === 'muur'
      ? { ...WALL_DIMENSIONS }
      : { ...DEFAULT_DIMENSIONS };

    const defaultFloor: FloorConfig =
      (type === 'berging' || type === 'overkapping')
        ? { materialId: 'beton' }
        : { ...DEFAULT_FLOOR };

    building = {
      id: crypto.randomUUID(),
      type,
      position: resolvedPos,
      dimensions: {
        width:  productDefaults.dimensions.width  ?? baseDims.width,
        depth:  productDefaults.dimensions.depth  ?? baseDims.depth,
        height: productDefaults.dimensions.height ?? baseDims.height,
      },
      primaryMaterialId: productDefaults.primaryMaterialId ?? DEFAULT_PRIMARY_MATERIAL,
      walls: getDefaultWalls(type),
      hasCornerBraces: false,
      floor: productDefaults.floor
        ? { materialId: productDefaults.floor.materialId as FloorMaterialId }
        : defaultFloor,
      orientation: 'horizontal',
      heightOverride: null,
      sourceProductId: productDefaults.sourceProductId,
    };
  } else {
    building = createBuilding(type, resolvedPos);
  }

  const nextCfg: ConfigData = { ...cfg, buildings: [...cfg.buildings, building] };

  // Roof is scene-level. Only apply product roof defaults on the first building.
  if (productDefaults?.roof && cfg.buildings.length === 0) {
    nextCfg.roof = {
      ...cfg.roof,
      ...(productDefaults.roof.coveringId
        ? { coveringId: productDefaults.roof.coveringId as typeof cfg.roof.coveringId }
        : {}),
      ...(productDefaults.roof.trimMaterialId
        ? { trimMaterialId: productDefaults.roof.trimMaterialId }
        : {}),
    };
  }

  return { cfg: nextCfg, id: building.id };
}

/** Remove a building, keeping at least one structural (non-paal, non-muur).
 *  Returns the same config unchanged if the removal isn't allowed. */
export function removeBuilding(cfg: ConfigData, id: string): ConfigData {
  const target = cfg.buildings.find((b) => b.id === id);
  if (!target) return cfg;
  const structuralCount = cfg.buildings.filter(
    (b) => b.type !== 'paal' && b.type !== 'muur',
  ).length;
  if (target.type !== 'paal' && target.type !== 'muur' && structuralCount <= 1) {
    return cfg;
  }
  return {
    ...cfg,
    buildings: cfg.buildings.filter((b) => b.id !== id),
    connections: cfg.connections.filter(
      (c) => c.buildingAId !== id && c.buildingBId !== id,
    ),
  };
}

function mapBuilding(
  cfg: ConfigData,
  id: string,
  transform: (b: BuildingEntity) => BuildingEntity,
): ConfigData {
  return {
    ...cfg,
    buildings: cfg.buildings.map((b) => (b.id === id ? transform(b) : b)),
  };
}

export function updateBuildingDimensions(
  cfg: ConfigData,
  id: string,
  dims: Partial<BuildingDimensions>,
): ConfigData {
  return mapBuilding(cfg, id, (b) => ({ ...b, dimensions: { ...b.dimensions, ...dims } }));
}

export function updateBuildingPosition(
  cfg: ConfigData,
  id: string,
  position: [number, number],
): ConfigData {
  return mapBuilding(cfg, id, (b) => ({ ...b, position }));
}

export function updateBuildingPositions(
  cfg: ConfigData,
  updates: readonly { id: string; position: [number, number] }[],
): ConfigData {
  return {
    ...cfg,
    buildings: cfg.buildings.map((b) => {
      const u = updates.find((u) => u.id === b.id);
      return u ? { ...b, position: u.position } : b;
    }),
  };
}

/** Attach a Paal to a structural building (for material inheritance) or
 *  clear the attachment by passing null. */
export function setPoleAttachment(
  cfg: ConfigData,
  id: string,
  attachedTo: string | null,
): ConfigData {
  return mapBuilding(cfg, id, (b) => {
    if (attachedTo === null) {
      const { attachedTo: _removed, ...rest } = b;
      return rest as BuildingEntity;
    }
    return { ...b, attachedTo };
  });
}

export function updateBuildingWall(
  cfg: ConfigData,
  id: string,
  wallId: WallId,
  patch: Partial<WallConfig>,
): ConfigData {
  return mapBuilding(cfg, id, (b) => ({
    ...b,
    walls: {
      ...b.walls,
      [wallId]: { ...(b.walls[wallId] ?? DEFAULT_WALL), ...patch },
    },
  }));
}

export function updateBuildingFloor(
  cfg: ConfigData,
  id: string,
  patch: Partial<FloorConfig>,
): ConfigData {
  return mapBuilding(cfg, id, (b) => ({ ...b, floor: { ...b.floor, ...patch } }));
}

/** Set primary material for a building and every building connected to it
 *  via snap connections (they form one visual structure). Also syncs the
 *  shared roof trim material. */
export function setBuildingPrimaryMaterial(
  cfg: ConfigData,
  id: string,
  materialId: string,
): ConfigData {
  const connectedIds = new Set<string>([id]);
  const queue: string[] = [id];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const c of cfg.connections) {
      const other =
        c.buildingAId === cur ? c.buildingBId :
        c.buildingBId === cur ? c.buildingAId : null;
      if (other && !connectedIds.has(other)) {
        connectedIds.add(other);
        queue.push(other);
      }
    }
  }
  return {
    ...cfg,
    buildings: cfg.buildings.map((b) =>
      connectedIds.has(b.id) ? { ...b, primaryMaterialId: materialId } : b,
    ),
    roof: { ...cfg.roof, trimMaterialId: materialId },
  };
}

export function toggleBuildingBraces(cfg: ConfigData, id: string): ConfigData {
  return mapBuilding(cfg, id, (b) => ({ ...b, hasCornerBraces: !b.hasCornerBraces }));
}

export function updateBuildingPoles(
  cfg: ConfigData,
  id: string,
  poles: PolesConfig,
): ConfigData {
  return mapBuilding(cfg, id, (b) => ({ ...b, poles }));
}

export function resetBuildingPoles(cfg: ConfigData, id: string): ConfigData {
  return mapBuilding(cfg, id, (b) => {
    const { poles: _removed, ...rest } = b;
    return rest as BuildingEntity;
  });
}

export function setConnections(
  cfg: ConfigData,
  connections: SnapConnection[],
): ConfigData {
  return { ...cfg, connections };
}

export function toggleConnectionOpen(
  cfg: ConfigData,
  aId: string,
  sideA: WallSide,
  bId: string,
  sideB: WallSide,
): ConfigData {
  return {
    ...cfg,
    connections: cfg.connections.map((c) => {
      const match =
        (c.buildingAId === aId && c.sideA === sideA && c.buildingBId === bId && c.sideB === sideB) ||
        (c.buildingAId === bId && c.sideA === sideB && c.buildingBId === aId && c.sideB === sideA);
      return match ? { ...c, isOpen: !c.isOpen } : c;
    }),
  };
}

export function setRoofType(cfg: ConfigData, type: RoofType): ConfigData {
  const sensibleCovering = type === 'flat' ? 'epdm' : 'dakpannen';
  return {
    ...cfg,
    roof: {
      ...cfg.roof,
      type,
      pitch: type === 'flat' ? 0 : 25,
      coveringId: sensibleCovering,
    },
  };
}

export function updateRoof(cfg: ConfigData, patch: Partial<RoofConfig>): ConfigData {
  return { ...cfg, roof: { ...cfg.roof, ...patch } };
}

export function setDefaultHeight(cfg: ConfigData, height: number): ConfigData {
  return { ...cfg, defaultHeight: height };
}

export function setHeightOverride(
  cfg: ConfigData,
  id: string,
  override: number | null,
): ConfigData {
  return mapBuilding(cfg, id, (b) => ({ ...b, heightOverride: override }));
}

export function setOrientation(
  cfg: ConfigData,
  id: string,
  orientation: Orientation,
): ConfigData {
  return mapBuilding(cfg, id, (b) => ({ ...b, orientation }));
}

/** True iff the wall is opened-up by a snap connection (no wall drawn). */
export function isWallHiddenByConnection(
  cfg: ConfigData,
  buildingId: string,
  wallSide: WallSide,
): boolean {
  return cfg.connections.some(
    (c) =>
      c.isOpen &&
      ((c.buildingAId === buildingId && c.sideA === wallSide) ||
        (c.buildingBId === buildingId && c.sideB === wallSide)),
  );
}
