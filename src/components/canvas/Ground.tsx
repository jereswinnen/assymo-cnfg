'use client';

import { useMemo } from 'react';
import { TextureLoader, RepeatWrapping, SRGBColorSpace } from 'three';

const GROUND_SIZE = 50;
const TILE_SIZE = 4; // meters per texture repeat

export default function Ground() {
  const texture = useMemo(() => {
    const loader = new TextureLoader();
    const tex = loader.load('/textures/grass.jpg');
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.colorSpace = SRGBColorSpace;
    tex.repeat.set(GROUND_SIZE / TILE_SIZE, GROUND_SIZE / TILE_SIZE);
    return tex;
  }, []);

  // Clone for bump so we can use independent settings if needed
  const bumpTexture = useMemo(() => {
    const loader = new TextureLoader();
    const tex = loader.load('/textures/grass.jpg');
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(GROUND_SIZE / TILE_SIZE, GROUND_SIZE / TILE_SIZE);
    return tex;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE, 128, 128]} />
      <meshStandardMaterial
        map={texture}
        bumpMap={bumpTexture}
        bumpScale={0.3}
        metalness={0}
        roughness={1}
      />
    </mesh>
  );
}
