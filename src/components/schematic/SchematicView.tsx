'use client';

import { useRef, useMemo, useState, useCallback } from 'react';
import { useConfigStore } from '@/store/useConfigStore';
import { detectSnap, detectPoleSnap, detectWallSnap } from '@/lib/snap';
import { t } from '@/lib/i18n';
import SchematicPosts from './SchematicPosts';
import SchematicWalls from './SchematicWalls';
import SchematicOpenings from './SchematicOpenings';
import DimensionLine from './DimensionLine';
import type { WallSide, SnapConnection, BuildingEntity } from '@/types/building';

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

    const aLeft = a.position[0] - a.dimensions.width / 2;
    const aRight = a.position[0] + a.dimensions.width / 2;
    const aTop = a.position[1] - a.dimensions.depth / 2;
    const aBottom = a.position[1] + a.dimensions.depth / 2;
    const bLeft = b.position[0] - b.dimensions.width / 2;
    const bRight = b.position[0] + b.dimensions.width / 2;
    const bTop = b.position[1] - b.dimensions.depth / 2;
    const bBottom = b.position[1] + b.dimensions.depth / 2;

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

export default function SchematicView() {
  const buildings = useConfigStore((s) => s.buildings);
  const connections = useConfigStore((s) => s.connections);
  const selectedElement = useConfigStore((s) => s.selectedElement);
  const selectedBuildingId = useConfigStore((s) => s.selectedBuildingId);
  const selectBuilding = useConfigStore((s) => s.selectBuilding);
  const updateBuildingPosition = useConfigStore((s) => s.updateBuildingPosition);
  const setConnections = useConfigStore((s) => s.setConnections);
  const setDraggedBuildingId = useConfigStore((s) => s.setDraggedBuildingId);
  const setAccordionSection = useConfigStore((s) => s.setAccordionSection);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const dragBuildingId = useRef<string | null>(null);
  const dragStartWorld = useRef<[number, number] | null>(null);
  const dragStartPos = useRef<[number, number]>([0, 0]);
  const pointerDownScreen = useRef<{ x: number; y: number } | null>(null);

  // Freeze viewBox during drag to prevent coordinate system shifts
  const [frozenViewBox, setFrozenViewBox] = useState<string | null>(null);

  const normalBuildings = buildings.filter(b => b.type !== 'paal' && b.type !== 'muur');
  const walls = buildings.filter(b => b.type === 'muur');
  const poles = buildings.filter(b => b.type === 'paal');

  // Compute bounding box of all buildings (including poles)
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const b of buildings) {
    const [cx, cz] = b.position;
    const isVertMuur = b.type === 'muur' && b.orientation === 'vertical';
    const bw = isVertMuur ? b.dimensions.depth : b.dimensions.width;
    const bd = isVertMuur ? b.dimensions.width : b.dimensions.depth;
    const hw = bw / 2;
    const hd = bd / 2;
    const pad2 = b.type === 'paal' ? 0.3 : 0;
    minX = Math.min(minX, cx - hw - pad2);
    maxX = Math.max(maxX, cx + hw + pad2);
    minZ = Math.min(minZ, cz - hd - pad2);
    maxZ = Math.max(maxZ, cz + hd + pad2);
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

  const onPointerMove = useCallback((e: React.PointerEvent) => {
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
  }, [updateBuildingPosition, setConnections, setDraggedBuildingId]);

  const onPointerUp = useCallback(() => {
    if (dragging.current) {
      setDraggedBuildingId(null);
    } else if (dragBuildingId.current) {
      // Click (no drag) — select building
      selectBuilding(dragBuildingId.current);
      setAccordionSection(2);
    }
    dragging.current = false;
    dragBuildingId.current = null;
    dragStartWorld.current = null;
    pointerDownScreen.current = null;
    setFrozenViewBox(null);
  }, [selectBuilding, setAccordionSection, setDraggedBuildingId]);

  const onSvgPointerDown = useCallback((e: React.PointerEvent) => {
    // Click on empty space — deselect
    if (e.target === svgRef.current) {
      selectBuilding(buildings[0]?.id ?? null);
    }
  }, [selectBuilding, buildings]);

  return (
    <div className="flex flex-col h-full p-6">
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
            const hw = width / 2;
            const hd = depth / 2;
            const connected = getConnectedSides(b.id, connections);
            const hasWalls = Object.keys(b.walls).length > 0;
            const isSelected = b.id === selectedBuildingId;

            return (
              <g key={b.id}>
                {/* Invisible hit target for drag — covers the full building rect */}
                <rect
                  x={ox - hw}
                  y={oz - hd}
                  width={width}
                  height={depth}
                  fill="transparent"
                  stroke="none"
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => onBuildingPointerDown(e, b.id)}
                />

                {/* Building fill */}
                <rect
                  x={ox - hw}
                  y={oz - hd}
                  width={width}
                  height={depth}
                  fill={b.type === 'berging' ? '#f0ebe4' : 'url(#hatch-overkapping)'}
                  stroke="none"
                  pointerEvents="none"
                />

                {/* Building outline */}
                <rect
                  x={ox - hw}
                  y={oz - hd}
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
                  <SchematicPosts width={width} depth={depth} offsetX={ox} offsetY={oz} />
                </g>

                {/* Walls */}
                <g pointerEvents="none">
                  <SchematicWalls
                    dimensions={b.dimensions}
                    walls={b.walls}
                    selectedElement={selectedElement}
                    buildingId={b.id}
                    offsetX={ox}
                    offsetY={oz}
                  />
                </g>

                {/* Door and window symbols */}
                <g pointerEvents="none">
                  <SchematicOpenings
                    dimensions={b.dimensions}
                    walls={b.walls}
                    offsetX={ox}
                    offsetY={oz}
                  />
                </g>

                {/* Per-building width dimension */}
                <g pointerEvents="none">
                  <DimensionLine
                    x1={ox - hw}
                    y1={oz + hd}
                    x2={ox + hw}
                    y2={oz + hd}
                    offset={showTotalDimension ? 1.0 : 0.8}
                    label={`${width.toFixed(1)}m`}
                  />
                </g>

                {/* Building type label */}
                <text
                  x={ox}
                  y={oz}
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
                      <text x={ox} y={oz + hd + 0.3}>{t('wall.front')}</text>
                    )}
                    {!connected.has('back') && (
                      <text x={ox} y={oz - hd - 0.3}>{t('wall.back')}</text>
                    )}
                    {!connected.has('left') && (
                      <text
                        x={ox - hw - 0.3}
                        y={oz}
                        transform={`rotate(-90, ${ox - hw - 0.3}, ${oz})`}
                      >
                        {t('wall.left')}
                      </text>
                    )}
                    {!connected.has('right') && (
                      <text
                        x={ox + hw + 0.3}
                        y={oz}
                        transform={`rotate(90, ${ox + hw + 0.3}, ${oz})`}
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
            const wallW = isHorizontal ? w.dimensions.width : w.dimensions.depth;
            const wallD = isHorizontal ? w.dimensions.depth : w.dimensions.width;
            const hw = wallW / 2;
            const hd = wallD / 2;
            const isSelected = w.id === selectedBuildingId;

            // Wall material color
            const wallCfg = w.walls['front'];
            const materialColor = wallCfg?.materialId === 'brick' ? '#8B4513'
              : wallCfg?.materialId === 'render' ? '#F5F5DC'
              : wallCfg?.materialId === 'metal' ? '#708090'
              : wallCfg?.materialId === 'glass' ? '#B8D4E3'
              : '#c4956a'; // wood default

            return (
              <g key={w.id}>
                <rect
                  x={ox - hw}
                  y={oz - hd}
                  width={wallW}
                  height={wallD}
                  fill={materialColor}
                  stroke={isSelected ? '#3b82f6' : '#666'}
                  strokeWidth={isSelected ? 0.04 : 0.02}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => onBuildingPointerDown(e, w.id)}
                />
              </g>
            );
          })}

          {/* Poles as small filled squares — rendered after buildings so they're on top */}
          {poles.map((p) => {
            const s = 0.18;
            const isSelected = p.id === selectedBuildingId;
            return (
              <rect
                key={p.id}
                x={p.position[0] - s / 2}
                y={p.position[1] - s / 2}
                width={s}
                height={s}
                fill="#8B6914"
                stroke={isSelected ? '#3b82f6' : '#666'}
                strokeWidth={isSelected ? 0.04 : 0.02}
                style={{ cursor: 'grab' }}
                onPointerDown={(e) => onBuildingPointerDown(e, p.id)}
              />
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

          {/* Depth dimension — outside rightmost edge (negative offset = push right) */}
          <g pointerEvents="none">
            <DimensionLine
              x1={maxX}
              y1={minZ}
              x2={maxX}
              y2={maxZ}
              offset={showTotalDimension ? -2.0 : -1.0}
              label={`${totalD.toFixed(1)}m`}
            />
          </g>

          {/* Total width dimension spanning all buildings */}
          {showTotalDimension && (
            <g pointerEvents="none">
              <DimensionLine
                x1={minX}
                y1={maxZ}
                x2={maxX}
                y2={maxZ}
                offset={1.8}
                label={`${totalW.toFixed(1)}m`}
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
