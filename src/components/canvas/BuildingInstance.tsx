'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { BoxGeometry } from 'three';
import { BuildingProvider } from '@/lib/BuildingContext';
import { useConfigStore, getEffectiveHeight } from '@/store/useConfigStore';
import { useUIStore, selectSingleBuildingId } from "@/store/useUIStore";
import Building from './Building';

interface BuildingInstanceProps {
  buildingId: string;
}

export default function BuildingInstance({ buildingId }: BuildingInstanceProps) {
  const building = useConfigStore((s) => s.buildings.find(b => b.id === buildingId));
  const selectedBuildingId = useUIStore(selectSingleBuildingId);
  const defaultHeight = useConfigStore((s) => s.defaultHeight);
  const selectBuilding = useUIStore((s) => s.selectBuilding);

  const handleClick = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    selectBuilding(buildingId);
  }, [buildingId, selectBuilding]);

  if (!building) return null;

  const isSelected = selectedBuildingId === buildingId;

  const isVertWallLike = (building.type === 'muur' || building.type === 'poort') && building.orientation === 'vertical';
  const bw = isVertWallLike ? building.dimensions.depth : building.dimensions.width;
  const bd = isVertWallLike ? building.dimensions.width : building.dimensions.depth;

  return (
    <BuildingProvider value={buildingId}>
      <group
        position={[
          building.position[0] + bw / 2,
          0,
          building.position[1] + bd / 2,
        ]}
        onClick={handleClick}
      >
        <Building />
        {isSelected && (
          <SelectionOutline
            width={isVertWallLike ? building.dimensions.depth : building.dimensions.width}
            depth={isVertWallLike ? building.dimensions.width : building.dimensions.depth}
            height={getEffectiveHeight(building, defaultHeight)}
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
