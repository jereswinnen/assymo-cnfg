import {
  WALL_MATERIALS,
  WALL_THICKNESS,
  DOUBLE_DOOR_W,
  DOOR_W,
  WIN_W,
  computeOpeningPositions,
  getWallLength,
  isOverkappingWall,
  OVERKAPPING_WALL_IDS,
} from '@/lib/constants';
import type {
  BuildingType,
  BuildingDimensions,
  WallConfig,
  WallId,
  SelectedElement,
} from '@/types/building';

const T = WALL_THICKNESS;

/** Per-wall metadata for 2D positioning */
export interface WallGeom {
  wallId: WallId;
  /** Center x in SVG coords */
  cx: number;
  /** Center y in SVG coords */
  cy: number;
  orientation: 'h' | 'v';
  /** Wall length in meters */
  length: number;
  /**
   * Sign to convert local opening offset to SVG coordinate offset.
   * Accounts for 3D geometry rotations per wall type.
   */
  flipSign: number;
  /** Inward direction perpendicular to wall: [dx, dy] pointing toward building interior */
  inward: [number, number];
  /**
   * Which end of the door gap has the hinge (matches 3D hinge-on-left-local convention).
   * 'start' = smaller coordinate side, 'end' = larger coordinate side.
   */
  hingeEnd: 'start' | 'end';
}

export function getWallGeometries(
  buildingType: BuildingType,
  dimensions: BuildingDimensions,
): WallGeom[] {
  const { width, depth, bergingWidth } = dimensions;
  const hw = width / 2;
  const hd = depth / 2;
  const bergingOffset =
    buildingType === 'combined' ? -(hw - bergingWidth / 2) : 0;
  const ovCenterX = hw - (width - bergingWidth) / 2;
  const sectionWidth = buildingType === 'combined' ? bergingWidth : width;

  const geoms: WallGeom[] = [];

  const add = (
    wallId: WallId,
    cx: number,
    cy: number,
    orientation: 'h' | 'v',
    flipSign: number,
    inward: [number, number],
    hingeEnd: 'start' | 'end',
  ) => {
    geoms.push({
      wallId,
      cx,
      cy,
      orientation,
      length: getWallLength(wallId, buildingType, dimensions),
      flipSign,
      inward,
      hingeEnd,
    });
  };

  // hingeEnd derived from 3D rotation: the door is always hinged on
  // local-left in the 3D geometry. After each wall's Y-rotation:
  //   front/ov_front (no rot):    local-left = SVG-left  → 'start'
  //   back/ov_back  (π):          local-left = SVG-right → 'end'
  //   left          (π/2):        local-left = SVG-bottom→ 'end'
  //   right/div/ov_right (-π/2):  local-left = SVG-top   → 'start'

  if (buildingType === 'berging') {
    add('front', 0, hd, 'h', 1, [0, -1], 'start');
    add('back', 0, -hd, 'h', -1, [0, 1], 'end');
    add('left', -hw, 0, 'v', 1, [1, 0], 'end');
    add('right', hw, 0, 'v', -1, [-1, 0], 'start');
  } else if (buildingType === 'combined') {
    add('front', bergingOffset, hd, 'h', 1, [0, -1], 'start');
    add('back', bergingOffset, -hd, 'h', -1, [0, 1], 'end');
    add('left', bergingOffset - sectionWidth / 2, 0, 'v', 1, [1, 0], 'end');
    add('divider', bergingOffset + sectionWidth / 2, 0, 'v', -1, [-1, 0], 'start');
    add('ov_front', ovCenterX, hd, 'h', 1, [0, -1], 'start');
    add('ov_back', ovCenterX, -hd, 'h', -1, [0, 1], 'end');
    add('ov_right', hw, 0, 'v', -1, [-1, 0], 'start');
  }
  // overkapping type has no walls

  return geoms;
}

interface SchematicWallsProps {
  buildingType: BuildingType;
  dimensions: BuildingDimensions;
  walls: Record<string, WallConfig>;
  selectedElement: SelectedElement;
}

