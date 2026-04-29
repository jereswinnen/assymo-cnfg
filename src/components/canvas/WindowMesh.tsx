'use client';

import { useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { Group, MathUtils, MeshStandardMaterial, ClampToEdgeWrapping, TextureLoader } from 'three';
import { useFrame, useLoader } from '@react-three/fiber';
import { WIN_W_DEFAULT, WIN_H_DEFAULT, WIN_SILL_DEFAULT } from '@/domain/building';
import { frameMat, glassMat } from './DoorMesh';
import { WIN_DEPTH, FRAME_T, FRAME_D } from './wallGeometry';
import type { SupplierProductRow } from '@/domain/supplier';
import type { WallWindow } from '@/domain/building';
import { resolveWindowControls, EMPTY_WINDOW_CONTROLS } from '@/domain/openings';
import { useUIStore } from '@/store/useUIStore';

interface WindowMeshProps {
  x: number;
  width?: number;
  height?: number;
  sillHeight?: number;
  supplierProduct?: SupplierProductRow;
  wallWindow?: WallWindow;
}

/** Glazing pane with a loaded texture. Only mounted when heroUrl is
 *  non-null so `useLoader`'s suspense never fires during idle renders. */
function SupplierWindowGlazing({ width, height, heroUrl }: { width: number; height: number; heroUrl: string }) {
  const texture = useLoader(TextureLoader, heroUrl);
  const glazingMat = useMemo(() => {
    const mat = new MeshStandardMaterial({ roughness: 0.05, metalness: 0.1, color: '#ffffff' });
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.repeat.set(1, 1);
    mat.map = texture;
    mat.needsUpdate = true;
    return mat;
  }, [texture]);

  useEffect(() => () => glazingMat.dispose(), [glazingMat]);

  return (
    <mesh>
      <boxGeometry args={[width, height, WIN_DEPTH]} />
      <primitive object={glazingMat} attach="material" />
    </mesh>
  );
}

/** Renders a window using supplier product dimensions + hero image as glazing. */
function SupplierWindowMesh({
  x,
  supplierProduct,
  sillHeight = WIN_SILL_DEFAULT,
  wallWindow,
}: {
  x: number;
  supplierProduct: SupplierProductRow;
  sillHeight?: number;
  wallWindow?: WallWindow;
}) {
  const width = supplierProduct.widthMm / 1000;
  const height = supplierProduct.heightMm / 1000;
  const winY = sillHeight + height / 2;
  const heroUrl = supplierProduct.heroImage;

  const ctrl = wallWindow
    ? resolveWindowControls(wallWindow, supplierProduct)
    : EMPTY_WINDOW_CONTROLS;
  const segmentCount = ctrl.segments.count;
  const isSchuifraam = ctrl.schuifraam.enabled;
  const open = useUIStore((s) =>
    wallWindow ? !!s.windowAnimations[wallWindow.id]?.open : false,
  );

  // Mullion offsets (X centres) for `segmentCount` vertical dividers, equally spaced.
  const mullionXs: number[] = [];
  if (segmentCount > 0) {
    const step = width / (segmentCount + 1);
    for (let i = 1; i <= segmentCount; i++) {
      mullionXs.push(-width / 2 + step * i);
    }
  }

  return (
    <group position={[x, winY, 0]}>
      {!isSchuifraam ? (
        <>
          {heroUrl ? (
            <SupplierWindowGlazing width={width} height={height} heroUrl={heroUrl} />
          ) : (
            <mesh material={glassMat}>
              <boxGeometry args={[width, height, WIN_DEPTH]} />
            </mesh>
          )}
          {mullionXs.map((mx, i) => (
            <mesh key={`m-${i}`} position={[mx, 0, 0]} material={frameMat}>
              <boxGeometry args={[FRAME_T * 0.7, height, FRAME_D]} />
            </mesh>
          ))}
        </>
      ) : (
        <SchuifraamPanes
          width={width}
          height={height}
          segmentCount={segmentCount}
          open={open}
          heroUrl={heroUrl}
        />
      )}

      {/* Frame: top / bottom / left / right (unchanged) */}
      <mesh position={[0, height / 2 + FRAME_T / 2, 0]} material={frameMat}>
        <boxGeometry args={[width + FRAME_T * 2, FRAME_T, FRAME_D]} />
      </mesh>
      <mesh position={[0, -height / 2 - FRAME_T / 2, 0]} material={frameMat}>
        <boxGeometry args={[width + FRAME_T * 2, FRAME_T, FRAME_D]} />
      </mesh>
      <mesh position={[-width / 2 - FRAME_T / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T, height + FRAME_T * 2, FRAME_D]} />
      </mesh>
      <mesh position={[width / 2 + FRAME_T / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T, height + FRAME_T * 2, FRAME_D]} />
      </mesh>
    </group>
  );
}

const PANE_OVERLAP_M = 0.03; // ~30mm overlap on the rail axis
const SLIDE_SPEED = 5; // lerp speed factor — matches DoorMesh SWING_SPEED

function SchuifraamPanes({
  width,
  height,
  segmentCount,
  open,
  heroUrl,
}: {
  width: number;
  height: number;
  segmentCount: number;
  open: boolean;
  heroUrl: string | null;
}) {
  const paneCount = segmentCount + 1;
  const slotW = width / paneCount;
  const paneW = slotW + PANE_OVERLAP_M;

  return (
    <>
      {Array.from({ length: paneCount }, (_, i) => {
        const baseX = -width / 2 + slotW / 2 + i * slotW;
        // Pane 0 is the fixed leaf; the rest slide BEHIND it (toward pane 0) when open.
        const slideX = i === 0 ? 0 : (open ? -slotW * i : 0);
        return (
          <SchuifraamPane
            key={i}
            targetX={baseX + slideX}
            width={paneW}
            height={height}
            heroUrl={heroUrl}
            zOffset={i % 2 === 0 ? 0 : WIN_DEPTH * 0.6}
          />
        );
      })}
    </>
  );
}

function SchuifraamPane({
  targetX,
  width,
  height,
  heroUrl,
  zOffset,
}: {
  targetX: number;
  width: number;
  height: number;
  heroUrl: string | null;
  zOffset: number;
}) {
  const groupRef = useRef<Group>(null);
  const targetXRef = useRef(targetX);

  // Keep target in a ref so useFrame always reads the latest without React re-rendering.
  useEffect(() => {
    targetXRef.current = targetX;
  }, [targetX]);

  // Set initial position once on mount so the first frame doesn't snap from 0.
  useLayoutEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.x = targetX;
    }
    // intentionally only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    const t = Math.min(1, delta * SLIDE_SPEED);
    if (groupRef.current) {
      groupRef.current.position.x = MathUtils.lerp(
        groupRef.current.position.x,
        targetXRef.current,
        t,
      );
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, zOffset]}>
      {heroUrl ? (
        <SupplierWindowGlazing width={width} height={height} heroUrl={heroUrl} />
      ) : (
        <mesh material={glassMat}>
          <boxGeometry args={[width, height, WIN_DEPTH]} />
        </mesh>
      )}
    </group>
  );
}

