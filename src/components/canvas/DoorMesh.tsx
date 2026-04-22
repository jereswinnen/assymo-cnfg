'use client';

import { useRef, useMemo, useEffect } from 'react';
import { Group, MeshStandardMaterial, MathUtils, ClampToEdgeWrapping, TextureLoader } from 'three';
import { useFrame, useLoader } from '@react-three/fiber';
import { DOUBLE_DOOR_W, DOOR_W } from '@/domain/building';
import { useDoorTexture } from '@/lib/textures';
import { createDoorPanelWithWindowGeo } from './wallGeometry';
import { DOOR_H, DOOR_DEPTH, FRAME_T, FRAME_D } from './wallGeometry';
import type { DoorSwing, DoorSize } from '@/domain/building';
import { getAtomColor } from '@/domain/materials';
import type { MaterialRow } from '@/domain/catalog';
import type { SupplierProductRow } from '@/domain/supplier';
import { useTenant } from '@/lib/TenantProvider';

// Door panel material configs for the legacy fixed-set (wood/aluminium/pvc/staal).
// Cladding atoms (vurenvert, bevelhorz, etc.) fall back to a wood-like config —
// they're textured wood variants so this matches the visual.
const DOOR_MAT_CFG: Record<string, { color: string; tint: string; metalness: number; roughness: number; envMapIntensity: number }> = {
  wood:      { color: '#8B6840', tint: '#C4955A', metalness: 0.1,  roughness: 0.7,  envMapIntensity: 0.3 },
  aluminium: { color: '#2A2A2A', tint: '#ffffff', metalness: 0.7,  roughness: 0.25, envMapIntensity: 1.0 },
  pvc:       { color: '#1E1E1E', tint: '#ffffff', metalness: 0.05, roughness: 0.4,  envMapIntensity: 1.0 },
  staal:     { color: '#2C2C2C', tint: '#ffffff', metalness: 0.85, roughness: 0.2,  envMapIntensity: 1.0 },
};

const DEFAULT_DOOR_MAT = { tint: '#ffffff', metalness: 0.1, roughness: 0.7, envMapIntensity: 0.3 };

function resolveDoorMatCfg(matId: string, materials: MaterialRow[]) {
  const cfg = DOOR_MAT_CFG[matId];
  if (cfg) return cfg;
  return { ...DEFAULT_DOOR_MAT, color: getAtomColor(materials, matId, 'door') };
}

// Handle materials: dark for wood-like, light for hard finishes.
const HANDLE_DARK = new MeshStandardMaterial({ color: '#333333', metalness: 0.7, roughness: 0.3, emissive: '#222222', emissiveIntensity: 0.3 });
const HANDLE_LIGHT = new MeshStandardMaterial({ color: '#E0E0E0', metalness: 0.9, roughness: 0.1, emissive: '#999999', emissiveIntensity: 0.4 });

function getHandleMat(matId: string): MeshStandardMaterial {
  // Aluminium/pvc/staal get the light handle; everything else (wood + cladding) gets dark.
  return matId === 'aluminium' || matId === 'pvc' || matId === 'staal'
    ? HANDLE_LIGHT
    : HANDLE_DARK;
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
  doorMaterialId: string;
  doorMirror?: boolean;
  supplierProduct?: SupplierProductRow;
}

/** Renders a supplier door using its fixed width × height and optional hero image. */
function SupplierDoorMesh({ x, supplierProduct, swing }: { x: number; supplierProduct: SupplierProductRow; swing: DoorSwing }) {
  const w = supplierProduct.widthMm / 1000;
  const h = supplierProduct.heightMm / 1000;
  const doorY = h / 2;

  // Target angle for swing animation
  let targetAngle = 0;
  if (swing === 'naar_binnen') targetAngle = Math.PI / 3;
  else if (swing === 'naar_buiten') targetAngle = -Math.PI / 3;

  const hingeRef = useRef<Group>(null);
  useFrame((_, delta) => {
    const t = Math.min(1, delta * SWING_SPEED);
    if (hingeRef.current) {
      hingeRef.current.rotation.y = MathUtils.lerp(hingeRef.current.rotation.y, targetAngle, t);
    }
  });

  const heroUrl = supplierProduct.heroImage;
  // useLoader must be called unconditionally. When heroUrl is null we pass a
  // transparent 1×1 data URI so the loader succeeds without a network request.
  const FALLBACK_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const texture = useLoader(TextureLoader, heroUrl ?? FALLBACK_URL);

  const material = useMemo(() => {
    const mat = new MeshStandardMaterial({ roughness: 0.6, metalness: 0.0 });
    if (heroUrl && texture) {
      texture.wrapS = ClampToEdgeWrapping;
      texture.wrapT = ClampToEdgeWrapping;
      texture.repeat.set(1, 1);
      mat.map = texture;
      mat.color.set('#ffffff');
    } else {
      mat.color.set('#888888');
    }
    mat.needsUpdate = true;
    return mat;
  }, [texture, heroUrl]);

  useEffect(() => {
    return () => { material.dispose(); };
  }, [material]);

  return (
    <group position={[x, doorY, 0]}>
      {/* Frame top */}
      <mesh position={[0, h / 2 + FRAME_T / 2, 0]} material={frameMat}>
        <boxGeometry args={[w + FRAME_T * 2, FRAME_T, FRAME_D]} />
      </mesh>
      {/* Frame left */}
      <mesh position={[-w / 2 - FRAME_T / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T, h + FRAME_T, FRAME_D]} />
      </mesh>
      {/* Frame right */}
      <mesh position={[w / 2 + FRAME_T / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T, h + FRAME_T, FRAME_D]} />
      </mesh>
      {/* Door panel — hinged on left */}
      <group ref={hingeRef} position={[-w / 2, 0, 0]}>
        <mesh position={[w / 2, 0, 0]}>
          <boxGeometry args={[w, h, DOOR_DEPTH]} />
          <primitive object={material} attach="material" />
        </mesh>
        {/* Handle */}
        <mesh position={[w - 0.12, 0, DOOR_DEPTH / 2 + 0.01]} material={HANDLE_DARK}>
          <boxGeometry args={[0.05, 0.2, 0.04]} />
        </mesh>
      </group>
    </group>
  );
}

/** Router: when supplierProduct is present delegate to SupplierDoorMesh so each
 *  variant keeps its own stable hook ordering (no conditional hook calls). */
export default function DoorMesh(props: DoorMeshProps) {
  if (props.supplierProduct) {
    return <SupplierDoorMesh x={props.x} supplierProduct={props.supplierProduct} swing={props.swing} />;
  }
  return <StandardDoorMesh {...props} />;
}

function StandardDoorMesh({ x, height, swing, doorSize, doorHasWindow, doorMaterialId, doorMirror = false }: DoorMeshProps) {
  const { catalog: { materials } } = useTenant();
  const doorY = DOOR_H / 2;
  const dh = Math.min(DOOR_H, height - 0.1);
  const panelW = doorSize === 'dubbel' ? DOUBLE_DOOR_W / 2 : DOOR_W;
  const totalW = doorSize === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W;
  const hMat = getHandleMat(doorMaterialId);
  const mc = resolveDoorMatCfg(doorMaterialId, materials);
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
