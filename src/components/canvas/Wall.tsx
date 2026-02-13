'use client';

import { useRef, useState, useMemo, useEffect } from 'react';
import { Group, Mesh, MeshStandardMaterial, Shape, Path, ExtrudeGeometry, MathUtils } from 'three';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import { useConfigStore } from '@/store/useConfigStore';
import { WALL_MATERIALS, WALL_THICKNESS, DOUBLE_DOOR_W } from '@/lib/constants';
import { useWallTexture, useDoorTexture } from '@/lib/textures';
import type { WallId, WallConfig, DoorPosition, DoorSwing, DoorSize, DoorMaterialId } from '@/types/building';

const DOOR_W = 0.9;
const DOOR_H = 2.1;
const DOOR_DEPTH = 0.05;
const DOUBLE_W = DOUBLE_DOOR_W; // 1.6m for double doors
const WIN_W = 1.2;
const WIN_H = 1.0;
const WIN_SILL = 1.2; // height of windowsill from ground
const WIN_DEPTH = 0.03;
const FRAME_T = 0.04; // frame bar thickness
const FRAME_D = 0.04; // frame bar depth

// Door panel material configs (color when no texture, and material properties)
const DOOR_MAT_CFG: Record<DoorMaterialId, { color: string; metalness: number; roughness: number; emissive: string; emissiveIntensity: number }> = {
  wood: { color: '#8B6840', metalness: 0.05, roughness: 0.7, emissive: '#3A2810', emissiveIntensity: 0.3 },
  aluminium: { color: '#2A2A2A', metalness: 0.7, roughness: 0.25, emissive: '#1A1A1A', emissiveIntensity: 0.25 },
  pvc: { color: '#1E1E1E', metalness: 0.05, roughness: 0.4, emissive: '#151515', emissiveIntensity: 0.25 },
  staal: { color: '#2C2C2C', metalness: 0.85, roughness: 0.2, emissive: '#1A1A1A', emissiveIntensity: 0.25 },
};

// Handle materials: dark for wood, light for the rest
const HANDLE_DARK = new MeshStandardMaterial({ color: '#333333', metalness: 0.7, roughness: 0.3, emissive: '#222222', emissiveIntensity: 0.3 });
const HANDLE_LIGHT = new MeshStandardMaterial({ color: '#E0E0E0', metalness: 0.9, roughness: 0.1, emissive: '#999999', emissiveIntensity: 0.4 });

function getHandleMat(matId: DoorMaterialId) {
  return matId === 'wood' ? HANDLE_DARK : HANDLE_LIGHT;
}

const frameMat = new MeshStandardMaterial({ color: '#2A2A2A', metalness: 0.4, roughness: 0.3 });
const glassMat = new MeshStandardMaterial({ color: '#B8D4E3', metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.3 });

// ---------- helpers ----------

function doorWidth(doorSize: DoorSize): number {
  return doorSize === 'dubbel' ? DOUBLE_W : DOOR_W;
}

