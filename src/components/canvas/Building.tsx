'use client';

import Roof from './Roof';
import OverkappingSection from './OverkappingSection';
import BergingSection from './BergingSection';
import { useConfigStore } from '@/store/useConfigStore';

export default function Building() {
  const config = useConfigStore((s) => s.config);
  const clearSelection = useConfigStore((s) => s.clearSelection);

  const { buildingType } = config;
  const { width, bergingWidth } = config.dimensions;

  // Calculate section positions: berging on the left, overkapping on the right
  const overkappingWidth = buildingType === 'combined' ? width - bergingWidth : width;
  const bergingOffset = buildingType === 'combined' ? -(width / 2 - bergingWidth / 2) : 0;
  const overkappingOffset = buildingType === 'combined' ? (width / 2 - overkappingWidth / 2) : 0;

  return (
    <group
      onClick={(e) => {
        if (e.object === e.eventObject) {
          clearSelection();
        }
      }}
    >
      {/* Berging section (closed walls) */}
      {(buildingType === 'berging' || buildingType === 'combined') && (
        <BergingSection
          sectionWidth={buildingType === 'combined' ? bergingWidth : width}
          offsetX={buildingType === 'combined' ? bergingOffset : 0}
        />
      )}

      {/* Overkapping section (open posts) */}
      {(buildingType === 'overkapping' || buildingType === 'combined') && (
        <OverkappingSection
          sectionWidth={overkappingWidth}
          offsetX={buildingType === 'combined' ? overkappingOffset : 0}
        />
      )}

      {/* Roof always spans the full building width */}
      <Roof />
    </group>
  );
}
