'use client';

import Roof from './Roof';
import TimberFrame from './TimberFrame';
import BergingSection from './BergingSection';
import { useConfigStore } from '@/store/useConfigStore';

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

      {/* Roof spans full building */}
      <Roof />
    </group>
  );
}
