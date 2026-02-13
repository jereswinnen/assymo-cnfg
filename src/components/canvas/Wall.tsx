'use client';

import { useRef, useState, useMemo, useEffect } from 'react';
import { Mesh } from 'three';
import { Edges } from '@react-three/drei';
import { useConfigStore } from '@/store/useConfigStore';
import { WALL_MATERIALS, WALL_THICKNESS, computeOpeningPositions } from '@/lib/constants';
import { useWallTexture } from '@/lib/textures';
import { createWallWithOpeningsGeo, FRAME_D } from './wallGeometry';
import { frameMat } from './DoorMesh';
import DoorMesh from './DoorMesh';
import WindowMesh from './WindowMesh';
import type { WallId, WallConfig } from '@/types/building';

// ---------- Glass wall constants ----------

const MULLION_SPACING = 1.2; // vertical mullion every 1.2m
const TRANSOM_H = 1.3; // horizontal transom height from bottom
const GLASS_FRAME = 0.05; // frame bar thickness for glass wall

// ---------- Wall component ----------

interface WallProps {
  wallId: WallId;
  sectionWidth?: number;
  sectionDepth?: number;
  offsetX?: number;
}

export default function Wall({ wallId, sectionWidth, sectionDepth, offsetX = 0 }: WallProps) {
  const meshRef = useRef<Mesh>(null);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);

  const config = useConfigStore((s) => s.config);
  const selectedElement = useConfigStore((s) => s.selectedElement);
  const selectElement = useConfigStore((s) => s.selectElement);

  const { width: fullWidth, depth: fullDepth, height, bergingWidth } = config.dimensions;
  const w = sectionWidth ?? fullWidth;
  const d = sectionDepth ?? fullDepth;
  const overkappingWidth = fullWidth - bergingWidth;

  const wallCfg = config.walls[wallId];
  const materialId = wallCfg?.materialId ?? 'brick';
  const material = WALL_MATERIALS.find((m) => m.id === materialId);
  const color = material?.color ?? '#cccccc';

  // Wall face dimensions for texture tiling
  const wallLength =
    wallId === 'ov_front' || wallId === 'ov_back' ? overkappingWidth
    : wallId === 'front' || wallId === 'back' ? w
    : d;
  const texture = useWallTexture(materialId, wallLength, height);

  if (!wallCfg) return null;

  const isSelected =
    selectedElement?.type === 'wall' && selectedElement.id === wallId;

  const { size, position, rotation } = useMemo(() => {
    const t = WALL_THICKNESS;
    const inset = 0.01;
    switch (wallId) {
      case 'front':
        return {
          size: [w - inset * 2, height, t] as [number, number, number],
          position: [offsetX, height / 2, d / 2 - inset] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
        };
      case 'back':
        return {
          size: [w - inset * 2, height, t] as [number, number, number],
          position: [offsetX, height / 2, -d / 2 + inset] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
        };
      case 'left':
        return {
          size: [t, height, d - inset * 2] as [number, number, number],
          position: [offsetX - w / 2 + inset, height / 2, 0] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
        };
      case 'right':
        return {
          size: [t, height, d - inset * 2] as [number, number, number],
          position: [offsetX + w / 2 - inset, height / 2, 0] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
        };
      case 'divider':
        return {
          size: [t, height, d - inset * 2] as [number, number, number],
          position: [offsetX + w / 2, height / 2, 0] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
        };
      case 'ov_front': {
        const ovCenterX = fullWidth / 2 - overkappingWidth / 2;
        return {
          size: [overkappingWidth - inset * 2, height, t] as [number, number, number],
          position: [ovCenterX, height / 2, d / 2 - inset] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
        };
      }
      case 'ov_back': {
        const ovCenterX = fullWidth / 2 - overkappingWidth / 2;
        return {
          size: [overkappingWidth - inset * 2, height, t] as [number, number, number],
          position: [ovCenterX, height / 2, -d / 2 + inset] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
        };
      }
      case 'ov_right':
        return {
          size: [t, height, d - inset * 2] as [number, number, number],
          position: [fullWidth / 2 - inset, height / 2, 0] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
        };
    }
  }, [wallId, w, d, height, offsetX, fullWidth, overkappingWidth]);

  // Compute opening positions (shared between geometry holes and overlays)
  const hasOpenings = wallCfg.hasDoor || (wallCfg.hasWindow && wallCfg.windowCount > 0);
  const ds = wallCfg.doorSize ?? 'enkel';
  const { doorX: computedDoorX, windowXs: computedWindowXs } = useMemo(
    () =>
      computeOpeningPositions(
        wallLength,
        wallCfg.hasDoor,
        wallCfg.doorPosition ?? 'midden',
        ds,
        wallCfg.hasWindow ? wallCfg.windowCount : 0,
      ),
    [wallLength, wallCfg.hasDoor, wallCfg.doorPosition, ds, wallCfg.hasWindow, wallCfg.windowCount],
  );

  const wallGeo = useMemo(() => {
    if (!hasOpenings) return null;
    return createWallWithOpeningsGeo(
      wallLength,
      height,
      WALL_THICKNESS,
      wallId,
      wallCfg.hasDoor ? computedDoorX : null,
      ds,
      computedWindowXs,
    );
  }, [hasOpenings, wallLength, height, wallId, wallCfg.hasDoor, computedDoorX, ds, computedWindowXs]);

  // Dispose old geometry when it changes
  useEffect(() => {
    return () => { wallGeo?.dispose(); };
  }, [wallGeo]);

  const isGlass = materialId === 'glass';

  // Shared pointer handlers
  const pointerHandlers = {
    onPointerOver: (e: { nativeEvent: MouseEvent; stopPropagation: () => void }) => {
      if (e.nativeEvent.buttons > 0) return;
      e.stopPropagation();
      setHovered(true);
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      setHovered(false);
      document.body.style.cursor = 'auto';
    },
    onPointerDown: (e: { nativeEvent: MouseEvent }) => {
      pointerDownPos.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
    },
    onClick: (e: { nativeEvent: MouseEvent; stopPropagation: () => void }) => {
      const down = pointerDownPos.current;
      if (down) {
        const dx = e.nativeEvent.clientX - down.x;
        const dy = e.nativeEvent.clientY - down.y;
        if (dx * dx + dy * dy > 16) return;
      }
      e.stopPropagation();
      selectElement({ type: 'wall', id: wallId });
    },
  };

  if (isGlass) {
    return (
      <GlassWallMesh
        position={position}
        rotation={rotation}
        wallLength={wallLength}
        height={height}
        wallId={wallId}
        isSelected={isSelected}
        hovered={hovered}
        pointerHandlers={pointerHandlers}
      />
    );
  }

  return (
    <group>
      <mesh
        ref={meshRef}
        position={position}
        rotation={rotation}
        {...pointerHandlers}
      >
        {wallGeo ? (
          <primitive object={wallGeo} attach="geometry" />
        ) : (
          <boxGeometry args={size} />
        )}
        <meshStandardMaterial
          color={texture ? '#ffffff' : color}
          map={texture ?? undefined}
          metalness={0.1}
          roughness={0.7}
          emissive={isSelected ? '#3b82f6' : hovered ? '#60a5fa' : '#000000'}
          emissiveIntensity={isSelected ? 0.35 : hovered ? 0.15 : 0}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
        <Edges color={isSelected ? '#2563eb' : '#333333'} threshold={15} />
      </mesh>

      <WallOpenings
        wallId={wallId}
        wallPosition={position}
        wallLength={wallId === 'ov_front' || wallId === 'ov_back' ? overkappingWidth : wallId === 'front' || wallId === 'back' ? w : d}
        height={height}
        wallCfg={wallCfg}
      />
    </group>
  );
}

