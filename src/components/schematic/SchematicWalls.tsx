'use client';

import {
  WALL_THICKNESS,
  DOUBLE_DOOR_W,
  DOOR_W,
  WIN_W,
  resolveOpeningPositions,
  getWallLength,
} from '@/domain/building';
import { getAtomColor } from '@/domain/materials';
import { useTenant } from '@/lib/TenantProvider';
import type {
  BuildingDimensions,
  WallConfig,
  WallId,
  SelectedElement,
} from '@/domain/building';

const T = WALL_THICKNESS;

export interface WallGeom {
  wallId: WallId;
  cx: number;
  cy: number;
  orientation: 'h' | 'v';
  length: number;
  flipSign: number;
  inward: [number, number];
  hingeEnd: 'start' | 'end';
}

export function getWallGeometries(
  dimensions: BuildingDimensions,
  offsetX: number,
  offsetY: number,
): WallGeom[] {
  const { width, depth } = dimensions;
  const hw = width / 2;
  const hd = depth / 2;

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
      cx: cx + offsetX,
      cy: cy + offsetY,
      orientation,
      length: getWallLength(wallId, dimensions),
      flipSign,
      inward,
      hingeEnd,
    });
  };

  add('front', 0, hd, 'h', 1, [0, -1], 'start');
  add('back', 0, -hd, 'h', -1, [0, 1], 'end');
  add('left', -hw, 0, 'v', 1, [1, 0], 'end');
  add('right', hw, 0, 'v', -1, [-1, 0], 'start');

  return geoms;
}

interface SchematicWallsProps {
  dimensions: BuildingDimensions;
  walls: Record<string, WallConfig>;
  primaryMaterialId: string;
  selectedElement: SelectedElement;
  buildingId: string;
  offsetX: number;
  offsetY: number;
  onWallClick?: (wallId: WallId, buildingId: string) => void;
}

export default function SchematicWalls({
  dimensions,
  walls,
  primaryMaterialId,
  selectedElement,
  buildingId,
  offsetX,
  offsetY,
  onWallClick,
}: SchematicWallsProps) {
  const geoms = getWallGeometries(dimensions, offsetX, offsetY);

  return (
    <g>
      {geoms.map((g) => {
        const cfg = walls[g.wallId];
        if (!cfg) return null;

        const isSelected =
          selectedElement?.type === 'wall' &&
          selectedElement.id === g.wallId &&
          selectedElement.buildingId === buildingId;

        return (
          <SolidWall
            key={g.wallId}
            geom={g}
            cfg={cfg}
            primaryMaterialId={primaryMaterialId}
            isSelected={isSelected}
            onWallClick={onWallClick ? () => onWallClick(g.wallId, buildingId) : undefined}
          />
        );
      })}
    </g>
  );
}

function SolidWall({
  geom,
  cfg,
  primaryMaterialId,
  isSelected,
  onWallClick,
}: {
  geom: WallGeom;
  cfg: WallConfig;
  primaryMaterialId: string;
  isSelected: boolean;
  onWallClick?: () => void;
}) {
  const { catalog: { materials } } = useTenant();
  const { cx, cy, orientation, length, flipSign } = geom;
  const isH = orientation === 'h';
  const fillColor = isSelected ? '#3b82f6' : getAtomColor(materials, cfg.materialId ?? primaryMaterialId, 'wall');
  const fillOpacity = isSelected ? 0.5 : 0.35;
  const strokeColor = isSelected ? '#2563eb' : '#444';

  const ds = cfg.doorSize ?? 'enkel';
  const { doorX, windowXs } = resolveOpeningPositions(
    length,
    cfg.hasDoor ? (cfg.doorPosition ?? 0.5) : null,
    cfg.windows ?? [],
  );

  type Opening = { localOffset: number; halfWidth: number };
  const openings: Opening[] = [];

  if (cfg.hasDoor) {
    const dw = ds === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W;
    openings.push({ localOffset: doorX! * flipSign, halfWidth: dw / 2 });
  }
  for (const wx of windowXs) {
    openings.push({ localOffset: wx * flipSign, halfWidth: WIN_W / 2 });
  }

  openings.sort((a, b) => a.localOffset - b.localOffset);

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
        cursor={onWallClick ? 'pointer' : undefined}
        pointerEvents={onWallClick ? 'auto' : 'none'}
        onClick={(e) => { e.stopPropagation(); onWallClick?.(); }}
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
            cursor={onWallClick ? 'pointer' : undefined}
            pointerEvents={onWallClick ? 'auto' : 'none'}
            onClick={(e) => { e.stopPropagation(); onWallClick?.(); }}
          />
        );
      })}
    </g>
  );
}
