'use client';

import { useState, useMemo, useRef } from 'react';
import { Edges } from '@react-three/drei';
import { useConfigStore } from '@/store/useConfigStore';
import { WALL_THICKNESS } from '@/lib/constants';
import type { WallId } from '@/types/building';

/** Check whether the ray also hit a solid (non-ghost) wall mesh */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasSolidWallIntersection(e: any): boolean {
  return e.intersections.some(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (hit: any) =>
      hit.object !== e.object &&
      !hit.object.userData?.ghostWall &&
      hit.point.y > 0.1,
  );
}

interface GhostWallProps {
  wallId: WallId;
}

export default function GhostWall({ wallId }: GhostWallProps) {
  const [hovered, setHovered] = useState(false);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  const config = useConfigStore((s) => s.config);
  const addOverkappingWall = useConfigStore((s) => s.addOverkappingWall);

  const { width, depth, height, bergingWidth } = config.dimensions;
  const overkappingWidth = width - bergingWidth;
  const inset = 0.01;

  const { size, position } = useMemo(() => {
    const t = 0.02; // thin ghost plane
    const ovCenterX = width / 2 - overkappingWidth / 2;

    switch (wallId) {
      case 'ov_front':
        return {
          size: [overkappingWidth - inset * 2, height, t] as [number, number, number],
          position: [ovCenterX, height / 2, depth / 2 - inset] as [number, number, number],
        };
      case 'ov_back':
        return {
          size: [overkappingWidth - inset * 2, height, t] as [number, number, number],
          position: [ovCenterX, height / 2, -depth / 2 + inset] as [number, number, number],
        };
      case 'ov_right':
        return {
          size: [t, height, depth - inset * 2] as [number, number, number],
          position: [width / 2 - inset, height / 2, 0] as [number, number, number],
        };
      default:
        return {
          size: [1, 1, t] as [number, number, number],
          position: [0, 0, 0] as [number, number, number],
        };
    }
  }, [wallId, width, depth, height, overkappingWidth]);

  const ghostThickness = WALL_THICKNESS * 0.15;
  const renderSize: [number, number, number] = [
    wallId === 'ov_right' ? ghostThickness : size[0],
    size[1],
    wallId === 'ov_right' ? size[2] : ghostThickness,
  ];

  return (
    <mesh
      position={position}
      renderOrder={-1}
      userData={{ ghostWall: true }}
      onPointerOver={(e) => {
        if (e.nativeEvent.buttons > 0) return;
        // If a solid wall is behind this ghost, let the event pass through
        if (hasSolidWallIntersection(e)) return;
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
      onPointerDown={(e) => {
        pointerDownPos.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
      }}
      onClick={(e) => {
        // If a solid wall is also in the ray path, don't handle — let it propagate
        if (hasSolidWallIntersection(e)) return;
        const down = pointerDownPos.current;
        if (down) {
          const dx = e.nativeEvent.clientX - down.x;
          const dy = e.nativeEvent.clientY - down.y;
          if (dx * dx + dy * dy > 16) return;
        }
        e.stopPropagation();
        addOverkappingWall(wallId);
      }}
    >
      <boxGeometry args={renderSize} />
      <meshStandardMaterial
        color={hovered ? '#60a5fa' : '#3b82f6'}
        transparent
        opacity={hovered ? 0.35 : 0.1}
        depthWrite={false}
        emissive="#3b82f6"
        emissiveIntensity={hovered ? 0.4 : 0}
      />
      <Edges color={hovered ? '#60a5fa' : '#3b82f6'} threshold={15} lineWidth={1} />
    </mesh>
  );
}
