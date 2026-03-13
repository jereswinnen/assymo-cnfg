'use client';

import { useMemo } from 'react';
import { useConfigStore } from '@/store/useConfigStore';
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

    // Find the shared edge segment (overlap on perpendicular axis)
    const aLeft = a.position[0] - a.dimensions.width / 2;
    const aRight = a.position[0] + a.dimensions.width / 2;
    const aTop = a.position[1] - a.dimensions.depth / 2;
    const aBottom = a.position[1] + a.dimensions.depth / 2;
    const bLeft = b.position[0] - b.dimensions.width / 2;
    const bRight = b.position[0] + b.dimensions.width / 2;
    const bTop = b.position[1] - b.dimensions.depth / 2;
    const bBottom = b.position[1] + b.dimensions.depth / 2;

    if (c.sideA === 'right' || c.sideA === 'left') {
      // Vertical shared edge
      const ex = c.sideA === 'right' ? aRight : aLeft;
      const overlapTop = Math.max(aTop, bTop);
      const overlapBottom = Math.min(aBottom, bBottom);
      if (overlapBottom > overlapTop) {
        edges.push({ x1: ex, y1: overlapTop, x2: ex, y2: overlapBottom, isOpen: c.isOpen });
      }
    } else {
      // Horizontal shared edge
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

export default function SchematicView() {
  const buildings = useConfigStore((s) => s.buildings);
  const connections = useConfigStore((s) => s.connections);
  const selectedElement = useConfigStore((s) => s.selectedElement);

  const normalBuildings = buildings.filter(b => b.type !== 'paal');
  const poles = buildings.filter(b => b.type === 'paal');

  // Compute bounding box of all buildings (including poles)
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const b of buildings) {
    const [cx, cz] = b.position;
    const hw = b.dimensions.width / 2;
    const hd = b.dimensions.depth / 2;
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
  const viewBox = `${minX - pad} ${minZ - pad} ${totalW + 2 * pad} ${totalD + 2 * pad}`;

  // Connection edge segments for rendering
  const connectionEdges = useMemo(
    () => getConnectionEdges(buildings, connections),
    [buildings, connections],
  );

  // Rightmost building for depth dimension placement
  const rightmostBuilding = useMemo(() => {
    let best = buildings[0];
    for (const b of buildings) {
      if (b.position[0] + b.dimensions.width / 2 > best.position[0] + best.dimensions.width / 2) {
        best = b;
      }
    }
    return best;
  }, [buildings]);

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <svg
          viewBox={viewBox}
          className="schematic-svg w-full h-full"
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

          {/* Poles as small filled squares */}
          {poles.map((p) => {
            const s = 0.18;
            return (
              <rect
                key={p.id}
                x={p.position[0] - s / 2}
                y={p.position[1] - s / 2}
                width={s}
                height={s}
                fill="#8B6914"
                stroke="#666"
                strokeWidth={0.02}
              />
            );
          })}

          {normalBuildings.map((b) => {
            const [ox, oz] = b.position;
            const { width, depth } = b.dimensions;
            const hw = width / 2;
            const hd = depth / 2;
            const connected = getConnectedSides(b.id, connections);
            const hasWalls = Object.keys(b.walls).length > 0;

            return (
              <g key={b.id}>
                {/* Building fill */}
                <rect
                  x={ox - hw}
                  y={oz - hd}
                  width={width}
                  height={depth}
                  fill={b.type === 'berging' ? '#f0ebe4' : 'url(#hatch-overkapping)'}
                  stroke="none"
                />

                {/* Building outline */}
                <rect
                  x={ox - hw}
                  y={oz - hd}
                  width={width}
                  height={depth}
                  fill="none"
                  stroke={b.type === 'berging' ? '#999' : '#bbb'}
                  strokeWidth={b.type === 'berging' ? 0.03 : 0.02}
                  strokeDasharray={b.type === 'overkapping' ? '0.12 0.06' : undefined}
                />

                {/* Posts */}
                <SchematicPosts width={width} depth={depth} offsetX={ox} offsetY={oz} />

                {/* Walls */}
                <SchematicWalls
                  dimensions={b.dimensions}
                  walls={b.walls}
                  selectedElement={selectedElement}
                  buildingId={b.id}
                  offsetX={ox}
                  offsetY={oz}
                />

                {/* Door and window symbols */}
                <SchematicOpenings
                  dimensions={b.dimensions}
                  walls={b.walls}
                  offsetX={ox}
                  offsetY={oz}
                />

                {/* Per-building width dimension */}
                <DimensionLine
                  x1={ox - hw}
                  y1={oz + hd}
                  x2={ox + hw}
                  y2={oz + hd}
                  offset={showTotalDimension ? 1.0 : 0.8}
                  label={`${width.toFixed(1)}m`}
                />

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
            />
          ))}

          {/* Depth dimension — outside rightmost edge (negative offset = push right) */}
          <DimensionLine
            x1={maxX}
            y1={minZ}
            x2={maxX}
            y2={maxZ}
            offset={showTotalDimension ? -2.0 : -1.0}
            label={`${totalD.toFixed(1)}m`}
          />

          {/* Total width dimension spanning all buildings */}
          {showTotalDimension && (
            <DimensionLine
              x1={minX}
              y1={maxZ}
              x2={maxX}
              y2={maxZ}
              offset={1.8}
              label={`${totalW.toFixed(1)}m`}
            />
          )}
        </svg>
      </div>
    </div>
  );
}
