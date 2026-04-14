'use client';

import { useEffect, useMemo } from 'react';
import { TextureLoader, RepeatWrapping, SRGBColorSpace, LinearSRGBColorSpace } from 'three';
import type { Texture } from 'three';

// Wall PBR texture maps (color, normal, roughness per material)
const WALL_TEXTURE_MAP: Record<string, { color: string; normal: string; roughness: string }> = {
  wood: {
    color: '/textures/wood_color.jpg',
    normal: '/textures/wood_normal.jpg',
    roughness: '/textures/wood_roughness.jpg',
  },
  brick: {
    color: '/textures/brick_color.jpg',
    normal: '/textures/brick_normal.jpg',
    roughness: '/textures/brick_roughness.jpg',
  },
  render: {
    color: '/textures/plaster_color.jpg',
    normal: '/textures/plaster_normal.jpg',
    roughness: '/textures/plaster_roughness.jpg',
  },
  metal: {
    color: '/textures/metal_color.jpg',
    normal: '/textures/metal_normal.jpg',
    roughness: '/textures/metal_roughness.jpg',
  },
};

// Floor PBR texture maps (color, normal, roughness per material)
const FLOOR_TEXTURE_MAP: Record<string, { color: string; normal: string; roughness: string }> = {
  tegels: {
    color: '/textures/floor_tiles_color.jpg',
    normal: '/textures/floor_tiles_normal.jpg',
    roughness: '/textures/floor_tiles_roughness.jpg',
  },
  beton: {
    color: '/textures/floor_concrete_color.jpg',
    normal: '/textures/floor_concrete_normal.jpg',
    roughness: '/textures/floor_concrete_roughness.jpg',
  },
  hout: {
    color: '/textures/floor_wood_color.jpg',
    normal: '/textures/floor_wood_normal.jpg',
    roughness: '/textures/floor_wood_roughness.jpg',
  },
};

// Roof PBR texture maps
const ROOF_TEXTURE_MAP: Record<string, { color: string; normal: string; roughness: string }> = {
  dakpannen: {
    color: '/textures/roof_tiles_color.jpg',
    normal: '/textures/roof_tiles_normal.jpg',
    roughness: '/textures/roof_tiles_roughness.jpg',
  },
  riet: {
    color: '/textures/thatch_color.jpg',
    normal: '/textures/thatch_normal.jpg',
    roughness: '/textures/thatch_roughness.jpg',
  },
};

const FLOOR_TILE_SIZE: Record<string, [number, number]> = {
  tegels: [2, 2],
  beton: [3, 3],
  hout: [1.5, 1.5],
};

// How many meters each texture tile covers (controls repeat density)
const WALL_TILE_SIZE: Record<string, [number, number]> = {
  wood: [1.5, 1.5],
  brick: [3, 2],
  render: [3, 3],
  metal: [1.5, 2],
};

const ROOF_TILE_SIZE: Record<string, [number, number]> = {
  dakpannen: [2, 2],
  riet: [3, 3],
};

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
  const paths = WALL_TEXTURE_MAP[materialId];
  const tileSize = WALL_TILE_SIZE[materialId];

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
  const paths = materialId === 'wood' ? WALL_TEXTURE_MAP.wood : null;

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
      // Match the wall's wood tile density (1.5×1.5 m) so door texture reads
      // continuous with the surrounding wall.
      const rx = panelWidth / 1.5;
      const ry = panelHeight / 1.5;
      textures.map.repeat.set(rx, ry);
      textures.normalMap.repeat.set(rx, ry);
      textures.roughnessMap.repeat.set(rx, ry);
    }
  }, [textures, panelWidth, panelHeight]);

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
  const paths = ROOF_TEXTURE_MAP[coveringId];
  const tileSize = ROOF_TILE_SIZE[coveringId];

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
  const paths = FLOOR_TEXTURE_MAP[materialId];
  const tileSize = FLOOR_TILE_SIZE[materialId];

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
