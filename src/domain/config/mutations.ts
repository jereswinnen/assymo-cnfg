import type {
  BuildingEntity,
  BuildingDimensions,
  BuildingType,
  FloorConfig,
  FloorMaterialId,
  GateConfig,
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
  BUILDING_KIND_META,
  createGateBuildingEntity,
  DEFAULT_DIMENSIONS,
  DEFAULT_FLOOR,
  DEFAULT_PRIMARY_MATERIAL,
  POLE_DIMENSIONS,
  WALL_DIMENSIONS,
} from '@/domain/building';
import type { MaterialCategory, ProductBuildingDefaults } from '@/domain/catalog';
import { randomId } from '@/domain/random';
import type { ConfigData } from './types';
import { CONFIG_VERSION } from './types';

/** Tenant-level "first available material per category" map. Threaded into
 *  spawn so freshly-created entities have valid material IDs from frame 1
 *  (no useEffect race, no empty-trigger flash, pricing resolves correctly).
 *  Pure-domain consumers don't need to populate every category — only the
 *  ones their kinds actually bind to (per `BUILDING_KIND_META[type].material.category`). */
export type MaterialDefaults = Partial<Record<MaterialCategory, string>>;

const BLANK_WALL: WallConfig = {
  hasDoor: false,
  doorSize: 'enkel',
  doorHasWindow: false,
  doorPosition: 0.5,
  doorSwing: 'naar_buiten',
  doorMirror: false,
  windows: [],
};

