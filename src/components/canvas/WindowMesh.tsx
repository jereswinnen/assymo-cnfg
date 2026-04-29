'use client';

import { useMemo, useEffect } from 'react';
import { MeshStandardMaterial, ClampToEdgeWrapping, TextureLoader } from 'three';
import { useLoader } from '@react-three/fiber';
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
  // Tap useUIStore so future schuifraam render path can read the open state.
  // Currently unused; Task 14 will consume it.
  useUIStore((s) =>
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
      {heroUrl ? (
        <SupplierWindowGlazing width={width} height={height} heroUrl={heroUrl} />
      ) : (
        <mesh material={glassMat}>
          <boxGeometry args={[width, height, WIN_DEPTH]} />
        </mesh>
      )}

      {/* Mullions — only when NOT schuifraam (schuifraam path lands in Task 14) */}
      {!isSchuifraam && mullionXs.map((mx, i) => (
        <mesh key={`m-${i}`} position={[mx, 0, 0]} material={frameMat}>
          <boxGeometry args={[FRAME_T * 0.7, height, FRAME_D]} />
        </mesh>
      ))}

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
}: WindowMeshProps) {
  const winY = sillHeight + height / 2;

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
      {/* Cross dividers - vertical */}
      <mesh material={frameMat}>
        <boxGeometry args={[FRAME_T * 0.7, height, FRAME_D]} />
      </mesh>
      {/* Cross dividers - horizontal */}
      <mesh material={frameMat}>
        <boxGeometry args={[width, FRAME_T * 0.7, FRAME_D]} />
      </mesh>
    </group>
  );
}
