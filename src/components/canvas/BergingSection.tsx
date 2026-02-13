'use client';

import Wall from './Wall';
import { useConfigStore } from '@/store/useConfigStore';
import { isOverkappingWall } from '@/lib/constants';
import type { WallId } from '@/types/building';

interface BergingSectionProps {
  sectionWidth: number;
  offsetX: number;
}

export default function BergingSection({ sectionWidth, offsetX }: BergingSectionProps) {
  const walls = useConfigStore((s) => s.config.walls);
  const wallIds = (Object.keys(walls) as WallId[]).filter((id) => !isOverkappingWall(id));

  return (
    <group>
      {wallIds.map((id) => (
        <Wall
          key={id}
          wallId={id}
          sectionWidth={sectionWidth}
          offsetX={offsetX}
        />
      ))}
    </group>
  );
}
