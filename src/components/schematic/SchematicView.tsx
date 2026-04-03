'use client';

import { useRef, useMemo, useState, useCallback } from 'react';
import { useConfigStore } from '@/store/useConfigStore';
import { detectSnap, detectPoleSnap, detectWallSnap, detectResizeSnap } from '@/lib/snap';
import { getConstraints } from '@/lib/constants';
import { t } from '@/lib/i18n';
import SchematicPosts from './SchematicPosts';
import SchematicWalls from './SchematicWalls';
import SchematicOpenings from './SchematicOpenings';
import DimensionLine from './DimensionLine';
import type { BuildingType, WallSide, SnapConnection, BuildingEntity } from '@/types/building';

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
  const selectedBuildingIds = useConfigStore((s) => s.selectedBuildingIds);
  const selectedBuildingId = useConfigStore((s) => s.selectedBuildingIds.length === 1 ? s.selectedBuildingIds[0] : null);
  const selectBuilding = useConfigStore((s) => s.selectBuilding);
  const updateBuildingPosition = useConfigStore((s) => s.updateBuildingPosition);
  const setConnections = useConfigStore((s) => s.setConnections);
  const setDraggedBuildingId = useConfigStore((s) => s.setDraggedBuildingId);
  const setOrientation = useConfigStore((s) => s.setOrientation);
  const addBuilding = useConfigStore((s) => s.addBuilding);
  const updateBuildingDimensions = useConfigStore((s) => s.updateBuildingDimensions);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const dragBuildingId = useRef<string | null>(null);
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

  // Freeze viewBox during drag to prevent coordinate system shifts
  const [frozenViewBox, setFrozenViewBox] = useState<string | null>(null);

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

  const connectionEdges = useMemo(
    () => getConnectionEdges(buildings, connections),
    [buildings, connections],
  );

  // --- Drag handlers ---

  const onBuildingPointerDown = useCallback((e: React.PointerEvent, buildingId: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    const svg = svgRef.current;
    if (!svg) return;

    const building = useConfigStore.getState().buildings.find(b => b.id === buildingId);
    if (!building) return;

    pointerDownScreen.current = { x: e.clientX, y: e.clientY };
    dragStartWorld.current = clientToWorld(svg, e.clientX, e.clientY);
    dragStartPos.current = [...building.position];
    dragBuildingId.current = buildingId;

    setFrozenViewBox(computedViewBox);
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

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    // --- Resize handling ---
    if (resizeBuildingId.current && resizeEdge.current && resizeStartWorld.current) {
      const down = pointerDownScreen.current;
      if (down && !resizing.current) {
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (dx * dx + dy * dy < 25) return;
        resizing.current = true;
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

    // --- Existing move handling ---
    if (!dragBuildingId.current || !dragStartWorld.current) return;

    const down = pointerDownScreen.current;
    if (down && !dragging.current) {
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      if (dx * dx + dy * dy < 25) return; // 5px dead zone
      dragging.current = true;
      setDraggedBuildingId(dragBuildingId.current);
    }
    if (!dragging.current) return;

    const svg = svgRef.current;
    if (!svg) return;

    const [wx, wz] = clientToWorld(svg, e.clientX, e.clientY);
    const dx = wx - dragStartWorld.current[0];
    const dz = wz - dragStartWorld.current[1];
    const newPos: [number, number] = [
      dragStartPos.current[0] + dx,
      dragStartPos.current[1] + dz,
    ];

    const allBuildings = useConfigStore.getState().buildings;
    const building = allBuildings.find(b => b.id === dragBuildingId.current);
    if (!building) return;

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
  }, [updateBuildingPosition, updateBuildingDimensions, setConnections, setDraggedBuildingId]);

  const onPointerUp = useCallback(() => {
    // --- Resize cleanup ---
    if (resizeBuildingId.current) {
      if (!resizing.current) {
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
      setDraggedBuildingId(null);
    } else if (dragBuildingId.current) {
      selectBuilding(dragBuildingId.current);
    }
    dragging.current = false;
    dragBuildingId.current = null;
    dragStartWorld.current = null;
    pointerDownScreen.current = null;
    setFrozenViewBox(null);
  }, [selectBuilding, setDraggedBuildingId]);

  const onSvgPointerDown = useCallback((e: React.PointerEvent) => {
    // Click on empty space — deselect
    if (e.target === svgRef.current) {
      selectBuilding(null);
    }
  }, [selectBuilding]);

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
          viewBox={activeViewBox}
          className="schematic-svg w-full h-full select-none"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerDown={onSvgPointerDown}
          style={{ cursor: dragging.current ? 'grabbing' : undefined }}
        >
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
            const isSelected = b.id === selectedBuildingId;

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
                  />
                </g>

                {/* Door and window symbols */}
                <g pointerEvents="none">
                  <SchematicOpenings
                    dimensions={b.dimensions}
                    walls={b.walls}
                    offsetX={ox + width / 2}
                    offsetY={oz + depth / 2}
                  />
                </g>

                {/* Per-building width dimension */}
                <g pointerEvents="none">
                  <DimensionLine
                    x1={ox}
                    y1={oz + depth}
                    x2={ox + width}
                    y2={oz + depth}
                    offset={showTotalDimension ? 1.0 : 0.8}
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
                    offset={-0.8}
                    label={`${t('dim.depth')}: ${depth.toFixed(1)}m`}
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
                      <text x={ox + width / 2} y={oz + depth + 0.3}>{t('wall.front')}</text>
                    )}
                    {!connected.has('back') && (
                      <text x={ox + width / 2} y={oz - 0.3}>{t('wall.back')}</text>
                    )}
                    {!connected.has('left') && (
                      <text
                        x={ox - 0.3}
                        y={oz + depth / 2}
                        transform={`rotate(-90, ${ox - 0.3}, ${oz + depth / 2})`}
                      >
                        {t('wall.left')}
                      </text>
                    )}
                    {!connected.has('right') && (
                      <text
                        x={ox + width + 0.3}
                        y={oz + depth / 2}
                        transform={`rotate(90, ${ox + width + 0.3}, ${oz + depth / 2})`}
                      >
                        {t('wall.right')}
                      </text>
                    )}
                  </g>
                )}
              </g>
            );
          })}

          {/* Standalone walls — rendered between buildings and poles */}
          {walls.map((w) => {
            const [ox, oz] = w.position;
            const isHorizontal = w.orientation === 'horizontal';
            const isSelected = w.id === selectedBuildingId;

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
                  />
                </g>

                {/* Door and window symbols */}
                <g pointerEvents="none">
                  <SchematicOpenings
                    dimensions={schematicDims}
                    walls={schematicWalls}
                    offsetX={wallOffsetX}
                    offsetY={wallOffsetY}
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
            const isSelected = p.id === selectedBuildingId;
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
          {selectedBuildingId && (() => {
            const selected = buildings.find(b => b.id === selectedBuildingId);
            if (!selected || selected.type === 'paal') return null;
            return (
              <ResizeHandles
                building={selected}
                onResizePointerDown={onResizePointerDown}
              />
            );
          })()}

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
