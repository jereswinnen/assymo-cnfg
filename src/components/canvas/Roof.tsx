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
import type { MaterialRow } from '@/domain/catalog';

const EPDM_THICKNESS = 0.02;
const ROOF_EDGE = 0.12; // must match TimberFrame
const INNER_CLADDING_T = 0.02;
const DEFAULT_BEAM_SPACING_M = 0.6;
const DEFAULT_BEAM_WIDTH_M = 0.05;

const WALL_TEXTURE_TINT: Record<string, string> = {
  wood: '#C4955A',
};

interface PointerHandlers {
  onPointerOver: (e: unknown) => void;
  onPointerOut: () => void;
  onPointerDown: (e: unknown) => void;
  onClick: (e: unknown) => void;
}

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

  // The fascia (dakbak) and the structural posts share a corner — having
  // them on the same material avoids the visible material-transition line
  // at every corner where post meets fascia. The building's primary
  // material drives both: the structural posts via `getEffectivePoleMaterial`
  // already, and now the fascia here. `roof.trimMaterialId` becomes a
  // legacy field we no longer read at render time.
  const trimMaterialId = building?.primaryMaterialId ?? roof.trimMaterialId;
  const middenlaagSlug = roof.middenlaagSlug ?? null;
  const innerCladdingSlug = roof.innerCladdingSlug ?? null;

  // Resolve middenlaag row + pricing for framing dimensions
  const middenlaagRow: MaterialRow | null = middenlaagSlug
    ? materials.find(m => m.slug === middenlaagSlug) ?? null
    : null;
  const middenlaagPricing = middenlaagRow?.pricing.middenlaag ?? null;
  const middenlaagColor = middenlaagSlug
    ? getAtomColor(materials, middenlaagSlug, 'middenlaag')
    : null;
  // Unconditional hook — placeholder when no middenlaag.
  const middenlaagTexture = useWallTexture(middenlaagSlug ?? trimMaterialId, width, depth);

  // Inner-cladding texture (uses wall texture pipeline — same `wall` category).
  const innerColor = innerCladdingSlug
    ? getAtomColor(materials, innerCladdingSlug, 'wall')
    : null;
  const innerTexture = useWallTexture(innerCladdingSlug ?? trimMaterialId, width, depth);

  if (roof.type === 'flat') {
    return <FlatRoof
      width={width} depth={depth} height={height}
      connectedSides={connectedSides}
      trimMaterialId={trimMaterialId}
      materialProps={materialProps}
      meshRef={meshRef}
      pointerHandlers={handlers}
      middenlaagSlug={middenlaagSlug}
      middenlaagPricing={middenlaagPricing}
      middenlaagColor={middenlaagColor}
      middenlaagTexture={middenlaagTexture}
      innerCladdingSlug={innerCladdingSlug}
      innerColor={innerColor}
      innerTexture={innerTexture}
      isSelected={isSelected}
      hovered={hovered}
    />;
  }

  return <PitchedRoof
    width={width} depth={depth} height={height} roofPitch={roofPitch}
    materialProps={materialProps}
    pointerHandlers={handlers}
    middenlaagSlug={middenlaagSlug}
    middenlaagPricing={middenlaagPricing}
    middenlaagColor={middenlaagColor}
    middenlaagTexture={middenlaagTexture}
    innerCladdingSlug={innerCladdingSlug}
    innerColor={innerColor}
    innerTexture={innerTexture}
    isSelected={isSelected}
    hovered={hovered}
  />;
}

// Fascia ("dakbak") — solid board wrapping the roof edge, flush with the
// building's outer perimeter (same plane as the top-plate beams). Thickness
// equals the tenant's post / lumber cross-section (read inside the
// component below). Height + overhang come from RoofConfig.

type MiddenlaagPricing = NonNullable<NonNullable<MaterialRow['pricing']['middenlaag']>>;

interface PanelLayerProps {
  middenlaagSlug: string | null;
  middenlaagPricing: MiddenlaagPricing | null;
  middenlaagColor: string | null;
  middenlaagTexture: ReturnType<typeof useWallTexture>;
  innerCladdingSlug: string | null;
  innerColor: string | null;
  innerTexture: ReturnType<typeof useWallTexture>;
  isSelected: boolean;
  hovered: boolean;
}

