'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { t } from '@/lib/i18n';
import SchematicPosts from './SchematicPosts';
import SchematicWalls from './SchematicWalls';
import SchematicOpenings from './SchematicOpenings';
import DimensionLine from './DimensionLine';

export default function SchematicView() {
  const config = useConfigStore((s) => s.config);
  const selectedElement = useConfigStore((s) => s.selectedElement);

  const { width, depth, bergingWidth } = config.dimensions;
  const { buildingType, walls } = config;

  const hw = width / 2;
  const hd = depth / 2;
  const pad = 1.8; // padding for dimension lines and labels

  const viewBox = `${-hw - pad} ${-hd - pad} ${width + 2 * pad} ${depth + 2 * pad}`;

  return (
    <div className="flex flex-col h-full p-6">
      {/* SVG container */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <svg
          viewBox={viewBox}
          className="w-full h-full"
        >
          {/* Building outline (light dashed rectangle for full footprint) */}
          <rect
            x={-hw}
            y={-hd}
            width={width}
            height={depth}
            fill="#fafafa"
            stroke="#ddd"
            strokeWidth={0.02}
            strokeDasharray="0.1 0.06"
          />

          {/* Combined type: berging zone fill */}
          {buildingType === 'combined' && (
            <rect
              x={-hw}
              y={-hd}
              width={bergingWidth}
              height={depth}
              fill="#f0ebe4"
              stroke="none"
            />
          )}

          {/* Posts */}
          <SchematicPosts width={width} depth={depth} />

          {/* Walls */}
          <SchematicWalls
            buildingType={buildingType}
            dimensions={config.dimensions}
            walls={walls}
            selectedElement={selectedElement}
          />

          {/* Door and window symbols */}
          <SchematicOpenings
            buildingType={buildingType}
            dimensions={config.dimensions}
            walls={walls}
          />

          {/* Dimension lines */}
          {/* Overall width — below front wall */}
          <DimensionLine
            x1={-hw}
            y1={hd}
            x2={hw}
            y2={hd}
            offset={0.8}
            label={`${width.toFixed(1)}m`}
          />

          {/* Overall depth — right of building */}
          <DimensionLine
            x1={hw}
            y1={-hd}
            x2={hw}
            y2={hd}
            offset={0.8}
            label={`${depth.toFixed(1)}m`}
          />

          {/* Berging width for combined type */}
          {buildingType === 'combined' && (
            <DimensionLine
              x1={-hw}
              y1={hd}
              x2={-hw + bergingWidth}
              y2={hd}
              offset={1.35}
              label={`${bergingWidth.toFixed(1)}m`}
            />
          )}

          {/* Wall labels */}
          <WallLabels
            buildingType={buildingType}
            width={width}
            depth={depth}
            bergingWidth={bergingWidth}
          />
          {/* Title watermark */}
          <text
            x={-hw - pad + 0.2}
            y={-hd - pad + 0.35}
            fontSize={0.25}
            fontFamily="system-ui, sans-serif"
            fill="#ccc"
            textAnchor="start"
          >
            {t('schematic.title')}
          </text>
        </svg>
      </div>
    </div>
  );
}

function WallLabels({
  buildingType,
  width,
  depth,
  bergingWidth,
}: {
  buildingType: string;
  width: number;
  depth: number;
  bergingWidth: number;
}) {
  const hw = width / 2;
  const hd = depth / 2;
  const labelOffset = 0.35;
  const fontSize = 0.18;

  return (
    <g
      fontSize={fontSize}
      fontFamily="system-ui, sans-serif"
      fill="#999"
      textAnchor="middle"
      dominantBaseline="central"
    >
      {/* Front — below */}
      <text x={buildingType === 'combined' ? -hw + bergingWidth / 2 : 0} y={hd + labelOffset}>
        {t('wall.front')}
      </text>

      {/* Back — above */}
      <text x={buildingType === 'combined' ? -hw + bergingWidth / 2 : 0} y={-hd - labelOffset}>
        {t('wall.back')}
      </text>

      {/* Left */}
      <text
        x={-hw - labelOffset}
        y={0}
        transform={`rotate(-90, ${-hw - labelOffset}, 0)`}
      >
        {t('wall.left')}
      </text>

      {buildingType === 'berging' && (
        <text
          x={hw + labelOffset}
          y={0}
          transform={`rotate(90, ${hw + labelOffset}, 0)`}
        >
          {t('wall.right')}
        </text>
      )}

      {buildingType === 'combined' && (
        <>
          {/* Divider label */}
          <text
            x={-hw + bergingWidth + labelOffset}
            y={0}
            transform={`rotate(90, ${-hw + bergingWidth + labelOffset}, 0)`}
          >
            {t('wall.divider')}
          </text>

          {/* Overkapping zone label */}
          <text
            x={-hw + bergingWidth + (width - bergingWidth) / 2}
            y={0}
            fontSize={fontSize * 0.85}
            fill="#bbb"
          >
            Overkapping
          </text>

          {/* Berging zone label */}
          <text
            x={-hw + bergingWidth / 2}
            y={0}
            fontSize={fontSize * 0.85}
            fill="#bbb"
          >
            Berging
          </text>
        </>
      )}
    </g>
  );
}
