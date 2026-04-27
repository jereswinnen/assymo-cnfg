'use client';

import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { useConfigStore, getEffectiveHeight } from '@/store/useConfigStore';
import { useUIStore, selectSingleBuildingId } from "@/store/useUIStore";
import { detectSnap, detectPoleSnap, detectWallSnap, detectResizeSnap } from '@/domain/building';
import { getConstraints, DOOR_W, DOUBLE_DOOR_W, WIN_W, xToFraction, clampOpeningPosition, fractionToX, getWallLength, autoPoleLayout } from '@/domain/building';
import { getEffectivePrimaryMaterial, getAtomColor } from '@/domain/materials';
import { computePlanDimensions, type DimLine } from '@/domain/schematic';
import { useTenant } from '@/lib/TenantProvider';
import { t } from '@/lib/i18n';
import SchematicPosts from './SchematicPosts';
import SchematicWalls, { getWallGeometries } from './SchematicWalls';
import SchematicOpenings from './SchematicOpenings';
import DimensionLine from './DimensionLine';
import WallElevation from './WallElevation';
import type { BuildingType, WallSide, WallId, SnapConnection, BuildingEntity } from '@/domain/building';

// Single source of truth for these constants is `@/lib/useDragGesture`
// — re-exported here so SchematicView's hand-rolled gesture stack
// (which predates the hook) stays aligned with the hook's defaults.
import { DRAG_DEAD_ZONE_SQ, IS_COARSE_POINTER } from '@/lib/useDragGesture';

/** Capture the pointer to the SVG so subsequent pointermove/up events
 *  route directly to the SVG handler regardless of where the finger
 *  drifts. We deliberately capture on the SVG (a stable element across
 *  the entire session) instead of `e.currentTarget` (a small child
 *  element that React may unmount and remount during the drag — store
 *  updates on every pointermove can break per-child capture). */
function captureOnSvg(svg: SVGSVGElement | null, e: React.PointerEvent) {
  if (!svg) return;
  try {
    svg.setPointerCapture(e.pointerId);
  } catch {
    // Some browsers reject capture (e.g. already capturing another
    // pointer for multitouch). Silent fallback: the SVG's onPointerMove
    // still receives bubbled events in the common case.
  }
}

function getConnectedSides(buildingId: string, connections: SnapConnection[]): Set<WallSide> {
  const sides = new Set<WallSide>();
  for (const c of connections) {
    if (c.buildingAId === buildingId) sides.add(c.sideA);
    if (c.buildingBId === buildingId) sides.add(c.sideB);
  }
  return sides;
}

/** Find the connection edge segments between buildings */
function getConnectionEdges(
  buildings: BuildingEntity[],
  connections: SnapConnection[],
): { x1: number; y1: number; x2: number; y2: number; isOpen: boolean }[] {
  const edges: { x1: number; y1: number; x2: number; y2: number; isOpen: boolean }[] = [];
  const byId = new Map(buildings.map(b => [b.id, b]));

  for (const c of connections) {
    const a = byId.get(c.buildingAId);
    const b = byId.get(c.buildingBId);
    if (!a || !b) continue;

    const aLeft = a.position[0];
    const aRight = a.position[0] + a.dimensions.width;
    const aTop = a.position[1];
    const aBottom = a.position[1] + a.dimensions.depth;
    const bLeft = b.position[0];
    const bRight = b.position[0] + b.dimensions.width;
    const bTop = b.position[1];
    const bBottom = b.position[1] + b.dimensions.depth;

    if (c.sideA === 'right' || c.sideA === 'left') {
      const ex = c.sideA === 'right' ? aRight : aLeft;
      const overlapTop = Math.max(aTop, bTop);
      const overlapBottom = Math.min(aBottom, bBottom);
      if (overlapBottom > overlapTop) {
        edges.push({ x1: ex, y1: overlapTop, x2: ex, y2: overlapBottom, isOpen: c.isOpen });
      }
    } else {
      const ey = c.sideA === 'front' ? aBottom : aTop;
      const overlapLeft = Math.max(aLeft, bLeft);
      const overlapRight = Math.min(aRight, bRight);
      if (overlapRight > overlapLeft) {
        edges.push({ x1: overlapLeft, y1: ey, x2: overlapRight, y2: ey, isOpen: c.isOpen });
      }
    }
  }
  return edges;
}

function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/** Minimum thickness used when growing a muur's selection AABB so the
 *  thin (15cm) wall can be picked up by a drag-rect that crosses its
 *  visible hit target. Mirrors the `Math.max(wallD, 0.5)` enlargement
 *  applied to the muur hit target rect in the render block below. */
const MUUR_SELECT_MIN_THICKNESS = 0.5;

function getBuildingAABB(b: BuildingEntity): [number, number, number, number] {
  if (b.type === 'muur') {
    const isVert = b.orientation === 'vertical';
    const wallW = isVert ? b.dimensions.depth : b.dimensions.width;
    const wallD = isVert ? b.dimensions.width : b.dimensions.depth;
    // Grow the thin axis so the selection footprint matches the
    // visible hit target. For horizontal muur that's the y-axis; for
    // vertical, the x-axis. The other axis is already the wall length.
    const grownW = isVert ? Math.max(wallW, MUUR_SELECT_MIN_THICKNESS) : wallW;
    const grownD = !isVert ? Math.max(wallD, MUUR_SELECT_MIN_THICKNESS) : wallD;
    const offsetX = (grownW - wallW) / 2;
    const offsetY = (grownD - wallD) / 2;
    return [b.position[0] - offsetX, b.position[1] - offsetY, grownW, grownD];
  }
  return [b.position[0], b.position[1], b.dimensions.width, b.dimensions.depth];
}

function clientToWorld(
  svgEl: SVGSVGElement,
  clientX: number,
  clientY: number,
): [number, number] {
  const pt = svgEl.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return [0, 0];
  const svgPt = pt.matrixTransform(ctm.inverse());
  return [svgPt.x, svgPt.y];
}

function ResizeHandles({
  building,
  onResizePointerDown,
  interactive = true,
}: {
  building: BuildingEntity;
  onResizePointerDown: (e: React.PointerEvent, buildingId: string, edge: 'left' | 'right' | 'top' | 'bottom') => void;
  /** When false, handles render as a visual indicator only (pointer-events
   *  off, dimmed). Used during multi-select so the user sees which entities
   *  are in the selection without enabling per-handle resize interactions
   *  that wouldn't apply to the whole group. */
  interactive?: boolean;
}) {
  const [ox, oz] = building.position;
  const { width, depth } = building.dimensions;
  // Larger resize handles on coarse pointers (touch) so a fingertip can
  // grab them reliably; mouse users keep the tighter visual.
  const r = IS_COARSE_POINTER ? 0.18 : 0.12;
  const isMuur = building.type === 'muur';
  const isVertMuur = isMuur && building.orientation === 'vertical';

  const handles: { cx: number; cy: number; edge: 'left' | 'right' | 'top' | 'bottom'; cursor: string }[] = [];

  if (isMuur) {
    if (isVertMuur) {
      const visualW = building.dimensions.depth;
      const visualD = building.dimensions.width;
      handles.push(
        { cx: ox + visualW / 2, cy: oz, edge: 'top', cursor: 'ns-resize' },
        { cx: ox + visualW / 2, cy: oz + visualD, edge: 'bottom', cursor: 'ns-resize' },
      );
    } else {
      handles.push(
        { cx: ox, cy: oz + depth / 2, edge: 'left', cursor: 'ew-resize' },
        { cx: ox + width, cy: oz + depth / 2, edge: 'right', cursor: 'ew-resize' },
      );
    }
  } else {
    handles.push(
      { cx: ox, cy: oz + depth / 2, edge: 'left', cursor: 'ew-resize' },
      { cx: ox + width, cy: oz + depth / 2, edge: 'right', cursor: 'ew-resize' },
      { cx: ox + width / 2, cy: oz, edge: 'top', cursor: 'ns-resize' },
      { cx: ox + width / 2, cy: oz + depth, edge: 'bottom', cursor: 'ns-resize' },
    );
  }

  return (
    <g pointerEvents={interactive ? undefined : 'none'}>
      {handles.map((h) => (
        <circle
          key={h.edge}
          cx={h.cx}
          cy={h.cy}
          r={r}
          fill="#3b82f6"
          fillOpacity={interactive ? 1 : 0.55}
          stroke="white"
          strokeWidth={0.03}
          style={interactive ? { cursor: h.cursor } : undefined}
          onPointerDown={interactive
            ? (e) => onResizePointerDown(e, building.id, h.edge)
            : undefined}
        />
      ))}
    </g>
  );
}