function wallsForType(type: BuildingType): Record<string, WallConfig> {
  switch (type) {
    case 'overkapping':
    case 'paal':
    case 'poort':
      return {};
    case 'berging':
      return {
        front: { ...BLANK_WALL },
        back: { ...BLANK_WALL },
        left: { ...BLANK_WALL },
        right: { ...BLANK_WALL },
      };
    case 'muur':
      return { front: { ...BLANK_WALL } };
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

export const INITIAL_DEFAULT_HEIGHT = 2.6;

export function createBuilding(
  type: BuildingType,
  position: [number, number],
  materialDefaults?: MaterialDefaults,
): BuildingEntity {
  // The kind's material binding (registry-driven) decides which slug we seed
  // and where it lands on the entity. Falls back to category-agnostic
  // defaults (DEFAULT_PRIMARY_MATERIAL for the building binding, '' for the
  // gate binding) when the caller doesn't pass a map — preserves legacy
  // behaviour for tests and any pure-domain caller without catalog access.
  const meta = BUILDING_KIND_META[type];
  const seededMaterial = materialDefaults?.[meta.material.category];

  if (type === 'poort') {
    return createGateBuildingEntity({
      position,
      gateConfig: seededMaterial ? { materialId: seededMaterial } : {},
    });
  }

  const dimensions = type === 'paal'
    ? { ...POLE_DIMENSIONS }
    : type === 'muur'
    ? { ...WALL_DIMENSIONS }
    : { ...DEFAULT_DIMENSIONS };

  return {
    id: randomId(),
    type,
    position,
    dimensions,
    primaryMaterialId: seededMaterial ?? DEFAULT_PRIMARY_MATERIAL,
    walls: wallsForType(type),
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
    buildings: [],
    connections: [],
    roof: {
      type: 'flat',
      pitch: 0,
      coveringId: 'epdm',
      trimMaterialId: 'wood',
      insulation: true,
      insulationThickness: 150,
      hasSkylight: false,
    },
    defaultHeight: INITIAL_DEFAULT_HEIGHT,
  };
}

export function addBuilding(
  cfg: ConfigData,
  type: BuildingType,
  position?: [number, number],
  productDefaults?: ProductBuildingDefaults,
  materialDefaults?: MaterialDefaults,
): { cfg: ConfigData; id: string } {
  let resolvedPos: [number, number] = position ?? [0, 0];
  if (!position && cfg.buildings.length > 0) {
    const maxX = Math.max(...cfg.buildings.map((e) => e.position[0] + e.dimensions.width));
    resolvedPos = [maxX + 2, 0];
  }

  let building: BuildingEntity;
  if (productDefaults && type === 'poort') {
    building = {
      ...createGateBuildingEntity({
        position: resolvedPos,
        dimensions: productDefaults.dimensions,
        gateConfig: productDefaults.gateConfig ?? {},
      }),
      sourceProductId: productDefaults.sourceProductId,
    };
  } else if (productDefaults) {
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
      id: randomId(),
      type,
      position: resolvedPos,
      dimensions: {
        width:  productDefaults.dimensions.width  ?? baseDims.width,
        depth:  productDefaults.dimensions.depth  ?? baseDims.depth,
        height: productDefaults.dimensions.height ?? baseDims.height,
      },
      primaryMaterialId: productDefaults.primaryMaterialId ?? DEFAULT_PRIMARY_MATERIAL,
      walls: wallsForType(type),
      hasCornerBraces: false,
      floor: productDefaults.floor
        ? { materialId: productDefaults.floor.materialId as FloorMaterialId }
        : defaultFloor,
      orientation: 'horizontal',
      heightOverride: null,
      sourceProductId: productDefaults.sourceProductId,
    };
  } else {
    building = createBuilding(type, resolvedPos, materialDefaults);
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

/** Default offset (metres on x and z) applied when pasting from the
 *  clipboard, so pasted entities don't sit exactly on top of the originals. */
export const PASTE_OFFSET: [number, number] = [1, 1];

/** Paste a list of detached building entities into the scene. Each entity
 *  receives a fresh id, has `attachedTo` and `sourceProductId` stripped
 *  (paste lands as a free-standing primitive that no longer follows a
 *  product kit), and is offset on (x, z) so it doesn't sit on top of the
 *  source. Snap connections are not duplicated — pasted entities are
 *  independent and the user can re-snap by dragging. */
export function pasteBuildings(
  cfg: ConfigData,
  entities: readonly BuildingEntity[],
  offset: [number, number] = PASTE_OFFSET,
): { cfg: ConfigData; ids: string[] } {
  const ids: string[] = [];
  const next = entities.map((e) => {
    const id = randomId();
    ids.push(id);
    const cloned: BuildingEntity = {
      ...e,
      id,
      position: [e.position[0] + offset[0], e.position[1] + offset[1]],
      walls: Object.fromEntries(
        Object.entries(e.walls).map(([k, v]) => [k, { ...v, windows: [...(v.windows ?? [])] }]),
      ),
      floor: { ...e.floor },
      dimensions: { ...e.dimensions },
      poles: e.poles ? { ...e.poles } : undefined,
    };
    delete cloned.attachedTo;
    delete cloned.sourceProductId;
    return cloned;
  });
  return {
    cfg: { ...cfg, buildings: [...cfg.buildings, ...next] },
    ids,
  };
}

/** Remove a building. Allowed for any entity, including the last structural
 *  one — the user can re-add from the Objects sidebar. Returns the same
 *  config unchanged when the id doesn't exist. */
export function removeBuilding(cfg: ConfigData, id: string): ConfigData {
  if (!cfg.buildings.some((b) => b.id === id)) return cfg;
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
      [wallId]: { ...(b.walls[wallId] ?? BLANK_WALL), ...patch },
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

/** Patch a poort building's `gateConfig`. No-op when the id doesn't exist
 *  or when the targeted building is not a poort. When `partCount` changes,
 *  the per-part width is preserved by adjusting `dimensions.width`
 *  proportionally (toggling 1→2 doubles the gate's total span). */
export function updateGateConfig(
  cfg: ConfigData,
  id: string,
  patch: Partial<GateConfig>,
): ConfigData {
  return mapBuilding(cfg, id, (b) => {
    if (b.type !== 'poort' || !b.gateConfig) return b;
    const nextGate: GateConfig = { ...b.gateConfig, ...patch };
    let nextDims = b.dimensions;
    if (patch.partCount !== undefined && patch.partCount !== b.gateConfig.partCount) {
      const oldPerPart = b.dimensions.width / b.gateConfig.partCount;
      nextDims = { ...nextDims, width: oldPerPart * patch.partCount };
    }
    return { ...b, gateConfig: nextGate, dimensions: nextDims };
  });
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

/** Reset a building in-place to its source product's defaults. Preserves
 *  id, position, orientation, connections, poles, attachedTo, and the
 *  scene roof. Only dimensions + primaryMaterialId + floor.materialId
 *  are touched. */
export function resetBuildingToDefaults(
  state: ConfigData,
  buildingId: string,
  defaults: ProductBuildingDefaults,
): ConfigData {
  return {
    ...state,
    buildings: state.buildings.map((b) => {
      if (b.id !== buildingId) return b;
      return {
        ...b,
        dimensions: {
          width: defaults.dimensions.width ?? b.dimensions.width,
          depth: defaults.dimensions.depth ?? b.dimensions.depth,
          height: defaults.dimensions.height ?? b.dimensions.height,
        },
        primaryMaterialId: defaults.primaryMaterialId ?? b.primaryMaterialId,
        floor: defaults.floor
          ? { materialId: defaults.floor.materialId as FloorMaterialId }
          : b.floor,
      };
    }),
  };
}

/** Set (or clear) the supplier product overriding a wall's door.
 *  Setting to a non-null id puts the door in "Uit catalogus" mode;
 *  material-based fields (doorMaterialId, doorSize, etc.) are
 *  preserved so switching modes round-trips cleanly. */
export function setWallDoorSupplierProduct(
  state: ConfigData,
  buildingId: string,
  wallSide: WallSide,
  supplierProductId: string | null,
): ConfigData {
  return mapBuilding(state, buildingId, (b) => ({
    ...b,
    walls: {
      ...b.walls,
      [wallSide]: {
        ...(b.walls[wallSide] ?? BLANK_WALL),
        doorSupplierProductId: supplierProductId,
      },
    },
  }));
}

/** Set (or clear) the supplier product overriding a specific window on a wall.
 *  Setting to a non-null id puts the window in "Uit catalogus" mode;
 *  material-based dimensions are preserved for round-trip switching. */
export function setWallWindowSupplierProduct(
  state: ConfigData,
  buildingId: string,
  wallSide: WallSide,
  windowId: string,
  supplierProductId: string | null,
): ConfigData {
  return mapBuilding(state, buildingId, (b) => {
    const wall = b.walls[wallSide] ?? BLANK_WALL;
    return {
      ...b,
      walls: {
        ...b.walls,
        [wallSide]: {
          ...wall,
          windows: (wall.windows ?? []).map((w) =>
            w.id === windowId ? { ...w, supplierProductId } : w,
          ),
        },
      },
    };
  });
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
