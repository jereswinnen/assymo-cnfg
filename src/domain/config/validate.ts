import type {
  BuildingEntity,
  DoorSize,
  RoofConfig,
  SnapConnection,
  WallConfig,
  WallId,
} from '@/domain/building';
import {
  DOOR_W,
  DOUBLE_DOOR_W,
  EDGE_CLEARANCE,
  OPENING_GAP,
  WIN_MIN_SIZE,
  getAvailableWallIds,
  getConstraints,
  getWallLength,
} from '@/domain/building';
import { getAtom } from '@/domain/materials';
import type { MaterialRow } from '@/domain/catalog';
import type { ConfigData } from './types';

/** Machine-readable error codes. Keeping them stable across schema
 *  versions lets the API surface consistent reject reasons. */
export type ValidationCode =
  | 'out_of_range'
  | 'unknown_material'
  | 'door_too_wide'
  | 'opening_out_of_bounds'
  | 'opening_overlap'
  | 'window_too_small'
  | 'connection_missing_building'
  | 'duplicate_building_id'
  | 'no_structural_building'
  | 'pitch_out_of_range'
  | 'insulation_out_of_range';

export interface ValidationError {
  /** JSON-pointer-ish path into the config (e.g. "buildings[1].walls.front.windows[0]"). */
  path: string;
  code: ValidationCode;
  message: string;
}

const MIN_PITCH = 0;
const MAX_PITCH = 55;
const MIN_INSULATION_MM = 0;
const MAX_INSULATION_MM = 400;

function doorWidthFor(size: DoorSize): number {
  return size === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W;
}

function validateMaterial(
  slug: string | undefined,
  path: string,
  errors: ValidationError[],
  materials: MaterialRow[],
): void {
  if (slug === undefined) return;
  // When no materials are provided, skip slug validation (e.g. tests that
  // don't exercise material checking).
  if (materials.length === 0) return;
  if (!getAtom(materials, slug)) {
    errors.push({
      path,
      code: 'unknown_material',
      message: `Material slug "${slug}" is not registered`,
    });
  }
}

function validateWall(
  building: BuildingEntity,
  wallId: WallId,
  wall: WallConfig,
  basePath: string,
  errors: ValidationError[],
  materials: MaterialRow[],
): void {
  validateMaterial(wall.materialId, `${basePath}.materialId`, errors, materials);
  validateMaterial(wall.doorMaterialId, `${basePath}.doorMaterialId`, errors, materials);

  const wallLength = getWallLength(wallId, building.dimensions);
  const usableLen = wallLength - 2 * EDGE_CLEARANCE;
  if (usableLen <= 0) return;

  if (wall.hasDoor) {
    const doorW = doorWidthFor(wall.doorSize);
    if (doorW > usableLen) {
      errors.push({
        path: `${basePath}.door`,
        code: 'door_too_wide',
        message: `Door (${doorW.toFixed(2)}m) wider than usable wall (${usableLen.toFixed(2)}m)`,
      });
    }
  }

  const occupied: { position: number; width: number; path: string }[] = [];
  if (wall.hasDoor) {
    occupied.push({
      position: wall.doorPosition ?? 0.5,
      width: doorWidthFor(wall.doorSize),
      path: `${basePath}.door`,
    });
  }
  for (let i = 0; i < (wall.windows ?? []).length; i++) {
    const win = wall.windows[i];
    const winPath = `${basePath}.windows[${i}]`;
    if (win.width < WIN_MIN_SIZE || win.height < WIN_MIN_SIZE) {
      errors.push({
        path: winPath,
        code: 'window_too_small',
        message: `Window must be at least ${WIN_MIN_SIZE}m on each side`,
      });
      continue;
    }
    if (win.width > usableLen) {
      errors.push({
        path: `${winPath}.width`,
        code: 'opening_out_of_bounds',
        message: `Window wider than usable wall`,
      });
      continue;
    }
    occupied.push({ position: win.position, width: win.width, path: winPath });
  }

  for (let i = 0; i < occupied.length; i++) {
    const a = occupied[i];
    for (let j = i + 1; j < occupied.length; j++) {
      const b = occupied[j];
      const minGapFrac = (a.width / 2 + b.width / 2 + OPENING_GAP) / usableLen;
      if (Math.abs(a.position - b.position) < minGapFrac) {
        errors.push({
          path: b.path,
          code: 'opening_overlap',
          message: `Opening overlaps ${a.path}`,
        });
      }
    }
  }
}

