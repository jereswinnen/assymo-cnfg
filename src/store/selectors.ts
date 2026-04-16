import type { BuildingEntity, WallConfig } from '@/domain/building';
import { useConfigStore } from './useConfigStore';
import { selectSingleBuildingId, useUIStore } from './useUIStore';

/** The ID of the single currently-selected building, or null when 0 or 2+
 *  are selected. Subscribes to UI state. */
export function useSelectedBuildingId(): string | null {
  return useUIStore(selectSingleBuildingId);
}

/** Resolve the single selected building from config state, or null. Crosses
 *  both stores so it re-renders on either selection or buildings changes. */
export function useSelectedBuilding(): BuildingEntity | null {
  const id = useSelectedBuildingId();
  return useConfigStore((s) =>
    id ? s.buildings.find((b) => b.id === id) ?? null : null,
  );
}

/** Resolve the currently-selected wall config, or null. */
export function useSelectedWallConfig(): WallConfig | null {
  const selectedElement = useUIStore((s) => s.selectedElement);
  return useConfigStore((s) => {
    if (!selectedElement || selectedElement.type !== 'wall') return null;
    const building = s.buildings.find((b) => b.id === selectedElement.buildingId);
    return building?.walls[selectedElement.id] ?? null;
  });
}
