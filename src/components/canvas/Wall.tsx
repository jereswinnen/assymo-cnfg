'use client';

import { useRef, useState, useMemo, useEffect } from 'react';
import { Mesh, MeshStandardMaterial, Shape, Path, ExtrudeGeometry } from 'three';
import { Edges } from '@react-three/drei';
import { useConfigStore } from '@/store/useConfigStore';
import { WALL_MATERIALS, WALL_THICKNESS } from '@/lib/constants';
import { useWallTexture } from '@/lib/textures';
import type { WallId, WallConfig, DoorPosition, DoorSwing } from '@/types/building';

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

// ---------- helpers ----------

function computeDoorX(wallLength: number, doorPosition: DoorPosition): number {
  const margin = 0.5;
  const usableHalf = wallLength / 2 - margin - DOOR_W / 2;
  switch (doorPosition) {
    case 'links':
      return -usableHalf;
    case 'rechts':
      return usableHalf;
    case 'midden':
    default:
      return 0;
  }
}

/** Create an ExtrudeGeometry with a rectangular door hole cut out.
 *  The geometry is centered at origin (same bounding box as a BoxGeometry of equal size)
 *  so it can be positioned identically to the box it replaces. */
function createWallWithDoorGeo(
  wallLength: number,
  wallHeight: number,
  thickness: number,
  doorX: number,
  wallId: WallId,
): ExtrudeGeometry {
  const hw = wallLength / 2;
  const hh = wallHeight / 2;

  // Outer rectangle (centered at origin)
  const shape = new Shape();
  shape.moveTo(-hw, -hh);
  shape.lineTo(hw, -hh);
  shape.lineTo(hw, hh);
  shape.lineTo(-hw, hh);
  shape.closePath();

  // Door hole (bottom sits at bottom of wall = -hh)
  const dw = DOOR_W / 2;
  const dh = Math.min(DOOR_H, wallHeight - 0.05);
  const hole = new Path();
  hole.moveTo(doorX - dw, -hh);
  hole.lineTo(doorX + dw, -hh);
  hole.lineTo(doorX + dw, -hh + dh);
  hole.lineTo(doorX - dw, -hh + dh);
  hole.closePath();
  shape.holes.push(hole);

  const geo = new ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
  });

  // Center along extrusion axis (Z)
  geo.translate(0, 0, -thickness / 2);

  // Normalize UVs to 0-1 range so the existing texture repeat works
  const uvAttr = geo.getAttribute('uv');
  for (let i = 0; i < uvAttr.count; i++) {
    const u = uvAttr.getX(i);
    const v = uvAttr.getY(i);
    uvAttr.setXY(i, (u + hw) / wallLength, (v + hh) / wallHeight);
  }
  uvAttr.needsUpdate = true;

  // Rotate geometry so it matches the boxGeometry orientation for each wall type.
  // Front/back boxes are [w, h, t] — the extruded shape is already [w, h, t]. ✓
  // Side wall boxes are [t, h, d] — the extruded shape is [d, h, t], needs 90° Y rotation.
  // Back wall needs PI rotation so "links" maps to the viewer's left from outside.
  switch (wallId) {
    case 'back':
      geo.rotateY(Math.PI);
      break;
    case 'left':
      geo.rotateY(Math.PI / 2);
      break;
    case 'right':
    case 'divider':
      geo.rotateY(-Math.PI / 2);
      break;
  }

  return geo;
}

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

  // Door hole geometry
  const doorX = useMemo(() => {
    if (!wallCfg.hasDoor) return 0;
    return computeDoorX(wallLength, wallCfg.doorPosition ?? 'midden');
  }, [wallCfg.hasDoor, wallCfg.doorPosition, wallLength]);

  const wallGeo = useMemo(() => {
    if (!wallCfg.hasDoor) return null;
    return createWallWithDoorGeo(wallLength, height, WALL_THICKNESS, doorX, wallId);
  }, [wallCfg.hasDoor, wallLength, height, doorX, wallId]);

  // Dispose old geometry when it changes
  useEffect(() => {
    return () => { wallGeo?.dispose(); };
  }, [wallGeo]);

  return (
    <group>
      <mesh
        ref={meshRef}
        position={position}
        rotation={rotation}
        onPointerOver={(e) => {
          if (e.nativeEvent.buttons > 0) return;
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
          const down = pointerDownPos.current;
          if (down) {
            const dx = e.nativeEvent.clientX - down.x;
            const dy = e.nativeEvent.clientY - down.y;
            if (dx * dx + dy * dy > 16) return;
          }
          e.stopPropagation();
          selectElement({ type: 'wall', id: wallId });
        }}
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

  const { doorX, windowXs } = computeOpeningPositions(
    wallLength,
    wallCfg.hasDoor,
    wallCfg.doorPosition ?? 'midden',
    wallCfg.windowCount,
  );

  return (
    <group position={groupPos} rotation={groupRot}>
      {wallCfg.hasDoor && (
        <DoorMesh
          x={doorX}
          height={height}
          swing={wallCfg.doorSwing ?? 'naar_buiten'}
        />
      )}
      {windowXs.map((wx, i) => (
        <WindowMesh key={i} x={wx} />
      ))}
    </group>
  );
}

