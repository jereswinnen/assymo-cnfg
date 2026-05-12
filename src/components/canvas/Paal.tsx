'use client';

import { useBuildingId } from '@/lib/BuildingContext';
import { useConfigStore, getEffectiveHeight } from '@/store/useConfigStore';
import { getEffectivePoleMaterial } from '@/domain/materials';
import { useEffectivePostSize } from '@/lib/useEffectivePostSize';
import { usePoleMaterial } from './poleMaterial';

/** Standalone Paal (pole) building. Matches TimberFrame post geometry and
 *  material so a free-standing pole aligns visually with overkapping corners. */
export default function Paal() {
  const buildingId = useBuildingId();
  const building = useConfigStore((s) => s.buildings.find(b => b.id === buildingId));
  const buildings = useConfigStore((s) => s.buildings);
  const defaultHeight = useConfigStore((s) => s.defaultHeight);

  const materialId = building ? getEffectivePoleMaterial(building, buildings) : 'wood';
  const material = usePoleMaterial(materialId);
  const postSize = useEffectivePostSize();

  if (!building) return null;

  const h = getEffectiveHeight(building, defaultHeight);
  return (
    <mesh position={[0, h / 2, 0]} material={material} castShadow>
      <boxGeometry args={[postSize, h, postSize]} />
    </mesh>
  );
}
