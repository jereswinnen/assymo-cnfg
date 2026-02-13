'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { FLOOR_MATERIALS } from '@/lib/constants';
import { useFloorTexture } from '@/lib/textures';

export default function Floor() {
  const config = useConfigStore((s) => s.config);
  const { materialId } = config.floor;

  const { width, depth } = config.dimensions;

  const material = FLOOR_MATERIALS.find((m) => m.id === materialId);
  const pbr = useFloorTexture(materialId, width, depth);

  if (materialId === 'geen' || !material) return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial
        color={pbr ? '#ffffff' : material.color}
        map={pbr?.map ?? undefined}
        normalMap={pbr?.normalMap ?? undefined}
        roughnessMap={pbr?.roughnessMap ?? undefined}
        metalness={0}
        roughness={pbr ? 1 : 0.8}
      />
    </mesh>
  );
}
