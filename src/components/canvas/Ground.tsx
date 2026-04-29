'use client';

import { useMemo, useEffect } from 'react';
import { TextureLoader, RepeatWrapping, SRGBColorSpace, LinearSRGBColorSpace, Texture } from 'three';

const GROUND_SIZE = 200;
const GRASS_TILE = 8;

/** Loads a single tiled texture for the ground plane. The PBR variants
 *  (normal / roughness) MUST be in linear colour space — otherwise three
 *  applies an sRGB→linear conversion to data that is already linear, and
 *  the surface ends up looking flat / wrong. The colour map stays in sRGB. */
function useRepeatingTexture(path: string, repeatX: number, repeatY: number, srgb: boolean): Texture {
  const tex = useMemo(() => {
    const t = new TextureLoader().load(path);
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace;
    t.repeat.set(repeatX, repeatY);
    return t;
  }, [path, repeatX, repeatY, srgb]);

  useEffect(() => () => { tex.dispose(); }, [tex]);

  return tex;
}

export default function Ground() {
  const repeat = GROUND_SIZE / GRASS_TILE;

  const grassColor     = useRepeatingTexture('/textures/GrassNew_Color.jpg',     repeat, repeat, true);
  const grassNormal    = useRepeatingTexture('/textures/GrassNew_Normal.png',    repeat, repeat, false);
  const grassRoughness = useRepeatingTexture('/textures/GrassNew_Roughness.jpg', repeat, repeat, false);

  return (
    <mesh
      position={[0, -0.001, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      <meshStandardMaterial
        map={grassColor}
        normalMap={grassNormal}
        roughnessMap={grassRoughness}
        metalness={0}
        roughness={1}
        envMapIntensity={0}
      />
    </mesh>
  );
}
