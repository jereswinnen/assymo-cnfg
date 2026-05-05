'use client';

import { useRef, useMemo, useCallback } from 'react';
import { Mesh } from 'three';
import { useBuildingId } from '@/lib/BuildingContext';
import { useConfigStore, getEffectiveHeight } from '@/store/useConfigStore';
import { useUIStore } from "@/store/useUIStore";
import { WALL_THICKNESS } from '@/domain/building';
import { getAtomColor } from '@/domain/materials';
import { useTenant } from '@/lib/TenantProvider';
import { useRoofTexture, useWallTexture } from '@/lib/textures';
import { useClickableObject } from '@/lib/useClickableObject';

const EPDM_THICKNESS = 0.02;
const ROOF_EDGE = 0.12; // must match TimberFrame

export default function Roof() {
  const { catalog: { materials } } = useTenant();
  const meshRef = useRef<Mesh>(null);

  const buildingId = useBuildingId();
  const building = useConfigStore((s) => s.buildings.find(b => b.id === buildingId));
  const defaultHeight = useConfigStore((s) => s.defaultHeight);
  const roof = useConfigStore((s) => s.roof);
  const connections = useConfigStore((s) => s.connections);
  const selectedElement = useUIStore((s) => s.selectedElement);
  const selectElement = useUIStore((s) => s.selectElement);

  const { width, depth } = building?.dimensions ?? { width: 8, depth: 4 };
  const height = building ? getEffectiveHeight(building, defaultHeight) : 3;
  const roofPitch = roof.pitch;
  const color = getAtomColor(materials, roof.coveringId, 'roof-cover');

  const isSelected = selectedElement?.type === 'roof';
  const roofTexture = useRoofTexture(roof.coveringId, width, depth);

  // Determine which sides have connections (for suppressing trim)
  const connectedSides = useMemo(() => {
    const sides = new Set<string>();
    for (const c of connections) {
      if (c.buildingAId === buildingId) sides.add(c.sideA);
      if (c.buildingBId === buildingId) sides.add(c.sideB);
    }
    return sides;
  }, [connections, buildingId]);

  const onSelect = useCallback(() => selectElement({ type: 'roof' }), [selectElement]);
  const { hovered, handlers } = useClickableObject(onSelect);

  const materialProps = {
    color: roofTexture ? '#ffffff' : color,
    map: roofTexture?.map ?? undefined,
    normalMap: roofTexture?.normalMap ?? undefined,
    roughnessMap: roofTexture?.roughnessMap ?? undefined,
    metalness: roofTexture ? 0.3 : 0.1,
    roughness: roofTexture?.roughnessMap ? 1 : 0.85,
    envMapIntensity: 0.8,
    emissive: isSelected ? '#3b82f6' : hovered ? '#60a5fa' : '#000000',
    emissiveIntensity: isSelected ? 0.35 : hovered ? 0.15 : 0,
  };

  const trimMaterialId = roof.trimMaterialId;

  if (roof.type === 'flat') {
    return <FlatRoof
      width={width} depth={depth} height={height}
      connectedSides={connectedSides}
      trimMaterialId={trimMaterialId}
      materialProps={materialProps}
      meshRef={meshRef}
      pointerHandlers={handlers}
    />;
  }

  return <PitchedRoof
    width={width} depth={depth} height={height} roofPitch={roofPitch}
    materialProps={materialProps}
    pointerHandlers={handlers}
  />;
}

// Fascia ("dakbak") — solid board wrapping the roof edge, flush with the
// building's outer perimeter (same plane as the top-plate beams). Thickness
// matches WALL_THICKNESS. Height + overhang now come from RoofConfig.
const FASCIA_THICKNESS = WALL_THICKNESS;

interface PointerHandlers {
  onPointerOver: (e: unknown) => void;
  onPointerOut: () => void;
  onPointerDown: (e: unknown) => void;
  onClick: (e: unknown) => void;
}

interface FlatRoofProps {
  width: number; depth: number; height: number;
  connectedSides: Set<string>;
  trimMaterialId: string;
  materialProps: Record<string, unknown>;
  meshRef: React.RefObject<Mesh | null>;
  pointerHandlers: PointerHandlers;
}

interface FasciaBoard {
  pos: [number, number, number];
  size: [number, number, number];
  /** Long-axis length in meters, for texture tiling */
  length: number;
  /** Wall-aligning U-offset (meters). Cancels three sources of drift
   *  between the fascia's texture and the wall texture beneath:
   *  (1) corner-mitre overlap that extends the fascia past the wall edge,
   *  (2) overhang outward extension on non-connected sides, and
   *  (3) the 0.01 m wall inset baked into Wall.tsx geometry.
   *  Sign and term selection differ per face since three.js BoxGeometry
   *  maps UVs differently on +X / −X / +Z / −Z. */
  offsetX: number;
}

