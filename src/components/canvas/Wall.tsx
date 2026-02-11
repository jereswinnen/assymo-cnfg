'use client';

import { useRef, useState, useMemo } from 'react';
import { Mesh, MeshStandardMaterial } from 'three';
import { Edges } from '@react-three/drei';
import { useConfigStore } from '@/store/useConfigStore';
import { WALL_MATERIALS, WALL_THICKNESS } from '@/lib/constants';
import { useWallTexture } from '@/lib/textures';
import type { WallId, WallConfig } from '@/types/building';

const DOOR_W = 0.9;
const DOOR_H = 2.1;
const DOOR_DEPTH = 0.05;
const WIN_W = 1.2;
const WIN_H = 1.0;
const WIN_SILL = 1.2; // height of windowsill from ground
const WIN_DEPTH = 0.03;
const FRAME_T = 0.04; // frame bar thickness
const FRAME_D = 0.04; // frame bar depth

const doorMat = new MeshStandardMaterial({ color: '#3E2B1C', metalness: 0.1, roughness: 0.6 });
const frameMat = new MeshStandardMaterial({ color: '#2A2A2A', metalness: 0.4, roughness: 0.3 });
const glassMat = new MeshStandardMaterial({ color: '#B8D4E3', metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.3 });
const voidMat = new MeshStandardMaterial({ color: '#1a1a2e', metalness: 0, roughness: 1 });
const handleMat = new MeshStandardMaterial({ color: '#888888', metalness: 0.6, roughness: 0.3 });

interface WallProps {
  wallId: WallId;
  sectionWidth?: number;
  sectionDepth?: number;
  offsetX?: number;
}

export default function Wall({ wallId, sectionWidth, sectionDepth, offsetX = 0 }: WallProps) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const config = useConfigStore((s) => s.config);
  const selectedElement = useConfigStore((s) => s.selectedElement);
  const selectElement = useConfigStore((s) => s.selectElement);

  const { width: fullWidth, depth: fullDepth, height } = config.dimensions;
  const w = sectionWidth ?? fullWidth;
  const d = sectionDepth ?? fullDepth;

  const wallCfg = config.walls[wallId];
  const materialId = wallCfg?.materialId ?? 'brick';
  const material = WALL_MATERIALS.find((m) => m.id === materialId);
  const color = material?.color ?? '#cccccc';

  // Wall face dimensions for texture tiling
  const wallLength = wallId === 'front' || wallId === 'back' ? w : d;
  const texture = useWallTexture(materialId, wallLength, height);

  if (!wallCfg) return null;

  const isSelected =
    selectedElement?.type === 'wall' && selectedElement.id === wallId;

  const { size, position, rotation } = useMemo(() => {
    const t = WALL_THICKNESS;
    // Small inset so walls sit just inside the timber frame (prevents z-fighting with posts)
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
    }
  }, [wallId, w, d, height, offsetX]);

  return (
    <group>
      <mesh
        ref={meshRef}
        position={position}
        rotation={rotation}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
        onClick={(e) => {
          e.stopPropagation();
          selectElement({ type: 'wall', id: wallId });
        }}
      >
        <boxGeometry args={size} />
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
        wallLength={wallId === 'front' || wallId === 'back' ? w : d}
        height={height}
        wallCfg={wallCfg}
      />
    </group>
  );
}

// --- Door & Window overlays ---

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

  // Determine group position (at outer face) and rotation
  let groupPos: [number, number, number];
  let groupRot: [number, number, number] = [0, 0, 0];

  switch (wallId) {
    case 'front':
      groupPos = [wallPosition[0], 0, wallPosition[2] + outOffset];
      break;
    case 'back':
      groupPos = [wallPosition[0], 0, wallPosition[2] - outOffset];
      groupRot = [0, Math.PI, 0];
      break;
    case 'left':
      groupPos = [wallPosition[0] - outOffset, 0, wallPosition[2]];
      groupRot = [0, Math.PI / 2, 0];
      break;
    case 'right':
    case 'divider':
      groupPos = [wallPosition[0] + outOffset, 0, wallPosition[2]];
      groupRot = [0, -Math.PI / 2, 0];
      break;
  }

  // Compute horizontal positions for openings
  const { doorX, windowXs } = computeOpeningPositions(wallLength, wallCfg.hasDoor, wallCfg.windowCount);

  return (
    <group position={groupPos} rotation={groupRot}>
      {wallCfg.hasDoor && <DoorMesh x={doorX} height={height} />}
      {windowXs.map((wx, i) => (
        <WindowMesh key={i} x={wx} />
      ))}
    </group>
  );
}

