'use client';

import { useBuildingId } from '@/lib/BuildingContext';
import { useConfigStore } from '@/store/useConfigStore';
import { getAtomColor } from '@/domain/materials';
import { useFloorTexture } from '@/lib/textures';
import { POST_SIZE } from '@/domain/building';

export default function Floor() {
  const buildingId = useBuildingId();
  const building = useConfigStore((s) => s.buildings.find(b => b.id === buildingId));

  const materialId = building?.floor.materialId ?? 'geen';
  const { width, depth } = building?.dimensions ?? { width: 8, depth: 4 };

  // Building dimensions measure pole-center to pole-center (and wall
  // center-line to wall center-line). Extending by POST_SIZE so the floor
  // reaches the outer face of corner poles / walls — otherwise the
  // structure visibly stands "outside" the slab.
  const floorWidth = width + POST_SIZE;
  const floorDepth = depth + POST_SIZE;

  const pbr = useFloorTexture(materialId, floorWidth, floorDepth);

  if (materialId === 'geen') return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
      <planeGeometry args={[floorWidth, floorDepth]} />
      <meshStandardMaterial
        color={pbr ? '#ffffff' : getAtomColor(materialId)}
        map={pbr?.map ?? undefined}
        normalMap={pbr?.normalMap ?? undefined}
        roughnessMap={pbr?.roughnessMap ?? undefined}
        metalness={0}
        roughness={pbr ? 1 : 0.8}
        envMapIntensity={0.4}
      />
    </mesh>
  );
}