interface FlatRoofProps extends PanelLayerProps {
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

function FlatRoof({
  width, depth, height, connectedSides, trimMaterialId, materialProps, meshRef, pointerHandlers,
  middenlaagSlug, middenlaagPricing, middenlaagColor, middenlaagTexture,
  innerCladdingSlug, innerColor, innerTexture, isSelected, hovered,
}: FlatRoofProps) {
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
  const fasciaBoards = useMemo<FasciaBoard[]>(() => {
    const boards: FasciaBoard[] = [];

    if (hasFront) {
      const fpWidth = maxX - minX;
      boards.push({
        pos: [(minX + maxX) / 2, fasciaCenterY, maxZ],
        size: [fpWidth + FASCIA_THICKNESS, roof.fasciaHeight, FASCIA_THICKNESS],
        length: fpWidth + FASCIA_THICKNESS,
        offsetX: -FASCIA_THICKNESS / 2 - 0.01 - (hasLeft ? oh : 0),
      });
    }
    if (hasBack) {
      const fpWidth = maxX - minX;
      boards.push({
        pos: [(minX + maxX) / 2, fasciaCenterY, minZ],
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
        pos: [minX, fasciaCenterY, sideCenterZ],
        size: [FASCIA_THICKNESS, roof.fasciaHeight, sideLen],
        length: sideLen,
        offsetX: 0,
      });
    }
    if (hasRight) {
      boards.push({
        pos: [maxX, fasciaCenterY, sideCenterZ],
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

  // Roof envelope — the inside cavity below the EPDM deck and above the
  // wall plate top. Used to lay out middenlaag + inner cladding.
  // Span (the longer side) drives beam orientation: beams run along the
  // SHORTER side (perpendicular to the span). For flat roofs, span = max(width, depth).
  const beamsAlongX = depth >= width; // beams run along X axis (front-back rafters)
  const beamSpan = beamsAlongX ? width : depth; // length each beam covers
  const beamSpread = beamsAlongX ? depth : width; // direction beams are repeated across

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

      {/* Middenlaag (rafters / insulation panel) — sits INSIDE the cavity
          below the EPDM deck (top anchor = fasciaTopY), occupying the
          cavity downward. */}
      {middenlaagSlug && middenlaagPricing && middenlaagPricing.kind === 'frame' && (
        <FlatFrameRafters
          width={width}
          depth={depth}
          topY={fasciaTopY}
          beamsAlongX={beamsAlongX}
          beamSpan={beamSpan}
          beamSpread={beamSpread}
          beamDepthMm={middenlaagPricing.thicknessMm}
          beamWidthMm={middenlaagPricing.beamWidthMm}
          beamSpacingMm={middenlaagPricing.beamSpacingMm}
          slug={middenlaagSlug}
          color={middenlaagColor ?? '#888'}
          texture={middenlaagTexture}
          isSelected={isSelected}
          hovered={hovered}
        />
      )}
      {middenlaagSlug && middenlaagPricing && middenlaagPricing.kind === 'panel' && (
        <FlatPanelSlab
          width={width}
          depth={depth}
          topY={fasciaTopY}
          panelThicknessMm={middenlaagPricing.thicknessMm}
          slug={middenlaagSlug}
          color={middenlaagColor ?? '#888'}
          texture={middenlaagTexture}
          isSelected={isSelected}
          hovered={hovered}
        />
      )}

      {/* Inner cladding ("binnenbekleding") — flat slab below the framing.
          On a flat roof, slope = 0, so it's simply a slab at the cavity bottom. */}
      {innerCladdingSlug && (
        <FlatInnerCladding
          width={width}
          depth={depth}
          topY={fasciaTopY}
          middenlaagPricing={middenlaagPricing}
          slug={innerCladdingSlug}
          color={innerColor ?? '#888'}
          texture={innerTexture}
          isSelected={isSelected}
          hovered={hovered}
        />
      )}
    </group>
  );
}

interface FlatFrameRaftersProps {
  width: number;
  depth: number;
  /** Y of the top of the cavity (= bottom of EPDM deck). Rafters hang
   *  below this with their TOP face flush, so slimmer rafters recede
   *  downward into the cavity rather than centring. */
  topY: number;
  beamsAlongX: boolean;
  beamSpan: number;
  beamSpread: number;
  /** Rafter cross-section, straight from the chosen middenlaag material.
   *  `beamDepthMm` → vertical rafter depth; `beamWidthMm` → lateral
   *  width. Matches the wall middenlaag convention. */
  beamDepthMm: number;
  beamWidthMm: number;
  beamSpacingMm: number;
  slug: string;
  color: string;
  texture: ReturnType<typeof useWallTexture>;
  isSelected: boolean;
  hovered: boolean;
}

function FlatFrameRafters({
  width, depth, topY,
  beamsAlongX, beamSpan, beamSpread,
  beamDepthMm, beamWidthMm, beamSpacingMm,
  slug, color, texture, isSelected, hovered,
}: FlatFrameRaftersProps) {
  const beamW = beamWidthMm / 1000;
  const beamH = beamDepthMm / 1000;
  const spacing = beamSpacingMm / 1000;
  // Anchor at top — rafter TOP face sits just below the deck so slimmer
  // beams recede downward, matching the wall middenlaag's outer-face anchor.
  const centreY = topY - beamH / 2 - 0.001;

  // Distribute beams across the spread axis like wall framing: outer
  // beams inset by half a beam width so their outer faces sit flush
  // with the building extent.
  const halfSpread = beamSpread / 2;
  const innerSpan = Math.max(0, beamSpread - beamW);
  const count = Math.max(2, Math.ceil(innerSpan / spacing) + 1);
  const step = innerSpan / (count - 1);
  const firstU = -halfSpread + beamW / 2;
  const positions = Array.from({ length: count }, (_, k) => firstU + k * step);

  return (
    <group>
      {positions.map((u, i) => {
        const pos: [number, number, number] = beamsAlongX
          ? [0, centreY, u]   // beam runs along X (width), placed at z=u
          : [u, centreY, 0];  // beam runs along Z (depth), placed at x=u
        const size: [number, number, number] = beamsAlongX
          ? [beamSpan, beamH, beamW]
          : [beamW, beamH, beamSpan];
        return (
          <mesh key={i} position={pos} castShadow receiveShadow>
            <boxGeometry args={size} />
            <meshStandardMaterial
              color={texture?.map ? (WALL_TEXTURE_TINT[slug] ?? '#ffffff') : color}
              map={texture?.map ?? undefined}
              normalMap={texture?.normalMap ?? undefined}
              roughnessMap={texture?.roughnessMap ?? undefined}
              metalness={0.1}
              roughness={texture?.roughnessMap ? 1 : 0.7}
              envMapIntensity={0.4}
              emissive={isSelected ? '#3b82f6' : hovered ? '#60a5fa' : '#000000'}
              emissiveIntensity={isSelected ? 0.35 : hovered ? 0.15 : 0}
            />
          </mesh>
        );
      })}
    </group>
  );
}

interface FlatPanelSlabProps {
  width: number;
  depth: number;
  topY: number;
  panelThicknessMm: number;
  slug: string;
  color: string;
  texture: ReturnType<typeof useWallTexture>;
  isSelected: boolean;
  hovered: boolean;
}

function FlatPanelSlab({
  width, depth, topY, panelThicknessMm, slug, color, texture, isSelected, hovered,
}: FlatPanelSlabProps) {
  const t = panelThicknessMm / 1000;
  const centreY = topY - t / 2 - 0.001;
  return (
    <mesh position={[0, centreY, 0]} castShadow receiveShadow>
      <boxGeometry args={[width, t, depth]} />
      <meshStandardMaterial
        color={texture?.map ? (WALL_TEXTURE_TINT[slug] ?? '#ffffff') : color}
        map={texture?.map ?? undefined}
        normalMap={texture?.normalMap ?? undefined}
        roughnessMap={texture?.roughnessMap ?? undefined}
        metalness={0.1}
        roughness={texture?.roughnessMap ? 1 : 0.85}
        envMapIntensity={0.4}
        emissive={isSelected ? '#3b82f6' : hovered ? '#60a5fa' : '#000000'}
        emissiveIntensity={isSelected ? 0.35 : hovered ? 0.15 : 0}
      />
    </mesh>
  );
}

interface FlatInnerCladdingProps {
  width: number;
  depth: number;
  topY: number;
  middenlaagPricing: MiddenlaagPricing | null;
  slug: string;
  color: string;
  texture: ReturnType<typeof useWallTexture>;
  isSelected: boolean;
  hovered: boolean;
}

function FlatInnerCladding({
  width, depth, topY, middenlaagPricing, slug, color, texture, isSelected, hovered,
}: FlatInnerCladdingProps) {
  // Inner cladding sits below the framing (or directly below the deck
  // when no middenlaag). thicknessMm is the framing depth.
  const midDepth = middenlaagPricing ? middenlaagPricing.thicknessMm / 1000 : 0;
  const t = INNER_CLADDING_T;
  const centreY = topY - midDepth - t / 2 - 0.002;
  return (
    <mesh position={[0, centreY, 0]} castShadow receiveShadow>
      <boxGeometry args={[width, t, depth]} />
      <meshStandardMaterial
        color={texture?.map ? (WALL_TEXTURE_TINT[slug] ?? '#ffffff') : color}
        map={texture?.map ?? undefined}
        normalMap={texture?.normalMap ?? undefined}
        roughnessMap={texture?.roughnessMap ?? undefined}
        metalness={0.1}
        roughness={texture?.roughnessMap ? 1 : 0.85}
        envMapIntensity={0.4}
        emissive={isSelected ? '#3b82f6' : hovered ? '#60a5fa' : '#000000'}
        emissiveIntensity={isSelected ? 0.35 : hovered ? 0.15 : 0}
      />
    </mesh>
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

interface PitchedRoofProps extends PanelLayerProps {
  width: number; depth: number; height: number; roofPitch: number;
  materialProps: Record<string, unknown>;
  pointerHandlers: PointerHandlers;
}

function PitchedRoof({
  width, depth, height, roofPitch, materialProps, pointerHandlers,
  middenlaagSlug, middenlaagPricing, middenlaagColor, middenlaagTexture,
  innerCladdingSlug, innerColor, innerTexture, isSelected, hovered,
}: PitchedRoofProps) {
  const pitchRad = (roofPitch * Math.PI) / 180;
  const halfSpan = depth / 2;
  const roofRise = Math.tan(pitchRad) * halfSpan;
  const roofSlantLength = halfSpan / Math.cos(pitchRad);

  // Two panels — front (sloping toward +Z), back (sloping toward -Z).
  // Each panel has a local frame: long axis along the slope (length =
  // roofSlantLength), width along X (= building width), normal points
  // upward / outward from the panel face.
  const panels = useMemo(() => {
    const ridgeY = height + roofRise;
    const centerY = (height + ridgeY) / 2;
    const centerZ = halfSpan / 2;

    return [
      // back panel (sloping up from back edge to ridge): rotation +pitch around X
      { position: [0, centerY, -centerZ] as [number, number, number], rotation: [pitchRad, 0, 0] as [number, number, number] },
      // front panel: rotation -pitch around X
      { position: [0, centerY, centerZ] as [number, number, number], rotation: [-pitchRad, 0, 0] as [number, number, number] },
    ];
  }, [height, roofRise, halfSpan, pitchRad]);

  const beamDepthM = middenlaagPricing ? middenlaagPricing.thicknessMm / 1000 : 0;
  // Stack offsets (perpendicular to the panel face, in local-Y).
  // Outer deck centre at +ROOF_EDGE/2 (already positioned by the outer mesh).
  // Below the deck: middenlaag centre, then inner cladding centre.
  // We model the deck as already at the panel's centerY; below the deck
  // means more NEGATIVE local-Y. The mesh rotations correctly map local-Y
  // to world (rotates around X).
  const midCentreLocalY = -(ROOF_EDGE / 2) - beamDepthM / 2 - 0.001;
  const innerCentreLocalY = -(ROOF_EDGE / 2) - beamDepthM - INNER_CLADDING_T / 2 - 0.002;

  const beamWidthM = middenlaagPricing?.kind === 'frame'
    ? middenlaagPricing.beamWidthMm / 1000
    : DEFAULT_BEAM_WIDTH_M;
  const beamSpacingM = middenlaagPricing?.kind === 'frame'
    ? middenlaagPricing.beamSpacingMm / 1000
    : DEFAULT_BEAM_SPACING_M;

  // Rafters: run ALONG the slope (panel's long axis), repeated across the
  // panel's WIDTH (along X). Each rafter is a box: [beamWidth, beamDepth,
  // roofSlantLength] in local coords.
  const halfW = width / 2;
  const innerSpan = Math.max(0, width - beamWidthM);
  const rafterCount = Math.max(2, Math.ceil(innerSpan / beamSpacingM) + 1);
  const rafterStep = innerSpan / (rafterCount - 1);
  const firstX = -halfW + beamWidthM / 2;
  const rafterXs = Array.from({ length: rafterCount }, (_, k) => firstX + k * rafterStep);

  return (
    <group>
      {panels.map((panel, i) => (
        <group key={i} position={panel.position} rotation={panel.rotation}>
          {/* Outer deck (existing slope) */}
          <mesh castShadow {...pointerHandlers}>
            <boxGeometry args={[width, ROOF_EDGE, roofSlantLength]} />
            <meshStandardMaterial key={materialProps.map ? 'textured' : 'flat'} {...materialProps} />
          </mesh>

          {/* Middenlaag (rafters or insulation panel) — local-Y BELOW the deck */}
          {middenlaagSlug && middenlaagPricing && middenlaagPricing.kind === 'frame' && (
            <group position={[0, midCentreLocalY, 0]}>
              {rafterXs.map((x, k) => (
                <mesh key={k} position={[x, 0, 0]} castShadow receiveShadow>
                  <boxGeometry args={[beamWidthM, beamDepthM, roofSlantLength]} />
                  <meshStandardMaterial
                    color={middenlaagTexture?.map
                      ? (WALL_TEXTURE_TINT[middenlaagSlug] ?? '#ffffff')
                      : (middenlaagColor ?? '#888')}
                    map={middenlaagTexture?.map ?? undefined}
                    normalMap={middenlaagTexture?.normalMap ?? undefined}
                    roughnessMap={middenlaagTexture?.roughnessMap ?? undefined}
                    metalness={0.1}
                    roughness={middenlaagTexture?.roughnessMap ? 1 : 0.7}
                    envMapIntensity={0.4}
                    emissive={isSelected ? '#3b82f6' : hovered ? '#60a5fa' : '#000000'}
                    emissiveIntensity={isSelected ? 0.35 : hovered ? 0.15 : 0}
                  />
                </mesh>
              ))}
            </group>
          )}
          {middenlaagSlug && middenlaagPricing && middenlaagPricing.kind === 'panel' && (
            <mesh position={[0, midCentreLocalY, 0]} castShadow receiveShadow>
              <boxGeometry args={[width, beamDepthM, roofSlantLength]} />
              <meshStandardMaterial
                color={middenlaagTexture?.map
                  ? (WALL_TEXTURE_TINT[middenlaagSlug] ?? '#ffffff')
                  : (middenlaagColor ?? '#888')}
                map={middenlaagTexture?.map ?? undefined}
                normalMap={middenlaagTexture?.normalMap ?? undefined}
                roughnessMap={middenlaagTexture?.roughnessMap ?? undefined}
                metalness={0.1}
                roughness={middenlaagTexture?.roughnessMap ? 1 : 0.85}
                envMapIntensity={0.4}
                emissive={isSelected ? '#3b82f6' : hovered ? '#60a5fa' : '#000000'}
                emissiveIntensity={isSelected ? 0.35 : hovered ? 0.15 : 0}
              />
            </mesh>
          )}

          {/* Inner cladding — sloped slab below the framing */}
          {innerCladdingSlug && (
            <mesh position={[0, innerCentreLocalY, 0]} castShadow receiveShadow>
              <boxGeometry args={[width, INNER_CLADDING_T, roofSlantLength]} />
              <meshStandardMaterial
                color={innerTexture?.map
                  ? (WALL_TEXTURE_TINT[innerCladdingSlug] ?? '#ffffff')
                  : (innerColor ?? '#888')}
                map={innerTexture?.map ?? undefined}
                normalMap={innerTexture?.normalMap ?? undefined}
                roughnessMap={innerTexture?.roughnessMap ?? undefined}
                metalness={0.1}
                roughness={innerTexture?.roughnessMap ? 1 : 0.85}
                envMapIntensity={0.4}
                emissive={isSelected ? '#3b82f6' : hovered ? '#60a5fa' : '#000000'}
                emissiveIntensity={isSelected ? 0.35 : hovered ? 0.15 : 0}
              />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
