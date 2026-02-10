'use client';

import { useRef, useState, useMemo } from 'react';
import { Mesh } from 'three';
import { Edges } from '@react-three/drei';
import { useConfigStore } from '@/store/useConfigStore';
import { MATERIALS, WALL_THICKNESS } from '@/lib/constants';
import type { WallId } from '@/types/building';

interface WallProps {
  wallId: WallId;
}

export default function Wall({ wallId }: WallProps) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const config = useConfigStore((s) => s.config);
  const selectedElement = useConfigStore((s) => s.selectedElement);
  const selectElement = useConfigStore((s) => s.selectElement);

  const { width, depth, height } = config.dimensions;
  const wallCfg = config.walls[wallId];
  const material = MATERIALS.find((m) => m.id === wallCfg.materialId);
  const color = material?.color ?? '#cccccc';

  const isSelected =
    selectedElement?.type === 'wall' && selectedElement.id === wallId;

  const { size, position, rotation } = useMemo(() => {
    const t = WALL_THICKNESS;
    switch (wallId) {
      case 'front':
        return {
          size: [width, height, t] as [number, number, number],
          position: [0, height / 2, depth / 2] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
        };
      case 'back':
        return {
          size: [width, height, t] as [number, number, number],
          position: [0, height / 2, -depth / 2] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
        };
      case 'left':
        return {
          size: [t, height, depth] as [number, number, number],
          position: [-width / 2, height / 2, 0] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
        };
      case 'right':
        return {
          size: [t, height, depth] as [number, number, number],
          position: [width / 2, height / 2, 0] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
        };
    }
  }, [wallId, width, depth, height]);

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
        selectElement({ type: 'wall', id: wallId });
      }}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        metalness={0.1}
        roughness={0.7}
        emissive={isSelected ? '#3b82f6' : hovered ? '#60a5fa' : '#000000'}
        emissiveIntensity={isSelected ? 0.35 : hovered ? 0.15 : 0}
      />
      <Edges color={isSelected ? '#2563eb' : '#333333'} threshold={15} />
    </mesh>
  );
}