function computeOpeningPositions(
  wallLength: number,
  hasDoor: boolean,
  doorPosition: DoorPosition,
  windowCount: number,
) {
  const margin = 0.5;
  let doorX = 0;
  const windowXs: number[] = [];

  if (hasDoor) {
    doorX = computeDoorX(wallLength, doorPosition);
  }

  if (hasDoor && windowCount > 0) {
    const doorLeft = doorX - DOOR_W / 2 - 0.3;
    const doorRight = doorX + DOOR_W / 2 + 0.3;
    const wallLeft = -wallLength / 2 + margin;
    const wallRight = wallLength / 2 - margin;

    const spans: [number, number][] = [];
    if (doorLeft - wallLeft > WIN_W) spans.push([wallLeft, doorLeft]);
    if (wallRight - doorRight > WIN_W) spans.push([doorRight, wallRight]);

    const totalSpan = spans.reduce((s, [a, b]) => s + (b - a), 0);
    let placed = 0;
    for (const [start, end] of spans) {
      const spanLen = end - start;
      const count = Math.round((spanLen / totalSpan) * windowCount) || 0;
      const toPlace = Math.min(count, windowCount - placed);
      if (toPlace > 0) {
        const step = spanLen / toPlace;
        for (let i = 0; i < toPlace; i++) {
          windowXs.push(start + step * (i + 0.5));
        }
        placed += toPlace;
      }
    }
    while (placed < windowCount && spans.length > 0) {
      const [start, end] = spans[spans.length - 1];
      const step = (end - start) / (windowCount - placed + 1);
      windowXs.push(start + step);
      placed++;
    }
  } else if (windowCount > 0) {
    const usable = wallLength - 2 * margin;
    const step = usable / windowCount;
    for (let i = 0; i < windowCount; i++) {
      windowXs.push(-wallLength / 2 + margin + step * (i + 0.5));
    }
  }

  return { doorX, windowXs };
}

function DoorMesh({ x, height, swing }: { x: number; height: number; swing: DoorSwing }) {
  const doorY = DOOR_H / 2;
  const dh = Math.min(DOOR_H, height - 0.1);

  // In the WallOpenings local space, +Z = outward from wall.
  // Three.js Y-rotation: positive angle rotates +X toward -Z (inward).
  // So: naar_binnen = positive angle, naar_buiten = negative angle.
  const swingAngle = swing === 'naar_binnen' ? Math.PI / 3 : -Math.PI / 3;

  return (
    <group position={[x, doorY, 0]}>
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
      {/* Door panel — hinged on left side */}
      <group position={[-DOOR_W / 2, 0, 0]} rotation={[0, swingAngle, 0]}>
        <mesh position={[DOOR_W / 2, 0, 0]} material={doorMat}>
          <boxGeometry args={[DOOR_W, dh, DOOR_DEPTH]} />
        </mesh>
        {/* Handle */}
        <mesh position={[DOOR_W - 0.12, 0, DOOR_DEPTH / 2 + 0.01]} material={handleMat}>
          <boxGeometry args={[0.04, 0.15, 0.03]} />
        </mesh>
      </group>
    </group>
  );
}

function WindowMesh({ x }: { x: number }) {
  const winY = WIN_SILL + WIN_H / 2;

  return (
    <group position={[x, winY, 0]}>
      {/* Dark backing to simulate interior void */}
      <mesh position={[0, 0, -0.015]} material={voidMat} renderOrder={-1}>
        <boxGeometry args={[WIN_W + 0.02, WIN_H + 0.02, 0.03]} />
      </mesh>
      {/* Glass pane */}
      <mesh material={glassMat}>
        <boxGeometry args={[WIN_W, WIN_H, WIN_DEPTH]} />
      </mesh>
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