// --- Door & Window overlay positioning ---

interface OpeningsProps {
  wallId: WallId;
  wallPosition: [number, number, number];
  wallLength: number;
  height: number;
  wallCfg: WallConfig;
}

function WallOpenings({ wallId, wallPosition, wallLength, height, wallCfg }: OpeningsProps) {
  if (!wallCfg.hasDoor && !(wallCfg.hasWindow && wallCfg.windowCount > 0)) return null;

  const t = WALL_THICKNESS;
  const outOffset = t / 2 + 0.01;

  let groupPos: [number, number, number];
  let groupRot: [number, number, number] = [0, 0, 0];

  switch (wallId) {
    case 'front':
    case 'ov_front':
      groupPos = [wallPosition[0], 0, wallPosition[2] + outOffset];
      break;
    case 'back':
    case 'ov_back':
      groupPos = [wallPosition[0], 0, wallPosition[2] - outOffset];
      groupRot = [0, Math.PI, 0];
      break;
    case 'left':
      groupPos = [wallPosition[0] - outOffset, 0, wallPosition[2]];
      groupRot = [0, Math.PI / 2, 0];
      break;
    case 'right':
    case 'divider':
    case 'ov_right':
      groupPos = [wallPosition[0] + outOffset, 0, wallPosition[2]];
      groupRot = [0, -Math.PI / 2, 0];
      break;
  }

  const ds = wallCfg.doorSize ?? 'enkel';
  const { doorX, windowXs } = computeOpeningPositions(
    wallLength,
    wallCfg.hasDoor,
    wallCfg.doorPosition ?? 'midden',
    ds,
    wallCfg.windowCount,
  );

  return (
    <group position={groupPos} rotation={groupRot}>
      {wallCfg.hasDoor && (
        <DoorMesh
          x={doorX}
          height={height}
          swing={wallCfg.doorSwing ?? 'dicht'}
          doorSize={ds}
          doorHasWindow={wallCfg.doorHasWindow ?? false}
          doorMaterialId={wallCfg.doorMaterialId ?? 'wood'}
        />
      )}
      {windowXs.map((wx, i) => (
        <WindowMesh key={i} x={wx} />
      ))}
    </group>
  );
}

