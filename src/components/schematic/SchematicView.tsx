'use client';

import { useMemo } from 'react';
import { useConfigStore } from '@/store/useConfigStore';
import { t } from '@/lib/i18n';
import SchematicPosts from './SchematicPosts';
import SchematicWalls from './SchematicWalls';
import SchematicOpenings from './SchematicOpenings';
import DimensionLine from './DimensionLine';
import type { WallSide, SnapConnection } from '@/types/building';

function getConnectedSides(buildingId: string, connections: SnapConnection[]): Set<WallSide> {
  const sides = new Set<WallSide>();
  for (const c of connections) {
    if (c.buildingAId === buildingId) sides.add(c.sideA);
    if (c.buildingBId === buildingId) sides.add(c.sideB);
  }
  return sides;
}

export default function SchematicView() {
  const buildings = useConfigStore((s) => s.buildings);
  const connections = useConfigStore((s) => s.connections);
  const selectedElement = useConfigStore((s) => s.selectedElement);

  // Compute bounding box of all buildings
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const b of buildings) {
    const [cx, cz] = b.position;
    const hw = b.dimensions.width / 2;
    const hd = b.dimensions.depth / 2;
    minX = Math.min(minX, cx - hw);
    maxX = Math.max(maxX, cx + hw);
    minZ = Math.min(minZ, cz - hd);
    maxZ = Math.max(maxZ, cz + hd);
  }

  const totalW = maxX - minX;
  const totalD = maxZ - minZ;
  const showTotalDimension = buildings.length > 1 && connections.length > 0;

  const pad = showTotalDimension ? 2.4 : 1.8;
  const viewBox = `${minX - pad} ${minZ - pad} ${totalW + 2 * pad} ${totalD + 2 * pad}`;

  // Per-building: which side is the outermost for the depth dimension?
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
          {buildings.map((b) => {
            const [ox, oz] = b.position;
            const { width, depth } = b.dimensions;
            const hw = width / 2;
            const hd = depth / 2;
            const connected = getConnectedSides(b.id, connections);

            return (
              <g key={b.id}>
                {/* Building outline */}
                <rect
                  x={ox - hw}
                  y={oz - hd}
                  width={width}
                  height={depth}
                  fill={b.type === 'berging' ? '#f0ebe4' : '#fafafa'}
                  stroke={b.type === 'berging' ? '#ccc' : '#bbb'}
                  strokeWidth={0.02}
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
                  offset={0.8}
                  label={`${width.toFixed(1)}m`}
                />

                {/* Depth dimension — only on rightmost building */}
                {b.id === rightmostBuilding.id && (
                  <DimensionLine
                    x1={maxX}
                    y1={minZ}
                    x2={maxX}
                    y2={maxZ}
                    offset={showTotalDimension ? 1.6 : 0.8}
                    label={`${depth.toFixed(1)}m`}
                  />
                )}

                {/* Building type label */}
                <text
                  x={ox}
                  y={oz}
                  fontSize={0.22}
                  fontFamily="system-ui, sans-serif"
                  fill="#aaa"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {t(`building.name.${b.type}`)}
                </text>

                {/* Wall labels — skip on connected sides */}
                <g
                  fontSize={0.18}
                  fontFamily="system-ui, sans-serif"
                  fill="#999"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {!connected.has('front') && (
                    <text x={ox} y={oz + hd + 0.35}>{t('wall.front')}</text>
                  )}
                  {!connected.has('back') && (
                    <text x={ox} y={oz - hd - 0.35}>{t('wall.back')}</text>
                  )}
                  {!connected.has('left') && (
                    <text
                      x={ox - hw - 0.35}
                      y={oz}
                      transform={`rotate(-90, ${ox - hw - 0.35}, ${oz})`}
                    >
                      {t('wall.left')}
                    </text>
                  )}
                  {!connected.has('right') && (
                    <text
                      x={ox + hw + 0.35}
                      y={oz}
                      transform={`rotate(90, ${ox + hw + 0.35}, ${oz})`}
                    >
                      {t('wall.right')}
                    </text>
                  )}
                </g>
              </g>
            );
          })}

          {/* Total dimension line spanning all buildings */}
          {showTotalDimension && (
            <DimensionLine
              x1={minX}
              y1={maxZ}
              x2={maxX}
              y2={maxZ}
              offset={1.6}
              label={`${totalW.toFixed(1)}m`}
            />
          )}
        </svg>
      </div>
    </div>
  );
}
