'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { t } from '@/lib/i18n';
import SchematicPosts from './SchematicPosts';
import SchematicWalls from './SchematicWalls';
import SchematicOpenings from './SchematicOpenings';
import DimensionLine from './DimensionLine';

export default function SchematicView() {
  const buildings = useConfigStore((s) => s.buildings);
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

  const pad = 1.8;
  const viewBox = `${minX - pad} ${minZ - pad} ${maxX - minX + 2 * pad} ${maxZ - minZ + 2 * pad}`;

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

            return (
              <g key={b.id}>
                {/* Building outline */}
                <rect
                  x={ox - hw}
                  y={oz - hd}
                  width={width}
                  height={depth}
                  fill={b.type === 'berging' ? '#f0ebe4' : '#fafafa'}
                  stroke="#ddd"
                  strokeWidth={0.02}
                  strokeDasharray="0.1 0.06"
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

                {/* Dimension lines */}
                <DimensionLine
                  x1={ox - hw}
                  y1={oz + hd}
                  x2={ox + hw}
                  y2={oz + hd}
                  offset={0.8}
                  label={`${width.toFixed(1)}m`}
                />
                <DimensionLine
                  x1={ox + hw}
                  y1={oz - hd}
                  x2={ox + hw}
                  y2={oz + hd}
                  offset={0.8}
                  label={`${depth.toFixed(1)}m`}
                />

                {/* Building type label */}
                <text
                  x={ox}
                  y={oz}
                  fontSize={0.18 * 0.85}
                  fontFamily="system-ui, sans-serif"
                  fill="#bbb"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {t(`building.name.${b.type}`)}
                </text>

                {/* Wall labels */}
                <g
                  fontSize={0.18}
                  fontFamily="system-ui, sans-serif"
                  fill="#999"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  <text x={ox} y={oz + hd + 0.35}>{t('wall.front')}</text>
                  <text x={ox} y={oz - hd - 0.35}>{t('wall.back')}</text>
                  <text
                    x={ox - hw - 0.35}
                    y={oz}
                    transform={`rotate(-90, ${ox - hw - 0.35}, ${oz})`}
                  >
                    {t('wall.left')}
                  </text>
                  <text
                    x={ox + hw + 0.35}
                    y={oz}
                    transform={`rotate(90, ${ox + hw + 0.35}, ${oz})`}
                  >
                    {t('wall.right')}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
