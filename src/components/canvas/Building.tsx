'use client';

import Roof from './Roof';
import Floor from './Floor';
import TimberFrame from './TimberFrame';
import BergingSection from './BergingSection';
import { useBuildingId } from '@/lib/BuildingContext';
import { useConfigStore, getEffectiveHeight } from '@/store/useConfigStore';
import { POST_SIZE } from '@/lib/constants';

export default function Building() {
  const buildingId = useBuildingId();
  const building = useConfigStore((s) => s.buildings.find(b => b.id === buildingId));
  const defaultHeight = useConfigStore((s) => s.defaultHeight);
  const clearSelection = useConfigStore((s) => s.clearSelection);

  if (!building) return null;

  if (building.type === 'paal') {
    const h = getEffectiveHeight(building, defaultHeight);
    return (
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[POST_SIZE, h, POST_SIZE]} />
        <meshStandardMaterial color="#8B6914" />
      </mesh>
    );
  }

  if (building.type === 'muur') {
    const h = getEffectiveHeight(building, defaultHeight);
    const wallCfg = building.walls['front'];
    const isVertical = building.orientation === 'vertical';

    return (
      <group rotation={isVertical ? [0, Math.PI / 2, 0] : [0, 0, 0]}>
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[building.dimensions.width, h, POST_SIZE]} />
          <meshStandardMaterial
            color={wallCfg?.materialId === 'glass' ? '#B8D4E3' : wallCfg?.materialId === 'brick' ? '#8B4513' : wallCfg?.materialId === 'render' ? '#F5F5DC' : wallCfg?.materialId === 'metal' ? '#708090' : '#8B6914'}
            transparent={wallCfg?.materialId === 'glass'}
            opacity={wallCfg?.materialId === 'glass' ? 0.4 : 1}
            side={2}
          />
        </mesh>
      </group>
    );
  }

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