function computeOpeningPositions(wallLength: number, hasDoor: boolean, windowCount: number) {
  const margin = 0.5;
  let doorX = 0;
  const windowXs: number[] = [];

  if (hasDoor && windowCount > 0) {
    doorX = -wallLength / 5;
    const winStart = doorX + DOOR_W / 2 + 0.4;
    const winEnd = wallLength / 2 - margin;
    const span = winEnd - winStart;
    if (span > 0 && windowCount > 0) {
      const step = span / windowCount;
      for (let i = 0; i < windowCount; i++) {
        windowXs.push(winStart + step * (i + 0.5));
      }
    }
  } else if (hasDoor) {
    doorX = 0;
  } else if (windowCount > 0) {
    const usable = wallLength - 2 * margin;
    const step = usable / windowCount;
    for (let i = 0; i < windowCount; i++) {
      windowXs.push(-wallLength / 2 + margin + step * (i + 0.5));
    }
  }

  return { doorX, windowXs };
}

function DoorMesh({ x, height }: { x: number; height: number }) {
  const doorY = DOOR_H / 2;
  // Scale door if it's taller than wall
  const dh = Math.min(DOOR_H, height - 0.1);

  return (
    <group position={[x, doorY, 0]}>
      {/* Door panel */}
      <mesh material={doorMat}>
        <boxGeometry args={[DOOR_W, dh, DOOR_DEPTH]} />
      </mesh>
      {/* Frame top */}
      <mesh position={[0, dh / 2 + FRAME_T / 2, 0]} material={frameMat}>
        <boxGeometry args={[DOOR_W + FRAME_T * 2, FRAME_T, FRAME_D]} />
      </mesh>
      {/* Frame left */}
      <mesh position={[-DOOR_W / 2 - FRAME_T / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T, dh + FRAME_T, FRAME_D]} />
      </mesh>
      {/* Frame right */}
      <mesh position={[DOOR_W / 2 + FRAME_T / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T, dh + FRAME_T, FRAME_D]} />
      </mesh>
      {/* Handle */}
      <mesh position={[DOOR_W / 2 - 0.12, 0, DOOR_DEPTH / 2 + 0.01]} material={handleMat}>
        <boxGeometry args={[0.04, 0.15, 0.03]} />
      </mesh>
    </group>
  );
}

function WindowMesh({ x }: { x: number }) {
  const winY = WIN_SILL + WIN_H / 2;

  return (
    <group position={[x, winY, 0]}>
      {/* Dark backing to simulate interior void — covers wall surface behind glass */}
      <mesh position={[0, 0, -0.015]} material={voidMat} renderOrder={-1}>
        <boxGeometry args={[WIN_W + 0.02, WIN_H + 0.02, 0.03]} />
      </mesh>
      {/* Glass pane */}
      <mesh material={glassMat}>
        <boxGeometry args={[WIN_W, WIN_H, WIN_DEPTH]} />
      </mesh>
      {/* Frame edges */}
      {/* Top */}
      <mesh position={[0, WIN_H / 2 + FRAME_T / 2, 0]} material={frameMat}>
        <boxGeometry args={[WIN_W + FRAME_T * 2, FRAME_T, FRAME_D]} />
      </mesh>
      {/* Bottom */}
      <mesh position={[0, -WIN_H / 2 - FRAME_T / 2, 0]} material={frameMat}>
        <boxGeometry args={[WIN_W + FRAME_T * 2, FRAME_T, FRAME_D]} />
      </mesh>
      {/* Left */}
      <mesh position={[-WIN_W / 2 - FRAME_T / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T, WIN_H + FRAME_T * 2, FRAME_D]} />
      </mesh>
      {/* Right */}
      <mesh position={[WIN_W / 2 + FRAME_T / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T, WIN_H + FRAME_T * 2, FRAME_D]} />
      </mesh>
      {/* Cross dividers - vertical */}
      <mesh material={frameMat}>
        <boxGeometry args={[FRAME_T * 0.7, WIN_H, FRAME_D]} />
      </mesh>
      {/* Cross dividers - horizontal */}
      <mesh material={frameMat}>
        <boxGeometry args={[WIN_W, FRAME_T * 0.7, FRAME_D]} />
      </mesh>
    </group>
  );
}
