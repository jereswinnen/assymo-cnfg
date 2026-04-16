'use client';

import Wall from './Wall';
import { useBuildingId } from '@/lib/BuildingContext';
import { useConfigStore } from '@/store/useConfigStore';
import type { WallId } from '@/domain/building';

export default function BergingSection() {
  const buildingId = useBuildingId();
  const walls = useConfigStore((s) => {
    const b = s.buildings.find(b => b.id === buildingId);
    return b?.walls ?? {};
  });

  const wallIds = Object.keys(walls) as WallId[];

  return (
    <group>
      {wallIds.map((id) => (
        <Wall key={id} wallId={id} />
      ))}
    </group>
  );
}
