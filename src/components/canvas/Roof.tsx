'use client';

import { useRef, useMemo, useCallback } from 'react';
import { Mesh } from 'three';
import { useBuildingId } from '@/lib/BuildingContext';
import { useConfigStore, getEffectiveHeight } from '@/store/useConfigStore';
import { useUIStore } from "@/store/useUIStore";
import { getAtomColor } from '@/domain/materials';
import { useTenant } from '@/lib/TenantProvider';
import { useEffectivePostSize } from '@/lib/useEffectivePostSize';
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
// equals the tenant's post / lumber cross-section (read inside the
// component below). Height + overhang come from RoofConfig.

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
  /** Geometry's long-axis length in meters — used to compute texture
   *  `repeat` so per-meter sampling rate matches the geometry. */
  length: number;
  /** Wall-aligning U-offset (meters). Front/back boards extend past the
   *  wall by FASCIA_THICKNESS/2 on each side AND by `fasciaOverhang` on
   *  any non-connected adjacent side, so their texture origin sits to
   *  the LEFT of the wall's; offsetX shifts it back. Side boards stay
   *  inside the wall extent and use 0. */
  offsetX: number;
}

function FlatRoof({ width, depth, height, connectedSides, trimMaterialId, materialProps, meshRef, pointerHandlers }: FlatRoofProps) {
  const roof = useConfigStore((s) => s.roof);
  /** Fascia thickness mirrors the effective post / lumber cross-section so
   *  the rim sits in the same plane as the structural posts and walls. */
  const FASCIA_THICKNESS = useEffectivePostSize();
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

  const fasciaOverhangOut = FASCIA_THICKNESS / 2;  // 0.075

  // EPDM membrane caps the fascia: extends OVER the fascia top to its outer
  // face on sides that have fascia, and rests directly on top so the rim
  // disappears under the membrane.
  const epdmOutFront = hasFront ? fasciaOverhangOut : 0;
  const epdmOutBack  = hasBack  ? fasciaOverhangOut : 0;
  const epdmOutLeft  = hasLeft  ? fasciaOverhangOut : 0;
  const epdmOutRight = hasRight ? fasciaOverhangOut : 0;
  const epdmWidth  = Math.max(0.01, (maxX - minX) + epdmOutLeft + epdmOutRight);
  const epdmDepth  = Math.max(0.01, (maxZ - minZ) + epdmOutFront + epdmOutBack);
  const epdmCenterX = (minX + maxX) / 2 + (epdmOutRight - epdmOutLeft) / 2;
  const epdmCenterZ = (minZ + maxZ) / 2 + (epdmOutFront - epdmOutBack) / 2;
  // 1mm lift above fascia/deck top to avoid coplanar z-fighting at min fascia.
  const epdmY = fasciaTopY + EPDM_THICKNESS / 2 + 0.001;

  // Front/back fascia extend past the wall ends by FASCIA_THICKNESS/2 on
  // each side so they fully cover the building's corners (no gap visible
  // through the structure). Side fascia stay shrunk by FASCIA_THICKNESS
  // along Z so they sit BETWEEN the front/back boards — the four boards
  // share only edges, not volume, so there's no z-fighting. Texture seam
  // is corrected via offsetX so the planks line up with the wall beneath.
  // Sub-mm outward nudge to break coplanarity with the top-plate beam
  // (which has the same FASCIA_THICKNESS-wide outer face when overhang=0).
  // Without it, every corner of the fascia z-fights with the beam and a
  // sliver of beam material flickers through the trim — exactly the
  // "piece of a pole at each corner" the user reported.
  const FASCIA_BEAM_NUDGE = 0.002;
  const fasciaBoards = useMemo<FasciaBoard[]>(() => {
    const boards: FasciaBoard[] = [];

    if (hasFront) {
      const fpWidth = maxX - minX;
      boards.push({
        pos: [(minX + maxX) / 2, fasciaCenterY, maxZ + FASCIA_BEAM_NUDGE],
        size: [fpWidth + FASCIA_THICKNESS, roof.fasciaHeight, FASCIA_THICKNESS],
        length: fpWidth + FASCIA_THICKNESS,
        offsetX: -FASCIA_THICKNESS / 2 - 0.01 - (hasLeft ? oh : 0),
      });
    }
    if (hasBack) {
      const fpWidth = maxX - minX;
      boards.push({
        pos: [(minX + maxX) / 2, fasciaCenterY, minZ - FASCIA_BEAM_NUDGE],
        size: [fpWidth + FASCIA_THICKNESS, roof.fasciaHeight, FASCIA_THICKNESS],
        length: fpWidth + FASCIA_THICKNESS,
        offsetX: -FASCIA_THICKNESS / 2 - 0.01 - (hasLeft ? oh : 0),
      });
    }
    // Side fascia shrinks by FASCIA_THICKNESS along its long axis so it
    // sits BETWEEN the front/back boards on Z and doesn't share a corner
    // volume with them (eliminates z-fighting at the corners). The short
    // length is passed straight to `useWallTexture` so the texture repeat
    // matches the geometry — accept a small per-meter rate mismatch with
    // the side wall in exchange for clean corners.
    const sideLen = (maxZ - minZ) - FASCIA_THICKNESS;
    const sideCenterZ = (minZ + maxZ) / 2;
    if (hasLeft) {
      boards.push({
        pos: [minX - FASCIA_BEAM_NUDGE, fasciaCenterY, sideCenterZ],
        size: [FASCIA_THICKNESS, roof.fasciaHeight, sideLen],
        length: sideLen,
        offsetX: 0,
      });
    }
    if (hasRight) {
      boards.push({
        pos: [maxX + FASCIA_BEAM_NUDGE, fasciaCenterY, sideCenterZ],
        size: [FASCIA_THICKNESS, roof.fasciaHeight, sideLen],
        length: sideLen,
        offsetX: 0,
      });
    }
    return boards;
  }, [
    width, depth, oh,
    minX, maxX, minZ, maxZ,
    fasciaCenterY, roof.fasciaHeight,
    hasFront, hasBack, hasLeft, hasRight,
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
