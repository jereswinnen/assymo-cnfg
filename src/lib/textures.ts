'use client';

import { useEffect, useMemo } from 'react';
import { TextureLoader, RepeatWrapping, SRGBColorSpace } from 'three';
import type { Texture } from 'three';

// Map material IDs to texture file paths
const WALL_TEXTURE_MAP: Record<string, string> = {
  wood: '/textures/wood.jpg',
  brick: '/textures/brick.jpg',
  render: '/textures/plaster.jpg',
  metal: '/textures/metal.jpg',
};

const ROOF_TEXTURE_MAP: Record<string, string> = {
  dakpannen: '/textures/tiles.jpg',
  riet: '/textures/thatch.jpg',
};

// How many meters each texture tile covers (controls repeat density)
const WALL_TILE_SIZE: Record<string, [number, number]> = {
  wood: [1.5, 1.5],
  brick: [5, 3.5],
  render: [3, 3],
  metal: [1.5, 2],
};

const ROOF_TILE_SIZE: Record<string, [number, number]> = {
  dakpannen: [2, 2],
  riet: [3, 3],
};

const loader = new TextureLoader();
const textureCache = new Map<string, Texture>();

function loadTexture(path: string): Texture {
  const cached = textureCache.get(path);
  if (cached) return cached;

  const tex = loader.load(path);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  textureCache.set(path, tex);
  return tex;
}

/** Returns a texture for a wall material, tiled to match the given dimensions */
export function useWallTexture(
  materialId: string,
  wallWidth: number,
  wallHeight: number,
): Texture | null {
  const path = WALL_TEXTURE_MAP[materialId];
  const tileSize = WALL_TILE_SIZE[materialId];

  const texture = useMemo(() => {
    if (!path) return null;
    return loadTexture(path);
  }, [path]);

  useEffect(() => {
    if (texture && tileSize) {
      texture.repeat.set(wallWidth / tileSize[0], wallHeight / tileSize[1]);
    }
  }, [texture, tileSize, wallWidth, wallHeight]);

  return texture;
}

/** Returns a wood texture sized for a door panel */
export function useDoorTexture(
  materialId: string,
  panelWidth: number,
  panelHeight: number,
): Texture | null {
  const path = materialId === 'wood' ? '/textures/wood.jpg' : null;

  const texture = useMemo(() => {
    if (!path) return null;
    // Clone so door repeat doesn't overwrite the shared wall texture
    return loadTexture(path).clone();
  }, [path]);

  useEffect(() => {
    if (texture) {
      texture.repeat.set(panelWidth / 1.5, panelHeight / 2);
    }
  }, [texture, panelWidth, panelHeight]);

  return texture;
}

/** Returns a texture for a roof covering, tiled to match the given dimensions */
export function useRoofTexture(
  coveringId: string,
  roofWidth: number,
  roofDepth: number,
): Texture | null {
  const path = ROOF_TEXTURE_MAP[coveringId];
  const tileSize = ROOF_TILE_SIZE[coveringId];

  const texture = useMemo(() => {
    if (!path) return null;
    return loadTexture(path);
  }, [path]);

  useEffect(() => {
    if (texture && tileSize) {
      texture.repeat.set(roofWidth / tileSize[0], roofDepth / tileSize[1]);
    }
  }, [texture, tileSize, roofWidth, roofDepth]);

  return texture;
}
