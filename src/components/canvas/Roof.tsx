'use client';

import { useRef, useState, useMemo } from 'react';
import { Mesh } from 'three';
import { Edges } from '@react-three/drei';
import { useConfigStore } from '@/store/useConfigStore';
import { ROOF_COVERINGS } from '@/lib/constants';

const ROOF_THICKNESS = 0.08;
// Must match TimberFrame constants for correct stacking
const BEAM_H = 0.20;
const DECK_T = 0.04;

export default function Roof() {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const config = useConfigStore((s) => s.config);
  const selectedElement = useConfigStore((s) => s.selectedElement);
  const selectElement = useConfigStore((s) => s.selectElement);

  const { width, depth, height, roofPitch } = config.dimensions;
  const roofCfg = config.roof;
  const covering = ROOF_COVERINGS.find((c) => c.id === roofCfg.coveringId);
  const color = covering?.color ?? '#cccccc';

  const isSelected = selectedElement?.type === 'roof';

  const handlePointerOver = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };
  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  };
  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    selectElement({ type: 'roof' });
  };

  const materialProps = {
    color,
    metalness: 0.3,
    roughness: 0.5,
    emissive: isSelected ? '#3b82f6' : hovered ? '#60a5fa' : '#000000',
    emissiveIntensity: isSelected ? 0.35 : hovered ? 0.15 : 0,
  };

  if (roofCfg.type === 'flat') {
    return <FlatRoof
      width={width} depth={depth} height={height}
      materialProps={materialProps}
      isSelected={isSelected}
      meshRef={meshRef}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    />;
  }

  return <PitchedRoof
    width={width} depth={depth} height={height} roofPitch={roofPitch}
    materialProps={materialProps}
    isSelected={isSelected}
    onPointerOver={handlePointerOver}
    onPointerOut={handlePointerOut}
    onClick={handleClick}
  />;
}

interface FlatRoofProps {
  width: number; depth: number; height: number;
  materialProps: Record<string, unknown>;
  isSelected: boolean;
  meshRef: React.RefObject<Mesh | null>;
  onPointerOver: (e: { stopPropagation: () => void }) => void;
  onPointerOut: () => void;
  onClick: (e: { stopPropagation: () => void }) => void;
}

function FlatRoof({ width, depth, height, materialProps, isSelected, meshRef, onPointerOver, onPointerOut, onClick }: FlatRoofProps) {
  return (
    <mesh
      ref={meshRef}
      position={[0, height + BEAM_H + DECK_T + ROOF_THICKNESS / 2, 0]}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
    >
      <boxGeometry args={[width + 0.3, ROOF_THICKNESS, depth + 0.3]} />
      <meshStandardMaterial {...materialProps} />
      <Edges color={isSelected ? '#2563eb' : '#333333'} threshold={15} />
    </mesh>
  );
}

interface PitchedRoofProps {
  width: number; depth: number; height: number; roofPitch: number;
  materialProps: Record<string, unknown>;
  isSelected: boolean;
  onPointerOver: (e: { stopPropagation: () => void }) => void;
  onPointerOut: () => void;
  onClick: (e: { stopPropagation: () => void }) => void;
}

function PitchedRoof({ width, depth, height, roofPitch, materialProps, isSelected, onPointerOver, onPointerOut, onClick }: PitchedRoofProps) {
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
          onClick={onClick}
        >
          <boxGeometry args={[roofSlantLength, ROOF_THICKNESS, depth]} />
          <meshStandardMaterial {...materialProps} />
          <Edges color={isSelected ? '#2563eb' : '#333333'} threshold={15} />
        </mesh>
      ))}
    </group>
  );
}
