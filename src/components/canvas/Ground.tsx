'use client';

import { useMemo } from 'react';
import { TextureLoader, RepeatWrapping, SRGBColorSpace, LinearSRGBColorSpace, Texture } from 'three';
import { RoundedBox } from '@react-three/drei';

const GROUND_W = 25;
const GROUND_D = 25;
const GROUND_H = 1.2;
const GROUND_R = 0.2;
const GRASS_TILE = 3;
const EARTH_TILE = 2;

function useRepeatingTexture(path: string, repeatX: number, repeatY: number, srgb: boolean): Texture {
  return useMemo(() => {
    const tex = new TextureLoader().load(path);
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace;
    tex.repeat.set(repeatX, repeatY);
    return tex;
  }, [path, repeatX, repeatY, srgb]);
}

export default function Ground() {
  const rGrass = GROUND_W / GRASS_TILE;
  const rEarthW = GROUND_W / EARTH_TILE;
  const rEarthH = GROUND_H / EARTH_TILE;

  const grassColor = useRepeatingTexture('/textures/Grass_Color.jpg', rGrass, rGrass, true);
  const grassNormal = useRepeatingTexture('/textures/Grass_NormalGL.jpg', rGrass, rGrass, false);
  const grassRoughness = useRepeatingTexture('/textures/Grass_Roughness.jpg', rGrass, rGrass, false);

  const earthColor = useRepeatingTexture('/textures/earth.jpg', rEarthW, rEarthH, true);
  const earthNormal = useRepeatingTexture('/textures/earth_normal.jpg', rEarthW, rEarthH, false);

  return (
    <group position={[0, -GROUND_H / 2, 0]}>
      {/* Earth block */}
      <RoundedBox
        args={[GROUND_W, GROUND_H, GROUND_D]}
        radius={GROUND_R}
        smoothness={4}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial
          map={earthColor}
          normalMap={earthNormal}
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
          map={grassColor}
          normalMap={grassNormal}
          roughnessMap={grassRoughness}
          metalness={0}
        />
      </mesh>
    </group>
  );
}