function validateBuilding(
  b: BuildingEntity,
  index: number,
  errors: ValidationError[],
  materials: MaterialRow[],
): void {
  const base = `buildings[${index}]`;
  const c = getConstraints(b.type);
  const { width, depth, height } = b.dimensions;

  if (width < c.width.min || width > c.width.max) {
    errors.push({
      path: `${base}.dimensions.width`,
      code: 'out_of_range',
      message: `Width ${width} outside [${c.width.min}, ${c.width.max}]`,
    });
  }
  if (depth < c.depth.min || depth > c.depth.max) {
    errors.push({
      path: `${base}.dimensions.depth`,
      code: 'out_of_range',
      message: `Depth ${depth} outside [${c.depth.min}, ${c.depth.max}]`,
    });
  }
  if (height < c.height.min || height > c.height.max) {
    errors.push({
      path: `${base}.dimensions.height`,
      code: 'out_of_range',
      message: `Height ${height} outside [${c.height.min}, ${c.height.max}]`,
    });
  }

  validateMaterial(b.primaryMaterialId, `${base}.primaryMaterialId`, errors, materials);
  validateMaterial(b.floor.materialId, `${base}.floor.materialId`, errors, materials);

  const availableWalls = getAvailableWallIds(b.type);
  for (const wallId of availableWalls) {
    const wall = b.walls[wallId];
    if (!wall) continue;
    validateWall(b, wallId, wall, `${base}.walls.${wallId}`, errors, materials);
  }
}

function validateRoof(roof: RoofConfig, errors: ValidationError[], materials: MaterialRow[]): void {
  validateMaterial(roof.coveringId, 'roof.coveringId', errors, materials);
  validateMaterial(roof.trimMaterialId, 'roof.trimMaterialId', errors, materials);

  const maxPitch = roof.type === 'flat' ? 0 : MAX_PITCH;
  if (roof.pitch < MIN_PITCH || roof.pitch > maxPitch) {
    errors.push({
      path: 'roof.pitch',
      code: 'pitch_out_of_range',
      message: `Roof pitch ${roof.pitch} outside [${MIN_PITCH}, ${maxPitch}] for ${roof.type} roof`,
    });
  }
  if (
    roof.insulationThickness < MIN_INSULATION_MM ||
    roof.insulationThickness > MAX_INSULATION_MM
  ) {
    errors.push({
      path: 'roof.insulationThickness',
      code: 'insulation_out_of_range',
      message: `Insulation thickness ${roof.insulationThickness}mm outside [${MIN_INSULATION_MM}, ${MAX_INSULATION_MM}]`,
    });
  }
}

function validateConnections(
  connections: SnapConnection[],
  buildingIds: Set<string>,
  errors: ValidationError[],
): void {
  for (let i = 0; i < connections.length; i++) {
    const c = connections[i];
    if (!buildingIds.has(c.buildingAId)) {
      errors.push({
        path: `connections[${i}].buildingAId`,
        code: 'connection_missing_building',
        message: `Connection references unknown building "${c.buildingAId}"`,
      });
    }
    if (!buildingIds.has(c.buildingBId)) {
      errors.push({
        path: `connections[${i}].buildingBId`,
        code: 'connection_missing_building',
        message: `Connection references unknown building "${c.buildingBId}"`,
      });
    }
  }
}

/** Run every validation rule over a config and collect errors. Empty array
 *  means the config is safe to render, price, and persist.
 *  Pass `materials` to enable material-slug validation (API routes and
 *  server-side checks). Omit (or pass `[]`) to skip slug checks — safe
 *  for pure structural tests and legacy call-sites. */
export function validateConfig(cfg: ConfigData, materials: MaterialRow[] = []): ValidationError[] {
  const errors: ValidationError[] = [];

  const ids = new Set<string>();
  for (let i = 0; i < cfg.buildings.length; i++) {
    const b = cfg.buildings[i];
    if (ids.has(b.id)) {
      errors.push({
        path: `buildings[${i}].id`,
        code: 'duplicate_building_id',
        message: `Duplicate building ID "${b.id}"`,
      });
    }
    ids.add(b.id);
    validateBuilding(b, i, errors, materials);
  }

  const hasStructural = cfg.buildings.some(
    (b) => b.type !== 'paal' && b.type !== 'muur' && b.type !== 'poort',
  );
  if (!hasStructural) {
    errors.push({
      path: 'buildings',
      code: 'no_structural_building',
      message: 'Config must contain at least one structural building',
    });
  }

  validateConnections(cfg.connections, ids, errors);
  validateRoof(cfg.roof, errors, materials);

  return errors;
}

/** Convenience: true iff the config has no validation errors. */
export function isConfigValid(cfg: ConfigData, materials: MaterialRow[] = []): boolean {
  return validateConfig(cfg, materials).length === 0;
}
