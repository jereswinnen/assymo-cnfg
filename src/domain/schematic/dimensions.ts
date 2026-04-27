import type {
  BuildingEntity,
  SnapConnection,
  WallId,
} from '@/domain/building';
import {
  WIN_W_DEFAULT,
  DOOR_W,
  DOUBLE_DOOR_W,
  resolveOpeningPositions,
  getWallLength,
} from '@/domain/building';
import { t } from '@/lib/i18n';

/** Stable ids for every dimension type the schematic + elevation views
 *  can render. New types add a case here, default in `DIMENSION_CONFIG`,
 *  and an emission rule inside the appropriate generator. */
export type DimensionId =
  | 'building.width'
  | 'building.depth'
  | 'total.width'
  | 'total.depth'
  | 'muur.length'
  | 'wall.openingGaps.plan'
  | 'wall.openingGaps.elevation';

export interface DimensionConfig {
  building: { width: boolean; depth: boolean };
  total:    { width: boolean; depth: boolean };
  muur:     { length: boolean };
  wall:     {
    openingGaps: { plan: boolean; elevation: boolean };
  };
}

/** Code-level default. Edit this constant to flip dimension types
 *  on/off across the whole app. Context-aware suppression (e.g. hiding
 *  per-building lines when there's only one structural building) is
 *  implemented inside the generators, not in the config. */
export const DIMENSION_CONFIG: DimensionConfig = {
  building: { width: true, depth: true },
  total:    { width: true, depth: true },
  muur:     { length: true },
  wall:     { openingGaps: { plan: true, elevation: true } },
};

export type DimSurface = 'plan' | 'elevation';

export interface DimLine {
  id: DimensionId;
  surface: DimSurface;
  /** World-space endpoints in the surface's coordinate system (metres). */
  x1: number; y1: number; x2: number; y2: number;
  /** Perpendicular offset in metres. Sign matches DimensionLine's
   *  convention: positive offsets sit on the +Y/+X side of the line. */
  offset: number;
  /** Pre-formatted, locale-aware label (e.g. "Lengte: 4.0m"). i18n
   *  happens inside the generator so callers stay locale-agnostic. */
  label: string;
  /** Stable grouping key used by the schematic to apply post-process
   *  offset adjustments (door-swing arc clearance) only to matching
   *  lines. Format:
   *    'building:<id>'              → per-building width/depth
   *    'total'                      → total width/depth (offset already
   *                                   beyond arc reach)
   *    'wall:<buildingId>:<wallId>' → opening-gap segments
   *    'muur:<id>'                  → standalone muur length
   */
  groupKey?: string;
}

export interface PlanInputs {
  buildings: BuildingEntity[];
  connections: SnapConnection[];
  config?: DimensionConfig;
}

export interface ElevationInputs {
  building: BuildingEntity;
  wallId: WallId;
  defaultHeight: number;
  config?: DimensionConfig;
}

// Base offsets — three tiers from the wall outward. The schematic adds
// per-building arc clearance on top of the building tier.
const OFFSET_OPENING_GAP_PLAN = 0.5;
const OFFSET_OPENING_GAP_ELEVATION = 0.4;
const OFFSET_BUILDING = 1.0;
const OFFSET_TOTAL = 2.0;
const OFFSET_MUUR_LENGTH = 0.5;

// Segments smaller than this drop out of the chain (avoids label clutter
// when a door pins to EDGE_CLEARANCE).
const MIN_SEGMENT_LENGTH = 0.05;

function isStructural(b: BuildingEntity): boolean {
  return b.type !== 'paal' && b.type !== 'muur';
}

function fmt1(value: number): string {
  return `${value.toFixed(1)}m`;
}

function fmt2(value: number): string {
  return `${value.toFixed(2)}m`;
}

/** Derive a sorted list of (start, end) segments along the wall's
 *  1D axis, in metres from wall centre, given its openings. The
 *  algorithm mirrors the spec: walk left→right, push gap before each
 *  opening, advance the cursor past the opening, push the trailing
 *  gap to the right edge. Drops segments shorter than MIN_SEGMENT_LENGTH. */
