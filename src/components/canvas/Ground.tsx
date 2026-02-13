'use client';

import { useMemo } from 'react';
import { TextureLoader, RepeatWrapping, SRGBColorSpace, LinearSRGBColorSpace } from 'three';
import { RoundedBox } from '@react-three/drei';

const GROUND_W = 25;
const GROUND_D = 25;
const GROUND_H = 1.2;
const GROUND_R = 0.2;
const GRASS_TILE = 3;
const EARTH_TILE = 2;

function useTexturePair(colorPath: string, normalPath: string, repeatX: number, repeatY: number) {
  const color = useMemo(() => {
    const loader = new TextureLoader();
    const tex = loader.load(colorPath);
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.colorSpace = SRGBColorSpace;
    tex.repeat.set(repeatX, repeatY);
    return tex;
  }, [colorPath, repeatX, repeatY]);

  const normal = useMemo(() => {
    const loader = new TextureLoader();
    const tex = loader.load(normalPath);
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.colorSpace = LinearSRGBColorSpace;
    tex.repeat.set(repeatX, repeatY);
    return tex;
  }, [normalPath, repeatX, repeatY]);

  return { color, normal };
}

export default function Ground() {
  const grass = useTexturePair(
    '/textures/grass.jpg',
    '/textures/grass_normal.jpg',
    GROUND_W / GRASS_TILE,
    GROUND_D / GRASS_TILE,
  );

  const earth = useTexturePair(
    '/textures/earth.jpg',
    '/textures/earth_normal.jpg',
    GROUND_W / EARTH_TILE,
    GROUND_H / EARTH_TILE,
  );

  return (
    <group position={[0, -GROUND_H / 2, 0]}>
      {/* Earth block — rounded box with soil texture */}
      <RoundedBox
        args={[GROUND_W, GROUND_H, GROUND_D]}
        radius={GROUND_R}
        smoothness={4}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial
          map={earth.color}
          normalMap={earth.normal}
          roughness={0.9}
          metalness={0}
        />
      </RoundedBox>

      {/* Grass overlay on top */}
      <mesh
        position={[0, GROUND_H / 2 + 0.001, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[GROUND_W - GROUND_R * 2, GROUND_D - GROUND_R * 2]} />
        <meshStandardMaterial
          map={grass.color}
          normalMap={grass.normal}
          metalness={0}
          roughness={1}
        />
      </mesh>
    </group>
  );
}
