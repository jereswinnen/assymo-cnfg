'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { FLOOR_MATERIALS } from '@/lib/constants';
import { useFloorTexture } from '@/lib/textures';

export default function Floor() {
  const config = useConfigStore((s) => s.config);
  const { materialId } = config.floor;

  const { width, depth } = config.dimensions;

  const material = FLOOR_MATERIALS.find((m) => m.id === materialId);
  const texture = useFloorTexture(materialId, width, depth);

  if (materialId === 'geen' || !material) return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial
        color={texture ? '#ffffff' : material.color}
        map={texture ?? undefined}
        metalness={0}
        roughness={0.8}
      />
    </mesh>
  );
}
