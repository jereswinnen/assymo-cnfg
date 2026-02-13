'use client';

import { useRef, useMemo } from 'react';
import { Mesh, TextureLoader, RepeatWrapping, SRGBColorSpace, LinearSRGBColorSpace } from 'three';
import { RoundedBox } from '@react-three/drei';

const GROUND_W = 25;
const GROUND_D = 25;
const GROUND_H = 1.2;
const GROUND_R = 0.2; // corner radius
const TILE_SIZE = 3;

export default function Ground() {
  const grassTexture = useMemo(() => {
    const loader = new TextureLoader();
    const tex = loader.load('/textures/grass.jpg');
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.colorSpace = SRGBColorSpace;
    tex.repeat.set(GROUND_W / TILE_SIZE, GROUND_D / TILE_SIZE);
    return tex;
  }, []);

  const normalTexture = useMemo(() => {
    const loader = new TextureLoader();
    const tex = loader.load('/textures/grass_normal.jpg');
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.colorSpace = LinearSRGBColorSpace;
    tex.repeat.set(GROUND_W / TILE_SIZE, GROUND_D / TILE_SIZE);
    return tex;
  }, []);

  // Earth block (rounded box)
  const earthRef = useRef<Mesh>(null);

  // Override UVs on the earth block so the top face uses the grass texture
  // while the side/bottom faces get earth color (handled by vertex colors).
  // Simpler approach: overlay a grass plane on top.

  return (
    <group position={[0, -GROUND_H / 2, 0]}>
      {/* Earth block */}
      <RoundedBox
        ref={earthRef}
        args={[GROUND_W, GROUND_H, GROUND_D]}
        radius={GROUND_R}
        smoothness={4}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial color="#6B4226" roughness={0.9} metalness={0} />
      </RoundedBox>

      {/* Grass overlay on top */}
      <mesh
        position={[0, GROUND_H / 2 + 0.001, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[GROUND_W - GROUND_R * 2, GROUND_D - GROUND_R * 2]} />
        <meshStandardMaterial
          map={grassTexture}
          normalMap={normalTexture}
          metalness={0}
          roughness={1}
        />
      </mesh>
    </group>
  );
}