function FlatRoof({ width, depth, height, connectedSides, trimMaterialId, materialProps, meshRef, pointerHandlers }: FlatRoofProps) {
  const roof = useConfigStore((s) => s.roof);
  const hd = depth / 2;
  const hw = width / 2;

  const hasFront = !connectedSides.has('front');
  const hasBack  = !connectedSides.has('back');
  const hasLeft  = !connectedSides.has('left');
  const hasRight = !connectedSides.has('right');

  const oh = roof.fasciaOverhang;
  // Effective footprint extents — extends outward by `oh` on non-connected sides only.
  const minX = -hw - (hasLeft  ? oh : 0);
  const maxX =  hw + (hasRight ? oh : 0);
  const minZ = -hd - (hasBack  ? oh : 0);
  const maxZ =  hd + (hasFront ? oh : 0);

  const fasciaBottomY = height;
  const fasciaTopY    = fasciaBottomY + roof.fasciaHeight;
  const fasciaCenterY = fasciaBottomY + roof.fasciaHeight / 2;

  const innerInset    = FASCIA_THICKNESS / 2;     // 0.075
  const cornerOverlap = FASCIA_THICKNESS / 2;     // 0.075

  // EPDM membrane spans the effective footprint, inset on sides that have fascia.
  const epdmInsetFront = hasFront ? innerInset : 0;
  const epdmInsetBack  = hasBack  ? innerInset : 0;
  const epdmInsetLeft  = hasLeft  ? innerInset : 0;
  const epdmInsetRight = hasRight ? innerInset : 0;
  const epdmWidth  = Math.max(0.01, (maxX - minX) - epdmInsetLeft - epdmInsetRight);
  const epdmDepth  = Math.max(0.01, (maxZ - minZ) - epdmInsetFront - epdmInsetBack);
  const epdmCenterX = (minX + maxX) / 2 + (epdmInsetLeft - epdmInsetRight) / 2;
  const epdmCenterZ = (minZ + maxZ) / 2 + (epdmInsetBack - epdmInsetFront) / 2;
  const epdmY = fasciaTopY - EPDM_THICKNESS / 2 - 0.02;

  // Each fascia board lies along the corresponding edge of the effective
  // footprint. Front/back boards span the full width and extend over corners
  // by `cornerOverlap` on adjacent fascia sides; left/right boards fit between.
  const fasciaBoards = useMemo<FasciaBoard[]>(() => {
    const boards: FasciaBoard[] = [];
    const fpWidth = maxX - minX;
    const fpDepth = maxZ - minZ;
    const fpCenterX = (minX + maxX) / 2;
    const fpCenterZ = (minZ + maxZ) / 2;

    if (hasFront) {
      const extLeft  = hasLeft  ? cornerOverlap : 0;
      const extRight = hasRight ? cornerOverlap : 0;
      const len = fpWidth + extLeft + extRight;
      const centerX = fpCenterX + (extRight - extLeft) / 2;
      boards.push({
        pos: [centerX, fasciaCenterY, maxZ],
        size: [len, roof.fasciaHeight, FASCIA_THICKNESS],
        length: len,
        offsetX: -extLeft - (hasLeft ? oh : 0) - 0.01,
      });
    }
    if (hasBack) {
      const extLeft  = hasLeft  ? cornerOverlap : 0;
      const extRight = hasRight ? cornerOverlap : 0;
      const len = fpWidth + extLeft + extRight;
      const centerX = fpCenterX + (extRight - extLeft) / 2;
      boards.push({
        pos: [centerX, fasciaCenterY, minZ],
        size: [len, roof.fasciaHeight, FASCIA_THICKNESS],
        length: len,
        offsetX: -extRight - (hasRight ? oh : 0) - 0.01,
      });
    }
    if (hasLeft) {
      const trimBack  = hasBack  ? cornerOverlap : 0;
      const trimFront = hasFront ? cornerOverlap : 0;
      const len = Math.max(0.01, fpDepth - trimBack - trimFront);
      const centerZ = fpCenterZ + (trimBack - trimFront) / 2;
      boards.push({
        pos: [minX, fasciaCenterY, centerZ],
        size: [FASCIA_THICKNESS, roof.fasciaHeight, len],
        length: len,
        offsetX: trimBack - (hasBack ? oh : 0) - 0.01,
      });
    }
    if (hasRight) {
      const trimBack  = hasBack  ? cornerOverlap : 0;
      const trimFront = hasFront ? cornerOverlap : 0;
      const len = Math.max(0.01, fpDepth - trimBack - trimFront);
      const centerZ = fpCenterZ + (trimBack - trimFront) / 2;
      boards.push({
        pos: [maxX, fasciaCenterY, centerZ],
        size: [FASCIA_THICKNESS, roof.fasciaHeight, len],
        length: len,
        offsetX: trimFront - (hasFront ? oh : 0) - 0.01,
      });
    }
    return boards;
  }, [
    minX, maxX, minZ, maxZ,
    fasciaCenterY, roof.fasciaHeight,
    hasFront, hasBack, hasLeft, hasRight, cornerOverlap, oh,
  ]);

  return (
    <group>
      {/* EPDM membrane — caps the fascia tops */}
      <mesh
        ref={meshRef}
        position={[epdmCenterX, epdmY, epdmCenterZ]}
        castShadow
        {...pointerHandlers}
      >
        <boxGeometry args={[epdmWidth, EPDM_THICKNESS, epdmDepth]} />
        <meshStandardMaterial key={materialProps.map ? 'textured' : 'flat'} {...materialProps} />
      </mesh>

      {/* Fascia boards ("dakbak") on exposed edges — textured like the walls */}
      {fasciaBoards.map((b, i) => (
        <FasciaBoardMesh key={i} board={b} materialId={trimMaterialId} fasciaHeight={roof.fasciaHeight} />
      ))}
    </group>
  );
}

