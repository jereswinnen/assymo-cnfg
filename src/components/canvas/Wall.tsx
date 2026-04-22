'use client';

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { Mesh } from 'three';
import { useBuildingId } from '@/lib/BuildingContext';
import { useConfigStore, getEffectiveHeight } from '@/store/useConfigStore';
import { useUIStore } from "@/store/useUIStore";
import { WALL_THICKNESS, resolveOpeningPositions, getWallLength } from '@/domain/building';
import { getAtomColor, getEffectiveWallMaterial, getEffectiveDoorMaterial } from '@/domain/materials';
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

interface WallProps {
  wallId: WallId;
}

export default function Wall({ wallId }: WallProps) {
  const { catalog: { materials }, supplierCatalog } = useTenant();
  const meshRef = useRef<Mesh>(null);

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

  if (!wallCfg) return null;

  const isSelected =
    selectedElement?.type === 'wall' && selectedElement.id === wallId && selectedElement.buildingId === buildingId;

  const isMuur = building?.type === 'muur';

  const { size, position, rotation } = useMemo(() => {
    const t = WALL_THICKNESS;
    const inset = isMuur ? 0 : 0.01;
    switch (wallId) {
      case 'front':
        return {
          size: [width - inset * 2, height, t] as [number, number, number],
          position: [0, height / 2, isMuur ? 0 : depth / 2 - inset] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
        };
      case 'back':
        return {
          size: [width - inset * 2, height, t] as [number, number, number],
          position: [0, height / 2, -depth / 2 + inset] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
        };
      case 'left':
        return {
          size: [t, height, depth - inset * 2] as [number, number, number],
          position: [-width / 2 + inset, height / 2, 0] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
        };
      case 'right':
        return {
          size: [t, height, depth - inset * 2] as [number, number, number],
          position: [width / 2 - inset, height / 2, 0] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
        };
    }
  }, [wallId, width, depth, height, isMuur]);

  const hasOpenings = wallCfg.hasDoor || (wallCfg.windows ?? []).length > 0;
  const ds = wallCfg.doorSize ?? 'enkel';
  const { doorX: computedDoorX, windowXs: computedWindowXs } = useMemo(
    () =>
      resolveOpeningPositions(
        wallLength,
        wallCfg.hasDoor ? (wallCfg.doorPosition ?? 0.5) : null,
        wallCfg.windows ?? [],
      ),
    [wallLength, wallCfg.hasDoor, wallCfg.doorPosition, wallCfg.windows],
  );

  const doorHole: DoorHole | null = useMemo(() => {
    if (!wallCfg.hasDoor || computedDoorX === null) return null;
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
  }, [wallCfg.hasDoor, wallCfg.doorSupplierProductId, computedDoorX, ds, supplierCatalog.products]);

  const windowHoles: WindowHole[] = useMemo(
    () =>
      computedWindowXs.map((wx, i) => {
        const win = (wallCfg.windows ?? [])[i];
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
    [computedWindowXs, wallCfg.windows, supplierCatalog.products],
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

  const isGlass = materialId === 'glass';

  if (isGlass) {
    return (
      <GlassWallMesh
        position={position}
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

  const envMapIntensity = WALL_ENV_MAP_INTENSITY[materialId] ?? 0.4;

  return (
    <group>
      <mesh
        ref={meshRef}
        position={position}
        rotation={rotation}
        castShadow
        receiveShadow
        {...pointerHandlers}
      >
        {wallGeo ? (
          <primitive object={wallGeo} attach="geometry" />
        ) : (
          <boxGeometry args={size} />
        )}
        <meshStandardMaterial
          color={texture ? (WALL_TEXTURE_TINT[materialId] ?? '#ffffff') : color}
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

      <WallOpenings
        wallId={wallId}
        wallPosition={position}
        wallLength={wallLength}
        height={height}
        wallCfg={wallCfg}
        effectiveDoorMaterial={building ? getEffectiveDoorMaterial(wallCfg, building, buildings) : 'wood'}
      />
    </group>
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
      groupRot = [0, Math.PI / 2, 0];
      break;
    case 'right':
      groupPos = [wallPosition[0] + outOffset, 0, wallPosition[2]];
      groupRot = [0, -Math.PI / 2, 0];
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