// ---------- Full glass wall ----------

interface GlassWallMeshProps {
  position: [number, number, number];
  rotation: [number, number, number];
  wallLength: number;
  height: number;
  wallId: WallId;
  isSelected: boolean;
  hovered: boolean;
  pointerHandlers: Record<string, unknown>;
}

function GlassWallMesh({
  position: pos,
  rotation: rot,
  wallLength,
  height,
  wallId,
  isSelected,
  hovered,
  pointerHandlers,
}: GlassWallMeshProps) {
  const isSideWall = wallId === 'left' || wallId === 'right' || wallId === 'divider' || wallId === 'ov_right';
  const glassThickness = 0.02;
  const paneW = wallLength - GLASS_FRAME * 2;
  const paneH = height - GLASS_FRAME * 2;

  // Mullion positions (vertical dividers)
  const mullionXs: number[] = [];
  const mullionCount = Math.max(0, Math.floor(wallLength / MULLION_SPACING) - 1);
  if (mullionCount > 0) {
    const spacing = wallLength / (mullionCount + 1);
    for (let i = 1; i <= mullionCount; i++) {
      mullionXs.push(-wallLength / 2 + spacing * i);
    }
  }

  // Transom Y position (relative to wall center)
  const transomY = -height / 2 + TRANSOM_H;

  const glassSize: [number, number, number] = isSideWall
    ? [glassThickness, paneH, paneW]
    : [paneW, paneH, glassThickness];

  return (
    <group position={pos} rotation={rot}>
      {/* Glass pane */}
      <mesh {...pointerHandlers}>
        <boxGeometry args={glassSize} />
        <meshStandardMaterial
          color="#B8D4E3"
          metalness={0.1}
          roughness={0.05}
          transparent
          opacity={0.3}
          emissive={isSelected ? '#3b82f6' : hovered ? '#60a5fa' : '#000000'}
          emissiveIntensity={isSelected ? 0.35 : hovered ? 0.15 : 0}
        />
      </mesh>

      {/* Frame -- outer border */}
      {/* Top */}
      <mesh position={[0, height / 2 - GLASS_FRAME / 2, 0]} material={frameMat}>
        <boxGeometry args={isSideWall ? [FRAME_D, GLASS_FRAME, wallLength] : [wallLength, GLASS_FRAME, FRAME_D]} />
      </mesh>
      {/* Bottom */}
      <mesh position={[0, -height / 2 + GLASS_FRAME / 2, 0]} material={frameMat}>
        <boxGeometry args={isSideWall ? [FRAME_D, GLASS_FRAME, wallLength] : [wallLength, GLASS_FRAME, FRAME_D]} />
      </mesh>
      {/* Left edge */}
      <mesh position={isSideWall ? [0, 0, -wallLength / 2 + GLASS_FRAME / 2] : [-wallLength / 2 + GLASS_FRAME / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={isSideWall ? [FRAME_D, height, GLASS_FRAME] : [GLASS_FRAME, height, FRAME_D]} />
      </mesh>
      {/* Right edge */}
      <mesh position={isSideWall ? [0, 0, wallLength / 2 - GLASS_FRAME / 2] : [wallLength / 2 - GLASS_FRAME / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={isSideWall ? [FRAME_D, height, GLASS_FRAME] : [GLASS_FRAME, height, FRAME_D]} />
      </mesh>

      {/* Vertical mullions */}
      {mullionXs.map((mx, i) => (
        <mesh key={`m${i}`} position={isSideWall ? [0, 0, mx] : [mx, 0, 0]} material={frameMat}>
          <boxGeometry args={isSideWall ? [FRAME_D, height, GLASS_FRAME * 0.7] : [GLASS_FRAME * 0.7, height, FRAME_D]} />
        </mesh>
      ))}

      {/* Horizontal transom */}
      <mesh position={[0, transomY, 0]} material={frameMat}>
        <boxGeometry args={isSideWall ? [FRAME_D, GLASS_FRAME * 0.7, wallLength] : [wallLength, GLASS_FRAME * 0.7, FRAME_D]} />
      </mesh>
    </group>
  );
}
