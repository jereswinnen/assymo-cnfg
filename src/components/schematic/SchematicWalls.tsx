'use client';

import {
  WALL_THICKNESS,
  resolveOpeningPositions,
  getWallLength,
} from '@/domain/building';
import { resolveDoorWidth, resolveWindowWidth } from '@/domain/openings';
import { getAtomColor } from '@/domain/materials';
import { useTenant } from '@/lib/TenantProvider';
import type {
  BuildingDimensions,
  WallConfig,
  WallId,
  SelectedElement,
} from '@/domain/building';
import type { SupplierProductRow } from '@/domain/supplier';

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
  /** Non-archived supplier products used for door/window width overrides. */
  supplierProducts: SupplierProductRow[];
  onWallClick?: (wallId: WallId, buildingId: string, face?: 'outer' | 'inner') => void;
}

export default function SchematicWalls({
  dimensions,
  walls,
  primaryMaterialId,
  selectedElement,
  buildingId,
  offsetX,
  offsetY,
  supplierProducts,
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

        const selectedFace =
          isSelected && selectedElement?.type === 'wall'
            ? selectedElement.face
            : undefined;

        return (
          <SolidWall
            key={g.wallId}
            geom={g}
            cfg={cfg}
            primaryMaterialId={primaryMaterialId}
            isSelected={isSelected}
            selectedFace={selectedFace}
            supplierProducts={supplierProducts}
            onWallClick={onWallClick ? (face) => onWallClick(g.wallId, buildingId, face) : undefined}
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
  selectedFace,
  supplierProducts,
  onWallClick,
}: {
  geom: WallGeom;
  cfg: WallConfig;
  primaryMaterialId: string;
  isSelected: boolean;
  selectedFace?: 'outer' | 'inner';
  supplierProducts: SupplierProductRow[];
  onWallClick?: (face?: 'outer' | 'inner') => void;
}) {
  const { catalog: { materials } } = useTenant();
  const { cx, cy, orientation, length, flipSign } = geom;
  const isH = orientation === 'h';

  const innerSlug = cfg.materialIdInner ?? null;
  const hasInner = !!innerSlug;
  const innerColor = hasInner
    ? getAtomColor(materials, innerSlug, 'wall')
    : null;
  const halfT = T / 2;

  // outerSign chooses on which side of the wall midline the OUTER strip sits.
  // front/back walls run along X, so their offset is applied to cy (Y axis in
  // SVG, which is y-down). left/right walls run along Z, offset applied to cx
  // (X axis). The sign below puts the outer strip on the side matching each
  // wall's outward normal in SVG (y-down) coordinates:
  //   front: outward = +y → outer at +cy offset → +1
  //   back:  outward = -y → outer at -cy offset → -1
  //   left:  outward = -x → outer at -cx offset → -1
  //   right: outward = +x → outer at +cx offset → +1
  const outerSign =
    geom.wallId === 'front' ? +1 :
    geom.wallId === 'back'  ? -1 :
    geom.wallId === 'left'  ? -1 :
    /* right */               +1;

  // Only used in the single-strip (no-inner) render path; the two-strip path
  // computes its own per-strip selection state below.
  const fillColor = isSelected
    ? '#3b82f6'
    : getAtomColor(materials, cfg.materialId ?? primaryMaterialId, 'wall');
  const fillOpacity = isSelected ? 0.5 : 0.35;
  const strokeColor = isSelected ? '#2563eb' : '#444';

  // Pre-compute two-strip colors/opacity (depend only on selection state + materials, not per-segment).
  const outerSelected = isSelected && (selectedFace ?? 'outer') === 'outer';
  const innerSelected = isSelected && selectedFace === 'inner';
  const outerStripFill = outerSelected ? '#3b82f6' : getAtomColor(materials, cfg.materialId ?? primaryMaterialId, 'wall');
  const outerStripOpacity = outerSelected ? 0.5 : 0.35;
  const innerStripFill = innerSelected ? '#3b82f6' : (innerColor ?? '#888');
  const innerStripOpacity = innerSelected ? 0.5 : 0.35;

  const windows = cfg.windows ?? [];
  const { doorX, windowXs } = resolveOpeningPositions(
    length,
    cfg.hasDoor ? (cfg.doorPosition ?? 0.5) : null,
    windows,
  );

  type Opening = { localOffset: number; halfWidth: number };
  const openings: Opening[] = [];

  if (cfg.hasDoor) {
    const dw = resolveDoorWidth(cfg, supplierProducts);
    openings.push({ localOffset: doorX! * flipSign, halfWidth: dw / 2 });
  }
  windowXs.forEach((wx, i) => {
    const ww = resolveWindowWidth(windows[i], supplierProducts);
    openings.push({ localOffset: wx * flipSign, halfWidth: ww / 2 });
  });

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

  // Use a unified segment renderer for both code paths.
  // When openings.length === 0, segments is empty — we use the full-length segment instead.
  const renderSegments = openings.length === 0
    ? [[-halfLen, halfLen] as [number, number]]
    : segments;

  const renderedRects = renderSegments.map(([s, e], i) => {
    const segLen = e - s;
    if (segLen < 0.01) return null;
    const segCenter = (s + e) / 2;

    if (!hasInner) {
      const x = isH ? cx + segCenter - segLen / 2 : cx - T / 2;
      const y = isH ? cy - T / 2 : cy + segCenter - segLen / 2;
      const w = isH ? segLen : T;
      const h = isH ? T : segLen;
      return (
        <rect
          key={i}
          x={x} y={y} width={w} height={h}
          fill={fillColor}
          fillOpacity={fillOpacity}
          stroke={strokeColor}
          strokeWidth={0.02}
          cursor={onWallClick ? 'pointer' : undefined}
          pointerEvents={onWallClick ? 'auto' : 'none'}
          onClick={(ev) => { ev.stopPropagation(); onWallClick?.('outer'); }}
        />
      );
    }

    // Two strips, each half-thickness.
    const outerOff = (outerSign * halfT) / 2;
    const innerOff = (-outerSign * halfT) / 2;

    const outerRect = isH
      ? { x: cx + segCenter - segLen / 2, y: cy + outerOff - halfT / 2, w: segLen, h: halfT }
      : { x: cx + outerOff - halfT / 2, y: cy + segCenter - segLen / 2, w: halfT, h: segLen };
    const innerRect = isH
      ? { x: cx + segCenter - segLen / 2, y: cy + innerOff - halfT / 2, w: segLen, h: halfT }
      : { x: cx + innerOff - halfT / 2, y: cy + segCenter - segLen / 2, w: halfT, h: segLen };

    return (
      <g key={i}>
        <rect
          x={outerRect.x} y={outerRect.y}
          width={outerRect.w} height={outerRect.h}
          fill={outerStripFill}
          fillOpacity={outerStripOpacity}
          stroke={strokeColor}
          strokeWidth={0.02}
          cursor={onWallClick ? 'pointer' : undefined}
          pointerEvents={onWallClick ? 'auto' : 'none'}
          onClick={(ev) => { ev.stopPropagation(); onWallClick?.('outer'); }}
        />
        <rect
          x={innerRect.x} y={innerRect.y}
          width={innerRect.w} height={innerRect.h}
          fill={innerStripFill}
          fillOpacity={innerStripOpacity}
          stroke={strokeColor}
          strokeWidth={0.02}
          cursor={onWallClick ? 'pointer' : undefined}
          pointerEvents={onWallClick ? 'auto' : 'none'}
          onClick={(ev) => { ev.stopPropagation(); onWallClick?.('inner'); }}
        />
      </g>
    );
  });

  if (openings.length === 0) {
    // Single-segment: return the rect/group directly (not wrapped in another <g>)
    return <>{renderedRects[0]}</>;
  }

  return (
    <g>
      {renderedRects}
    </g>
  );
}
