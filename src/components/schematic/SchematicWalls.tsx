'use client';

import {
  getPanelLayerLayout,
  resolveOpeningPositions,
  getWallLength,
} from '@/domain/building';
import type { PanelLayer } from '@/domain/building';
import { resolveDoorWidth, resolveWindowWidth } from '@/domain/openings';
import { getAtomColor } from '@/domain/materials';
import { useTenant } from '@/lib/TenantProvider';
import { useEffectivePostSize } from '@/lib/useEffectivePostSize';
import type {
  BuildingDimensions,
  WallConfig,
  WallId,
  SelectedElement,
} from '@/domain/building';
import type { SupplierProductRow } from '@/domain/supplier';

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

        return (
          <SolidWall
            key={g.wallId}
            geom={g}
            cfg={cfg}
            primaryMaterialId={primaryMaterialId}
            isSelected={isSelected}
            supplierProducts={supplierProducts}
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
  supplierProducts,
  onWallClick,
}: {
  geom: WallGeom;
  cfg: WallConfig;
  primaryMaterialId: string;
  isSelected: boolean;
  supplierProducts: SupplierProductRow[];
  onWallClick?: () => void;
}) {
  const { catalog: { materials } } = useTenant();
  /** Wall thickness equals the effective post / lumber cross-section. */
  const T = useEffectivePostSize();
  const { cx, cy, orientation, length, flipSign } = geom;
  const isH = orientation === 'h';

  const innerSlug = cfg.materialIdInner ?? null;
  const hasInner = !!innerSlug;
  const innerColor = hasInner
    ? getAtomColor(materials, innerSlug, 'wall')
    : null;

  const middenlaagSlug = cfg.materialIdMiddenlaag ?? null;
  const middenlaagColor = middenlaagSlug
    ? getAtomColor(materials, middenlaagSlug, 'middenlaag')
    : null;

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

  const effectiveOuterSign = (cfg.innerFlipped ? -1 : 1) * outerSign;

  const strokeColor = isSelected ? '#2563eb' : '#444';

  // Strip-table: describes each layer of the wall cross-section.
  // offsetNorm = signed offset of strip centre from wall midline as fraction of T (positive = outward).
  // thicknessNorm = strip thickness as fraction of T.
  // Packing guarantee: [offset - thickness/2, offset + thickness/2] covers [-0.5, +0.5] with no gaps/overlaps.
  type Strip = { fillBase: string; offsetNorm: number; thicknessNorm: number };

  const hasMiddenlaag = !!middenlaagSlug;

  const outerFillBase = getAtomColor(materials, cfg.materialId ?? primaryMaterialId, 'wall');
  const innerFillBase = innerColor ?? '#888';
  const middenlaagFillBase = middenlaagColor ?? '#888';

  const fillForRole = (role: PanelLayer['role']): string => {
    switch (role) {
      case 'whole':
      case 'outerCladding':
        return outerFillBase;
      case 'middenlaag':
        return middenlaagFillBase;
      case 'innerCladding':
        return innerFillBase;
    }
  };

  const strips: Strip[] = getPanelLayerLayout({ hasMiddenlaag, hasInner }).map(l => ({
    fillBase: fillForRole(l.role),
    offsetNorm: l.offsetNorm,
    thicknessNorm: l.thicknessNorm,
  }));

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

    return (
      <g key={i}>
        {strips.map((strip, idx) => {
          const stripT = strip.thicknessNorm * T;
          const perpOffset = effectiveOuterSign * (strip.offsetNorm * T);
          const x = isH
            ? cx + segCenter - segLen / 2
            : cx + perpOffset - stripT / 2;
          const y = isH
            ? cy + perpOffset - stripT / 2
            : cy + segCenter - segLen / 2;
          const w = isH ? segLen : stripT;
          const h = isH ? stripT : segLen;
          return (
            <rect
              key={idx}
              x={x} y={y} width={w} height={h}
              fill={isSelected ? '#3b82f6' : strip.fillBase}
              fillOpacity={isSelected ? 0.5 : 0.35}
              stroke={strokeColor}
              strokeWidth={0.02}
              cursor={onWallClick ? 'pointer' : undefined}
              pointerEvents={onWallClick ? 'auto' : 'none'}
              onClick={(ev) => { ev.stopPropagation(); onWallClick?.(); }}
            />
          );
        })}
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
