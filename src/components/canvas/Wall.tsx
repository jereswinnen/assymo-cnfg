'use client';

import { useMemo, useEffect, useCallback } from 'react';
import { useBuildingId } from '@/lib/BuildingContext';
import { useConfigStore, getEffectiveHeight } from '@/store/useConfigStore';
import { useUIStore } from "@/store/useUIStore";
import { WALL_THICKNESS, getWallLayerLayout, resolveOpeningPositions, getWallLength } from '@/domain/building';
import { getAtomColor, getEffectiveWallMaterial, getEffectiveDoorMaterial, getEffectiveInnerWallMaterial, getEffectiveMiddenlaagMaterial } from '@/domain/materials';
import { useTenant } from '@/lib/TenantProvider';
import { useWallTexture } from '@/lib/textures';
import { useClickableObject } from '@/lib/useClickableObject';
import { WIN_W_DEFAULT, WIN_H_DEFAULT, WIN_SILL_DEFAULT } from '@/domain/building';
import { createWallWithOpeningsGeo, doorWidth, DOOR_H, FRAME_D } from './wallGeometry';
import type { DoorHole, WindowHole } from './wallGeometry';
import { frameMat } from './DoorMesh';
import DoorMesh from './DoorMesh';
import WindowMesh from './WindowMesh';
import type { WallId, WallConfig } from '@/domain/building';

const MULLION_SPACING = 1.2;
const TRANSOM_H = 1.3;
const GLASS_FRAME = 0.05;

const WALL_ENV_MAP_INTENSITY: Record<string, number> = {
  wood: 0.3,
  brick: 0.4,
  render: 0.5,
  metal: 1.0,
  glass: 1.5,
};

// Tint colors applied when PBR textures are present (white = no tint)
const WALL_TEXTURE_TINT: Record<string, string> = {
  wood: '#C4955A',
};

type LayerRole = 'whole' | 'outerCladding' | 'middenlaag' | 'innerCladding';
interface LayerSpec {
  role: LayerRole;
  position: [number, number, number];
  size: [number, number, number];
}

interface WallProps {
  wallId: WallId;
}

