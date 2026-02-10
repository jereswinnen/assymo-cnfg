'use client';

import Wall from './Wall';
import Roof from './Roof';
import { useConfigStore } from '@/store/useConfigStore';
import type { WallId, RoofId } from '@/types/building';

const WALL_IDS: WallId[] = ['front', 'back', 'left', 'right'];
const ROOF_IDS: RoofId[] = ['left-panel', 'right-panel'];

export default function Building() {
  const clearSelection = useConfigStore((s) => s.clearSelection);

  return (
    <group
      onClick={(e) => {
        // Only clear if the click didn't hit a child mesh
        if (e.object === e.eventObject) {
          clearSelection();
        }
      }}
    >
      {WALL_IDS.map((id) => (
        <Wall key={id} wallId={id} />
      ))}
      {ROOF_IDS.map((id) => (
        <Roof key={id} roofId={id} />
      ))}
    </group>
  );
}
