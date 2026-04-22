'use client';

import { useRef, useMemo, useCallback } from 'react';
import { Mesh } from 'three';
import { useBuildingId } from '@/lib/BuildingContext';
import { useConfigStore, getEffectiveHeight } from '@/store/useConfigStore';
import { useUIStore } from "@/store/useUIStore";
import { BEAM_H, WALL_THICKNESS } from '@/domain/building';
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
// matches WALL_THICKNESS. Fixed for now; lift to RoofConfig / API when we want
// it user-controlled.
const FASCIA_HEIGHT = 0.36;
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
}

function FlatRoof({ width, depth, height, connectedSides, trimMaterialId, materialProps, meshRef, pointerHandlers }: FlatRoofProps) {
  const hw = width / 2;
  const hd = depth / 2;

  const hasFront = !connectedSides.has('front');
  const hasBack = !connectedSides.has('back');
  const hasLeft = !connectedSides.has('left');
  const hasRight = !connectedSides.has('right');

  // Fascia ("dakbak") sits directly on top of the wall (no overlap with the
  // wall) and rises above the roof membrane — the EPDM lives INSIDE the bak.
  const fasciaBottomY = height;
  const fasciaTopY = fasciaBottomY + FASCIA_HEIGHT;
  const fasciaCenterY = fasciaBottomY + FASCIA_HEIGHT / 2;

  // Fascia sits centred on the building's nominal edge (±hd / ±hw), matching
  // the top-plate beams in TimberFrame. Its inner face is inset by half its
  // thickness from the edge; front/back extend by the same amount past the
  // corners to meet the outer faces of the side boards.
  const innerInset = FASCIA_THICKNESS / 2;     // 0.075
  const cornerOverlap = FASCIA_THICKNESS / 2;  // 0.075

  // EPDM fits snug inside the fascia ring. On connected sides (no fascia) it
  // extends to the building edge so it can meet the neighbour's membrane.
  const epdmInsetFront = hasFront ? innerInset : 0;
  const epdmInsetBack = hasBack ? innerInset : 0;
  const epdmInsetLeft = hasLeft ? innerInset : 0;
  const epdmInsetRight = hasRight ? innerInset : 0;
  const epdmWidth = Math.max(0.01, width - epdmInsetLeft - epdmInsetRight);
  const epdmDepth = Math.max(0.01, depth - epdmInsetFront - epdmInsetBack);
  const epdmOffsetX = (epdmInsetLeft - epdmInsetRight) / 2;
  const epdmOffsetZ = (epdmInsetBack - epdmInsetFront) / 2;
  // Membrane sits just below the fascia top so the bak rim is visible.
  const epdmY = fasciaTopY - EPDM_THICKNESS / 2 - 0.02;

  // Front/back fascia spans the full width (covers the corners). Left/right
  // fascia fits exactly between the inner faces of the front/back boards; when
  // those don't exist the side fascia extends to the wall's full length.
  const fasciaBoards = useMemo<FasciaBoard[]>(() => {
    const boards: FasciaBoard[] = [];

    if (hasFront) {
      const extLeft = hasLeft ? cornerOverlap : 0;
      const extRight = hasRight ? cornerOverlap : 0;
      const len = width + extLeft + extRight;
      const centerX = (extRight - extLeft) / 2;
      boards.push({
        pos: [centerX, fasciaCenterY, hd],
        size: [len, FASCIA_HEIGHT, FASCIA_THICKNESS],
        length: len,
      });
    }
    if (hasBack) {
      const extLeft = hasLeft ? cornerOverlap : 0;
      const extRight = hasRight ? cornerOverlap : 0;
      const len = width + extLeft + extRight;
      const centerX = (extRight - extLeft) / 2;
      boards.push({
        pos: [centerX, fasciaCenterY, -hd],
        size: [len, FASCIA_HEIGHT, FASCIA_THICKNESS],
        length: len,
      });
    }
    if (hasLeft) {
      const trimBack = hasBack ? cornerOverlap : 0;
      const trimFront = hasFront ? cornerOverlap : 0;
      const len = Math.max(0.01, depth - trimBack - trimFront);
      const centerZ = (trimBack - trimFront) / 2;
      boards.push({
        pos: [-hw, fasciaCenterY, centerZ],
        size: [FASCIA_THICKNESS, FASCIA_HEIGHT, len],
        length: len,
      });
    }
    if (hasRight) {
      const trimBack = hasBack ? cornerOverlap : 0;
      const trimFront = hasFront ? cornerOverlap : 0;
      const len = Math.max(0.01, depth - trimBack - trimFront);
      const centerZ = (trimBack - trimFront) / 2;
      boards.push({
        pos: [hw, fasciaCenterY, centerZ],
        size: [FASCIA_THICKNESS, FASCIA_HEIGHT, len],
        length: len,
      });
    }
    return boards;
  }, [width, depth, hw, hd, fasciaCenterY, hasFront, hasBack, hasLeft, hasRight, cornerOverlap]);

  return (
    <group>
      {/* EPDM membrane — caps the fascia tops */}
      <mesh
        ref={meshRef}
        position={[epdmOffsetX, epdmY, epdmOffsetZ]}
        castShadow
        {...pointerHandlers}
      >
        <boxGeometry args={[epdmWidth, EPDM_THICKNESS, epdmDepth]} />
        <meshStandardMaterial key={materialProps.map ? 'textured' : 'flat'} {...materialProps} />
      </mesh>

      {/* Fascia boards ("dakbak") on exposed edges — textured like the walls */}
      {fasciaBoards.map((b, i) => (
        <FasciaBoardMesh key={i} board={b} materialId={trimMaterialId} />
      ))}
    </group>
  );
}

const FASCIA_TEXTURE_TINT: Record<string, string> = {
  wood: '#C4955A',
};

function FasciaBoardMesh({ board, materialId }: { board: FasciaBoard; materialId: string }) {
  const { catalog: { materials } } = useTenant();
  const texture = useWallTexture(materialId, board.length, FASCIA_HEIGHT);
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