function computeWallGapSegments1D(
  wallLength: number,
  doorPosition: number | null,
  doorSize: 'enkel' | 'dubbel',
  windows: { position: number; width?: number }[],
): Array<{ start: number; end: number }> {
  const { doorX, windowXs } = resolveOpeningPositions(wallLength, doorPosition, windows);
  type Op = { x: number; w: number };
  const ops: Op[] = [];
  if (doorX !== null) {
    const dw = doorSize === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W;
    ops.push({ x: doorX, w: dw });
  }
  for (let i = 0; i < windowXs.length; i++) {
    const win = windows[i];
    ops.push({ x: windowXs[i], w: win.width ?? WIN_W_DEFAULT });
  }
  ops.sort((a, b) => a.x - b.x);

  const segments: Array<{ start: number; end: number }> = [];
  let cursor = -wallLength / 2;
  for (const op of ops) {
    segments.push({ start: cursor, end: op.x - op.w / 2 });
    cursor = op.x + op.w / 2;
  }
  segments.push({ start: cursor, end: wallLength / 2 });

  return segments.filter((s) => s.end - s.start >= MIN_SEGMENT_LENGTH);
}

/** Geometry helper for one wall on a structural building. Resolves the
 *  wall's world-coord baseline + outward direction so opening-gap
 *  segments can be transformed. */
interface WallPlanGeom {
  /** Origin (start of the wall along its long axis) in world coords. */
  origin: [number, number];
  /** Unit vector along the wall's long axis (from start → end). */
  axis: [number, number];
  /** Unit vector pointing outward (away from building centre). */
  outward: [number, number];
  /** Wall length in metres. */
  length: number;
}

function structuralWallGeom(b: BuildingEntity, wallId: WallId): WallPlanGeom {
  const [lx, tz] = b.position;
  const w = b.dimensions.width;
  const d = b.dimensions.depth;
  // Convention follows SchematicWalls.tsx::getWallGeometries:
  //   'front' is the +Y side (cy = +depth/2 from centre)
  //   'back'  is the −Y side
  //   'left'  is −X, 'right' is +X
  switch (wallId) {
    case 'front':
      return { origin: [lx, tz + d],     axis: [1, 0], outward: [0,  1], length: w };
    case 'back':
      return { origin: [lx, tz],         axis: [1, 0], outward: [0, -1], length: w };
    case 'left':
      return { origin: [lx, tz],         axis: [0, 1], outward: [-1, 0], length: d };
    case 'right':
      return { origin: [lx + w, tz],     axis: [0, 1], outward: [ 1, 0], length: d };
    default: {
      const _exhaustive: never = wallId;
      return _exhaustive;
    }
  }
}

/** A muur has a single conceptual wall (`front`). Its plan geometry
 *  depends on orientation. Outward direction is fixed by convention so
 *  the chain always lands on the same visual side regardless of
 *  rotation. */
function muurWallGeom(b: BuildingEntity): WallPlanGeom {
  const [lx, tz] = b.position;
  const w = b.dimensions.width;
  const d = b.dimensions.depth;
  if (b.orientation === 'horizontal') {
    // Wall runs along X. Centreline at y = tz + d/2. Outward = +Y (south).
    return {
      origin: [lx, tz + d / 2],
      axis: [1, 0],
      outward: [0, 1],
      length: w,
    };
  }
  // Vertical: wall runs along Z. Centreline at x = lx + d/2. Outward = +X (east).
  return {
    origin: [lx + d / 2, tz],
    axis: [0, 1],
    outward: [1, 0],
    length: w,
  };
}

/** Map a 1D wall-local segment (metres from wall centre) to world-coord
 *  endpoints on the plan surface. Gap chain DimLines run parallel to
 *  the wall, offset perpendicular by `OFFSET_OPENING_GAP_PLAN` from
 *  the wall baseline (the schematic translates the offset perpendicular
 *  to the line; we encode `outward` into the sign of the offset). */
