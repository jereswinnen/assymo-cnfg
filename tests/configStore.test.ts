import { beforeEach, describe, it, expect } from 'vite-plus/test';
import { useConfigStore } from '@/store/useConfigStore';
import { useUIStore } from '@/store/useUIStore';

describe('useConfigStore', () => {
  beforeEach(() => {
    useConfigStore.getState().resetConfig();
  });

  it('starts with an empty scene', () => {
    expect(useConfigStore.getState().buildings).toHaveLength(0);
  });

  it('addBuilding appends to buildings and selects the new one in UI store', () => {
    const before = useConfigStore.getState().buildings.length;
    const id = useConfigStore.getState().addBuilding('paal');
    expect(useConfigStore.getState().buildings.length).toBe(before + 1);
    expect(useUIStore.getState().selectedBuildingIds).toEqual([id]);
  });

  it('removeBuilding deletes the lone structural building (scene becomes empty)', () => {
    useConfigStore.getState().addBuilding('berging');
    const { buildings } = useConfigStore.getState();
    useConfigStore.getState().removeBuilding(buildings[0].id);
    expect(useConfigStore.getState().buildings).toHaveLength(0);
  });

  it('removeBuilding deletes a single paal even when a structural is present', () => {
    useConfigStore.getState().addBuilding('berging');
    const paalId = useConfigStore.getState().addBuilding('paal');
    expect(useConfigStore.getState().buildings).toHaveLength(2);
    useConfigStore.getState().removeBuilding(paalId);
    expect(useConfigStore.getState().buildings).toHaveLength(1);
    expect(useConfigStore.getState().buildings[0].type).toBe('berging');
  });

  it('removing all selected entities works for both single and multi', () => {
    useConfigStore.getState().addBuilding('berging');
    const a = useConfigStore.getState().addBuilding('paal');
    const b = useConfigStore.getState().addBuilding('muur');
    // Mirror the registry handler: snapshot ids, then iterate.
    useUIStore.getState().selectBuildings([a, b]);
    const ids = [...useUIStore.getState().selectedBuildingIds];
    for (const id of ids) useConfigStore.getState().removeBuilding(id);
    expect(useConfigStore.getState().buildings).toHaveLength(1);
    // And single-select via the same path.
    const c = useConfigStore.getState().addBuilding('paal');
    useUIStore.getState().selectBuildings([c]);
    for (const id of [...useUIStore.getState().selectedBuildingIds]) {
      useConfigStore.getState().removeBuilding(id);
    }
    expect(useConfigStore.getState().buildings.find((bb) => bb.id === c)).toBeUndefined();
  });

  it('updateBuildingDimensions applies the patch', () => {
    useConfigStore.getState().addBuilding('berging');
    const { buildings } = useConfigStore.getState();
    useConfigStore.getState().updateBuildingDimensions(buildings[0].id, { width: 5 });
    expect(useConfigStore.getState().buildings[0].dimensions.width).toBe(5);
  });

  it('temporal.undo reverts the last mutation', () => {
    useConfigStore.getState().addBuilding('berging');
    const { buildings } = useConfigStore.getState();
    const originalWidth = buildings[0].dimensions.width;
    useConfigStore.getState().updateBuildingDimensions(buildings[0].id, { width: 7 });
    useConfigStore.temporal.getState().undo();
    expect(useConfigStore.getState().buildings[0].dimensions.width).toBe(originalWidth);
  });

  it('resetConfig clears any additions back to empty', () => {
    useConfigStore.getState().addBuilding('paal');
    useConfigStore.getState().addBuilding('paal');
    useConfigStore.getState().resetConfig();
    expect(useConfigStore.getState().buildings).toHaveLength(0);
  });
});