export default function Wall({ wallId }: WallProps) {
  const { catalog: { materials }, supplierCatalog } = useTenant();

  const buildingId = useBuildingId();
  const building = useConfigStore((s) => s.buildings.find(b => b.id === buildingId));
  const buildings = useConfigStore((s) => s.buildings);
  const defaultHeight = useConfigStore((s) => s.defaultHeight);
  const selectedElement = useUIStore((s) => s.selectedElement);
  const selectElement = useUIStore((s) => s.selectElement);

  const onSelect = useCallback(() => selectElement({ type: 'wall', id: wallId, buildingId }), [selectElement, wallId, buildingId]);
  const { hovered, handlers: pointerHandlers } = useClickableObject(onSelect);

  const dimensions = building?.dimensions ?? { width: 8, depth: 4, height: 3 };
  const height = building ? getEffectiveHeight(building, defaultHeight) : 3;
  const { width, depth } = dimensions;

  const wallCfg = building?.walls[wallId];
  const materialId = wallCfg && building
    ? getEffectiveWallMaterial(wallCfg, building, buildings)
    : 'brick';
  const color = getAtomColor(materials, materialId, 'wall');

  const wallLength = getWallLength(wallId, dimensions);
  const texture = useWallTexture(materialId, wallLength, height);

  // Inner cladding — resolved before the isGlass early-return so hooks run unconditionally.
  const innerSlug = wallCfg
    ? getEffectiveInnerWallMaterial(wallCfg)
    : null;
  const innerColor = innerSlug
    ? getAtomColor(materials, innerSlug, 'wall')
    : null;
  // useWallTexture must be called unconditionally; feed the outer slug as
  // placeholder when there's no inner slug (the result is unused in that case).
  const innerTexture = useWallTexture(innerSlug ?? materialId, wallLength, height);

  // Middenlaag — resolved after innerSlug, unconditional hooks.
  const middenlaagSlug = wallCfg
    ? getEffectiveMiddenlaagMaterial(wallCfg)
    : null;
  const middenlaagRow = middenlaagSlug
    ? materials.find(m => m.slug === middenlaagSlug) ?? null
    : null;
  const middenlaagPricing = middenlaagRow?.pricing.middenlaag ?? null;
  const middenlaagColor = middenlaagSlug
    ? getAtomColor(materials, middenlaagSlug, 'middenlaag')
    : null;
  // Unconditional hook — placeholder slug when no middenlaag.
  const middenlaagTexture = useWallTexture(middenlaagSlug ?? materialId, wallLength, height);

  const isSelected =
    selectedElement?.type === 'wall' && selectedElement.id === wallId && selectedElement.buildingId === buildingId;

  const isMuur = building?.type === 'muur';

  const { layout, rotation } = useMemo(() => {
    const t = WALL_THICKNESS;
    const inset = isMuur ? 0 : 0.01;
    const w = width - inset * 2;
    const d = depth - inset * 2;
    const rot: [number, number, number] = [0, 0, 0];

    let perpAxis: 'x' | 'z';
    let outwardSign: 1 | -1;
    let centre: [number, number, number];
    let lengthAlongWall: number;

    switch (wallId) {
      case 'front':
        perpAxis = 'z'; outwardSign = 1;
        centre = [0, height / 2, isMuur ? 0 : depth / 2 - inset];
        lengthAlongWall = w;
        break;
      case 'back':
        perpAxis = 'z'; outwardSign = -1;
        centre = [0, height / 2, -depth / 2 + inset];
        lengthAlongWall = w;
        break;
      case 'left':
        perpAxis = 'x'; outwardSign = -1;
        centre = [-width / 2 + inset, height / 2, 0];
        lengthAlongWall = d;
        break;
      case 'right':
        perpAxis = 'x'; outwardSign = 1;
        centre = [width / 2 - inset, height / 2, 0];
        lengthAlongWall = d;
        break;
    }

    const effectiveOuterSign = (wallCfg?.innerFlipped ? -1 : 1) * outwardSign;

    function layer(role: LayerRole, offsetNorm: number, thicknessNorm: number): LayerSpec {
      const thickness = thicknessNorm * t;
      const offset = effectiveOuterSign * (offsetNorm * t);
      const pos: [number, number, number] =
        perpAxis === 'z'
          ? [centre[0], centre[1], centre[2] + offset]
          : [centre[0] + offset, centre[1], centre[2]];
      const size: [number, number, number] =
        perpAxis === 'z'
          ? [lengthAlongWall, height, thickness]
          : [thickness, height, lengthAlongWall];
      return { role, position: pos, size };
    }

    const hasInner = !!innerSlug;
    const hasMiddenlaag = !!middenlaagSlug;
    const canonical = getWallLayerLayout({ hasInner, hasMiddenlaag });
    const layers: LayerSpec[] = canonical.map(l => layer(l.role, l.offsetNorm, l.thicknessNorm));

    return {
      layout: { layers, perpAxis, lengthAlongWall },
      rotation: rot,
    };
  }, [wallId, width, depth, height, isMuur, innerSlug, middenlaagSlug, wallCfg?.innerFlipped]);

  const hasOpenings = wallCfg ? wallCfg.hasDoor || (wallCfg.windows ?? []).length > 0 : false;
  const ds = wallCfg?.doorSize ?? 'enkel';
  const { doorX: computedDoorX, windowXs: computedWindowXs } = useMemo(
    () => {
      if (!wallCfg) return { doorX: null, windowXs: [] };
      return resolveOpeningPositions(
        wallLength,
        wallCfg.hasDoor ? (wallCfg.doorPosition ?? 0.5) : null,
        wallCfg.windows ?? [],
      );
    },
    [wallLength, wallCfg?.hasDoor, wallCfg?.doorPosition, wallCfg?.windows],
  );

  const doorHole: DoorHole | null = useMemo(() => {
    if (!wallCfg || !wallCfg.hasDoor || computedDoorX === null) return null;
    const supplier = wallCfg.doorSupplierProductId
      ? supplierCatalog.products.find(p => p.id === wallCfg.doorSupplierProductId)
      : null;
    if (supplier) {
      return {
        x: computedDoorX,
        width: supplier.widthMm / 1000,
        height: supplier.heightMm / 1000,
      };
    }
    return { x: computedDoorX, width: doorWidth(ds), height: DOOR_H };
  }, [wallCfg, wallCfg?.doorSupplierProductId, computedDoorX, ds, supplierCatalog.products]);

  const windowHoles: WindowHole[] = useMemo(
    () =>
      computedWindowXs.map((wx, i) => {
        const win = (wallCfg?.windows ?? [])[i];
        const supplier = win?.supplierProductId
          ? supplierCatalog.products.find(p => p.id === win.supplierProductId)
          : null;
        if (supplier) {
          return {
            x: wx,
            width: supplier.widthMm / 1000,
            height: supplier.heightMm / 1000,
            sillHeight: win?.sillHeight ?? WIN_SILL_DEFAULT,
          };
        }
        return {
          x: wx,
          width: win?.width ?? WIN_W_DEFAULT,
          height: win?.height ?? WIN_H_DEFAULT,
          sillHeight: win?.sillHeight ?? WIN_SILL_DEFAULT,
        };
      }),
    [computedWindowXs, wallCfg?.windows, supplierCatalog.products],
  );

  const wallGeo = useMemo(() => {
    if (!hasOpenings) return null;
    return createWallWithOpeningsGeo(
      wallLength,
      height,
      WALL_THICKNESS,
      wallId,
      doorHole,
      windowHoles,
    );
  }, [hasOpenings, wallLength, height, wallId, doorHole, windowHoles]);

  useEffect(() => {
    return () => { wallGeo?.dispose(); };
  }, [wallGeo]);

  const layerGeoms = useMemo(() => {
    if (!hasOpenings) return null;
    const m = new Map<LayerRole, import('three').ExtrudeGeometry>();
    for (const layerSpec of layout.layers) {
      const perpThickness = layout.perpAxis === 'z' ? layerSpec.size[2] : layerSpec.size[0];
      m.set(layerSpec.role, createWallWithOpeningsGeo(
        wallLength,
        height,
        perpThickness,
        wallId,
        doorHole,
        windowHoles,
      ));
    }
    return m;
  }, [hasOpenings, layout, wallLength, height, wallId, doorHole, windowHoles]);

  useEffect(() => () => { layerGeoms?.forEach(g => g.dispose()); }, [layerGeoms]);

  if (!wallCfg) return null;

  const isGlass = materialId === 'glass';

  if (isGlass) {
    return (
      <GlassWallMesh
        position={layout.layers[0].position}
        rotation={rotation}
        wallLength={wallLength}
        height={height}
        wallId={wallId}
        isSelected={isSelected}
        hovered={hovered}
        pointerHandlers={pointerHandlers}
      />
    );
  }

  return (
    <group>
      {layout.layers.map((layerSpec, i) => {
        const isInner = layerSpec.role === 'innerCladding';
        const isMid   = layerSpec.role === 'middenlaag';

        const slabSlug =
          isMid && middenlaagSlug ? middenlaagSlug :
          isInner && innerSlug    ? innerSlug      :
          materialId;
        const slabColor =
          isMid && middenlaagColor ? middenlaagColor :
          isInner && innerColor    ? innerColor      :
          color;
        const slabTexture =
          isMid    ? middenlaagTexture :
          isInner  ? innerTexture      :
          texture;

        // Frame middenlaag: render posts instead of a solid slab.
        if (isMid && middenlaagPricing?.kind === 'frame') {
          return (
            <FramePosts
              key={i}
              wallLength={layout.lengthAlongWall}
              height={height}
              slabPosition={layerSpec.position}
              rotation={rotation}
              perpAxis={layout.perpAxis}
              perpThickness={layout.perpAxis === 'z' ? layerSpec.size[2] : layerSpec.size[0]}
              beamWidthMm={middenlaagPricing.beamWidthMm}
              beamSpacingMm={middenlaagPricing.beamSpacingMm}
              slug={middenlaagSlug!}
              color={middenlaagColor ?? '#888'}
              texture={middenlaagTexture}
              envMapIntensity={WALL_ENV_MAP_INTENSITY[middenlaagSlug!] ?? 0.4}
              doorHole={doorHole}
              windowHoles={windowHoles}
              isSelected={isSelected}
              hovered={hovered}
              pointerHandlers={pointerHandlers}
            />
          );
        }

        // Panel / cladding slab.
        const geo = hasOpenings ? layerGeoms?.get(layerSpec.role) ?? null : null;
        return (
          <mesh
            key={i}
            position={layerSpec.position}
            rotation={rotation}
            castShadow
            receiveShadow
            {...pointerHandlers}
          >
            {geo ? (
              <primitive object={geo} attach="geometry" />
            ) : (
              <boxGeometry args={layerSpec.size} />
            )}
            <meshStandardMaterial
              color={slabTexture?.map ? (WALL_TEXTURE_TINT[slabSlug] ?? '#ffffff') : slabColor}
              map={slabTexture?.map ?? undefined}
              normalMap={slabTexture?.normalMap ?? undefined}
              roughnessMap={slabTexture?.roughnessMap ?? undefined}
              metalness={0.1}
              roughness={slabTexture?.roughnessMap ? 1 : 0.7}
              envMapIntensity={WALL_ENV_MAP_INTENSITY[slabSlug] ?? 0.4}
              emissive={isSelected ? '#3b82f6' : hovered ? '#60a5fa' : '#000000'}
              emissiveIntensity={isSelected ? 0.35 : hovered ? 0.15 : 0}
            />
          </mesh>
        );
      })}

      <WallOpenings
        wallId={wallId}
        wallPosition={layout.layers[0].position}
        wallLength={wallLength}
        height={height}
        wallCfg={wallCfg}
        effectiveDoorMaterial={building ? getEffectiveDoorMaterial(wallCfg, building, buildings) : 'wood'}
      />
    </group>
  );
}