function computeDoorX(wallLength: number, doorPosition: DoorPosition, doorSize: DoorSize): number {
  const margin = 0.5;
  const dw = doorWidth(doorSize);
  const usableHalf = wallLength / 2 - margin - dw / 2;
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

/** Create an ExtrudeGeometry with rectangular holes for doors and/or windows.
 *  The geometry is centered at origin (same bounding box as a BoxGeometry of equal size)
 *  so it can be positioned identically to the box it replaces. */
function createWallWithOpeningsGeo(
  wallLength: number,
  wallHeight: number,
  thickness: number,
  wallId: WallId,
  doorX: number | null,
  doorSize: DoorSize,
  windowXs: number[],
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

  // Door hole (bottom at ground level)
  if (doorX !== null) {
    const dw = doorWidth(doorSize) / 2;
    const dh = Math.min(DOOR_H, wallHeight - 0.05);
    const hole = new Path();
    hole.moveTo(doorX - dw, -hh);
    hole.lineTo(doorX + dw, -hh);
    hole.lineTo(doorX + dw, -hh + dh);
    hole.lineTo(doorX - dw, -hh + dh);
    hole.closePath();
    shape.holes.push(hole);
  }

  // Window holes
  for (const wx of windowXs) {
    const ww = WIN_W / 2;
    const winBottom = -hh + WIN_SILL;
    const winTop = winBottom + WIN_H;
    const hole = new Path();
    hole.moveTo(wx - ww, winBottom);
    hole.lineTo(wx + ww, winBottom);
    hole.lineTo(wx + ww, winTop);
    hole.lineTo(wx - ww, winTop);
    hole.closePath();
    shape.holes.push(hole);
  }

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
  switch (wallId) {
    case 'back':
    case 'ov_back':
      geo.rotateY(Math.PI);
      break;
    case 'left':
      geo.rotateY(Math.PI / 2);
      break;
    case 'right':
    case 'divider':
    case 'ov_right':
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

function computeOpeningPositions(
  wallLength: number,
  hasDoor: boolean,
  doorPosition: DoorPosition,
  doorSize: DoorSize,
  windowCount: number,
) {
  const margin = 0.5;
  let doorX = 0;
  const windowXs: number[] = [];
  const dw = doorWidth(doorSize);

  if (hasDoor) {
    doorX = computeDoorX(wallLength, doorPosition, doorSize);
  }

  if (hasDoor && windowCount > 0) {
    const doorLeft = doorX - dw / 2 - 0.3;
    const doorRight = doorX + dw / 2 + 0.3;
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

/** Create door panel ExtrudeGeometry with a window hole cut out */
function createDoorPanelWithWindowGeo(panelW: number, panelH: number): ExtrudeGeometry {
  const hw = panelW / 2;
  const hh = panelH / 2;

  const shape = new Shape();
  shape.moveTo(-hw, -hh);
  shape.lineTo(hw, -hh);
  shape.lineTo(hw, hh);
  shape.lineTo(-hw, hh);
  shape.closePath();

  const glassW = panelW - 0.16;
  const glassH = panelH * 0.35;
  const glassTop = hh - 0.08;
  const glassBottom = glassTop - glassH;
  const ghw = glassW / 2;

  const hole = new Path();
  hole.moveTo(-ghw, glassBottom);
  hole.lineTo(ghw, glassBottom);
  hole.lineTo(ghw, glassTop);
  hole.lineTo(-ghw, glassTop);
  hole.closePath();
  shape.holes.push(hole);

  const geo = new ExtrudeGeometry(shape, { depth: DOOR_DEPTH, bevelEnabled: false });
  geo.translate(0, 0, -DOOR_DEPTH / 2);
  return geo;
}

/** Glass pane + cross dividers that sit inside a door panel cutout */
function DoorGlass({ cx, panelW, dh }: { cx: number; panelW: number; dh: number }) {
  const glassH = dh * 0.35;
  const glassY = dh / 2 - 0.08 - glassH / 2;
  const glassW = panelW - 0.16;

  return (
    <>
      <mesh position={[cx, glassY, 0]} material={glassMat}>
        <boxGeometry args={[glassW, glassH, 0.005]} />
      </mesh>
      <mesh position={[cx, glassY, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T * 0.5, glassH, DOOR_DEPTH + 0.002]} />
      </mesh>
      <mesh position={[cx, glassY, 0]} material={frameMat}>
        <boxGeometry args={[glassW, FRAME_T * 0.5, DOOR_DEPTH + 0.002]} />
      </mesh>
    </>
  );
}

const SWING_SPEED = 5; // lerp speed factor

function DoorMesh({ x, height, swing, doorSize, doorHasWindow, doorMaterialId }: {
  x: number; height: number; swing: DoorSwing; doorSize: DoorSize; doorHasWindow: boolean; doorMaterialId: DoorMaterialId;
}) {
  const doorY = DOOR_H / 2;
  const dh = Math.min(DOOR_H, height - 0.1);
  const panelW = doorSize === 'dubbel' ? DOUBLE_W / 2 : DOOR_W;
  const totalW = doorSize === 'dubbel' ? DOUBLE_W : DOOR_W;
  const hMat = getHandleMat(doorMaterialId);
  const mc = DOOR_MAT_CFG[doorMaterialId];
  const doorTex = useDoorTexture(doorMaterialId, panelW, dh);
  const panelColor = doorTex ? '#ffffff' : mc.color;

  // Target angle: dicht=0, naar_binnen=+60°, naar_buiten=-60°
  const targetAngle =
    swing === 'naar_binnen' ? Math.PI / 3
    : swing === 'naar_buiten' ? -Math.PI / 3
    : 0;

  // Animated hinge refs
  const hingeA = useRef<Group>(null);
  const hingeB = useRef<Group>(null);

  useFrame((_, delta) => {
    const t = Math.min(1, delta * SWING_SPEED);
    if (hingeA.current) {
      hingeA.current.rotation.y = MathUtils.lerp(hingeA.current.rotation.y, targetAngle, t);
    }
    if (hingeB.current) {
      hingeB.current.rotation.y = MathUtils.lerp(hingeB.current.rotation.y, -targetAngle, t);
    }
  });

  // Door panel geometry with window cutout (one per panel that needs it)
  const panelGeoA = useMemo(() => {
    if (!doorHasWindow) return null;
    return createDoorPanelWithWindowGeo(panelW, dh);
  }, [doorHasWindow, panelW, dh]);

  const panelGeoB = useMemo(() => {
    if (!doorHasWindow || doorSize !== 'dubbel') return null;
    return createDoorPanelWithWindowGeo(panelW, dh);
  }, [doorHasWindow, doorSize, panelW, dh]);

  useEffect(() => {
    return () => {
      panelGeoA?.dispose();
      panelGeoB?.dispose();
    };
  }, [panelGeoA, panelGeoB]);

  if (doorSize === 'dubbel') {
    return (
      <group position={[x, doorY, 0]}>
        {/* Frame top */}
        <mesh position={[0, dh / 2 + FRAME_T / 2, 0]} material={frameMat}>
          <boxGeometry args={[totalW + FRAME_T * 2, FRAME_T, FRAME_D]} />
        </mesh>
        {/* Frame left */}
        <mesh position={[-totalW / 2 - FRAME_T / 2, 0, 0]} material={frameMat}>
          <boxGeometry args={[FRAME_T, dh + FRAME_T, FRAME_D]} />
        </mesh>
        {/* Frame right */}
        <mesh position={[totalW / 2 + FRAME_T / 2, 0, 0]} material={frameMat}>
          <boxGeometry args={[FRAME_T, dh + FRAME_T, FRAME_D]} />
        </mesh>
        {/* Left panel — hinged on left edge */}
        <group ref={hingeA} position={[-totalW / 2, 0, 0]}>
          <mesh position={[panelW / 2, 0, 0]}>
            {panelGeoA ? (
              <primitive object={panelGeoA} attach="geometry" />
            ) : (
              <boxGeometry args={[panelW, dh, DOOR_DEPTH]} />
            )}
            <meshStandardMaterial color={panelColor} map={doorTex ?? undefined} metalness={mc.metalness} roughness={mc.roughness} emissive={mc.emissive} emissiveIntensity={mc.emissiveIntensity} />
          </mesh>
          {doorHasWindow && <DoorGlass cx={panelW / 2} panelW={panelW} dh={dh} />}
          <mesh position={[panelW - 0.12, 0, DOOR_DEPTH / 2 + 0.01]} material={hMat}>
            <boxGeometry args={[0.05, 0.2, 0.04]} />
          </mesh>
        </group>
        {/* Right panel — hinged on right edge (mirror swing) */}
        <group ref={hingeB} position={[totalW / 2, 0, 0]}>
          <mesh position={[-panelW / 2, 0, 0]}>
            {panelGeoB ? (
              <primitive object={panelGeoB} attach="geometry" />
            ) : (
              <boxGeometry args={[panelW, dh, DOOR_DEPTH]} />
            )}
            <meshStandardMaterial color={panelColor} map={doorTex ?? undefined} metalness={mc.metalness} roughness={mc.roughness} emissive={mc.emissive} emissiveIntensity={mc.emissiveIntensity} />
          </mesh>
          {doorHasWindow && <DoorGlass cx={-panelW / 2} panelW={panelW} dh={dh} />}
          <mesh position={[-panelW + 0.12, 0, DOOR_DEPTH / 2 + 0.01]} material={hMat}>
            <boxGeometry args={[0.05, 0.2, 0.04]} />
          </mesh>
        </group>
      </group>
    );
  }

  // Single door
  return (
    <group position={[x, doorY, 0]}>
      {/* Frame top */}
      <mesh position={[0, dh / 2 + FRAME_T / 2, 0]} material={frameMat}>
        <boxGeometry args={[totalW + FRAME_T * 2, FRAME_T, FRAME_D]} />
      </mesh>
      {/* Frame left */}
      <mesh position={[-totalW / 2 - FRAME_T / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T, dh + FRAME_T, FRAME_D]} />
      </mesh>
      {/* Frame right */}
      <mesh position={[totalW / 2 + FRAME_T / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T, dh + FRAME_T, FRAME_D]} />
      </mesh>
      {/* Door panel — hinged on left side */}
      <group ref={hingeA} position={[-totalW / 2, 0, 0]}>
        <mesh position={[panelW / 2, 0, 0]}>
          {panelGeoA ? (
            <primitive object={panelGeoA} attach="geometry" />
          ) : (
            <boxGeometry args={[panelW, dh, DOOR_DEPTH]} />
          )}
          <meshStandardMaterial color={panelColor} map={doorTex ?? undefined} metalness={mc.metalness} roughness={mc.roughness} emissive={mc.emissive} emissiveIntensity={mc.emissiveIntensity} />
        </mesh>
        {doorHasWindow && <DoorGlass cx={panelW / 2} panelW={panelW} dh={dh} />}
        {/* Handle */}
        <mesh position={[panelW - 0.12, 0, DOOR_DEPTH / 2 + 0.01]} material={hMat}>
          <boxGeometry args={[0.05, 0.2, 0.04]} />
        </mesh>
      </group>
    </group>
  );
}

function WindowMesh({ x }: { x: number }) {
  const winY = WIN_SILL + WIN_H / 2;

  return (
    <group position={[x, winY, 0]}>
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

// ---------- Full glass wall ----------

const MULLION_SPACING = 1.2; // vertical mullion every 1.2m
const TRANSOM_H = 1.3; // horizontal transom height from bottom
const GLASS_FRAME = 0.05; // frame bar thickness for glass wall

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
  // Determine local axes based on wall orientation
  const isSideWall = wallId === 'left' || wallId === 'right' || wallId === 'divider' || wallId === 'ov_right';
  // Glass pane sits in the wall plane
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

  // For side walls, the "width" is along Z and "thickness" along X
  // For front/back walls, "width" is along X and "thickness" along Z
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

      {/* Frame — outer border */}
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
