'use client';

import { useEffect, useMemo } from 'react';
import { TextureLoader, RepeatWrapping, SRGBColorSpace, LinearSRGBColorSpace } from 'three';
import type { Texture } from 'three';
import { getAtom } from '@/domain/materials';
import { useTenant } from '@/lib/TenantProvider';

const loader = new TextureLoader();
const textureCache = new Map<string, Texture>();

function loadTexture(path: string, srgb = true): Texture {
  const cacheKey = `${path}:${srgb ? 's' : 'l'}`;
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  const tex = loader.load(path);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace;
  textureCache.set(cacheKey, tex);
  return tex;
}

export interface PBRTextures {
  map: Texture;
  normalMap: Texture;
  roughnessMap: Texture;
}

/** Returns PBR textures for a wall material, tiled to match the given dimensions */
export function useWallTexture(
  materialId: string,
  wallWidth: number,
  wallHeight: number,
): PBRTextures | null {
  const { catalog: { materials } } = useTenant();
  const atom = getAtom(materials, materialId);
  const paths = atom?.textures ?? null;
  const tileSize = atom?.tileSize ?? null;

  const textures = useMemo(() => {
    if (!paths) return null;
    return {
      map: loadTexture(paths.color, true).clone(),
      normalMap: loadTexture(paths.normal, false).clone(),
      roughnessMap: loadTexture(paths.roughness, false).clone(),
    };
  }, [paths]);

  useEffect(() => {
    if (textures && tileSize) {
      const rx = wallWidth / tileSize[0];
      const ry = wallHeight / tileSize[1];
      textures.map.repeat.set(rx, ry);
      textures.normalMap.repeat.set(rx, ry);
      textures.roughnessMap.repeat.set(rx, ry);
    }
  }, [textures, tileSize, wallWidth, wallHeight]);

  useEffect(() => {
    if (!textures) return;
    return () => {
      textures.map.dispose();
      textures.normalMap.dispose();
      textures.roughnessMap.dispose();
    };
  }, [textures]);

  return textures;
}

/** Returns PBR textures for a door panel */
export function useDoorTexture(
  materialId: string,
  panelWidth: number,
  panelHeight: number,
): PBRTextures | null {
  const { catalog: { materials } } = useTenant();
  const atom = getAtom(materials, materialId);
  const paths = atom?.textures ?? null;
  // Tile size matches the surrounding wall so the door texture reads continuous.
  const tileSize = atom?.tileSize ?? [1.5, 1.5];

  const textures = useMemo(() => {
    if (!paths) return null;
    return {
      map: loadTexture(paths.color, true).clone(),
      normalMap: loadTexture(paths.normal, false).clone(),
      roughnessMap: loadTexture(paths.roughness, false).clone(),
    };
  }, [paths]);

  useEffect(() => {
    if (textures) {
      const rx = panelWidth / tileSize[0];
      const ry = panelHeight / tileSize[1];
      textures.map.repeat.set(rx, ry);
      textures.normalMap.repeat.set(rx, ry);
      textures.roughnessMap.repeat.set(rx, ry);
    }
  }, [textures, tileSize, panelWidth, panelHeight]);

  useEffect(() => {
    if (!textures) return;
    return () => {
      textures.map.dispose();
      textures.normalMap.dispose();
      textures.roughnessMap.dispose();
    };
  }, [textures]);

  return textures;
}

/** Returns PBR textures for a roof covering, tiled to match the given dimensions */
export function useRoofTexture(
  coveringId: string,
  roofWidth: number,
  roofDepth: number,
): PBRTextures | null {
  const { catalog: { materials } } = useTenant();
  const atom = getAtom(materials, coveringId);
  const paths = atom?.textures ?? null;
  const tileSize = atom?.tileSize ?? null;

  const textures = useMemo(() => {
    if (!paths) return null;
    return {
      map: loadTexture(paths.color, true).clone(),
      normalMap: loadTexture(paths.normal, false).clone(),
      roughnessMap: loadTexture(paths.roughness, false).clone(),
    };
  }, [paths]);

  useEffect(() => {
    if (textures && tileSize) {
      const rx = roofWidth / tileSize[0];
      const ry = roofDepth / tileSize[1];
      textures.map.repeat.set(rx, ry);
      textures.normalMap.repeat.set(rx, ry);
      textures.roughnessMap.repeat.set(rx, ry);
    }
  }, [textures, tileSize, roofWidth, roofDepth]);

  useEffect(() => {
    if (!textures) return;
    return () => {
      textures.map.dispose();
      textures.normalMap.dispose();
      textures.roughnessMap.dispose();
    };
  }, [textures]);

  return textures;
}

export type FloorPBR = PBRTextures;

/** Returns PBR textures for a floor material, tiled to match the given dimensions */
export function useFloorTexture(
  materialId: string,
  floorWidth: number,
  floorDepth: number,
): FloorPBR | null {
  const { catalog: { materials } } = useTenant();
  const atom = getAtom(materials, materialId);
  const paths = atom?.textures ?? null;
  const tileSize = atom?.tileSize ?? null;

  const textures = useMemo(() => {
    if (!paths) return null;
    return {
      map: loadTexture(paths.color, true).clone(),
      normalMap: loadTexture(paths.normal, false).clone(),
      roughnessMap: loadTexture(paths.roughness, false).clone(),
    };
  }, [paths]);

  useEffect(() => {
    if (textures && tileSize) {
      const rx = floorWidth / tileSize[0];
      const ry = floorDepth / tileSize[1];
      textures.map.repeat.set(rx, ry);
      textures.normalMap.repeat.set(rx, ry);
      textures.roughnessMap.repeat.set(rx, ry);
    }
  }, [textures, tileSize, floorWidth, floorDepth]);

  useEffect(() => {
    if (!textures) return;
    return () => {
      textures.map.dispose();
      textures.normalMap.dispose();
      textures.roughnessMap.dispose();
    };
  }, [textures]);

  return textures;
}
