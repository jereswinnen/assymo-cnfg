'use client';

import { useRef, useState, useMemo, useCallback } from 'react';
import { Mesh } from 'three';
import { useBuildingId } from '@/lib/BuildingContext';
import { useConfigStore } from '@/store/useConfigStore';
import { ROOF_COVERINGS, TRIM_COLORS, BEAM_H } from '@/lib/constants';
import { useRoofTexture } from '@/lib/textures';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ThreePointerEvent = any;

const EPDM_THICKNESS = 0.02;
const ROOF_EDGE = 0.12; // must match TimberFrame

export default function Roof() {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const buildingId = useBuildingId();
  const building = useConfigStore((s) => s.buildings.find(b => b.id === buildingId));
  const roof = useConfigStore((s) => s.roof);
  const connections = useConfigStore((s) => s.connections);
  const selectedElement = useConfigStore((s) => s.selectedElement);
  const selectElement = useConfigStore((s) => s.selectElement);

  const { width, depth, height } = building?.dimensions ?? { width: 8, depth: 4, height: 3 };
  const roofPitch = roof.pitch;
  const covering = ROOF_COVERINGS.find((c) => c.id === roof.coveringId);
  const color = covering?.color ?? '#cccccc';

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

  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  const handlePointerOver = useCallback((e: ThreePointerEvent) => {
    if (e.nativeEvent.buttons > 0) return;
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  }, []);
  const handlePointerOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  }, []);
  const handlePointerDown = useCallback((e: ThreePointerEvent) => {
    pointerDownPos.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
  }, []);
  const handleClick = useCallback((e: ThreePointerEvent) => {
    const down = pointerDownPos.current;
    if (down) {
      const dx = e.nativeEvent.clientX - down.x;
      const dy = e.nativeEvent.clientY - down.y;
      if (dx * dx + dy * dy > 16) return;
    }
    e.stopPropagation();
    selectElement({ type: 'roof' });
  }, [selectElement]);

  const materialProps = {
    color: roofTexture ? '#ffffff' : color,
    map: roofTexture ?? undefined,
    metalness: roofTexture ? 0.3 : 0.1,
    roughness: roofTexture ? 0.5 : 0.85,
    emissive: isSelected ? '#3b82f6' : hovered ? '#60a5fa' : '#000000',
    emissiveIntensity: isSelected ? 0.35 : hovered ? 0.15 : 0,
  };

  const trimColor = TRIM_COLORS.find((c) => c.id === roof.trimColorId)?.hex ?? '#3C3C3C';

  if (roof.type === 'flat') {
    return <FlatRoof
      width={width} depth={depth} height={height}
      connectedSides={connectedSides}
      trimColor={trimColor}
      materialProps={materialProps}
      isSelected={isSelected}
      meshRef={meshRef}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    />;
  }

  return <PitchedRoof
    width={width} depth={depth} height={height} roofPitch={roofPitch}
    materialProps={materialProps}
    isSelected={isSelected}
    onPointerOver={handlePointerOver}
    onPointerOut={handlePointerOut}
    onPointerDown={handlePointerDown}
    onClick={handleClick}
  />;
}

const TRIM_T = 0.02; // trim strip thickness

interface FlatRoofProps {
  width: number; depth: number; height: number;
  connectedSides: Set<string>;
  trimColor: string;
  materialProps: Record<string, unknown>;
  isSelected: boolean;
  meshRef: React.RefObject<Mesh | null>;
  onPointerOver: (e: ThreePointerEvent) => void;
  onPointerOut: () => void;
  onPointerDown: (e: ThreePointerEvent) => void;
  onClick: (e: ThreePointerEvent) => void;
}

function FlatRoof({ width, depth, height, connectedSides, trimColor, materialProps, isSelected, meshRef, onPointerOver, onPointerOut, onPointerDown, onClick }: FlatRoofProps) {
  const epdmY = height + BEAM_H + ROOF_EDGE + EPDM_THICKNESS / 2;
  const trimY = height + BEAM_H + ROOF_EDGE + EPDM_THICKNESS / 2;

  const hw = width / 2;
  const hd = depth / 2;

  // Trim strips on non-connected edges (sits on top of the wood edge)
  const trimStrips = useMemo(() => {
    const strips: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    if (!connectedSides.has('front')) {
      strips.push({ pos: [0, trimY, -hd], size: [width, EPDM_THICKNESS, TRIM_T] });
    }
    if (!connectedSides.has('back')) {
      strips.push({ pos: [0, trimY, hd], size: [width, EPDM_THICKNESS, TRIM_T] });
    }
    if (!connectedSides.has('left')) {
      strips.push({ pos: [-hw, trimY, 0], size: [TRIM_T, EPDM_THICKNESS, depth] });
    }
    if (!connectedSides.has('right')) {
      strips.push({ pos: [hw, trimY, 0], size: [TRIM_T, EPDM_THICKNESS, depth] });
    }
    return strips;
  }, [width, depth, hw, hd, trimY, connectedSides]);

  return (
    <group>
      {/* EPDM membrane — thin, on top of the wood deck */}
      <mesh
        ref={meshRef}
        position={[0, epdmY, 0]}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onPointerDown={onPointerDown}
        onClick={onClick}
      >
        <boxGeometry args={[width, EPDM_THICKNESS, depth]} />
        <meshStandardMaterial key={materialProps.map ? 'textured' : 'flat'} {...materialProps} />
      </mesh>

      {/* Metal trim strips on exposed edges */}
      {trimStrips.map((s, i) => (
        <mesh key={i} position={s.pos}>
          <boxGeometry args={s.size} />
          <meshStandardMaterial color={trimColor} metalness={0.5} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

interface PitchedRoofProps {
  width: number; depth: number; height: number; roofPitch: number;
  materialProps: Record<string, unknown>;
  isSelected: boolean;
  onPointerOver: (e: ThreePointerEvent) => void;
  onPointerOut: () => void;
  onPointerDown: (e: ThreePointerEvent) => void;
  onClick: (e: ThreePointerEvent) => void;
}

function PitchedRoof({ width, depth, height, roofPitch, materialProps, isSelected, onPointerOver, onPointerOut, onPointerDown, onClick }: PitchedRoofProps) {
  const pitchRad = (roofPitch * Math.PI) / 180;
  const halfWidth = width / 2;
  const roofRise = Math.tan(pitchRad) * halfWidth;
  const roofSlantLength = halfWidth / Math.cos(pitchRad);

  const panels = useMemo(() => {
    const ridgeY = height + roofRise;
    const centerY = (height + ridgeY) / 2;
    const centerX = halfWidth / 2;

    return [
      { position: [-centerX, centerY, 0] as [number, number, number], rotation: [0, 0, pitchRad] as [number, number, number] },
      { position: [centerX, centerY, 0] as [number, number, number], rotation: [0, 0, -pitchRad] as [number, number, number] },
    ];
  }, [height, roofRise, halfWidth, pitchRad]);

  return (
    <group>
      {panels.map((panel, i) => (
        <mesh
          key={i}
          position={panel.position}
          rotation={panel.rotation}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onPointerDown={onPointerDown}
          onClick={onClick}
        >
          <boxGeometry args={[roofSlantLength, ROOF_EDGE, depth]} />
          <meshStandardMaterial key={materialProps.map ? 'textured' : 'flat'} {...materialProps} />
            </mesh>
      ))}
    </group>
  );
}
