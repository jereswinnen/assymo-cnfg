'use client';

import { useRef, useMemo, useEffect } from 'react';
import { Group, MeshStandardMaterial, MathUtils } from 'three';
import { useFrame } from '@react-three/fiber';
import { DOUBLE_DOOR_W, DOOR_W } from '@/lib/constants';
import { useDoorTexture } from '@/lib/textures';
import { createDoorPanelWithWindowGeo } from './wallGeometry';
import { DOOR_H, DOOR_DEPTH, FRAME_T, FRAME_D } from './wallGeometry';
import type { DoorSwing, DoorSize, DoorMaterialId } from '@/types/building';

// Door panel material configs (color when no texture, and material properties).
// Wood matches the wall's meshStandardMaterial exactly (same metalness, tint,
// env intensity) so a wooden door blends into a wooden wall.
const DOOR_MAT_CFG: Record<DoorMaterialId, { color: string; tint: string; metalness: number; roughness: number; envMapIntensity: number }> = {
  wood:      { color: '#8B6840', tint: '#C4955A', metalness: 0.1,  roughness: 0.7,  envMapIntensity: 0.3 },
  aluminium: { color: '#2A2A2A', tint: '#ffffff', metalness: 0.7,  roughness: 0.25, envMapIntensity: 1.0 },
  pvc:       { color: '#1E1E1E', tint: '#ffffff', metalness: 0.05, roughness: 0.4,  envMapIntensity: 1.0 },
  staal:     { color: '#2C2C2C', tint: '#ffffff', metalness: 0.85, roughness: 0.2,  envMapIntensity: 1.0 },
};

// Handle materials: dark for wood, light for the rest
const HANDLE_DARK = new MeshStandardMaterial({ color: '#333333', metalness: 0.7, roughness: 0.3, emissive: '#222222', emissiveIntensity: 0.3 });
const HANDLE_LIGHT = new MeshStandardMaterial({ color: '#E0E0E0', metalness: 0.9, roughness: 0.1, emissive: '#999999', emissiveIntensity: 0.4 });

function getHandleMat(matId: DoorMaterialId): MeshStandardMaterial {
  return matId === 'wood' ? HANDLE_DARK : HANDLE_LIGHT;
}

export const frameMat = new MeshStandardMaterial({ color: '#2A2A2A', metalness: 0.4, roughness: 0.3, envMapIntensity: 0.8 });
export const glassMat = new MeshStandardMaterial({ color: '#B8D4E3', metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.3, envMapIntensity: 1.5 });

const SWING_SPEED = 5; // lerp speed factor

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

interface DoorMeshProps {
  x: number;
  height: number;
  swing: DoorSwing;
  doorSize: DoorSize;
  doorHasWindow: boolean;
  doorMaterialId: DoorMaterialId;
  doorMirror?: boolean;
}

export default function DoorMesh({ x, height, swing, doorSize, doorHasWindow, doorMaterialId, doorMirror = false }: DoorMeshProps) {
  const doorY = DOOR_H / 2;
  const dh = Math.min(DOOR_H, height - 0.1);
  const panelW = doorSize === 'dubbel' ? DOUBLE_DOOR_W / 2 : DOOR_W;
  const totalW = doorSize === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W;
  const hMat = getHandleMat(doorMaterialId);
  const mc = DOOR_MAT_CFG[doorMaterialId];
  const doorTex = useDoorTexture(doorMaterialId, panelW, dh);
  const panelColor = doorTex ? mc.tint : mc.color;

  // Mirror only applies to single doors (dubbel is already symmetric)
  const mirror = doorMirror && doorSize !== 'dubbel' ? -1 : 1;

  // Target angle: dicht=0, naar_binnen=+60deg, naar_buiten=-60deg.
  // Flipping the hinge to the opposite edge also flips the swing direction so
  // "naar_buiten" still opens outward.
  let targetAngle = 0;
  if (swing === 'naar_binnen') {
    targetAngle = Math.PI / 3;
  } else if (swing === 'naar_buiten') {
    targetAngle = -Math.PI / 3;
  }
  const singleAngle = mirror * targetAngle;

  // Animated hinge refs
  const hingeA = useRef<Group>(null);
  const hingeB = useRef<Group>(null);

  useFrame((_, delta) => {
    const t = Math.min(1, delta * SWING_SPEED);
    if (hingeA.current) {
      const target = doorSize === 'dubbel' ? targetAngle : singleAngle;
      hingeA.current.rotation.y = MathUtils.lerp(hingeA.current.rotation.y, target, t);
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
        {/* Left panel -- hinged on left edge */}
        <group ref={hingeA} position={[-totalW / 2, 0, 0]}>
          <mesh position={[panelW / 2, 0, 0]}>
            {panelGeoA ? (
              <primitive object={panelGeoA} attach="geometry" />
            ) : (
              <boxGeometry args={[panelW, dh, DOOR_DEPTH]} />
            )}
            <meshStandardMaterial color={panelColor} map={doorTex?.map ?? undefined} normalMap={doorTex?.normalMap ?? undefined} roughnessMap={doorTex?.roughnessMap ?? undefined} metalness={mc.metalness} roughness={doorTex?.roughnessMap ? 1 : mc.roughness} envMapIntensity={mc.envMapIntensity} />
          </mesh>
          {doorHasWindow && <DoorGlass cx={panelW / 2} panelW={panelW} dh={dh} />}
          <mesh position={[panelW - 0.12, 0, DOOR_DEPTH / 2 + 0.01]} material={hMat}>
            <boxGeometry args={[0.05, 0.2, 0.04]} />
          </mesh>
        </group>
        {/* Right panel -- hinged on right edge (mirror swing) */}
        <group ref={hingeB} position={[totalW / 2, 0, 0]}>
          <mesh position={[-panelW / 2, 0, 0]}>
            {panelGeoB ? (
              <primitive object={panelGeoB} attach="geometry" />
            ) : (
              <boxGeometry args={[panelW, dh, DOOR_DEPTH]} />
            )}
            <meshStandardMaterial color={panelColor} map={doorTex?.map ?? undefined} normalMap={doorTex?.normalMap ?? undefined} roughnessMap={doorTex?.roughnessMap ?? undefined} metalness={mc.metalness} roughness={doorTex?.roughnessMap ? 1 : mc.roughness} envMapIntensity={mc.envMapIntensity} />
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
      {/* Door panel -- hinged on left side (or right when mirrored) */}
      <group ref={hingeA} position={[mirror * -totalW / 2, 0, 0]}>
        <mesh position={[mirror * panelW / 2, 0, 0]}>
          {panelGeoA ? (
            <primitive object={panelGeoA} attach="geometry" />
          ) : (
            <boxGeometry args={[panelW, dh, DOOR_DEPTH]} />
          )}
          <meshStandardMaterial color={panelColor} map={doorTex?.map ?? undefined} normalMap={doorTex?.normalMap ?? undefined} roughnessMap={doorTex?.roughnessMap ?? undefined} metalness={mc.metalness} roughness={doorTex?.roughnessMap ? 1 : mc.roughness} envMapIntensity={mc.envMapIntensity} />
        </mesh>
        {doorHasWindow && <DoorGlass cx={mirror * panelW / 2} panelW={panelW} dh={dh} />}
        {/* Handle */}
        <mesh position={[mirror * (panelW - 0.12), 0, DOOR_DEPTH / 2 + 0.01]} material={hMat}>
          <boxGeometry args={[0.05, 0.2, 0.04]} />
        </mesh>
      </group>
    </group>
  );
}