export default function SchematicWalls({
  buildingType,
  dimensions,
  walls,
  selectedElement,
}: SchematicWallsProps) {
  const geoms = getWallGeometries(buildingType, dimensions);

  return (
    <g>
      {geoms.map((g) => {
        const cfg = walls[g.wallId];
        const isOv = isOverkappingWall(g.wallId);
        const isGhost = isOv && !cfg;

        // Skip overkapping walls for non-combined (they don't exist)
        if (buildingType !== 'combined' && isOv) return null;

        // Ghost wall: dashed outline
        if (isGhost) {
          return (
            <GhostWallRect
              key={g.wallId}
              geom={g}
            />
          );
        }

        if (!cfg) return null;

        const isSelected =
          selectedElement?.type === 'wall' &&
          selectedElement.id === g.wallId;

        return (
          <SolidWall
            key={g.wallId}
            geom={g}
            cfg={cfg}
            isSelected={isSelected}
          />
        );
      })}
    </g>
  );
}

function GhostWallRect({ geom }: { geom: WallGeom }) {
  const { cx, cy, orientation, length } = geom;
  const isH = orientation === 'h';
  const x = isH ? cx - length / 2 : cx - T / 2;
  const y = isH ? cy - T / 2 : cy - length / 2;
  const w = isH ? length : T;
  const h = isH ? T : length;

  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      fill="none"
      stroke="#93c5fd"
      strokeWidth={0.02}
      strokeDasharray="0.12 0.08"
      opacity={0.6}
    />
  );
}

function SolidWall({
  geom,
  cfg,
  isSelected,
}: {
  geom: WallGeom;
  cfg: WallConfig;
  isSelected: boolean;
}) {
  const { cx, cy, orientation, length, flipSign } = geom;
  const isH = orientation === 'h';
  const mat = WALL_MATERIALS.find((m) => m.id === cfg.materialId);
  const fillColor = isSelected ? '#3b82f6' : (mat?.color ?? '#888888');
  const fillOpacity = isSelected ? 0.5 : 0.35;
  const strokeColor = isSelected ? '#2563eb' : '#444';

  // Compute opening positions (in wall-local coords)
  const ds = cfg.doorSize ?? 'enkel';
  const { doorX, windowXs } = computeOpeningPositions(
    length,
    cfg.hasDoor,
    cfg.doorPosition ?? 'midden',
    ds,
    cfg.hasWindow ? cfg.windowCount : 0,
  );

  // Build sorted list of openings
  type Opening = { localOffset: number; halfWidth: number };
  const openings: Opening[] = [];

  if (cfg.hasDoor) {
    const dw = ds === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W;
    openings.push({ localOffset: doorX * flipSign, halfWidth: dw / 2 });
  }
  for (const wx of windowXs) {
    openings.push({ localOffset: wx * flipSign, halfWidth: WIN_W / 2 });
  }

  // Sort openings along the wall
  openings.sort((a, b) => a.localOffset - b.localOffset);

  // Compute wall segments (solid parts between openings)
  const halfLen = length / 2;
  const segments: [number, number][] = [];
  let cursor = -halfLen;
  for (const op of openings) {
    const start = op.localOffset - op.halfWidth;
    const end = op.localOffset + op.halfWidth;
    if (start > cursor + 0.001) {
      segments.push([cursor, start]);
    }
    cursor = Math.max(cursor, end);
  }
  if (cursor < halfLen - 0.001) {
    segments.push([cursor, halfLen]);
  }

  // If no openings, draw full wall
  if (openings.length === 0) {
    const x = isH ? cx - length / 2 : cx - T / 2;
    const y = isH ? cy - T / 2 : cy - length / 2;
    const w = isH ? length : T;
    const h = isH ? T : length;
    return (
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={fillColor}
        fillOpacity={fillOpacity}
        stroke={strokeColor}
        strokeWidth={0.02}
      />
    );
  }

  return (
    <g>
      {segments.map(([s, e], i) => {
        const segLen = e - s;
        if (segLen < 0.01) return null;
        const segCenter = (s + e) / 2;
        const x = isH ? cx + segCenter - segLen / 2 : cx - T / 2;
        const y = isH ? cy - T / 2 : cy + segCenter - segLen / 2;
        const w = isH ? segLen : T;
        const h = isH ? T : segLen;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={w}
            height={h}
            fill={fillColor}
            fillOpacity={fillOpacity}
            stroke={strokeColor}
            strokeWidth={0.02}
          />
        );
      })}
    </g>
  );
}