const FASCIA_TEXTURE_TINT: Record<string, string> = {
  wood: '#C4955A',
};

function FasciaBoardMesh({
  board,
  materialId,
  fasciaHeight,
}: {
  board: FasciaBoard;
  materialId: string;
  fasciaHeight: number;
}) {
  const { catalog: { materials } } = useTenant();
  const texture = useWallTexture(materialId, board.length, fasciaHeight, board.offsetX);
  const isGlass = materialId === 'glass';
  const tint = FASCIA_TEXTURE_TINT[materialId] ?? '#ffffff';

  return (
    <mesh position={board.pos} castShadow receiveShadow>
      <boxGeometry args={board.size} />
      <meshStandardMaterial
        key={texture ? 'textured' : 'flat'}
        color={texture ? tint : getAtomColor(materials, materialId, 'wall')}
        map={texture?.map ?? undefined}
        normalMap={texture?.normalMap ?? undefined}
        roughnessMap={texture?.roughnessMap ?? undefined}
        metalness={isGlass ? 0.1 : 0.1}
        roughness={texture?.roughnessMap ? 1 : 0.7}
        transparent={isGlass}
        opacity={isGlass ? 0.4 : 1}
        envMapIntensity={isGlass ? 1.5 : 0.4}
        // Fascia shares its footprint with the structural top-plate beams
        // below. Nudge its polygons slightly toward the camera so the fascia
        // always wins the depth test and doesn't flicker.
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-4}
      />
    </mesh>
  );
}

interface PitchedRoofProps {
  width: number; depth: number; height: number; roofPitch: number;
  materialProps: Record<string, unknown>;
  pointerHandlers: PointerHandlers;
}

function PitchedRoof({ width, depth, height, roofPitch, materialProps, pointerHandlers }: PitchedRoofProps) {
  const pitchRad = (roofPitch * Math.PI) / 180;
  const halfSpan = depth / 2;
  const roofRise = Math.tan(pitchRad) * halfSpan;
  const roofSlantLength = halfSpan / Math.cos(pitchRad);

  const panels = useMemo(() => {
    const ridgeY = height + roofRise;
    const centerY = (height + ridgeY) / 2;
    const centerZ = halfSpan / 2;

    return [
      { position: [0, centerY, -centerZ] as [number, number, number], rotation: [pitchRad, 0, 0] as [number, number, number] },
      { position: [0, centerY, centerZ] as [number, number, number], rotation: [-pitchRad, 0, 0] as [number, number, number] },
    ];
  }, [height, roofRise, halfSpan, pitchRad]);

  return (
    <group>
      {panels.map((panel, i) => (
        <mesh
          key={i}
          position={panel.position}
          rotation={panel.rotation}
          castShadow
          {...pointerHandlers}
        >
          <boxGeometry args={[width, ROOF_EDGE, roofSlantLength]} />
          <meshStandardMaterial key={materialProps.map ? 'textured' : 'flat'} {...materialProps} />
            </mesh>
      ))}
    </group>
  );
}
