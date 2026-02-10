import { create } from 'zustand';
import type {
  BuildingConfig,
  BuildingDimensions,
  SelectedElement,
  WallId,
  RoofId,
  WallConfig,
  RoofConfig,
} from '@/types/building';
import {
  DEFAULT_DIMENSIONS,
  DEFAULT_WALLS,
  DEFAULT_ROOFS,
} from '@/lib/constants';
import { calculateQuote } from '@/lib/pricing';

interface ConfigState {
  config: BuildingConfig;
  selectedElement: SelectedElement;

  // Actions
  selectElement: (element: SelectedElement) => void;
  clearSelection: () => void;
  updateDimensions: (dims: Partial<BuildingDimensions>) => void;
  updateWall: (id: WallId, patch: Partial<WallConfig>) => void;
  updateRoof: (id: RoofId, patch: Partial<RoofConfig>) => void;
  resetConfig: () => void;

  // Computed selectors
  getSelectedSurfaceConfig: () => (WallConfig | RoofConfig | null);
  getTotalQuote: () => ReturnType<typeof calculateQuote>;
}

const defaultConfig: BuildingConfig = {
  dimensions: { ...DEFAULT_DIMENSIONS },
  walls: {
    front: { ...DEFAULT_WALLS.front },
    back: { ...DEFAULT_WALLS.back },
    left: { ...DEFAULT_WALLS.left },
    right: { ...DEFAULT_WALLS.right },
  },
  roofs: {
    'left-panel': { ...DEFAULT_ROOFS['left-panel'] },
    'right-panel': { ...DEFAULT_ROOFS['right-panel'] },
  },
};

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: defaultConfig,
  selectedElement: null,

  selectElement: (element) => set({ selectedElement: element }),

  clearSelection: () => set({ selectedElement: null }),

  updateDimensions: (dims) =>
    set((state) => ({
      config: {
        ...state.config,
        dimensions: { ...state.config.dimensions, ...dims },
      },
    })),

  updateWall: (id, patch) =>
    set((state) => ({
      config: {
        ...state.config,
        walls: {
          ...state.config.walls,
          [id]: { ...state.config.walls[id], ...patch },
        },
      },
    })),

  updateRoof: (id, patch) =>
    set((state) => ({
      config: {
        ...state.config,
        roofs: {
          ...state.config.roofs,
          [id]: { ...state.config.roofs[id], ...patch },
        },
      },
    })),

  resetConfig: () =>
    set({
      config: JSON.parse(JSON.stringify(defaultConfig)),
      selectedElement: null,
    }),

  getSelectedSurfaceConfig: (): WallConfig | RoofConfig | null => {
    const { config, selectedElement } = get();
    if (!selectedElement) return null;
    if (selectedElement.type === 'wall') {
      return config.walls[selectedElement.id as WallId];
    }
    return config.roofs[selectedElement.id as RoofId];
  },

  getTotalQuote: () => calculateQuote(get().config),
}));
