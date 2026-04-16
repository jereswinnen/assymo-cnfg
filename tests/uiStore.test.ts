import { beforeEach, describe, it, expect } from 'vite-plus/test';
import {
  selectSingleBuildingId,
  useUIStore,
} from '@/store/useUIStore';

describe('useUIStore', () => {
  beforeEach(() => {
    useUIStore.getState().resetUI();
  });

  it('selectBuilding puts the id in selectedBuildingIds and switches to configure tab', () => {
    useUIStore.getState().selectBuilding('b1');
    const state = useUIStore.getState();
    expect(state.selectedBuildingIds).toEqual(['b1']);
    expect(state.sidebarTab).toBe('configure');
    expect(state.sidebarCollapsed).toBe(false);
  });

  it('selectElement(wall) sets activeConfigSection to "walls"', () => {
    useUIStore.getState().selectElement({ type: 'wall', id: 'front', buildingId: 'b1' });
    expect(useUIStore.getState().activeConfigSection).toBe('walls');
    expect(useUIStore.getState().selectedBuildingIds).toEqual(['b1']);
  });

  it('selectElement(roof) sets activeConfigSection to "structure"', () => {
    useUIStore.getState().selectElement({ type: 'roof' });
    expect(useUIStore.getState().activeConfigSection).toBe('structure');
  });

  it('toggleBuildingSelection toggles membership', () => {
    useUIStore.getState().selectBuildings(['a']);
    useUIStore.getState().toggleBuildingSelection('b');
    expect(useUIStore.getState().selectedBuildingIds).toEqual(['a', 'b']);
    useUIStore.getState().toggleBuildingSelection('a');
    expect(useUIStore.getState().selectedBuildingIds).toEqual(['b']);
  });

  it('resetUI clears selection but keeps qualityTier', () => {
    useUIStore.getState().setQualityTier('low');
    useUIStore.getState().selectBuilding('b1');
    useUIStore.getState().resetUI();
    expect(useUIStore.getState().selectedBuildingIds).toEqual([]);
    expect(useUIStore.getState().qualityTier).toBe('low');
  });
});

describe('selectSingleBuildingId', () => {
  beforeEach(() => {
    useUIStore.getState().resetUI();
  });

  it('returns the id only when exactly one is selected', () => {
    expect(selectSingleBuildingId(useUIStore.getState())).toBeNull();
    useUIStore.getState().selectBuildings(['a']);
    expect(selectSingleBuildingId(useUIStore.getState())).toBe('a');
    useUIStore.getState().selectBuildings(['a', 'b']);
    expect(selectSingleBuildingId(useUIStore.getState())).toBeNull();
  });
});