interface FramePostsProps {
  wallLength: number;
  height: number;
  slabPosition: [number, number, number];
  rotation: [number, number, number];
  perpAxis: 'x' | 'z';
  perpThickness: number;
  beamWidthMm: number;
  beamSpacingMm: number;
  slug: string;
  color: string;
  texture: ReturnType<typeof useWallTexture>;
  envMapIntensity: number;
  doorHole: DoorHole | null;
  windowHoles: WindowHole[];
  isSelected: boolean;
  hovered: boolean;
  pointerHandlers: ReturnType<typeof useClickableObject>['handlers'];
}

function FramePosts({
  wallLength, height, slabPosition, rotation, perpAxis, perpThickness,
  beamWidthMm, beamSpacingMm, slug, color, texture, envMapIntensity,
  doorHole, windowHoles, isSelected, hovered, pointerHandlers,
}: FramePostsProps) {
  const beamW = beamWidthMm / 1000;
  const spacing = beamSpacingMm / 1000;

  // Inset the outer posts by half a beam width so their outer faces sit
  // flush with the wall ends instead of protruding past them. Inner posts
  // distribute evenly across the remaining span.
  const halfL = wallLength / 2;
  const innerSpan = Math.max(0, wallLength - beamW);
  const rawCount = Math.max(2, Math.ceil(innerSpan / spacing) + 1);
  const step = innerSpan / (rawCount - 1);
  const firstX = -halfL + beamW / 2;

  const posts = Array.from({ length: rawCount }, (_, k) => firstX + k * step)
    .filter(localX => {
      if (doorHole) {
        const dHalf = doorHole.width / 2;
        if (Math.abs(localX - doorHole.x) < dHalf + beamW / 2) return false;
      }
      for (const win of windowHoles) {
        const wHalf = win.width / 2;
        if (Math.abs(localX - win.x) < wHalf + beamW / 2) return false;
      }
      return true;
    });

  return (
    <>
      {posts.map((localX, i) => {
        const pos: [number, number, number] =
          perpAxis === 'z'
            ? [slabPosition[0] + localX, slabPosition[1], slabPosition[2]]
            : [slabPosition[0], slabPosition[1], slabPosition[2] + localX];

        const meshSize: [number, number, number] =
          perpAxis === 'z'
            ? [beamW, height, perpThickness]
            : [perpThickness, height, beamW];

        return (
          <mesh
            key={i}
            position={pos}
            rotation={rotation}
            castShadow
            receiveShadow
            {...pointerHandlers}
          >
            <boxGeometry args={meshSize} />
            <meshStandardMaterial
              color={texture?.map ? (WALL_TEXTURE_TINT[slug] ?? '#ffffff') : color}
              map={texture?.map ?? undefined}
              normalMap={texture?.normalMap ?? undefined}
              roughnessMap={texture?.roughnessMap ?? undefined}
              metalness={0.1}
              roughness={texture?.roughnessMap ? 1 : 0.7}
              envMapIntensity={envMapIntensity}
              emissive={isSelected ? '#3b82f6' : hovered ? '#60a5fa' : '#000000'}
              emissiveIntensity={isSelected ? 0.35 : hovered ? 0.15 : 0}
            />
          </mesh>
        );
      })}
    </>
  );
}