export default function SchematicView() {
  const { catalog: { materials }, supplierCatalog, features } = useTenant();
  const wallElevationEnabled = features.wallElevationView;
  const buildings = useConfigStore((s) => s.buildings);
  const connections = useConfigStore((s) => s.connections);
  const selectedElement = useUIStore((s) => s.selectedElement);
  const defaultHeight = useConfigStore((s) => s.defaultHeight);
  const isElevationMode = selectedElement?.type === 'wall';
  const selectedBuildingIds = useUIStore((s) => s.selectedBuildingIds);
  const selectedBuildingId = useUIStore(selectSingleBuildingId);
  const selectBuilding = useUIStore((s) => s.selectBuilding);
  const updateBuildingPosition = useConfigStore((s) => s.updateBuildingPosition);
  const setPoleAttachment = useConfigStore((s) => s.setPoleAttachment);
  const setConnections = useConfigStore((s) => s.setConnections);
  const setDraggedBuildingId = useUIStore((s) => s.setDraggedBuildingId);
  const setOrientation = useConfigStore((s) => s.setOrientation);
  const addBuilding = useConfigStore((s) => s.addBuilding);
  const updateBuildingDimensions = useConfigStore((s) => s.updateBuildingDimensions);
  const updateBuildingWall = useConfigStore((s) => s.updateBuildingWall);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const dragBuildingId = useRef<string | null>(null);
  const shiftOnDown = useRef(false);
  const dragStartWorld = useRef<[number, number] | null>(null);
  const dragStartPos = useRef<[number, number]>([0, 0]);
  const pointerDownScreen = useRef<{ x: number; y: number } | null>(null);

  // Resize state
  const resizing = useRef(false);
  const resizeBuildingId = useRef<string | null>(null);
  const resizeEdge = useRef<'left' | 'right' | 'top' | 'bottom' | null>(null);
  const resizeStartWorld = useRef<[number, number] | null>(null);
  const resizeStartDims = useRef<{ width: number; depth: number }>({ width: 0, depth: 0 });
  const resizeStartPos = useRef<[number, number]>([0, 0]);

  // Opening drag state
  const draggingOpening = useRef<{
    buildingId: string;
    wallId: string;
    type: 'door' | 'window';
    windowIndex?: number;
    wallGeom: { cx: number; cy: number; orientation: 'h' | 'v'; length: number; flipSign: number };
  } | null>(null);
  const [openingDragPreview, setOpeningDragPreview] = useState<{
    buildingId: string;
    wallId: string;
    type: 'door' | 'window';
    windowIndex?: number;
    fraction: number;
  } | null>(null);

  // Overkapping intermediate-pole drag state
  const draggingPole = useRef<{
    buildingId: string;
    side: 'front' | 'back' | 'left' | 'right';
    index: number;
  } | null>(null);
  const [polePreview, setPolePreview] = useState<{
    buildingId: string;
    side: 'front' | 'back' | 'left' | 'right';
    index: number;
    fraction: number;
  } | null>(null);
  const [hoveredPole, setHoveredPole] = useState<{
    buildingId: string;
    side: 'front' | 'back' | 'left' | 'right';
    index: number;
  } | null>(null);

  const groupDragStartPositions = useRef<Map<string, [number, number]>>(new Map());

  // Selection rectangle state
  const selectRectAnchor = useRef<[number, number] | null>(null);
  const [selectRect, setSelectRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const selectRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  // Freeze viewBox during drag to prevent coordinate system shifts
  const [frozenViewBox, setFrozenViewBox] = useState<string | null>(null);

  const previewSelectedIds = useMemo(() => {
    if (!selectRect) return new Set<string>();
    const { x, y, w, h } = selectRect;
    return new Set(
      buildings
        .filter(b => {
          const [bx, by, bw, bh] = getBuildingAABB(b);
          return rectsOverlap(x, y, w, h, bx, by, bw, bh);
        })
        .map(b => b.id),
    );
  }, [selectRect, buildings]);

  // Ghost preview for drag-and-drop from sidebar
  const [dragGhost, setDragGhost] = useState<{ x: number; y: number } | null>(null);

  const normalBuildings = buildings.filter(b => b.type !== 'paal' && b.type !== 'muur');
  const walls = buildings.filter(b => b.type === 'muur');
  const poles = buildings.filter(b => b.type === 'paal');

  // Compute bounding box of all buildings (including poles)
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const b of buildings) {
    const [lx, lz] = b.position;
    const isVertMuur = b.type === 'muur' && b.orientation === 'vertical';
    const bw = isVertMuur ? b.dimensions.depth : b.dimensions.width;
    const bd = isVertMuur ? b.dimensions.width : b.dimensions.depth;
    const pad2 = b.type === 'paal' ? 0.3 : 0;
    minX = Math.min(minX, lx - pad2);
    maxX = Math.max(maxX, lx + bw + pad2);
    minZ = Math.min(minZ, lz - pad2);
    maxZ = Math.max(maxZ, lz + bd + pad2);
  }

  const totalW = maxX - minX;
  const totalD = maxZ - minZ;
  const showTotalDimension = buildings.length > 1 && connections.length > 0;

  // Dimension registry — single source of truth for what gets rendered.
  // computePlanDimensions handles context-aware suppression. The local
  // arc-clearance pass below preserves the door-swing-clearance bump that
  // the old inline blocks applied to per-building width/depth offsets.
  const planLines = useMemo<DimLine[]>(
    () => computePlanDimensions({ buildings, connections }),
    [buildings, connections],
  );

  const arcClearance = useMemo(() => {
    const front: Record<string, number> = {};
    const right: Record<string, number> = {};
    for (const b of buildings) {
      if (b.type === 'paal' || b.type === 'muur') continue;
      const fw = b.walls['front'];
      const rw = b.walls['right'];
      front[b.id] = (fw?.hasDoor && fw.doorSwing === 'naar_buiten')
        ? (fw.doorSize === 'dubbel' ? DOUBLE_DOOR_W / 2 : DOOR_W)
        : 0;
      right[b.id] = (rw?.hasDoor && rw.doorSwing === 'naar_buiten')
        ? (rw.doorSize === 'dubbel' ? DOUBLE_DOOR_W / 2 : DOOR_W)
        : 0;
    }
    return { front, right };
  }, [buildings]);

  const adjustedPlanLines = useMemo<DimLine[]>(() => {
    return planLines.map((d) => {
      if (!d.groupKey?.startsWith('building:')) return d;
      const id = d.groupKey.slice('building:'.length);
      if (d.id === 'building.width') {
        const arc = arcClearance.front[id] ?? 0;
        // Width line sits south of the building; bump positive offset
        // outward when the front-wall door swings into the dimension lane.
        return { ...d, offset: Math.max(d.offset, arc + 0.5) };
      }
      if (d.id === 'building.depth') {
        const arc = arcClearance.right[id] ?? 0;
        // Depth line sits east; offset is negative, so push more
        // negative when the right-wall door swings outward.
        return { ...d, offset: Math.min(d.offset, -(arc + 0.5)) };
      }
      return d;
    });
  }, [planLines, arcClearance]);

  const pad = showTotalDimension ? 2.8 : 2.0;
  const computedViewBox = `${minX - pad} ${minZ - pad} ${totalW + 2 * pad} ${totalD + 2 * pad}`;
  const activeViewBox = frozenViewBox ?? computedViewBox;

  const elevationViewBox = useMemo(() => {
    if (!isElevationMode || selectedElement?.type !== 'wall') return '';
    const building = buildings.find(b => b.id === selectedElement.buildingId);
    if (!building) return '';
    const wallLength = getWallLength(selectedElement.id, building.dimensions);
    const wallHeight = getEffectiveHeight(building, defaultHeight);
    const pad = 0.8;
    return `${-pad} ${-pad} ${wallLength + 2 * pad} ${wallHeight + 2 * pad}`;
  }, [isElevationMode, selectedElement, buildings, defaultHeight]);

  const connectionEdges = useMemo(
    () => getConnectionEdges(buildings, connections),
    [buildings, connections],
  );

  // --- Drag handlers ---

  const onBuildingPointerDown = useCallback((e: React.PointerEvent, buildingId: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    captureOnSvg(svgRef.current, e);
    shiftOnDown.current = e.shiftKey;

    const svg = svgRef.current;
    if (!svg) return;

    const building = useConfigStore.getState().buildings.find(b => b.id === buildingId);
    if (!building) return;

    pointerDownScreen.current = { x: e.clientX, y: e.clientY };
    dragStartWorld.current = clientToWorld(svg, e.clientX, e.clientY);
    dragStartPos.current = [...building.position];
    dragBuildingId.current = buildingId;

    setFrozenViewBox(computedViewBox);

    // Capture start positions for all selected buildings (for group drag)
    const cfg = useConfigStore.getState();
    const ui = useUIStore.getState();
    if (ui.selectedBuildingIds.includes(buildingId) && ui.selectedBuildingIds.length > 1) {
      const posMap = new Map<string, [number, number]>();
      for (const id of ui.selectedBuildingIds) {
        const b = cfg.buildings.find(b => b.id === id);
        if (b) posMap.set(id, [...b.position]);
      }
      groupDragStartPositions.current = posMap;
    } else {
      groupDragStartPositions.current = new Map();
    }
  }, [computedViewBox]);

  const onResizePointerDown = useCallback((
    e: React.PointerEvent,
    buildingId: string,
    edge: 'left' | 'right' | 'top' | 'bottom',
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    captureOnSvg(svgRef.current, e);

    const svg = svgRef.current;
    if (!svg) return;

    const building = useConfigStore.getState().buildings.find(b => b.id === buildingId);
    if (!building) return;

    pointerDownScreen.current = { x: e.clientX, y: e.clientY };
    resizeStartWorld.current = clientToWorld(svg, e.clientX, e.clientY);
    resizeStartDims.current = { width: building.dimensions.width, depth: building.dimensions.depth };
    resizeStartPos.current = [...building.position];
    resizeBuildingId.current = buildingId;
    resizeEdge.current = edge;

    setFrozenViewBox(computedViewBox);
  }, [computedViewBox]);

  const onOpeningPointerDown = useCallback((
    e: React.PointerEvent,
    info: { buildingId: string; wallId: string; type: 'door' | 'window'; windowIndex?: number },
  ) => {
    e.stopPropagation();
    captureOnSvg(svgRef.current, e);
    const svg = svgRef.current;
    if (!svg) return;

    const building = buildings.find(b => b.id === info.buildingId);
    if (!building) return;

    const [bx, bz] = building.position;
    const { width, depth } = building.dimensions;

    // For standalone walls, replicate the dimension/offset logic from the render section
    const isMuur = building.type === 'muur';
    const isHorizontal = building.orientation !== 'vertical';
    const schematicDims = isMuur && !isHorizontal
      ? { width: building.dimensions.depth, depth: building.dimensions.width, height: building.dimensions.height }
      : building.dimensions;
    const gOffsetX = isMuur
      ? (isHorizontal ? bx + width / 2 : bx + building.dimensions.depth)
      : bx + width / 2;
    const gOffsetY = isMuur
      ? (isHorizontal ? bz : bz + width / 2)
      : bz + depth / 2;

    const geoms = getWallGeometries(schematicDims, gOffsetX, gOffsetY);
    // For vertical muur, the wall config key 'front' is mapped to wallId 'left'
    const wallGeom = geoms.find(g => g.wallId === info.wallId);
    if (!wallGeom) return;

    pointerDownScreen.current = { x: e.clientX, y: e.clientY };
    draggingOpening.current = {
      ...info,
      wallGeom: { cx: wallGeom.cx, cy: wallGeom.cy, orientation: wallGeom.orientation, length: wallGeom.length, flipSign: wallGeom.flipSign },
    };
    setFrozenViewBox(computedViewBox);
  }, [buildings, computedViewBox]);

  const onPolePointerDown = useCallback((
    e: React.PointerEvent,
    info: { buildingId: string; side: 'front' | 'back' | 'left' | 'right'; index: number },
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    captureOnSvg(svgRef.current, e);
    pointerDownScreen.current = { x: e.clientX, y: e.clientY };
    draggingPole.current = info;
    setFrozenViewBox(computedViewBox);
  }, [computedViewBox]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (isElevationMode) return;
    // --- Selection rectangle handling ---
    if (selectRectAnchor.current) {
      const down = pointerDownScreen.current;
      if (down) {
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (dx * dx + dy * dy < DRAG_DEAD_ZONE_SQ) return; // 5px dead zone
      }

      const svg = svgRef.current;
      if (!svg) return;

      const [wx, wz] = clientToWorld(svg, e.clientX, e.clientY);
      const [ax, az] = selectRectAnchor.current;
      const rx = Math.min(ax, wx);
      const ry = Math.min(az, wz);
      const rw = Math.abs(wx - ax);
      const rh = Math.abs(wz - az);
      const rect = { x: rx, y: ry, w: rw, h: rh };
      selectRectRef.current = rect;
      setSelectRect(rect);
      return;
    }

    // --- Resize handling ---
    if (resizeBuildingId.current && resizeEdge.current && resizeStartWorld.current) {
      const down = pointerDownScreen.current;
      if (down && !resizing.current) {
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (dx * dx + dy * dy < DRAG_DEAD_ZONE_SQ) return;
        resizing.current = true;
        useConfigStore.temporal.getState().pause();
      }
      if (!resizing.current) return;

      const svg = svgRef.current;
      if (!svg) return;

      const [wx, wz] = clientToWorld(svg, e.clientX, e.clientY);
      const edge = resizeEdge.current;
      const startPos = resizeStartPos.current;
      const startDims = resizeStartDims.current;
      const buildingId = resizeBuildingId.current;

      const allBuildings = useConfigStore.getState().buildings;
      const building = allBuildings.find(b => b.id === buildingId);
      if (!building) return;

      const constraints = getConstraints(building.type);
      const isMuur = building.type === 'muur';
      const isVertMuur = isMuur && building.orientation === 'vertical';
      const others = allBuildings.filter(b => b.id !== buildingId && b.type !== 'paal' && b.type !== 'muur');

      // For vertical muur, top/bottom edges control width (wall length), not depth
      if (isVertMuur) {
        if (edge === 'bottom') {
          const candidateBottom = detectResizeSnap(wz, 'z', 'back', startPos[0], startPos[0] + startDims.depth, others);
          const newLen = Math.max(constraints.width.min, Math.min(constraints.width.max, candidateBottom - startPos[1]));
          updateBuildingDimensions(buildingId, { width: newLen });
          return;
        } else if (edge === 'top') {
          const candidateTop = detectResizeSnap(wz, 'z', 'front', startPos[0], startPos[0] + startDims.depth, others);
          const bottomEdge = startPos[1] + startDims.width;
          const newLen = Math.max(constraints.width.min, Math.min(constraints.width.max, bottomEdge - candidateTop));
          updateBuildingDimensions(buildingId, { width: newLen });
          updateBuildingPosition(buildingId, [startPos[0], bottomEdge - newLen]);
          return;
        }
      }

      let newWidth = startDims.width;
      let newDepth = startDims.depth;
      let newPosX = startPos[0];
      let newPosZ = startPos[1];

      if (edge === 'right') {
        const candidateRight = detectResizeSnap(wx, 'x', 'right', startPos[1], startPos[1] + startDims.depth, others);
        newWidth = Math.max(constraints.width.min, Math.min(constraints.width.max, candidateRight - startPos[0]));
      } else if (edge === 'left') {
        const candidateLeft = detectResizeSnap(wx, 'x', 'left', startPos[1], startPos[1] + startDims.depth, others);
        const rightEdge = startPos[0] + startDims.width;
        newWidth = Math.max(constraints.width.min, Math.min(constraints.width.max, rightEdge - candidateLeft));
        newPosX = rightEdge - newWidth;
      } else if (edge === 'bottom') {
        const candidateBottom = detectResizeSnap(wz, 'z', 'back', startPos[0], startPos[0] + startDims.width, others);
        newDepth = Math.max(constraints.depth.min, Math.min(constraints.depth.max, candidateBottom - startPos[1]));
      } else if (edge === 'top') {
        const candidateTop = detectResizeSnap(wz, 'z', 'front', startPos[0], startPos[0] + startDims.width, others);
        const bottomEdge = startPos[1] + startDims.depth;
        newDepth = Math.max(constraints.depth.min, Math.min(constraints.depth.max, bottomEdge - candidateTop));
        newPosZ = bottomEdge - newDepth;
      }

      updateBuildingDimensions(buildingId, { width: newWidth, depth: newDepth });
      updateBuildingPosition(buildingId, [newPosX, newPosZ]);
      return;
    }

    // --- Pole drag handling ---
    if (draggingPole.current) {
      const down = pointerDownScreen.current;
      if (down) {
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (dx * dx + dy * dy < DRAG_DEAD_ZONE_SQ) return; // 5px dead zone
      }

      if (!polePreview) {
        useConfigStore.temporal.getState().pause();
      }

      const svg = svgRef.current;
      if (!svg) return;

      const { buildingId, side, index } = draggingPole.current;
      const building = useConfigStore.getState().buildings.find(b => b.id === buildingId);
      if (!building) return;

      const [wx, wz] = clientToWorld(svg, e.clientX, e.clientY);
      const [bx, bz] = building.position;
      const { width, depth } = building.dimensions;

      // Side axis: front/back slide along x (width); left/right slide along z (depth)
      const axis = side === 'front' || side === 'back' ? 'x' : 'z';
      const along = axis === 'x' ? (wx - bx) : (wz - bz);
      const edgeLen = axis === 'x' ? width : depth;
      const SNAP = 0.1;
      const ALIGN_THRESHOLD = 0.15; // metres — pulls to opposite-side / self-side pole positions
      let snapped = Math.round(along / SNAP) * SNAP;

      // Alignment snap: pull toward other poles that lie on the same axis —
      // the opposite side (symmetry) and sibling poles on the same side.
      const layout = building.poles ?? autoPoleLayout(width, depth);
      const oppositeSide: typeof side =
        side === 'front' ? 'back' :
        side === 'back' ? 'front' :
        side === 'left' ? 'right' : 'left';
      const alignCandidates: number[] = [];
      for (const f of layout[oppositeSide]) alignCandidates.push(f * edgeLen);
      layout[side].forEach((f, i) => { if (i !== index) alignCandidates.push(f * edgeLen); });
      for (const cand of alignCandidates) {
        if (Math.abs(cand - snapped) <= ALIGN_THRESHOLD) {
          snapped = cand;
          break;
        }
      }

      const minClear = 0.2; // keep poles off the exact corners
      const clamped = Math.max(minClear, Math.min(edgeLen - minClear, snapped));
      const fraction = clamped / edgeLen;

      setPolePreview({ buildingId, side, index, fraction });
      // Live-sync to 3D: write the in-progress fraction to the store on every
      // move. Temporal is paused above, so this doesn't flood undo history;
      // pointer-up still runs the final dedup pass.
      const liveSide = [...layout[side]];
      liveSide[index] = fraction;
      useConfigStore.getState().updateBuildingPoles(buildingId, {
        ...layout,
        [side]: liveSide,
      });
      return;
    }

    // --- Opening drag handling ---
    if (draggingOpening.current) {
      const down = pointerDownScreen.current;
      if (down) {
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (dx * dx + dy * dy < DRAG_DEAD_ZONE_SQ) return; // 5px dead zone
      }

      if (!openingDragPreview) {
        useConfigStore.temporal.getState().pause();
      }

      const svg = svgRef.current;
      if (!svg) return;

      const [wx, wz] = clientToWorld(svg, e.clientX, e.clientY);
      const { cx, cy, orientation, length, flipSign } = draggingOpening.current.wallGeom;

      // Project pointer onto wall axis
      const localOffset = orientation === 'h'
        ? (wx - cx) * flipSign
        : (wz - cy) * flipSign;

      let fraction = xToFraction(length, localOffset);

      // Snap to preset positions (links=0, midden=0.5, rechts=1)
      const SNAP_THRESHOLD = 0.03; // ~3% of wall length
      const presets = [0.0, 0.5, 1.0];
      for (const preset of presets) {
        if (Math.abs(fraction - preset) < SNAP_THRESHOLD) {
          fraction = preset;
          break;
        }
      }

      // Build other openings array (exclude the one being dragged)
      const state = useConfigStore.getState();
      const building = state.buildings.find(b => b.id === draggingOpening.current!.buildingId);
      if (!building) return;

      // Resolve the correct wall config key
      const isMuur = building.type === 'muur';
      const isVertMuur = isMuur && building.orientation === 'vertical';
      // For vertical muur, wallId 'left' maps to config key 'front'
      const wallConfigKey = isVertMuur && draggingOpening.current.wallId === 'left'
        ? 'front'
        : draggingOpening.current.wallId;
      const wallCfg = building.walls[wallConfigKey];
      if (!wallCfg) return;

      const otherOpenings: { position: number; width: number }[] = [];

      // Add door as other opening (unless we're dragging the door)
      if (wallCfg.hasDoor && draggingOpening.current.type !== 'door') {
        const ds = wallCfg.doorSize ?? 'enkel';
        otherOpenings.push({
          position: wallCfg.doorPosition ?? 0.5,
          width: ds === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W,
        });
      }

      // Add windows as other openings (excluding the one being dragged)
      const wins = wallCfg.windows ?? [];
      for (let i = 0; i < wins.length; i++) {
        if (draggingOpening.current.type === 'window' && draggingOpening.current.windowIndex === i) continue;
        otherOpenings.push({ position: wins[i].position, width: WIN_W });
      }

      const openingWidth = draggingOpening.current.type === 'door'
        ? ((wallCfg.doorSize ?? 'enkel') === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W)
        : WIN_W;

      const clampedFraction = clampOpeningPosition(length, openingWidth, fraction, otherOpenings);

      setOpeningDragPreview({
        buildingId: draggingOpening.current.buildingId,
        wallId: draggingOpening.current.wallId,
        type: draggingOpening.current.type,
        windowIndex: draggingOpening.current.windowIndex,
        fraction: clampedFraction,
      });

      // Live-update store for 3D view
      if (draggingOpening.current.type === 'door') {
        useConfigStore.getState().updateBuildingWall(
          draggingOpening.current.buildingId,
          wallConfigKey as WallId,
          { doorPosition: clampedFraction },
        );
      } else if (draggingOpening.current.type === 'window' && draggingOpening.current.windowIndex !== undefined) {
        const newWindows = [...(wallCfg.windows ?? [])];
        newWindows[draggingOpening.current.windowIndex] = {
          ...newWindows[draggingOpening.current.windowIndex],
          position: clampedFraction,
        };
        useConfigStore.getState().updateBuildingWall(
          draggingOpening.current.buildingId,
          wallConfigKey as WallId,
          { windows: newWindows },
        );
      }
      return;
    }

    // --- Existing move handling ---
    if (!dragBuildingId.current || !dragStartWorld.current) return;

    const down = pointerDownScreen.current;
    if (down && !dragging.current) {
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      if (dx * dx + dy * dy < DRAG_DEAD_ZONE_SQ) return; // 5px dead zone
      dragging.current = true;
      setDraggedBuildingId(dragBuildingId.current);
      useConfigStore.temporal.getState().pause();
    }
    if (!dragging.current) return;

    const svg = svgRef.current;
    if (!svg) return;

    const [wx, wz] = clientToWorld(svg, e.clientX, e.clientY);
    const dx = wx - dragStartWorld.current[0];
    const dz = wz - dragStartWorld.current[1];

    const allBuildings = useConfigStore.getState().buildings;
    const building = allBuildings.find(b => b.id === dragBuildingId.current);
    if (!building) return;

    // Group drag: move all selected buildings
    if (groupDragStartPositions.current.size > 1) {
      const draggedStartPos = groupDragStartPositions.current.get(dragBuildingId.current!);
      if (!draggedStartPos) return;

      const newDraggedPos: [number, number] = [draggedStartPos[0] + dx, draggedStartPos[1] + dz];

      // Snap only the dragged building
      let snappedDx = dx;
      let snappedDz = dz;

      if (building.type === 'paal') {
        const halfW = building.dimensions.width / 2;
        const halfD = building.dimensions.depth / 2;
        const centerIn: [number, number] = [newDraggedPos[0] + halfW, newDraggedPos[1] + halfD];
        const snapped = detectPoleSnap(
          centerIn,
          allBuildings.filter(b => !groupDragStartPositions.current.has(b.id)),
        );
        // Convert snapped center back to top-left corner for storage.
        const snappedCorner: [number, number] = [snapped.center[0] - halfW, snapped.center[1] - halfD];
        snappedDx = snappedCorner[0] - draggedStartPos[0];
        snappedDz = snappedCorner[1] - draggedStartPos[1];
        setPoleAttachment(building.id, snapped.attachedTo);
      } else if (building.type === 'muur') {
        const snapped = detectWallSnap(
          newDraggedPos,
          building.dimensions.width,
          building.orientation,
          allBuildings.filter(b => !groupDragStartPositions.current.has(b.id)),
        );
        snappedDx = snapped.position[0] - draggedStartPos[0];
        snappedDz = snapped.position[1] - draggedStartPos[1];
        setPoleAttachment(building.id, snapped.attachedTo);
      } else {
        const others = allBuildings.filter(b => !groupDragStartPositions.current.has(b.id) && b.type !== 'paal' && b.type !== 'muur');
        const tempBuilding = { ...building, position: newDraggedPos };
        const { snappedPosition } = detectSnap(tempBuilding, others);
        snappedDx = snappedPosition[0] - draggedStartPos[0];
        snappedDz = snappedPosition[1] - draggedStartPos[1];
      }

      // Apply snapped delta to all selected buildings
      const updates: { id: string; position: [number, number] }[] = [];
      for (const [id, startPos] of groupDragStartPositions.current) {
        updates.push({ id, position: [startPos[0] + snappedDx, startPos[1] + snappedDz] });
      }
      useConfigStore.getState().updateBuildingPositions(updates);
    } else {
      // Single building drag (existing behavior)
      const newPos: [number, number] = [
        dragStartPos.current[0] + dx,
        dragStartPos.current[1] + dz,
      ];

      if (building.type === 'paal') {
        const halfW = building.dimensions.width / 2;
        const halfD = building.dimensions.depth / 2;
        const centerIn: [number, number] = [newPos[0] + halfW, newPos[1] + halfD];
        const snapped = detectPoleSnap(
          centerIn,
          allBuildings.filter(b => b.id !== building.id),
        );
        updateBuildingPosition(building.id, [snapped.center[0] - halfW, snapped.center[1] - halfD]);
        setPoleAttachment(building.id, snapped.attachedTo);
      } else if (building.type === 'muur') {
        const snapped = detectWallSnap(
          newPos,
          building.dimensions.width,
          building.orientation,
          allBuildings.filter(b => b.id !== building.id),
        );
        updateBuildingPosition(building.id, snapped.position);
        setPoleAttachment(building.id, snapped.attachedTo);
      } else {
        const others = allBuildings.filter(b => b.id !== building.id && b.type !== 'paal' && b.type !== 'muur');
        const tempBuilding = { ...building, position: newPos };
        const { snappedPosition, newConnections } = detectSnap(tempBuilding, others);
        updateBuildingPosition(building.id, snappedPosition);
        setConnections(newConnections);
      }
    }
  }, [isElevationMode, updateBuildingPosition, setPoleAttachment, updateBuildingDimensions, setConnections, setDraggedBuildingId]);

  const onPointerUp = useCallback(() => {
    // --- Selection rectangle commit ---
    if (selectRectAnchor.current) {
      const rect = selectRectRef.current;
      if (rect) {
        const { x, y, w, h } = rect;
        const allBuildings = useConfigStore.getState().buildings;
        const hits = allBuildings.filter(b => {
          const [bx, by, bw, bh] = getBuildingAABB(b);
          return rectsOverlap(x, y, w, h, bx, by, bw, bh);
        });
        if (hits.length > 0) {
          useUIStore.getState().selectBuildings(hits.map(b => b.id));
        } else {
          useUIStore.getState().selectBuildings([]);
        }
      } else {
        // Click on empty space (no drag) — deselect
        useUIStore.getState().selectBuildings([]);
      }
      selectRectAnchor.current = null;
      selectRectRef.current = null;
      pointerDownScreen.current = null;
      setSelectRect(null);
      setFrozenViewBox(null);
      return;
    }

    // --- Pole drag cleanup ---
    if (draggingPole.current) {
      if (polePreview) {
        const { buildingId, side, index, fraction } = polePreview;
        const building = useConfigStore.getState().buildings.find(b => b.id === buildingId);
        if (building) {
          const current = building.poles ?? autoPoleLayout(building.dimensions.width, building.dimensions.depth);
          const nextSide = [...current[side]];
          nextSide[index] = fraction;
          // Dedupe: if the dragged pole lands within a small epsilon of any
          // other pole on this side, drop the duplicate so we never persist
          // two poles at the same x/z.
          const EPS = 0.005; // fraction — ~2cm on a 4m side
          const deduped: number[] = [];
          for (const f of nextSide.sort((a, b) => a - b)) {
            if (deduped.length === 0 || Math.abs(f - deduped[deduped.length - 1]) > EPS) {
              deduped.push(f);
            }
          }
          useConfigStore.getState().updateBuildingPoles(buildingId, {
            ...current,
            [side]: deduped,
          });
        }
        useConfigStore.temporal.getState().resume();
      }
      draggingPole.current = null;
      setPolePreview(null);
      pointerDownScreen.current = null;
      setFrozenViewBox(null);
      return;
    }

    // --- Opening drag cleanup ---
    if (draggingOpening.current) {
      if (openingDragPreview) {
        const { buildingId, wallId, type, windowIndex, fraction } = openingDragPreview;

        // For vertical muur, wallId 'left' maps to config key 'front'
        const building = useConfigStore.getState().buildings.find(b => b.id === buildingId);
        const isMuur = building?.type === 'muur';
        const isVertMuur = isMuur && building?.orientation === 'vertical';
        const wallConfigKey = isVertMuur && wallId === 'left' ? 'front' : wallId;

        if (type === 'door') {
          updateBuildingWall(buildingId, wallConfigKey as WallId, { doorPosition: fraction });
        } else if (type === 'window' && windowIndex !== undefined) {
          const wallCfg = building?.walls[wallConfigKey];
          if (wallCfg) {
            const newWindows = [...(wallCfg.windows ?? [])];
            newWindows[windowIndex] = { ...newWindows[windowIndex], position: fraction };
            updateBuildingWall(buildingId, wallConfigKey as WallId, { windows: newWindows });
          }
        }
        useConfigStore.temporal.getState().resume();
      }
      draggingOpening.current = null;
      setOpeningDragPreview(null);
      pointerDownScreen.current = null;
      setFrozenViewBox(null);
      return;
    }

    // --- Resize cleanup ---
    if (resizeBuildingId.current) {
      if (resizing.current) {
        useConfigStore.temporal.getState().resume();
      } else {
        selectBuilding(resizeBuildingId.current);
      }
      resizing.current = false;
      resizeBuildingId.current = null;
      resizeEdge.current = null;
      resizeStartWorld.current = null;
      pointerDownScreen.current = null;
      setFrozenViewBox(null);
      return;
    }

    // --- Existing move cleanup ---
    if (dragging.current) {
      useConfigStore.temporal.getState().resume();
      setDraggedBuildingId(null);

      // Re-evaluate snap connections after group move
      if (groupDragStartPositions.current.size > 1) {
        const allBuildings = useConfigStore.getState().buildings;
        // Rebuild all connections by checking each non-pole/non-muur building
        let allConnections: SnapConnection[] = [];
        const structuralBuildings = allBuildings.filter(b => b.type !== 'paal' && b.type !== 'muur');
        for (const building of structuralBuildings) {
          const others = structuralBuildings.filter(b => b.id !== building.id);
          const { newConnections } = detectSnap(building, others);
          // Merge without duplicates
          for (const nc of newConnections) {
            const exists = allConnections.some(
              c => (c.buildingAId === nc.buildingAId && c.sideA === nc.sideA && c.buildingBId === nc.buildingBId && c.sideB === nc.sideB) ||
                   (c.buildingAId === nc.buildingBId && c.sideA === nc.sideB && c.buildingBId === nc.buildingAId && c.sideB === nc.sideA),
            );
            if (!exists) allConnections.push(nc);
          }
        }
        setConnections(allConnections);
      }

      groupDragStartPositions.current = new Map();
    } else if (dragBuildingId.current) {
      if (shiftOnDown.current) {
        useUIStore.getState().toggleBuildingSelection(dragBuildingId.current);
      } else {
        const clicked = useConfigStore.getState().buildings.find(b => b.id === dragBuildingId.current);
        if (clicked?.type === 'muur' && wallElevationEnabled) {
          // Wall elevation view (per-tenant feature flag, off by default).
          // When disabled, a single click on a muur selects the entity like
          // any other building.
          useUIStore.getState().selectElement({ type: 'wall', id: 'front', buildingId: clicked.id });
        } else {
          selectBuilding(dragBuildingId.current);
        }
      }
    }
    dragging.current = false;
    dragBuildingId.current = null;
    dragStartWorld.current = null;
    pointerDownScreen.current = null;
    setFrozenViewBox(null);
  }, [selectBuilding, setDraggedBuildingId, setConnections, updateBuildingWall, openingDragPreview, polePreview]);

  // Escape handling moved into the central `useConfiguratorShortcuts`
  // registry mounted by ConfiguratorClient.

  // Bypass React's synthetic event delegation for move/up. Native window
  // listeners fire reliably regardless of which SVG element the gesture
  // started on or what React re-renders during the drag — including the
  // edge case where iOS Safari drops React-managed pointermove deliveries
  // when the captured target's subtree is reconciled mid-gesture.
  // Refs keep the handlers fresh across renders without re-binding the
  // window listeners (which would lose any in-flight gesture).
  const moveRef = useRef(onPointerMove);
  const upRef = useRef(onPointerUp);
  moveRef.current = onPointerMove;
  upRef.current = onPointerUp;

  useEffect(() => {
    function handleMove(e: PointerEvent) {
      moveRef.current(e as unknown as React.PointerEvent);
    }
    function handleUp() {
      upRef.current();
    }
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, []);

  const onSvgPointerDown = useCallback((e: React.PointerEvent) => {
    if (isElevationMode) return;
    if (e.target !== svgRef.current) return;
    if (e.button !== 0) return;

    const svg = svgRef.current;
    if (!svg) return;

    captureOnSvg(svgRef.current, e);
    pointerDownScreen.current = { x: e.clientX, y: e.clientY };
    selectRectAnchor.current = clientToWorld(svg, e.clientX, e.clientY);
    setFrozenViewBox(computedViewBox);
  }, [isElevationMode, computedViewBox]);

  // --- HTML drag-and-drop handlers (sidebar catalog → canvas) ---

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/building-type')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragGhost({ x: e.clientX, y: e.clientY });
  }, []);

  const onDragLeave = useCallback(() => {
    setDragGhost(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    setDragGhost(null);
    const type = e.dataTransfer.getData('application/building-type') as BuildingType;
    if (!type) return;
    e.preventDefault();

    const svg = svgRef.current;
    if (!svg) return;

    const [wx, wz] = clientToWorld(svg, e.clientX, e.clientY);
    const newId = addBuilding(type, [wx, wz]);

    // Run snap detection on the newly placed building
    const allBuildings = useConfigStore.getState().buildings;
    const building = allBuildings.find(b => b.id === newId);
    if (!building) return;

    if (building.type === 'paal') {
      const halfW = building.dimensions.width / 2;
      const halfD = building.dimensions.depth / 2;
      const centerIn: [number, number] = [building.position[0] + halfW, building.position[1] + halfD];
      const snapped = detectPoleSnap(
        centerIn,
        allBuildings.filter(b => b.id !== newId),
      );
      updateBuildingPosition(newId, [snapped.center[0] - halfW, snapped.center[1] - halfD]);
      setPoleAttachment(newId, snapped.attachedTo);
    } else if (building.type === 'muur') {
      const snapped = detectWallSnap(
        building.position,
        building.dimensions.width,
        building.orientation,
        allBuildings.filter(b => b.id !== newId),
      );
      updateBuildingPosition(newId, snapped.position);
      setPoleAttachment(newId, snapped.attachedTo);
    } else {
      const others = allBuildings.filter(b => b.id !== newId && b.type !== 'paal' && b.type !== 'muur');
      const { snappedPosition, newConnections } = detectSnap(building, others);
      updateBuildingPosition(newId, snappedPosition);
      setConnections(newConnections);
    }

    selectBuilding(newId);
  }, [addBuilding, updateBuildingPosition, setPoleAttachment, setConnections, selectBuilding]);

  const onWallClick = useCallback((wallId: WallId, buildingId: string) => {
    if (!wallElevationEnabled) return;
    useUIStore.getState().selectElement({ type: 'wall', id: wallId, buildingId });
  }, [wallElevationEnabled]);

  return (
    <div
      className="flex flex-col h-full p-6 relative"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      // Defence-in-depth so a touch that drifts onto the wrapper during
      // a drag isn't reclaimed by the browser as a pan gesture.
      style={{ touchAction: 'none' }}
    >
      <div className="flex-1 min-h-0 flex items-center justify-center" style={{ touchAction: 'none' }}>
        <svg
          ref={svgRef}
          viewBox={isElevationMode ? elevationViewBox : activeViewBox}
          className="schematic-svg w-full h-full select-none"
          // Move/up/cancel are handled by native window listeners (above) for
          // touch reliability — React's delegated SVG listeners can drop
          // events mid-drag when the subtree re-renders heavily on iPad.
          onPointerDown={onSvgPointerDown}
          style={{
            cursor: (dragging.current || draggingOpening.current) ? 'grabbing' : undefined,
            // Prevent the browser from claiming the gesture as a pan/zoom
            // mid-drag on touch devices. Without this, Safari/Chrome on
            // iPad cancel the pointer stream as soon as horizontal
            // movement looks like a scroll.
            touchAction: 'none',
          }}
        >
          {!isElevationMode && (
          <>
          {/* Defs: diagonal hatch for overkapping */}
          <defs>
            <pattern
              id="hatch-overkapping"
              width={0.3}
              height={0.3}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1={0} y1={0} x2={0} y2={0.3} stroke="#ddd" strokeWidth={0.02} />
            </pattern>
          </defs>

          {normalBuildings.map((b) => {
            const [ox, oz] = b.position;
            const { width, depth } = b.dimensions;
            const connected = getConnectedSides(b.id, connections);
            const hasWalls = Object.keys(b.walls).length > 0;

            // Compute outward door arc extent for dimension line clearance
            const outwardArcR = (side: WallSide) => {
              const w = b.walls[side];
              if (!w?.hasDoor || w.doorSwing !== 'naar_buiten') return 0;
              return w.doorSize === 'dubbel' ? DOUBLE_DOOR_W / 2 : DOOR_W;
            };
            const rightArc = outwardArcR('right');
            const frontArc = outwardArcR('front');
            const isSelected = selectedBuildingIds.includes(b.id) || previewSelectedIds.has(b.id);

            return (
              <g
                key={b.id}
                className={isSelected ? 'schematic-selected' : undefined}
                onPointerDown={(e) => onBuildingPointerDown(e, b.id)}
              >
                {/* Invisible hit target for drag — covers the full building
                    rect. Pointerdown on walls/openings/poles bubbles up to
                    the parent <g> handler above; children that need their
                    own gesture (resize handles, opening drag, pole drag)
                    stopPropagation so this fallback only fires for "click
                    anywhere on the building" cases. */}
                <rect
                  x={ox}
                  y={oz}
                  width={width}
                  height={depth}
                  fill="transparent"
                  stroke="none"
                  style={{ cursor: 'grab' }}
                />

                {/* Building fill */}
                <rect
                  x={ox}
                  y={oz}
                  width={width}
                  height={depth}
                  fill={b.type === 'berging' ? '#f0ebe4' : 'url(#hatch-overkapping)'}
                  stroke="none"
                  pointerEvents="none"
                />

                {/* Building outline */}
                <rect
                  x={ox}
                  y={oz}
                  width={width}
                  height={depth}
                  fill="none"
                  stroke={isSelected ? '#3b82f6' : (b.type === 'berging' ? '#999' : '#bbb')}
                  strokeWidth={isSelected ? 0.06 : (b.type === 'berging' ? 0.03 : 0.02)}
                  strokeDasharray={b.type === 'overkapping' && !isSelected ? '0.12 0.06' : undefined}
                  pointerEvents="none"
                />

                {/* Posts */}
                <g pointerEvents="none">
                  <SchematicPosts
                    width={width}
                    depth={depth}
                    offsetX={ox + width / 2}
                    offsetY={oz + depth / 2}
                    poles={b.poles}
                  />
                </g>

                {/* Pole handles + visible add/remove controls for overkappingen.
                    Only shown when the overkapping is selected so they don't
                    clutter the canvas. */}
                {b.type === 'overkapping' && isSelected && (() => {
                  const layout = b.poles ?? autoPoleLayout(width, depth);
                  const HANDLE_R = 0.18;
                  const ADD_R = 0.12;
                  const MIN_GAP = 0.8; // don't show "+" if gap is smaller than this

                  const addPole = (
                    side: 'front'|'back'|'left'|'right',
                    fraction: number,
                  ) => {
                    const clamped = Math.max(0.02, Math.min(0.98, fraction));
                    const EPS = 0.005;
                    const merged: number[] = [];
                    for (const f of [...layout[side], clamped].sort((a, b) => a - b)) {
                      if (merged.length === 0 || Math.abs(f - merged[merged.length - 1]) > EPS) {
                        merged.push(f);
                      }
                    }
                    useConfigStore.getState().updateBuildingPoles(b.id, { ...layout, [side]: merged });
                  };
                  const removePole = (side: 'front'|'back'|'left'|'right', index: number) => {
                    const next = [...layout[side]];
                    next.splice(index, 1);
                    useConfigStore.getState().updateBuildingPoles(b.id, { ...layout, [side]: next });
                  };

                  const isPreviewMatch = (side: 'front'|'back'|'left'|'right', idx: number) =>
                    polePreview && polePreview.buildingId === b.id && polePreview.side === side && polePreview.index === idx;

                  // Geometry: map a side + fraction to an (sx, sy) screen point
                  const sidePoint = (side: 'front'|'back'|'left'|'right', fraction: number): [number, number] => {
                    if (side === 'front') return [ox + fraction * width, oz];
                    if (side === 'back') return [ox + fraction * width, oz + depth];
                    if (side === 'left') return [ox, oz + fraction * depth];
                    return [ox + width, oz + fraction * depth];
                  };

                  const isHoveredPole = (side: 'front'|'back'|'left'|'right', idx: number) =>
                    hoveredPole && hoveredPole.buildingId === b.id && hoveredPole.side === side && hoveredPole.index === idx;

                  const handlesFor = (side: 'front'|'back'|'left'|'right') => {
                    const fracs = layout[side];
                    const horizontal = side === 'front' || side === 'back';
                    // How far outward (away from building center) to place the × button
                    const X_OFFSET = 0.45;
                    const X_R = 0.14;
                    return fracs.map((f, i) => {
                      const preview = isPreviewMatch(side, i) ? polePreview!.fraction : f;
                      const [cx, cy] = sidePoint(side, preview);
                      const cursor = horizontal ? 'ew-resize' : 'ns-resize';
                      const active = isPreviewMatch(side, i);
                      const hovered = isHoveredPole(side, i);
                      // × button position — nudged outside the building edge
                      const xCx =
                        side === 'left' ? cx - X_OFFSET :
                        side === 'right' ? cx + X_OFFSET : cx;
                      const xCy =
                        side === 'front' ? cy - X_OFFSET :
                        side === 'back' ? cy + X_OFFSET : cy;
                      return (
                        <g
                          key={`h-${side}-${i}`}
                          onPointerEnter={() => setHoveredPole({ buildingId: b.id, side, index: i })}
                          onPointerLeave={() => setHoveredPole(prev => (prev && prev.buildingId === b.id && prev.side === side && prev.index === i ? null : prev))}
                        >
                          {/* Visible handle dot */}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={HANDLE_R}
                            fill={active ? '#3b82f6' : '#ffffff'}
                            stroke="#3b82f6"
                            strokeWidth={0.04}
                            pointerEvents="none"
                          />
                          {/* Hit target (larger, drives the drag) */}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={HANDLE_R * 1.8}
                            fill="transparent"
                            style={{ cursor }}
                            onPointerDown={(e) => onPolePointerDown(e, { buildingId: b.id, side, index: i })}
                          >
                            <title>Versleep om te verplaatsen</title>
                          </circle>
                          {/* × remove button — appears on hover */}
                          {hovered && !active && (
                            <g style={{ cursor: 'pointer' }}>
                              <circle
                                cx={xCx}
                                cy={xCy}
                                r={X_R}
                                fill="#ffffff"
                                stroke="#ef4444"
                                strokeWidth={0.035}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); removePole(side, i); }}
                              >
                                <title>Paal verwijderen</title>
                              </circle>
                              <line x1={xCx - X_R * 0.45} y1={xCy - X_R * 0.45} x2={xCx + X_R * 0.45} y2={xCy + X_R * 0.45} stroke="#ef4444" strokeWidth={0.035} strokeLinecap="round" pointerEvents="none" />
                              <line x1={xCx - X_R * 0.45} y1={xCy + X_R * 0.45} x2={xCx + X_R * 0.45} y2={xCy - X_R * 0.45} stroke="#ef4444" strokeWidth={0.035} strokeLinecap="round" pointerEvents="none" />
                            </g>
                          )}
                        </g>
                      );
                    });
                  };

                  // Subtle dimension lines between adjacent pole positions (and corners).
                  const measurementsFor = (side: 'front'|'back'|'left'|'right') => {
                    const fracs = layout[side];
                    const effective = fracs
                      .map((f, i) => (isPreviewMatch(side, i) ? polePreview!.fraction : f))
                      .slice()
                      .sort((a, b) => a - b);
                    const edgeLen = (side === 'front' || side === 'back') ? width : depth;
                    const bookended = [0, ...effective, 1];
                    // Without intermediate posts there's a single "gap"
                    // covering the whole edge — that number is already
                    // shown by the per-building width/depth dimension,
                    // so suppress it here to avoid duplicates.
                    if (bookended.length <= 2) return [] as React.ReactNode[];
                    const horizontal = side === 'front' || side === 'back';
                    // Offset the dimension line outward from the building edge.
                    // Positive in our helpers = below/right.
                    const DIM_OFFSET = 0.35;
                    const TICK = 0.07;
                    const TEXT_GAP = 0.14;
                    // Outward direction sign
                    const outward =
                      side === 'front' ? -1 :
                      side === 'back' ? 1 :
                      side === 'left' ? -1 : 1;
                    const segments: React.ReactNode[] = [];
                    for (let i = 0; i < bookended.length - 1; i++) {
                      const startF = bookended[i];
                      const endF = bookended[i + 1];
                      const gap = (endF - startF) * edgeLen;
                      if (gap < 0.5) continue;
                      const [sx, sy] = sidePoint(side, startF);
                      const [ex, ey] = sidePoint(side, endF);
                      // Offset endpoints perpendicular to the edge
                      const ox1 = horizontal ? sx : sx + outward * DIM_OFFSET;
                      const oy1 = horizontal ? sy + outward * DIM_OFFSET : sy;
                      const ox2 = horizontal ? ex : ex + outward * DIM_OFFSET;
                      const oy2 = horizontal ? ey + outward * DIM_OFFSET : ey;
                      const tx = (ox1 + ox2) / 2;
                      const ty = (oy1 + oy2) / 2;
                      // Label offset a touch further outward from the line so text
                      // doesn't sit on top of it.
                      const lx = horizontal ? tx : tx + outward * TEXT_GAP;
                      const ly = horizontal ? ty + outward * TEXT_GAP : ty;
                      const angle = horizontal ? 0 : -90;
                      segments.push(
                        <g key={`m-${side}-${i}`} stroke="#cbd5e1" strokeWidth={0.02} pointerEvents="none">
                          {/* Dimension line */}
                          <line x1={ox1} y1={oy1} x2={ox2} y2={oy2} />
                          {/* Perpendicular ticks at each end */}
                          {horizontal ? (
                            <>
                              <line x1={ox1} y1={oy1 - TICK} x2={ox1} y2={oy1 + TICK} />
                              <line x1={ox2} y1={oy2 - TICK} x2={ox2} y2={oy2 + TICK} />
                            </>
                          ) : (
                            <>
                              <line x1={ox1 - TICK} y1={oy1} x2={ox1 + TICK} y2={oy1} />
                              <line x1={ox2 - TICK} y1={oy2} x2={ox2 + TICK} y2={oy2} />
                            </>
                          )}
                          {/* Label (with a white halo so it's readable over the line) */}
                          <text
                            x={lx}
                            y={ly}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={0.16}
                            fontFamily="system-ui, sans-serif"
                            fill="#64748b"
                            stroke="white"
                            strokeWidth={0.06}
                            paintOrder="stroke"
                            transform={`rotate(${angle}, ${lx}, ${ly})`}
                          >
                            {gap.toFixed(2)}m
                          </text>
                        </g>
                      );
                    }
                    return segments;
                  };

                  // "+" affordances at midpoints of each gap along each side
                  const addMarkersFor = (side: 'front'|'back'|'left'|'right') => {
                    const fracs = [0, ...layout[side], 1];
                    const edgeLen = (side === 'front' || side === 'back') ? width : depth;
                    const markers: React.ReactNode[] = [];
                    for (let i = 0; i < fracs.length - 1; i++) {
                      const gap = (fracs[i + 1] - fracs[i]) * edgeLen;
                      if (gap < MIN_GAP) continue;
                      const mid = (fracs[i] + fracs[i + 1]) / 2;
                      const [cx, cy] = sidePoint(side, mid);
                      markers.push(
                        <g key={`add-${side}-${i}`} style={{ cursor: 'pointer' }}>
                          <line x1={cx - ADD_R * 0.5} y1={cy} x2={cx + ADD_R * 0.5} y2={cy} stroke="#64748b" strokeWidth={0.03} strokeLinecap="round" pointerEvents="none" />
                          <line x1={cx} y1={cy - ADD_R * 0.5} x2={cx} y2={cy + ADD_R * 0.5} stroke="#64748b" strokeWidth={0.03} strokeLinecap="round" pointerEvents="none" />
                          {/* The circle is the hit target — pointerdown stops
                              propagation so the building's drag doesn't fire,
                              and the click handler adds the pole. */}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={ADD_R * 1.4}
                            fill="#ffffff"
                            stroke="#94a3b8"
                            strokeWidth={0.03}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); addPole(side, mid); }}
                          >
                            <title>Paal toevoegen</title>
                          </circle>
                        </g>
                      );
                    }
                    return markers;
                  };

                  return (
                    <g>
                      {(['front','back','left','right'] as const).map(side => (
                        <g key={side}>
                          {measurementsFor(side)}
                          {addMarkersFor(side)}
                          {handlesFor(side)}
                        </g>
                      ))}
                    </g>
                  );
                })()}

                {/* Walls */}
                <g pointerEvents="none">
                  <SchematicWalls
                    dimensions={b.dimensions}
                    walls={b.walls}
                    primaryMaterialId={getEffectivePrimaryMaterial(b, buildings)}
                    selectedElement={selectedElement}
                    buildingId={b.id}
                    offsetX={ox + width / 2}
                    offsetY={oz + depth / 2}
                    onWallClick={onWallClick}
                  />
                </g>

                {/* Per-building width + depth dimensions — emitted by
                    computePlanDimensions and rendered in the unified block
                    below. The local frontArc / rightArc values still drive
                    the wall-label placement and are preserved. */}

                {/* Door and window symbols — rendered after dimensions so
                    naar_buiten arcs aren't clipped by dimension label backgrounds */}
                <g>
                  <SchematicOpenings
                    dimensions={b.dimensions}
                    walls={b.walls}
                    offsetX={ox + width / 2}
                    offsetY={oz + depth / 2}
                    buildingId={b.id}
                    supplierProducts={supplierCatalog.products}
                    onOpeningPointerDown={onOpeningPointerDown}
                    dragPreview={openingDragPreview}
                  />
                </g>

                {/* Building type label */}
                <text
                  x={ox + width / 2}
                  y={oz + depth / 2}
                  fontSize={0.24}
                  fontWeight={500}
                  fontFamily="system-ui, sans-serif"
                  fill={b.type === 'berging' ? '#888' : '#aaa'}
                  textAnchor="middle"
                  dominantBaseline="central"
                  pointerEvents="none"
                >
                  {t(`building.name.${b.type}`)}
                </text>

                {/* Wall labels — only for buildings with walls, skip connected sides */}
                {hasWalls && (
                  <g
                    fontSize={0.16}
                    fontFamily="system-ui, sans-serif"
                    fill="#888"
                    textAnchor="middle"
                    dominantBaseline="central"
                    pointerEvents="none"
                  >
                    {!connected.has('front') && (
                      <text x={ox + width / 2} y={oz + depth + Math.max(0.3, frontArc + 0.15)}>{t('wall.front')}</text>
                    )}
                    {!connected.has('back') && (
                      <text x={ox + width / 2} y={oz - Math.max(0.3, outwardArcR('back') + 0.15)}>{t('wall.back')}</text>
                    )}
                    {!connected.has('left') && (() => {
                      const lx = ox - Math.max(0.3, outwardArcR('left') + 0.15);
                      return (
                        <text
                          x={lx}
                          y={oz + depth / 2}
                          transform={`rotate(-90, ${lx}, ${oz + depth / 2})`}
                        >
                          {t('wall.left')}
                        </text>
                      );
                    })()}
                    {!connected.has('right') && (() => {
                      const rx = ox + width + Math.max(0.3, rightArc + 0.15);
                      return (
                        <text
                          x={rx}
                          y={oz + depth / 2}
                          transform={`rotate(90, ${rx}, ${oz + depth / 2})`}
                        >
                          {t('wall.right')}
                        </text>
                      );
                    })()}
                  </g>
                )}
              </g>
            );
          })}

          {/* Standalone walls — rendered between buildings and poles */}
          {walls.map((w) => {
            const [ox, oz] = w.position;
            const isHorizontal = w.orientation === 'horizontal';
            const isSelected = selectedBuildingIds.includes(w.id) || previewSelectedIds.has(w.id);

            // Coordinate mapping for SchematicWalls/SchematicOpenings:
            // These components use getWallGeometries() which positions walls at the building edge
            // (e.g. 'front' at cy + depth/2, 'left' at cx - width/2). For a standalone wall we
            // want the rendered line centered on the entity position, so we compensate with an
            // offset of -depth/2 (horizontal) or +width/2 (vertical).
            // For vertical muur we swap width↔depth and remap 'front' config → 'left' wallId
            // so the wall renders vertically with correct door/window placement.
            const schematicDims = isHorizontal
              ? w.dimensions
              : { width: w.dimensions.depth, depth: w.dimensions.width, height: w.dimensions.height };
            const schematicWalls = isHorizontal
              ? w.walls
              : { left: w.walls['front'] };
            // Offset: child components expect center-based offsets
            const wallOffsetX = isHorizontal ? ox + w.dimensions.width / 2 : ox + w.dimensions.depth;
            const wallOffsetY = isHorizontal ? oz : oz + w.dimensions.width / 2;

            // Visual dimensions after orientation
            const wallW = isHorizontal ? w.dimensions.width : w.dimensions.depth;
            const wallD = isHorizontal ? w.dimensions.depth : w.dimensions.width;
            // Enlarged hit target (0.5m min on each axis) so thin walls are
            // easy to click/drag in either orientation. Kept in sync with
            // getBuildingAABB so visible hit target == selection footprint.
            const hitW = Math.max(wallW, MUUR_SELECT_MIN_THICKNESS);
            const hitH = Math.max(wallD, MUUR_SELECT_MIN_THICKNESS);
            const hitOffsetX = (hitW - wallW) / 2;
            const hitOffsetY = (hitH - wallD) / 2;

            return (
              <g
                key={w.id}
                className={isSelected ? 'schematic-selected' : undefined}
                onPointerDown={(e) => onBuildingPointerDown(e, w.id)}
              >
                {/* Enlarged invisible hit target — visible "grab" cursor
                    + double-click to rotate. Pointerdown handling lives
                    on the parent <g> so any element inside the muur
                    (including the dimension chain ticks if a finger
                    happens to land on one) still initiates a drag. */}
                <rect
                  x={ox - hitOffsetX}
                  y={oz - hitOffsetY}
                  width={hitW}
                  height={hitH}
                  fill="transparent"
                  stroke="none"
                  style={{ cursor: 'grab' }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setOrientation(w.id, isHorizontal ? 'vertical' : 'horizontal');
                  }}
                />

                {/* Wall segments with door/window gaps — no onWallClick so the
                    outer hit target handles click-vs-drag uniformly */}
                <g pointerEvents="none">
                  <SchematicWalls
                    dimensions={schematicDims}
                    walls={schematicWalls}
                    primaryMaterialId={getEffectivePrimaryMaterial(w, buildings)}
                    selectedElement={selectedElement}
                    buildingId={w.id}
                    offsetX={wallOffsetX}
                    offsetY={wallOffsetY}
                  />
                </g>

                {/* Muur length dimension — emitted by computePlanDimensions
                    in the unified block below. */}

                {/* Door and window symbols — after dimensions so arcs aren't clipped */}
                <g>
                  <SchematicOpenings
                    dimensions={schematicDims}
                    walls={schematicWalls}
                    offsetX={wallOffsetX}
                    offsetY={wallOffsetY}
                    buildingId={w.id}
                    supplierProducts={supplierCatalog.products}
                    onOpeningPointerDown={onOpeningPointerDown}
                    dragPreview={openingDragPreview}
                  />
                </g>

                {/* Wall type label */}
                <text
                  x={ox + wallW / 2}
                  y={isHorizontal ? oz + wallD / 2 - 0.25 : oz + wallD / 2}
                  fontSize={0.18}
                  fontWeight={500}
                  fontFamily="system-ui, sans-serif"
                  fill="#999"
                  textAnchor="middle"
                  dominantBaseline="central"
                  pointerEvents="none"
                >
                  {t(`building.name.${w.type}`)}
                </text>
              </g>
            );
          })}

          {/* Poles as small filled squares — rendered after buildings so they're on top */}
          {poles.map((p) => {
            const s = 0.18;
            const cx = p.position[0] + p.dimensions.width / 2;
            const cz = p.position[1] + p.dimensions.depth / 2;
            const isSelected = selectedBuildingIds.includes(p.id) || previewSelectedIds.has(p.id);
            const poleColor = getAtomColor(materials, getEffectivePrimaryMaterial(p, buildings), 'wall');
            return (
              <g
                key={p.id}
                className={isSelected ? 'schematic-selected' : undefined}
              >
                <rect
                  x={cx - s / 2}
                  y={cz - s / 2}
                  width={s}
                  height={s}
                  fill={poleColor}
                  stroke={isSelected ? '#3b82f6' : '#666'}
                  strokeWidth={isSelected ? 0.04 : 0.02}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => onBuildingPointerDown(e, p.id)}
                />
              </g>
            );
          })}

          {/* Connection edge indicators */}
          {connectionEdges.map((edge, i) => (
            <line
              key={`conn-${i}`}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke={edge.isOpen ? '#3b82f6' : '#888'}
              strokeWidth={0.04}
              strokeDasharray={edge.isOpen ? '0.12 0.08' : undefined}
              pointerEvents="none"
            />
          ))}

          {/* Resize handles on every selected non-paal building.
              Single-select: handles are interactive (drag to resize).
              Multi-select: handles render as visual indicators only — they
              show which entities are in the selection without offering a
              per-handle resize that wouldn't apply to the whole group. */}
          {(() => {
            const isMulti = selectedBuildingIds.length > 1;
            return selectedBuildingIds
              .map((id) => buildings.find((b) => b.id === id))
              .filter((b): b is BuildingEntity => !!b && b.type !== 'paal')
              .map((b) => (
                <ResizeHandles
                  key={b.id}
                  building={b}
                  onResizePointerDown={onResizePointerDown}
                  interactive={!isMulti}
                />
              ));
          })()}

          {/* Selection rectangle — marching ants */}
          {selectRect && (
            <rect
              x={selectRect.x}
              y={selectRect.y}
              width={selectRect.w}
              height={selectRect.h}
              fill="rgba(255,255,255,0.03)"
              stroke="#3b82f6"
              strokeWidth={0.04}
              strokeDasharray="0.12 0.12"
              pointerEvents="none"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="0"
                to="0.24"
                dur="0.4s"
                repeatCount="indefinite"
              />
            </rect>
          )}

          {/* All dimension lines — single unified block driven by the
              dimension registry. computePlanDimensions handles
              context-aware suppression (per-building hidden when only one
              structural; totals likewise) and emits opening-gap chains
              for any wall with door/windows. The local arc-clearance pass
              preserves the legacy door-swing-clearance behaviour for
              per-building lines. */}
          <g pointerEvents="none">
            {adjustedPlanLines.map((d) => (
              <DimensionLine
                key={`${d.id}|${d.groupKey ?? ''}|${d.x1.toFixed(3)},${d.y1.toFixed(3)}->${d.x2.toFixed(3)},${d.y2.toFixed(3)}`}
                x1={d.x1}
                y1={d.y1}
                x2={d.x2}
                y2={d.y2}
                offset={d.offset}
                label={d.label}
                compact={d.id === 'wall.openingGaps.plan'}
              />
            ))}
          </g>
          </>
          )}

          {isElevationMode && selectedElement?.type === 'wall' && (
            <WallElevation
              buildingId={selectedElement.buildingId}
              wallId={selectedElement.id}
            />
          )}
        </svg>
      </div>

      {/* Ghost preview during drag-and-drop from sidebar */}
      {dragGhost && (
        <div
          className="pointer-events-none fixed"
          style={{
            left: dragGhost.x - 40,
            top: dragGhost.y - 30,
            width: 80,
            height: 60,
            border: '2px dashed #3b82f6',
            borderRadius: 6,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
          }}
        />
      )}
    </div>
  );
}