function segmentToPlanLine(
  geom: WallPlanGeom,
  start: number,
  end: number,
): { x1: number; y1: number; x2: number; y2: number; offset: number } {
  const halfL = geom.length / 2;
  // Convert wall-local x (centred) to start-relative t (0..length).
  const t1 = start + halfL;
  const t2 = end + halfL;
  const x1 = geom.origin[0] + geom.axis[0] * t1;
  const y1 = geom.origin[1] + geom.axis[1] * t1;
  const x2 = geom.origin[0] + geom.axis[0] * t2;
  const y2 = geom.origin[1] + geom.axis[1] * t2;
  // The DimensionLine renders the label on the +offset side. We want
  // it on the outward side. Outward dotted with the line's normal
  // determines the sign — but our wall axes are unit X or Y, so the
  // outward vector matches the DimensionLine's perpendicular direction
  // already. Sign of offset = +1 when outward axis component is +1, and
  // −1 when −1. Encode that:
  const outwardSign =
    geom.axis[0] !== 0 ? geom.outward[1] : geom.outward[0];
  return {
    x1, y1, x2, y2,
    offset: outwardSign * OFFSET_OPENING_GAP_PLAN,
  };
}

/** Walls a structural building has, in the order we emit them. */
const STRUCTURAL_WALL_IDS: WallId[] = ['front', 'back', 'left', 'right'];

/** Compute every dimension line for the top-down schematic surface.
 *  Returns a flat array; callers map over it to render. The array is
 *  in deterministic order — useful for tests. */
export function computePlanDimensions(input: PlanInputs): DimLine[] {
  const { buildings, config = DIMENSION_CONFIG } = input;
  const lines: DimLine[] = [];

  const structurals = buildings.filter(isStructural);
  const muurs = buildings.filter((b) => b.type === 'muur');
  const showPerBuilding = structurals.length > 1;

  // 1. Per-building width / depth (only when 2+ structurals).
  for (const b of structurals) {
    const [lx, tz] = b.position;
    const w = b.dimensions.width;
    const d = b.dimensions.depth;
    if (showPerBuilding && config.building.width) {
      lines.push({
        id: 'building.width',
        surface: 'plan',
        x1: lx, y1: tz + d, x2: lx + w, y2: tz + d,
        offset: OFFSET_BUILDING,
        label: `${t('dim.width')}: ${fmt1(w)}`,
        groupKey: `building:${b.id}`,
      });
    }
    if (showPerBuilding && config.building.depth) {
      lines.push({
        id: 'building.depth',
        surface: 'plan',
        x1: lx + w, y1: tz, x2: lx + w, y2: tz + d,
        offset: -OFFSET_BUILDING,
        label: `${t('dim.depth')}: ${fmt1(d)}`,
        groupKey: `building:${b.id}`,
      });
    }
  }

  // 2. Total width / depth (only when 2+ structurals — bounding box).
  if (structurals.length > 1) {
    const minX = Math.min(...structurals.map((b) => b.position[0]));
    const maxX = Math.max(...structurals.map((b) => b.position[0] + b.dimensions.width));
    const minZ = Math.min(...structurals.map((b) => b.position[1]));
    const maxZ = Math.max(...structurals.map((b) => b.position[1] + b.dimensions.depth));
    if (config.total.width) {
      lines.push({
        id: 'total.width',
        surface: 'plan',
        x1: minX, y1: maxZ, x2: maxX, y2: maxZ,
        offset: OFFSET_TOTAL,
        label: `${t('dim.width')}: ${fmt1(maxX - minX)}`,
        groupKey: 'total',
      });
    }
    if (config.total.depth) {
      lines.push({
        id: 'total.depth',
        surface: 'plan',
        x1: maxX, y1: minZ, x2: maxX, y2: maxZ,
        offset: -OFFSET_TOTAL,
        label: `${t('dim.depth')}: ${fmt1(maxZ - minZ)}`,
        groupKey: 'total',
      });
    }
  }

  // 3. Muur length (always when enabled).
  if (config.muur.length) {
    for (const b of muurs) {
      const [lx, tz] = b.position;
      const w = b.dimensions.width;
      const d = b.dimensions.depth;
      const isHorizontal = b.orientation === 'horizontal';
      if (isHorizontal) {
        lines.push({
          id: 'muur.length',
          surface: 'plan',
          x1: lx, y1: tz + d / 2, x2: lx + w, y2: tz + d / 2,
          offset: OFFSET_MUUR_LENGTH,
          label: fmt1(w),
          groupKey: `muur:${b.id}`,
        });
      } else {
        lines.push({
          id: 'muur.length',
          surface: 'plan',
          x1: lx + d / 2, y1: tz, x2: lx + d / 2, y2: tz + w,
          offset: -OFFSET_MUUR_LENGTH,
          label: fmt1(w),
          groupKey: `muur:${b.id}`,
        });
      }
    }
  }

  // 4. Opening-gap chains, plan surface.
  if (config.wall.openingGaps.plan) {
    for (const b of structurals) {
      for (const wallId of STRUCTURAL_WALL_IDS) {
        const wallCfg = b.walls[wallId];
        if (!wallCfg) continue;
        if (!wallCfg.hasDoor && (wallCfg.windows ?? []).length === 0) continue;
        const geom = structuralWallGeom(b, wallId);
        const segments = computeWallGapSegments1D(
          getWallLength(wallId, b.dimensions),
          wallCfg.hasDoor ? (wallCfg.doorPosition ?? 0.5) : null,
          wallCfg.doorSize ?? 'enkel',
          wallCfg.windows ?? [],
        );
        for (const seg of segments) {
          const line = segmentToPlanLine(geom, seg.start, seg.end);
          lines.push({
            id: 'wall.openingGaps.plan',
            surface: 'plan',
            ...line,
            label: fmt2(seg.end - seg.start),
            groupKey: `wall:${b.id}:${wallId}`,
          });
        }
      }
    }
    for (const b of muurs) {
      const wallCfg = b.walls['front'];
      if (!wallCfg) continue;
      if (!wallCfg.hasDoor && (wallCfg.windows ?? []).length === 0) continue;
      const geom = muurWallGeom(b);
      const segments = computeWallGapSegments1D(
        b.dimensions.width,
        wallCfg.hasDoor ? (wallCfg.doorPosition ?? 0.5) : null,
        wallCfg.doorSize ?? 'enkel',
        wallCfg.windows ?? [],
      );
      for (const seg of segments) {
        const line = segmentToPlanLine(geom, seg.start, seg.end);
        lines.push({
          id: 'wall.openingGaps.plan',
          surface: 'plan',
          ...line,
          label: fmt2(seg.end - seg.start),
          groupKey: `wall:${b.id}:front`,
        });
      }
    }
  }

  return lines;
}