/** Router: delegates to supplier or standard window based on prop. */
export default function WindowMesh(props: WindowMeshProps) {
  if (props.supplierProduct) {
    return (
      <SupplierWindowMesh
        x={props.x}
        supplierProduct={props.supplierProduct}
        sillHeight={props.sillHeight}
        wallWindow={props.wallWindow}
      />
    );
  }
  return <StandardWindowMesh {...props} />;
}

function StandardWindowMesh({
  x,
  width = WIN_W_DEFAULT,
  height = WIN_H_DEFAULT,
  sillHeight = WIN_SILL_DEFAULT,
  wallWindow,
}: WindowMeshProps) {
  const winY = sillHeight + height / 2;

  const ctrl = wallWindow
    ? resolveWindowControls(wallWindow, null)
    : EMPTY_WINDOW_CONTROLS;
  const segmentCount = ctrl.segments.count;

  const mullionXs: number[] = [];
  if (segmentCount > 0) {
    const step = width / (segmentCount + 1);
    for (let i = 1; i <= segmentCount; i++) {
      mullionXs.push(-width / 2 + step * i);
    }
  }

  return (
    <group position={[x, winY, 0]}>
      {/* Glass pane */}
      <mesh material={glassMat}>
        <boxGeometry args={[width, height, WIN_DEPTH]} />
      </mesh>
      {/* Top */}
      <mesh position={[0, height / 2 + FRAME_T / 2, 0]} material={frameMat}>
        <boxGeometry args={[width + FRAME_T * 2, FRAME_T, FRAME_D]} />
      </mesh>
      {/* Bottom */}
      <mesh position={[0, -height / 2 - FRAME_T / 2, 0]} material={frameMat}>
        <boxGeometry args={[width + FRAME_T * 2, FRAME_T, FRAME_D]} />
      </mesh>
      {/* Left */}
      <mesh position={[-width / 2 - FRAME_T / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T, height + FRAME_T * 2, FRAME_D]} />
      </mesh>
      {/* Right */}
      <mesh position={[width / 2 + FRAME_T / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T, height + FRAME_T * 2, FRAME_D]} />
      </mesh>
      {/* Vertical mullion dividers */}
      {mullionXs.map((mx, i) => (
        <mesh key={`m-${i}`} position={[mx, 0, 0]} material={frameMat}>
          <boxGeometry args={[FRAME_T * 0.7, height, FRAME_D]} />
        </mesh>
      ))}
    </group>
  );
}
