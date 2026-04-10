'use client';

import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { useConfigStore, selectSingleBuildingId, getEffectiveHeight } from '@/store/useConfigStore';
import { detectSnap, detectPoleSnap, detectWallSnap, detectResizeSnap } from '@/lib/snap';
import { getConstraints, DOOR_W, DOUBLE_DOOR_W, WIN_W, xToFraction, clampOpeningPosition, fractionToX, getWallLength } from '@/lib/constants';
import { t } from '@/lib/i18n';
import SchematicPosts from './SchematicPosts';
import SchematicWalls, { getWallGeometries } from './SchematicWalls';
import SchematicOpenings from './SchematicOpenings';
import DimensionLine from './DimensionLine';
import type { BuildingType, WallSide, WallId, SnapConnection, BuildingEntity } from '@/types/building';

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

function getBuildingAABB(b: BuildingEntity): [number, number, number, number] {
  const isVertMuur = b.type === 'muur' && b.orientation === 'vertical';
  const w = isVertMuur ? b.dimensions.depth : b.dimensions.width;
  const d = isVertMuur ? b.dimensions.width : b.dimensions.depth;
  return [b.position[0], b.position[1], w, d];
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
}: {
  building: BuildingEntity;
  onResizePointerDown: (e: React.PointerEvent, buildingId: string, edge: 'left' | 'right' | 'top' | 'bottom') => void;
}) {
  const [ox, oz] = building.position;
  const { width, depth } = building.dimensions;
  const r = 0.12;
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
    <g>
      {handles.map((h) => (
        <circle
          key={h.edge}
          cx={h.cx}
          cy={h.cy}
          r={r}
          fill="#3b82f6"
          stroke="white"
          strokeWidth={0.03}
          style={{ cursor: h.cursor }}
          onPointerDown={(e) => onResizePointerDown(e, building.id, h.edge)}
        />
      ))}
    </g>
  );
}