/** Compute the elevation-surface gap chain for a single wall. The
 *  caller (`WallElevation.tsx`) renders these under the wall's baseline
 *  in elevation-local coords (x ∈ [0, wallLength], y = 0 at the
 *  baseline). Returns [] when no openings exist or the config disables
 *  the elevation surface. Wall length / height labels stay in
 *  WallElevation's own render code. */
export function computeElevationDimensions(input: ElevationInputs): DimLine[] {
  const { building, wallId, config = DIMENSION_CONFIG } = input;
  if (!config.wall.openingGaps.elevation) return [];

  const wallCfg = building.walls[wallId];
  if (!wallCfg) return [];
  if (!wallCfg.hasDoor && (wallCfg.windows ?? []).length === 0) return [];

  const isMuur = building.type === 'muur';
  const wallLength = isMuur
    ? building.dimensions.width
    : getWallLength(wallId, building.dimensions);

  const segments = computeWallGapSegments1D(
    wallLength,
    wallCfg.hasDoor ? (wallCfg.doorPosition ?? 0.5) : null,
    wallCfg.doorSize ?? 'enkel',
    wallCfg.windows ?? [],
  );

  const halfL = wallLength / 2;
  return segments.map((seg) => {
    const x1 = seg.start + halfL;
    const x2 = seg.end + halfL;
    return {
      id: 'wall.openingGaps.elevation',
      surface: 'elevation' as const,
      x1, y1: 0, x2, y2: 0,
      offset: OFFSET_OPENING_GAP_ELEVATION,
      label: fmt2(seg.end - seg.start),
      groupKey: `wall:${building.id}:${wallId}`,
    };
  });
}
