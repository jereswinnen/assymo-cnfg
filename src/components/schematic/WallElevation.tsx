'use client';

import { useConfigStore, getEffectiveHeight } from '@/store/useConfigStore';
import {
  WALL_MATERIALS, DOOR_W, DOUBLE_DOOR_W,
  WIN_W_DEFAULT, WIN_H_DEFAULT, WIN_SILL_DEFAULT,
  getWallLength, fractionToX,
} from '@/lib/constants';
import type { WallId } from '@/types/building';

interface WallElevationProps {
  buildingId: string;
  wallId: WallId;
}

export default function WallElevation({ buildingId, wallId }: WallElevationProps) {
  const building = useConfigStore((s) => s.buildings.find(b => b.id === buildingId));
  const defaultHeight = useConfigStore((s) => s.defaultHeight);

  if (!building) return null;

  const wallCfg = building.walls[wallId];
  if (!wallCfg) return null;

  const wallLength = getWallLength(wallId, building.dimensions);
  const wallHeight = getEffectiveHeight(building, defaultHeight);
  const mat = WALL_MATERIALS.find(m => m.id === wallCfg.materialId);
  const wallColor = mat?.color ?? '#d4c5a9';

  const windows = wallCfg.windows ?? [];

  // Door dimensions and position
  const doorW = wallCfg.doorSize === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W;
  const doorH = Math.min(2.1, wallHeight - 0.05);
  // fractionToX returns offset from wall CENTER. Add wallLength/2 to get offset from wall LEFT edge (0).
  const doorX = wallCfg.hasDoor
    ? wallLength / 2 + fractionToX(wallLength, wallCfg.doorPosition ?? 0.5)
    : null;

  return (
    <g>
      {/* Ground line */}
      <line
        x1={-0.2} y1={wallHeight}
        x2={wallLength + 0.2} y2={wallHeight}
        stroke="#ccc" strokeWidth={0.02} strokeDasharray="0.08 0.05"
      />

      {/* Wall rectangle */}
      <rect
        x={0} y={0}
        width={wallLength} height={wallHeight}
        fill={wallColor} fillOpacity={0.15}
        stroke="#888" strokeWidth={0.03}
        rx={0.02}
      />

      {/* Wall width dimension label */}
      <text
        x={wallLength / 2} y={-0.15}
        textAnchor="middle" fontSize={0.18} fill="#888" fontFamily="system-ui"
      >
        {wallLength.toFixed(1)}m
      </text>

      {/* Wall height dimension label */}
      <text
        x={-0.2} y={wallHeight / 2}
        textAnchor="middle" fontSize={0.18} fill="#888" fontFamily="system-ui"
        transform={`rotate(-90, ${-0.2}, ${wallHeight / 2})`}
      >
        {wallHeight.toFixed(1)}m
      </text>

      {/* Door */}
      {wallCfg.hasDoor && doorX !== null && (
        <g>
          {/* Door panel */}
          <rect
            x={doorX - doorW / 2}
            y={wallHeight - doorH}
            width={doorW} height={doorH}
            fill="#d4a574" fillOpacity={0.3}
            stroke="#8B6914" strokeWidth={0.025}
            rx={0.01}
          />
          {/* Door handle */}
          <rect
            x={doorX + doorW / 2 - 0.15}
            y={wallHeight - doorH / 2 - 0.07}
            width={0.06} height={0.15}
            fill="#8B6914" rx={0.01}
          />
          {/* Door dimension label */}
          <text
            x={doorX} y={wallHeight + 0.2}
            textAnchor="middle" fontSize={0.12} fill="#666" fontFamily="system-ui"
          >
            {doorW.toFixed(1)} × {doorH.toFixed(1)}m
          </text>
        </g>
      )}

      {/* Windows */}
      {windows.map((win) => {
        const w = win.width ?? WIN_W_DEFAULT;
        const h = win.height ?? WIN_H_DEFAULT;
        const sill = win.sillHeight ?? WIN_SILL_DEFAULT;
        // fractionToX returns offset from wall CENTER. Add wallLength/2 to get from LEFT edge.
        const winX = wallLength / 2 + fractionToX(wallLength, win.position);
        const winTop = wallHeight - sill - h;

        return (
          <g key={win.id}>
            {/* Window frame */}
            <rect
              x={winX - w / 2}
              y={winTop}
              width={w} height={h}
              fill="#d4eaf7" fillOpacity={0.3}
              stroke="#5BA3D9" strokeWidth={0.025}
              rx={0.01}
            />
            {/* Vertical cross divider */}
            <line
              x1={winX} y1={winTop}
              x2={winX} y2={winTop + h}
              stroke="#5BA3D9" strokeWidth={0.015}
            />
            {/* Horizontal cross divider */}
            <line
              x1={winX - w / 2} y1={winTop + h / 2}
              x2={winX + w / 2} y2={winTop + h / 2}
              stroke="#5BA3D9" strokeWidth={0.015}
            />
            {/* Window dimension label */}
            <text
              x={winX} y={winTop + h + 0.18}
              textAnchor="middle" fontSize={0.12} fill="#666" fontFamily="system-ui"
            >
              {w.toFixed(1)} × {h.toFixed(1)}m
            </text>
          </g>
        );
      })}
    </g>
  );
}
