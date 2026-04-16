import { beforeEach, describe, it, expect } from 'vite-plus/test';
import { useConfigStore } from '@/store/useConfigStore';
import { useUIStore } from '@/store/useUIStore';

describe('useConfigStore', () => {
  beforeEach(() => {
    useConfigStore.getState().resetConfig();
  });

  it('starts with exactly one structural building', () => {
    const { buildings } = useConfigStore.getState();
    expect(buildings).toHaveLength(1);
    expect(buildings[0].type).toBe('berging');
  });

  it('addBuilding appends to buildings and selects the new one in UI store', () => {
    const before = useConfigStore.getState().buildings.length;
    const id = useConfigStore.getState().addBuilding('paal');
    expect(useConfigStore.getState().buildings.length).toBe(before + 1);
    expect(useUIStore.getState().selectedBuildingIds).toEqual([id]);
  });

  it('removeBuilding keeps at least one structural building', () => {
    const { buildings } = useConfigStore.getState();
    useConfigStore.getState().removeBuilding(buildings[0].id);
    expect(useConfigStore.getState().buildings).toHaveLength(1);
  });

  it('updateBuildingDimensions applies the patch', () => {
    const { buildings } = useConfigStore.getState();
    useConfigStore.getState().updateBuildingDimensions(buildings[0].id, { width: 5 });
    expect(useConfigStore.getState().buildings[0].dimensions.width).toBe(5);
  });

  it('temporal.undo reverts the last mutation', () => {
    const { buildings } = useConfigStore.getState();
    const originalWidth = buildings[0].dimensions.width;
    useConfigStore.getState().updateBuildingDimensions(buildings[0].id, { width: 7 });
    useConfigStore.temporal.getState().undo();
    expect(useConfigStore.getState().buildings[0].dimensions.width).toBe(originalWidth);
  });

  it('resetConfig clears any additions', () => {
    useConfigStore.getState().addBuilding('paal');
    useConfigStore.getState().addBuilding('paal');
    useConfigStore.getState().resetConfig();
    expect(useConfigStore.getState().buildings).toHaveLength(1);
  });
});
