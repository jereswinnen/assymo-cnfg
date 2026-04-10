'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useConfigStore, getEffectiveHeight } from '@/store/useConfigStore';
import {
  WALL_MATERIALS, DOOR_W, DOUBLE_DOOR_W,
  WIN_W_DEFAULT, WIN_H_DEFAULT, WIN_SILL_DEFAULT,
  getWallLength, fractionToX, xToFraction,
  clampOpeningPosition, EDGE_CLEARANCE, SNAP_INCREMENT,
  WIN_MIN_SIZE,
} from '@/lib/constants';
import type { WallId } from '@/types/building';

interface WallElevationProps {
  buildingId: string;
  wallId: WallId;
}

export default function WallElevation({ buildingId, wallId }: WallElevationProps) {
  const building = useConfigStore((s) => s.buildings.find(b => b.id === buildingId));
  const defaultHeight = useConfigStore((s) => s.defaultHeight);
  const updateBuildingWall = useConfigStore((s) => s.updateBuildingWall);

  const [selectedOpening, setSelectedOpening] = useState<{
    type: 'door' | 'window';
    windowId?: string;
  } | null>(null);

  const groupRef = useRef<SVGGElement>(null);

  const dragging = useRef<{
    type: 'door' | 'window';
    windowId?: string;
    startPointerSvg: [number, number];
    startPosition: number;
    startSillHeight: number;
  } | null>(null);

  const resizing = useRef<{
    windowId: string;
    edge: string;
    startPointerSvg: [number, number];
    startWidth: number;
    startHeight: number;
    startPosition: number;
    startSillHeight: number;
  } | null>(null);

  const clientToSvg = useCallback((clientX: number, clientY: number): [number, number] => {
    const svg = groupRef.current?.ownerSVGElement;
    if (!svg) return [0, 0];
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return [0, 0];
    const svgPt = pt.matrixTransform(ctm.inverse());
    return [svgPt.x, svgPt.y];
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = dragging.current;
    if (!d || !building) return;

    const wallCfg = building.walls[wallId];
    if (!wallCfg) return;

    const wallLength = getWallLength(wallId, building.dimensions);
    const wallHeight = getEffectiveHeight(building, defaultHeight);
    const [svgX, svgY] = clientToSvg(e.clientX, e.clientY);
    const deltaX = svgX - d.startPointerSvg[0];
    const deltaY = svgY - d.startPointerSvg[1];
    const usableLen = wallLength - 2 * EDGE_CLEARANCE;

    const deltaFrac = usableLen > 0 ? deltaX / usableLen : 0;
    const rawFrac = d.startPosition + deltaFrac;
    const snappedFrac = Math.round(rawFrac / (SNAP_INCREMENT / usableLen)) * (SNAP_INCREMENT / usableLen);

    const windows = wallCfg.windows ?? [];

    if (d.type === 'door') {
      const doorW = wallCfg.doorSize === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W;
      const otherOpenings = windows.map(w => ({
        position: w.position,
        width: w.width ?? WIN_W_DEFAULT,
      }));
      const newFrac = clampOpeningPosition(wallLength, doorW, snappedFrac, otherOpenings);
      updateBuildingWall(buildingId, wallId, { doorPosition: newFrac });
    } else if (d.type === 'window' && d.windowId) {
      const win = windows.find(w => w.id === d.windowId);
      if (!win) return;

      const winW = win.width ?? WIN_W_DEFAULT;
      const winH = win.height ?? WIN_H_DEFAULT;

      const otherOpenings: { position: number; width: number }[] = [];
      if (wallCfg.hasDoor) {
        const dw = wallCfg.doorSize === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W;
        otherOpenings.push({ position: wallCfg.doorPosition ?? 0.5, width: dw });
      }
      windows.forEach(w => {
        if (w.id === d.windowId) return;
        otherOpenings.push({ position: w.position, width: w.width ?? WIN_W_DEFAULT });
      });

      const newFrac = clampOpeningPosition(wallLength, winW, snappedFrac, otherOpenings);

      const deltaSill = -deltaY;
      const rawSill = d.startSillHeight + deltaSill;
      const snappedSill = Math.round(rawSill / SNAP_INCREMENT) * SNAP_INCREMENT;
      const clampedSill = Math.max(0, Math.min(wallHeight - winH, snappedSill));

      const updatedWindows = windows.map(w =>
        w.id === d.windowId
          ? { ...w, position: newFrac, sillHeight: clampedSill }
          : w
      );
      updateBuildingWall(buildingId, wallId, { windows: updatedWindows });
    }
  }, [building, wallId, defaultHeight, buildingId, clientToSvg, updateBuildingWall]);

  const onPointerUp = useCallback(() => {
    dragging.current = null;
    useConfigStore.temporal.getState().resume();
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, [onPointerMove]);

  const onResizeMove = useCallback((e: PointerEvent) => {
    const r = resizing.current;
    if (!r || !building) return;

    const wallCfg = building.walls[wallId];
    if (!wallCfg) return;

    const wallLength = getWallLength(wallId, building.dimensions);
    const wallHeight = getEffectiveHeight(building, defaultHeight);
    const windows = wallCfg.windows ?? [];
    const [svgX, svgY] = clientToSvg(e.clientX, e.clientY);
    const deltaX = svgX - r.startPointerSvg[0];
    const deltaY = svgY - r.startPointerSvg[1];

    let newWidth = r.startWidth;
    let newHeight = r.startHeight;
    let newSill = r.startSillHeight;
    let newPosition = r.startPosition;

    const edge = r.edge;

    // Horizontal: east edge
    if (edge.includes('e')) {
      newWidth = Math.round((r.startWidth + deltaX) / SNAP_INCREMENT) * SNAP_INCREMENT;
      newWidth = Math.max(WIN_MIN_SIZE, newWidth);
      // Compute left edge X (stays fixed)
      const startCenterX = wallLength / 2 + fractionToX(wallLength, r.startPosition);
      const leftEdge = startCenterX - r.startWidth / 2;
      // Clamp: right edge <= wallLength
      const maxW = wallLength - leftEdge;
      newWidth = Math.min(newWidth, maxW);
      newWidth = Math.max(WIN_MIN_SIZE, newWidth);
      // Recompute center and position fraction
      const newCenterX = leftEdge + newWidth / 2;
      newPosition = xToFraction(wallLength, newCenterX - wallLength / 2);
    }

    // Horizontal: west edge
    if (edge.includes('w')) {
      newWidth = Math.round((r.startWidth - deltaX) / SNAP_INCREMENT) * SNAP_INCREMENT;
      newWidth = Math.max(WIN_MIN_SIZE, newWidth);
      // Compute right edge X (stays fixed)
      const startCenterX = wallLength / 2 + fractionToX(wallLength, r.startPosition);
      const rightEdge = startCenterX + r.startWidth / 2;
      // Clamp: left edge >= 0
      const maxW = rightEdge;
      newWidth = Math.min(newWidth, maxW);
      newWidth = Math.max(WIN_MIN_SIZE, newWidth);
      // Recompute center and position fraction
      const newCenterX = rightEdge - newWidth / 2;
      newPosition = xToFraction(wallLength, newCenterX - wallLength / 2);
    }

    // Vertical: north (top) edge
    if (edge.includes('n')) {
      newHeight = Math.round((r.startHeight - deltaY) / SNAP_INCREMENT) * SNAP_INCREMENT;
      newHeight = Math.max(WIN_MIN_SIZE, newHeight);
      // Sill stays the same (bottom edge fixed), but top must stay >= 0
      const maxH = wallHeight - r.startSillHeight;
      newHeight = Math.min(newHeight, maxH);
      newHeight = Math.max(WIN_MIN_SIZE, newHeight);
      // Sill doesn't change for north drag
    }

    // Vertical: south (bottom) edge
    if (edge.includes('s')) {
      newHeight = Math.round((r.startHeight + deltaY) / SNAP_INCREMENT) * SNAP_INCREMENT;
      newHeight = Math.max(WIN_MIN_SIZE, newHeight);
      newSill = Math.round((r.startSillHeight - deltaY) / SNAP_INCREMENT) * SNAP_INCREMENT;
      newSill = Math.max(0, newSill);
      // Ensure top doesn't go above wall
      if (wallHeight - newSill - newHeight < 0) {
        newHeight = wallHeight - newSill;
      }
      newHeight = Math.max(WIN_MIN_SIZE, newHeight);
      if (newSill < 0) newSill = 0;
    }

    // Clamp position via clampOpeningPosition
    const otherOpenings: { position: number; width: number }[] = [];
    if (wallCfg.hasDoor) {
      const dw = wallCfg.doorSize === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W;
      otherOpenings.push({ position: wallCfg.doorPosition ?? 0.5, width: dw });
    }
    windows.forEach(w => {
      if (w.id === r.windowId) return;
      otherOpenings.push({ position: w.position, width: w.width ?? WIN_W_DEFAULT });
    });
    newPosition = clampOpeningPosition(wallLength, newWidth, newPosition, otherOpenings);

    const updatedWindows = windows.map(w =>
      w.id === r.windowId
        ? { ...w, width: newWidth, height: newHeight, sillHeight: newSill, position: newPosition }
        : w
    );
    updateBuildingWall(buildingId, wallId, { windows: updatedWindows });
  }, [building, wallId, defaultHeight, buildingId, clientToSvg, updateBuildingWall]);

  const onResizeUp = useCallback(() => {
    resizing.current = null;
    useConfigStore.temporal.getState().resume();
    window.removeEventListener('pointermove', onResizeMove);
    window.removeEventListener('pointerup', onResizeUp);
  }, [onResizeMove]);

  const startResize = useCallback((
    e: React.PointerEvent,
    edge: string,
    windowId: string,
    width: number,
    height: number,
    position: number,
    sillHeight: number,
  ) => {
    e.stopPropagation();
    const [sx, sy] = clientToSvg(e.clientX, e.clientY);
    resizing.current = {
      windowId,
      edge,
      startPointerSvg: [sx, sy],
      startWidth: width,
      startHeight: height,
      startPosition: position,
      startSillHeight: sillHeight,
    };
    useConfigStore.temporal.getState().pause();
    window.addEventListener('pointermove', onResizeMove);
    window.addEventListener('pointerup', onResizeUp);
  }, [clientToSvg, onResizeMove, onResizeUp]);

  const startDrag = useCallback((
    e: React.PointerEvent,
    type: 'door' | 'window',
    position: number,
    sillHeight: number,
    windowId?: string,
  ) => {
    e.stopPropagation();
    const [sx, sy] = clientToSvg(e.clientX, e.clientY);
    dragging.current = {
      type,
      windowId,
      startPointerSvg: [sx, sy],
      startPosition: position,
      startSillHeight: sillHeight,
    };
    setSelectedOpening({ type, windowId });
    useConfigStore.temporal.getState().pause();
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [clientToSvg, onPointerMove, onPointerUp]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointermove', onResizeMove);
      window.removeEventListener('pointerup', onResizeUp);
    };
  }, [onPointerMove, onPointerUp, onResizeMove, onResizeUp]);

  if (!building) return null;

  const wallCfg = building.walls[wallId];
  if (!wallCfg) return null;

  const wallLength = getWallLength(wallId, building.dimensions);
  const wallHeight = getEffectiveHeight(building, defaultHeight);
  const mat = WALL_MATERIALS.find(m => m.id === wallCfg.materialId);
  const wallColor = mat?.color ?? '#d4a5a9';

  const windows = wallCfg.windows ?? [];

  // Door dimensions and position
  const doorW = wallCfg.doorSize === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W;
  const doorH = Math.min(2.1, wallHeight - 0.05);
  const doorX = wallCfg.hasDoor
    ? wallLength / 2 + fractionToX(wallLength, wallCfg.doorPosition ?? 0.5)
    : null;

  const isDoorSelected = selectedOpening?.type === 'door';

  return (
    <g ref={groupRef}>
      {/* Ground line */}
      <line
        x1={-0.2} y1={wallHeight}
        x2={wallLength + 0.2} y2={wallHeight}
        stroke="#ccc" strokeWidth={0.02} strokeDasharray="0.08 0.05"
      />

      {/* Wall rectangle — click to deselect */}
      <rect
        x={0} y={0}
        width={wallLength} height={wallHeight}
        fill={wallColor} fillOpacity={0.15}
        stroke="#888" strokeWidth={0.03}
        rx={0.02}
        style={{ cursor: 'default' }}
        onPointerDown={() => setSelectedOpening(null)}
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
        <g
          style={{ cursor: 'grab' }}
          onPointerDown={(e) =>
            startDrag(e, 'door', wallCfg.doorPosition ?? 0.5, 0)
          }
        >
          {/* Transparent hit rect */}
          <rect
            x={doorX - doorW / 2}
            y={wallHeight - doorH}
            width={doorW} height={doorH}
            fill="transparent"
          />
          {/* Door panel */}
          <rect
            x={doorX - doorW / 2}
            y={wallHeight - doorH}
            width={doorW} height={doorH}
            fill="#d4a574" fillOpacity={0.3}
            stroke={isDoorSelected ? '#3b82f6' : '#8B6914'}
            strokeWidth={isDoorSelected ? 0.04 : 0.025}
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
            {doorW.toFixed(1)} x {doorH.toFixed(1)}m
          </text>
        </g>
      )}

      {/* Windows */}
      {windows.map((win) => {
        const w = win.width ?? WIN_W_DEFAULT;
        const h = win.height ?? WIN_H_DEFAULT;
        const sill = win.sillHeight ?? WIN_SILL_DEFAULT;
        const winX = wallLength / 2 + fractionToX(wallLength, win.position);
        const winTop = wallHeight - sill - h;

        const isSelected =
          selectedOpening?.type === 'window' &&
          selectedOpening.windowId === win.id;

        return (
          <g
            key={win.id}
            style={{ cursor: 'grab' }}
            onPointerDown={(e) =>
              startDrag(e, 'window', win.position, sill, win.id)
            }
          >
            {/* Transparent hit rect */}
            <rect
              x={winX - w / 2}
              y={winTop}
              width={w} height={h}
              fill="transparent"
            />
            {/* Window frame */}
            <rect
              x={winX - w / 2}
              y={winTop}
              width={w} height={h}
              fill="#d4eaf7" fillOpacity={0.3}
              stroke={isSelected ? '#3b82f6' : '#5BA3D9'}
              strokeWidth={isSelected ? 0.04 : 0.025}
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
              {w.toFixed(1)} x {h.toFixed(1)}m
            </text>

            {/* Resize handles (windows only, when selected) */}
            {isSelected && (() => {
              const hx = winX - w / 2; // left edge X
              const hy = winTop;       // top edge Y
              const hs = 0.08;         // handle size
              const handles = [
                { id: 'nw', cx: hx,         cy: hy,         cursor: 'nwse-resize' },
                { id: 'ne', cx: hx + w,     cy: hy,         cursor: 'nesw-resize' },
                { id: 'sw', cx: hx,         cy: hy + h,     cursor: 'nesw-resize' },
                { id: 'se', cx: hx + w,     cy: hy + h,     cursor: 'nwse-resize' },
                { id: 'n',  cx: hx + w / 2, cy: hy,         cursor: 'ns-resize' },
                { id: 's',  cx: hx + w / 2, cy: hy + h,     cursor: 'ns-resize' },
                { id: 'w',  cx: hx,         cy: hy + h / 2, cursor: 'ew-resize' },
                { id: 'e',  cx: hx + w,     cy: hy + h / 2, cursor: 'ew-resize' },
              ];
              return handles.map(handle => (
                <rect
                  key={handle.id}
                  x={handle.cx - hs / 2}
                  y={handle.cy - hs / 2}
                  width={hs}
                  height={hs}
                  fill="white"
                  stroke="#3b82f6"
                  strokeWidth={0.02}
                  rx={0.015}
                  style={{ cursor: handle.cursor }}
                  onPointerDown={(e) =>
                    startResize(e, handle.id, win.id, w, h, win.position, sill)
                  }
                />
              ));
            })()}

            {/* Dimension label during resize */}
            {resizing.current?.windowId === win.id && (
              <text
                x={winX}
                y={winTop - 0.15}
                textAnchor="middle" fontSize={0.14}
                fill="#3b82f6" fontFamily="system-ui" fontWeight={600}
              >
                {w.toFixed(1)} x {h.toFixed(1)}m
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