export default function SchematicView() {
  const buildings = useConfigStore((s) => s.buildings);
  const connections = useConfigStore((s) => s.connections);
  const selectedElement = useConfigStore((s) => s.selectedElement);
  const defaultHeight = useConfigStore((s) => s.defaultHeight);
  const isElevationMode = selectedElement?.type === 'wall';
  const selectedBuildingIds = useConfigStore((s) => s.selectedBuildingIds);
  const selectedBuildingId = useConfigStore(selectSingleBuildingId);
  const selectBuilding = useConfigStore((s) => s.selectBuilding);
  const updateBuildingPosition = useConfigStore((s) => s.updateBuildingPosition);
  const setConnections = useConfigStore((s) => s.setConnections);
  const setDraggedBuildingId = useConfigStore((s) => s.setDraggedBuildingId);
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
    const state = useConfigStore.getState();
    if (state.selectedBuildingIds.includes(buildingId) && state.selectedBuildingIds.length > 1) {
      const posMap = new Map<string, [number, number]>();
      for (const id of state.selectedBuildingIds) {
        const b = state.buildings.find(b => b.id === id);
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

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (isElevationMode) return;
    // --- Selection rectangle handling ---
    if (selectRectAnchor.current) {
      const down = pointerDownScreen.current;
      if (down) {
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (dx * dx + dy * dy < 25) return; // 5px dead zone
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
        if (dx * dx + dy * dy < 25) return;
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

    // --- Opening drag handling ---
    if (draggingOpening.current) {
      const down = pointerDownScreen.current;
      if (down) {
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (dx * dx + dy * dy < 25) return; // 5px dead zone
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
      if (dx * dx + dy * dy < 25) return; // 5px dead zone
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
        const snapped = detectPoleSnap(newDraggedPos, allBuildings.filter(b => !groupDragStartPositions.current.has(b.id)));
        snappedDx = snapped[0] - draggedStartPos[0];
        snappedDz = snapped[1] - draggedStartPos[1];
      } else if (building.type === 'muur') {
        const snapped = detectWallSnap(
          newDraggedPos,
          building.dimensions.width,
          building.orientation,
          allBuildings.filter(b => !groupDragStartPositions.current.has(b.id)),
        );
        snappedDx = snapped[0] - draggedStartPos[0];
        snappedDz = snapped[1] - draggedStartPos[1];
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
        const snapped = detectPoleSnap(newPos, allBuildings.filter(b => b.id !== building.id));
        updateBuildingPosition(building.id, snapped);
      } else if (building.type === 'muur') {
        const snapped = detectWallSnap(
          newPos,
          building.dimensions.width,
          building.orientation,
          allBuildings.filter(b => b.id !== building.id),
        );
        updateBuildingPosition(building.id, snapped);
      } else {
        const others = allBuildings.filter(b => b.id !== building.id && b.type !== 'paal' && b.type !== 'muur');
        const tempBuilding = { ...building, position: newPos };
        const { snappedPosition, newConnections } = detectSnap(tempBuilding, others);
        updateBuildingPosition(building.id, snappedPosition);
        setConnections(newConnections);
      }
    }
  }, [isElevationMode, updateBuildingPosition, updateBuildingDimensions, setConnections, setDraggedBuildingId]);

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
          useConfigStore.getState().selectBuildings(hits.map(b => b.id));
        } else {
          useConfigStore.getState().selectBuildings([]);
        }
      } else {
        // Click on empty space (no drag) — deselect
        useConfigStore.getState().selectBuildings([]);
      }
      selectRectAnchor.current = null;
      selectRectRef.current = null;
      pointerDownScreen.current = null;
      setSelectRect(null);
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
        useConfigStore.getState().toggleBuildingSelection(dragBuildingId.current);
      } else {
        selectBuilding(dragBuildingId.current);
      }
    }
    dragging.current = false;
    dragBuildingId.current = null;
    dragStartWorld.current = null;
    pointerDownScreen.current = null;
    setFrozenViewBox(null);
  }, [selectBuilding, setDraggedBuildingId, setConnections, updateBuildingWall, openingDragPreview]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isElevationMode) {
          useConfigStore.getState().selectElement(null);
        } else {
          useConfigStore.getState().selectBuildings([]);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isElevationMode]);

  const onSvgPointerDown = useCallback((e: React.PointerEvent) => {
    if (isElevationMode) return;
    if (e.target !== svgRef.current) return;
    if (e.button !== 0) return;

    const svg = svgRef.current;
    if (!svg) return;

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
      const snapped = detectPoleSnap(building.position, allBuildings.filter(b => b.id !== newId));
      updateBuildingPosition(newId, snapped);
    } else if (building.type === 'muur') {
      const snapped = detectWallSnap(
        building.position,
        building.dimensions.width,
        building.orientation,
        allBuildings.filter(b => b.id !== newId),
      );
      updateBuildingPosition(newId, snapped);
    } else {
      const others = allBuildings.filter(b => b.id !== newId && b.type !== 'paal' && b.type !== 'muur');
      const { snappedPosition, newConnections } = detectSnap(building, others);
      updateBuildingPosition(newId, snappedPosition);
      setConnections(newConnections);
    }

    selectBuilding(newId);
  }, [addBuilding, updateBuildingPosition, setConnections, selectBuilding]);

  const onWallClick = useCallback((wallId: WallId, buildingId: string) => {
    useConfigStore.getState().selectElement({ type: 'wall', id: wallId, buildingId });
  }, []);

  return (
    <div
      className="flex flex-col h-full p-6 relative"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <svg
          ref={svgRef}
          viewBox={isElevationMode ? elevationViewBox : activeViewBox}
          className="schematic-svg w-full h-full select-none"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerDown={onSvgPointerDown}
          style={{ cursor: (dragging.current || draggingOpening.current) ? 'grabbing' : undefined }}
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
              >
                {/* Invisible hit target for drag — covers the full building rect */}
                <rect
                  x={ox}
                  y={oz}
                  width={width}
                  height={depth}
                  fill="transparent"
                  stroke="none"
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => onBuildingPointerDown(e, b.id)}
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
                  <SchematicPosts width={width} depth={depth} offsetX={ox + width / 2} offsetY={oz + depth / 2} />
                </g>

                {/* Walls */}
                <g pointerEvents="none">
                  <SchematicWalls
                    dimensions={b.dimensions}
                    walls={b.walls}
                    selectedElement={selectedElement}
                    buildingId={b.id}
                    offsetX={ox + width / 2}
                    offsetY={oz + depth / 2}
                    onWallClick={onWallClick}
                  />
                </g>

                {/* Per-building width dimension */}
                <g pointerEvents="none">
                  <DimensionLine
                    x1={ox}
                    y1={oz + depth}
                    x2={ox + width}
                    y2={oz + depth}
                    offset={Math.max(showTotalDimension ? 1.0 : 0.8, frontArc + 0.5)}
                    label={`${t('dim.width')}: ${width.toFixed(1)}m`}
                  />
                </g>

                {/* Per-building length dimension */}
                <g pointerEvents="none">
                  <DimensionLine
                    x1={ox + width}
                    y1={oz}
                    x2={ox + width}
                    y2={oz + depth}
                    offset={Math.min(-0.8, -(rightArc + 0.5))}
                    label={`${t('dim.depth')}: ${depth.toFixed(1)}m`}
                  />
                </g>

                {/* Door and window symbols — rendered after dimensions so
                    naar_buiten arcs aren't clipped by dimension label backgrounds */}
                <g>
                  <SchematicOpenings
                    dimensions={b.dimensions}
                    walls={b.walls}
                    offsetX={ox + width / 2}
                    offsetY={oz + depth / 2}
                    buildingId={b.id}
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
            // Enlarged hit target (0.5m min) so thin walls are easy to click/drag
            const hitH = Math.max(wallD, 0.5);
            const hitOffsetY = (hitH - wallD) / 2;

            return (
              <g
                key={w.id}
                className={isSelected ? 'schematic-selected' : undefined}
              >
                {/* Enlarged invisible hit target for drag + double-click to rotate */}
                <rect
                  x={ox}
                  y={oz - hitOffsetY}
                  width={wallW}
                  height={hitH}
                  fill="transparent"
                  stroke="none"
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => onBuildingPointerDown(e, w.id)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setOrientation(w.id, isHorizontal ? 'vertical' : 'horizontal');
                  }}
                />

                {/* Wall segments with door/window gaps */}
                <g pointerEvents="none">
                  <SchematicWalls
                    dimensions={schematicDims}
                    walls={schematicWalls}
                    selectedElement={selectedElement}
                    buildingId={w.id}
                    offsetX={wallOffsetX}
                    offsetY={wallOffsetY}
                    onWallClick={onWallClick}
                  />
                </g>

                {/* Dimension line showing wall length */}
                <g pointerEvents="none">
                  {isHorizontal ? (
                    <DimensionLine
                      x1={ox}
                      y1={oz + wallD / 2}
                      x2={ox + w.dimensions.width}
                      y2={oz + wallD / 2}
                      offset={0.5}
                      label={`${w.dimensions.width.toFixed(1)}m`}
                    />
                  ) : (
                    <DimensionLine
                      x1={ox + wallW}
                      y1={oz}
                      x2={ox + wallW}
                      y2={oz + w.dimensions.width}
                      offset={-0.5}
                      label={`${w.dimensions.width.toFixed(1)}m`}
                    />
                  )}
                </g>

                {/* Door and window symbols — after dimensions so arcs aren't clipped */}
                <g>
                  <SchematicOpenings
                    dimensions={schematicDims}
                    walls={schematicWalls}
                    offsetX={wallOffsetX}
                    offsetY={wallOffsetY}
                    buildingId={w.id}
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
                  fill="#8B6914"
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

          {/* Resize handles on selected building */}
          {selectedBuildingId && selectedBuildingIds.length === 1 && (() => {
            const selected = buildings.find(b => b.id === selectedBuildingId);
            if (!selected || selected.type === 'paal') return null;
            return (
              <ResizeHandles
                building={selected}
                onResizePointerDown={onResizePointerDown}
              />
            );
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

          {/* Total depth dimension — only when multiple connected buildings */}
          {showTotalDimension && (
            <g pointerEvents="none">
              <DimensionLine
                x1={maxX}
                y1={minZ}
                x2={maxX}
                y2={maxZ}
                offset={-2.0}
                label={`${t('dim.depth')}: ${totalD.toFixed(1)}m`}
              />
            </g>
          )}

          {/* Total width dimension spanning all buildings */}
          {showTotalDimension && (
            <g pointerEvents="none">
              <DimensionLine
                x1={minX}
                y1={maxZ}
                x2={maxX}
                y2={maxZ}
                offset={1.8}
                label={`${t('dim.width')}: ${totalW.toFixed(1)}m`}
              />
            </g>
          )}
          </>
          )}

          {isElevationMode && selectedElement?.type === 'wall' && (() => {
            const building = buildings.find(b => b.id === selectedElement.buildingId);
            if (!building) return null;
            const wallLength = getWallLength(selectedElement.id, building.dimensions);
            const wallHeight = getEffectiveHeight(building, defaultHeight);
            return (
              <g>
                <rect x={0} y={0} width={wallLength} height={wallHeight} fill="#f5f0e8" fillOpacity={0.15} stroke="#888" strokeWidth={0.03} rx={0.02} />
                <text x={wallLength / 2} y={wallHeight / 2} textAnchor="middle" dominantBaseline="central" fontSize={0.3} fill="#888" fontFamily="system-ui">
                  {selectedElement.id}
                </text>
              </g>
            );
          })()}
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
