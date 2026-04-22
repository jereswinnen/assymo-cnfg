'use client';

import { useMemo, useEffect } from 'react';
import { MeshStandardMaterial, ClampToEdgeWrapping, TextureLoader } from 'three';
import { useLoader } from '@react-three/fiber';
import { WIN_W_DEFAULT, WIN_H_DEFAULT, WIN_SILL_DEFAULT } from '@/domain/building';
import { frameMat, glassMat } from './DoorMesh';
import { WIN_DEPTH, FRAME_T, FRAME_D } from './wallGeometry';
import type { SupplierProductRow } from '@/domain/supplier';

interface WindowMeshProps {
  x: number;
  width?: number;
  height?: number;
  sillHeight?: number;
  supplierProduct?: SupplierProductRow;
}

/** Renders a window using supplier product dimensions + hero image as glazing. */
function SupplierWindowMesh({ x, supplierProduct, sillHeight = WIN_SILL_DEFAULT }: { x: number; supplierProduct: SupplierProductRow; sillHeight?: number }) {
  const width = supplierProduct.widthMm / 1000;
  const height = supplierProduct.heightMm / 1000;
  const winY = sillHeight + height / 2;
  const heroUrl = supplierProduct.heroImage;
  // useLoader must be called unconditionally. When heroUrl is null we pass a
  // transparent 1×1 data URI so the loader succeeds without a network request.
  const FALLBACK_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const texture = useLoader(TextureLoader, heroUrl ?? FALLBACK_URL);

  const glazingMat = useMemo(() => {
    const mat = new MeshStandardMaterial({ roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.6 });
    if (heroUrl && texture) {
      texture.wrapS = ClampToEdgeWrapping;
      texture.wrapT = ClampToEdgeWrapping;
      texture.repeat.set(1, 1);
      mat.map = texture;
      mat.transparent = false;
      mat.opacity = 1;
      mat.color.set('#ffffff');
    } else {
      mat.color.set('#B8D4E3');
    }
    mat.needsUpdate = true;
    return mat;
  }, [texture, heroUrl]);

  useEffect(() => {
    return () => { glazingMat.dispose(); };
  }, [glazingMat]);

  return (
    <group position={[x, winY, 0]}>
      {/* Glass pane */}
      <mesh>
        <boxGeometry args={[width, height, WIN_DEPTH]} />
        <primitive object={glazingMat} attach="material" />
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
    </group>
  );
}

/** Router: delegates to supplier or standard window based on prop. */
export default function WindowMesh(props: WindowMeshProps) {
  if (props.supplierProduct) {
    return <SupplierWindowMesh x={props.x} supplierProduct={props.supplierProduct} sillHeight={props.sillHeight} />;
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
