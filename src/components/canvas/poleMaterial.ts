'use client';

import { useEffect, useMemo } from 'react';
import { MeshStandardMaterial, TextureLoader, RepeatWrapping, SRGBColorSpace, LinearSRGBColorSpace } from 'three';
import { getAtom, getAtomColor } from '@/domain/materials';

/** Timber-frame pole material. Shared by TimberFrame (overkapping posts +
 *  fascia) and the standalone Paal so both track the primary material
 *  identically, including PBR textures. */
export function usePoleMaterial(materialId: string): MeshStandardMaterial {
  const atom = getAtom(materialId);

  const material = useMemo(() => {
    const loader = new TextureLoader();
    const paths = atom?.textures ?? null;
    const tile = atom?.tileSize ?? [2, 2];
    const baseColor = getAtomColor(materialId);

    if (!paths) {
      return new MeshStandardMaterial({
        color: baseColor,
        metalness: 0.05,
        roughness: 1,
        envMapIntensity: 0.2,
      });
    }

    const colorTex = loader.load(paths.color);
    colorTex.wrapS = RepeatWrapping;
    colorTex.wrapT = RepeatWrapping;
    colorTex.colorSpace = SRGBColorSpace;
    colorTex.repeat.set(2 / tile[0], 2 / tile[1]);

    const normalTex = loader.load(paths.normal);
    normalTex.wrapS = RepeatWrapping;
    normalTex.wrapT = RepeatWrapping;
    normalTex.colorSpace = LinearSRGBColorSpace;
    normalTex.repeat.set(2 / tile[0], 2 / tile[1]);

    const roughTex = loader.load(paths.roughness);
    roughTex.wrapS = RepeatWrapping;
    roughTex.wrapT = RepeatWrapping;
    roughTex.colorSpace = LinearSRGBColorSpace;
    roughTex.repeat.set(2 / tile[0], 2 / tile[1]);

    return new MeshStandardMaterial({
      map: colorTex,
      normalMap: normalTex,
      roughnessMap: roughTex,
      color: materialId === 'wood' ? '#C4955A' : '#ffffff',
      metalness: 0.05,
      roughness: 1,
      envMapIntensity: 0.2,
    });
  }, [materialId, atom]);

  useEffect(() => () => {
    material.map?.dispose();
    material.normalMap?.dispose();
    material.roughnessMap?.dispose();
    material.dispose();
  }, [material]);

  return material;
}