interface OpeningsProps {
  wallId: WallId;
  wallPosition: [number, number, number];
  wallLength: number;
  height: number;
  wallCfg: WallConfig;
  effectiveDoorMaterial: string;
}

function WallOpenings({ wallId, wallPosition, wallLength, height, wallCfg, effectiveDoorMaterial }: OpeningsProps) {
  const { supplierCatalog } = useTenant();

  if (!wallCfg.hasDoor && (wallCfg.windows ?? []).length === 0) return null;

  const t = WALL_THICKNESS;
  const outOffset = t / 2 + 0.01;

  let groupPos: [number, number, number];
  let groupRot: [number, number, number] = [0, 0, 0];

  switch (wallId) {
    case 'front':
      groupPos = [wallPosition[0], 0, wallPosition[2] + outOffset];
      break;
    case 'back':
      groupPos = [wallPosition[0], 0, wallPosition[2] - outOffset];
      groupRot = [0, Math.PI, 0];
      break;
    case 'left':
      groupPos = [wallPosition[0] - outOffset, 0, wallPosition[2]];
      groupRot = [0, -Math.PI / 2, 0];
      break;
    case 'right':
      groupPos = [wallPosition[0] + outOffset, 0, wallPosition[2]];
      groupRot = [0, Math.PI / 2, 0];
      break;
  }

  const ds = wallCfg.doorSize ?? 'enkel';
  const { doorX, windowXs } = resolveOpeningPositions(
    wallLength,
    wallCfg.hasDoor ? (wallCfg.doorPosition ?? 0.5) : null,
    wallCfg.windows ?? [],
  );

  // Resolve supplier products for door and windows
  const doorSupplierProduct = wallCfg.doorSupplierProductId
    ? supplierCatalog.products.find(p => p.id === wallCfg.doorSupplierProductId) ?? undefined
    : undefined;

  return (
    <group position={groupPos} rotation={groupRot}>
      {wallCfg.hasDoor && (
        <DoorMesh
          x={doorX!}
          height={height}
          swing={wallCfg.doorSwing ?? 'dicht'}
          doorSize={ds}
          doorHasWindow={wallCfg.doorHasWindow ?? false}
          doorMaterialId={effectiveDoorMaterial}
          doorMirror={wallCfg.doorMirror ?? false}
          supplierProduct={doorSupplierProduct}
        />
      )}
      {windowXs.map((wx, i) => {
        const win = (wallCfg.windows ?? [])[i];
        const windowSupplierProduct = win?.supplierProductId
          ? supplierCatalog.products.find(p => p.id === win.supplierProductId) ?? undefined
          : undefined;
        return (
          <WindowMesh
            key={i}
            x={wx}
            width={win?.width}
            height={win?.height}
            sillHeight={win?.sillHeight}
            supplierProduct={windowSupplierProduct}
            wallWindow={win}
          />
        );
      })}
    </group>
  );
}

