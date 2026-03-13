'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { BoxGeometry } from 'three';
import { BuildingProvider } from '@/lib/BuildingContext';
import { useConfigStore } from '@/store/useConfigStore';
import Building from './Building';

interface BuildingInstanceProps {
  buildingId: string;
}

export default function BuildingInstance({ buildingId }: BuildingInstanceProps) {
  const building = useConfigStore((s) => s.buildings.find(b => b.id === buildingId));
  const selectedBuildingId = useConfigStore((s) => s.selectedBuildingId);
  const selectBuilding = useConfigStore((s) => s.selectBuilding);
  const setAccordionSection = useConfigStore((s) => s.setAccordionSection);

  const handleClick = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    selectBuilding(buildingId);
    setAccordionSection(2);
  }, [buildingId, selectBuilding, setAccordionSection]);

  if (!building) return null;

  const isSelected = selectedBuildingId === buildingId;

  return (
    <BuildingProvider value={buildingId}>
      <group
        position={[building.position[0], 0, building.position[1]]}
        onClick={handleClick}
      >
        <Building />
        {isSelected && (
          <SelectionOutline
            width={building.dimensions.width}
            depth={building.dimensions.depth}
            height={building.dimensions.height}
            isPole={building.type === 'paal'}
          />
        )}
      </group>
    </BuildingProvider>
  );
}

function SelectionOutline({ width, depth, height, isPole }: { width: number; depth: number; height: number; isPole?: boolean }) {
  const margin = isPole ? 0.4 : 0.1;
  const geo = useMemo(() => new BoxGeometry(width + margin, height + margin, depth + margin), [width, depth, height, margin]);
  useEffect(() => () => { geo.dispose(); }, [geo]);
  return (
    <lineSegments position={[0, height / 2, 0]}>
      <edgesGeometry args={[geo]} />
      <lineBasicMaterial color="#3b82f6" linewidth={2} />
    </lineSegments>
  );
}
