'use client';

import { useMemo, useEffect } from 'react';
import { TextureLoader, RepeatWrapping, SRGBColorSpace, Texture } from 'three';

const GROUND_SIZE = 200;
const GRASS_TILE = 8;

function useRepeatingTexture(path: string, repeatX: number, repeatY: number, srgb: boolean): Texture {
  const tex = useMemo(() => {
    const t = new TextureLoader().load(path);
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.colorSpace = srgb ? SRGBColorSpace : SRGBColorSpace;
    t.repeat.set(repeatX, repeatY);
    return t;
  }, [path, repeatX, repeatY, srgb]);

  useEffect(() => () => { tex.dispose(); }, [tex]);

  return tex;
}

export default function Ground() {
  const repeat = GROUND_SIZE / GRASS_TILE;

  const grassColor = useRepeatingTexture('/textures/Grass_Color.jpg', repeat, repeat, true);

  return (
    <mesh
      position={[0, -0.001, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      <meshStandardMaterial
        map={grassColor}
        color="#88cc77"
        metalness={0}
        roughness={0.95}
        envMapIntensity={0}
      />
    </mesh>
  );
}
