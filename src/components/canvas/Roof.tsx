'use client';

import { useRef, useState, useMemo } from 'react';
import { Mesh } from 'three';
import { Edges } from '@react-three/drei';
import { useConfigStore } from '@/store/useConfigStore';
import { MATERIALS } from '@/lib/constants';
import type { RoofId } from '@/types/building';

interface RoofProps {
  roofId: RoofId;
}

export default function Roof({ roofId }: RoofProps) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const config = useConfigStore((s) => s.config);
  const selectedElement = useConfigStore((s) => s.selectedElement);
  const selectElement = useConfigStore((s) => s.selectElement);

  const { width, depth, height, roofPitch } = config.dimensions;
  const roofCfg = config.roofs[roofId];
  const material = MATERIALS.find((m) => m.id === roofCfg.materialId);
  const color = material?.color ?? '#cccccc';

  const isSelected =
    selectedElement?.type === 'roof' && selectedElement.id === roofId;

  const pitchRad = (roofPitch * Math.PI) / 180;
  const halfWidth = width / 2;
  const roofRise = Math.tan(pitchRad) * halfWidth;
  const roofSlantLength = halfWidth / Math.cos(pitchRad);
  const roofThickness = 0.08;

  const { position, rotation } = useMemo(() => {
    const ridgeY = height + roofRise;
    const centerY = (height + ridgeY) / 2;
    const centerX = halfWidth / 2;

    if (roofId === 'left-panel') {
      return {
        position: [-centerX, centerY, 0] as [number, number, number],
        rotation: [0, 0, pitchRad] as [number, number, number],
      };
    }
    return {
      position: [centerX, centerY, 0] as [number, number, number],
      rotation: [0, 0, -pitchRad] as [number, number, number],
    };
  }, [roofId, height, roofRise, halfWidth, pitchRad]);

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
      onClick={(e) => {
        e.stopPropagation();
        selectElement({ type: 'roof', id: roofId });
      }}
    >
      <boxGeometry args={[roofSlantLength, roofThickness, depth]} />
      <meshStandardMaterial
        color={color}
        metalness={0.3}
        roughness={0.5}
        emissive={isSelected ? '#3b82f6' : hovered ? '#60a5fa' : '#000000'}
        emissiveIntensity={isSelected ? 0.35 : hovered ? 0.15 : 0}
      />
      <Edges color={isSelected ? '#2563eb' : '#333333'} threshold={15} />
    </mesh>
  );
}
