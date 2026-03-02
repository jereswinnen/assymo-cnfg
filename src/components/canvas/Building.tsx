'use client';

import Roof from './Roof';
import Floor from './Floor';
import TimberFrame from './TimberFrame';
import BergingSection from './BergingSection';
import { useBuildingId } from '@/lib/BuildingContext';
import { useConfigStore } from '@/store/useConfigStore';

export default function Building() {
  const buildingId = useBuildingId();
  const building = useConfigStore((s) => s.buildings.find(b => b.id === buildingId));
  const clearSelection = useConfigStore((s) => s.clearSelection);

  if (!building) return null;

  return (
    <group
      onClick={(e) => {
        if (e.object === e.eventObject) {
          clearSelection();
        }
      }}
    >
      <TimberFrame />

      {building.type === 'berging' && <BergingSection />}

      <Floor />
      <Roof />
    </group>
  );
}