interface GlassWallMeshProps {
  position: [number, number, number];
  rotation: [number, number, number];
  wallLength: number;
  height: number;
  wallId: WallId;
  isSelected: boolean;
  hovered: boolean;
  pointerHandlers: Record<string, unknown>;
}

function GlassWallMesh({
  position: pos,
  rotation: rot,
  wallLength,
  height,
  wallId,
  isSelected,
  hovered,
  pointerHandlers,
}: GlassWallMeshProps) {
  const isSideWall = wallId === 'left' || wallId === 'right';
  const glassThickness = 0.02;
  const paneW = wallLength - GLASS_FRAME * 2;
  const paneH = height - GLASS_FRAME * 2;

  const mullionXs: number[] = [];
  const mullionCount = Math.max(0, Math.floor(wallLength / MULLION_SPACING) - 1);
  if (mullionCount > 0) {
    const spacing = wallLength / (mullionCount + 1);
    for (let i = 1; i <= mullionCount; i++) {
      mullionXs.push(-wallLength / 2 + spacing * i);
    }
  }

  const transomY = -height / 2 + TRANSOM_H;

  const glassSize: [number, number, number] = isSideWall
    ? [glassThickness, paneH, paneW]
    : [paneW, paneH, glassThickness];

  return (
    <group position={pos} rotation={rot}>
      <mesh {...pointerHandlers}>
        <boxGeometry args={glassSize} />
        <meshStandardMaterial
          color="#B8D4E3"
          metalness={0.1}
          roughness={0.05}
          transparent
          opacity={0.3}
          envMapIntensity={1.5}
          emissive={isSelected ? '#3b82f6' : hovered ? '#60a5fa' : '#000000'}
          emissiveIntensity={isSelected ? 0.35 : hovered ? 0.15 : 0}
        />
      </mesh>

      <mesh position={[0, height / 2 - GLASS_FRAME / 2, 0]} material={frameMat}>
        <boxGeometry args={isSideWall ? [FRAME_D, GLASS_FRAME, wallLength] : [wallLength, GLASS_FRAME, FRAME_D]} />
      </mesh>
      <mesh position={[0, -height / 2 + GLASS_FRAME / 2, 0]} material={frameMat}>
        <boxGeometry args={isSideWall ? [FRAME_D, GLASS_FRAME, wallLength] : [wallLength, GLASS_FRAME, FRAME_D]} />
      </mesh>
      <mesh position={isSideWall ? [0, 0, -wallLength / 2 + GLASS_FRAME / 2] : [-wallLength / 2 + GLASS_FRAME / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={isSideWall ? [FRAME_D, height, GLASS_FRAME] : [GLASS_FRAME, height, FRAME_D]} />
      </mesh>
      <mesh position={isSideWall ? [0, 0, wallLength / 2 - GLASS_FRAME / 2] : [wallLength / 2 - GLASS_FRAME / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={isSideWall ? [FRAME_D, height, GLASS_FRAME] : [GLASS_FRAME, height, FRAME_D]} />
      </mesh>

      {mullionXs.map((mx, i) => (
        <mesh key={`m${i}`} position={isSideWall ? [0, 0, mx] : [mx, 0, 0]} material={frameMat}>
          <boxGeometry args={isSideWall ? [FRAME_D, height, GLASS_FRAME * 0.7] : [GLASS_FRAME * 0.7, height, FRAME_D]} />
        </mesh>
      ))}

      <mesh position={[0, transomY, 0]} material={frameMat}>
        <boxGeometry args={isSideWall ? [FRAME_D, GLASS_FRAME * 0.7, wallLength] : [wallLength, GLASS_FRAME * 0.7, FRAME_D]} />
      </mesh>
    </group>
  );
}
