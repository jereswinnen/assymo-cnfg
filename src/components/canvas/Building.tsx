'use client';

import Roof from './Roof';
import Floor from './Floor';
import TimberFrame from './TimberFrame';
import BergingSection from './BergingSection';
import Wall from './Wall';
import GhostWall from './GhostWall';
import { useConfigStore } from '@/store/useConfigStore';
import { OVERKAPPING_WALL_IDS } from '@/lib/constants';

export default function Building() {
  const config = useConfigStore((s) => s.config);
  const clearSelection = useConfigStore((s) => s.clearSelection);

  const { buildingType } = config;
  const { width, bergingWidth } = config.dimensions;

  const bergingOffset = buildingType === 'combined' ? -(width / 2 - bergingWidth / 2) : 0;

  return (
    <group
      onClick={(e) => {
        if (e.object === e.eventObject) {
          clearSelection();
        }
      }}
    >
      {/* Timber frame always visible */}
      <TimberFrame />

      {/* Berging section walls (berging and combined types) */}
      {(buildingType === 'berging' || buildingType === 'combined') && (
        <BergingSection
          sectionWidth={buildingType === 'combined' ? bergingWidth : width}
          offsetX={buildingType === 'combined' ? bergingOffset : 0}
        />
      )}

      {/* Overkapping walls / ghost placeholders (combined type only) */}
      {buildingType === 'combined' &&
        OVERKAPPING_WALL_IDS.map((id) =>
          config.walls[id] ? (
            <Wall key={id} wallId={id} />
          ) : (
            <GhostWall key={id} wallId={id} />
          ),
        )}

      {/* Floor covering */}
      <Floor />

      {/* Roof spans full building */}
      <Roof />
    </group>
  );
}
