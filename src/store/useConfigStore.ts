import { create } from 'zustand';
import type {
  BuildingConfig,
  BuildingDimensions,
  BuildingType,
  RoofType,
  RoofConfig,
  SelectedElement,
  WallId,
  WallConfig,
} from '@/types/building';
import {
  DEFAULT_DIMENSIONS,
  DEFAULT_ROOF,
  getDefaultWalls,
} from '@/lib/constants';
import { calculateQuote } from '@/lib/pricing';

interface ConfigState {
  config: BuildingConfig;
  selectedElement: SelectedElement;
  activeAccordionSection: number;
  cameraTargetWallId: WallId | null;

  // Actions
  selectElement: (element: SelectedElement) => void;
  clearSelection: () => void;
  clearCameraTarget: () => void;
  updateDimensions: (dims: Partial<BuildingDimensions>) => void;
  setBuildingType: (type: BuildingType) => void;
  setRoofType: (type: RoofType) => void;
  updateRoof: (patch: Partial<RoofConfig>) => void;
  updateWall: (id: WallId, patch: Partial<WallConfig>) => void;
  toggleCornerBraces: () => void;
  setAccordionSection: (n: number) => void;
  resetConfig: () => void;

  // Computed selectors
  getSelectedWallConfig: () => WallConfig | null;
  getTotalQuote: () => ReturnType<typeof calculateQuote>;
}

function makeDefaultConfig(type: BuildingType = 'combined'): BuildingConfig {
  return {
    buildingType: type,
    dimensions: { ...DEFAULT_DIMENSIONS },
    roof: { ...DEFAULT_ROOF },
    walls: getDefaultWalls(type),
    hasCornerBraces: type !== 'berging',
  };
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: makeDefaultConfig(),
  selectedElement: null,
  activeAccordionSection: 1,
  cameraTargetWallId: null,

  selectElement: (element) =>
    set((state) => ({
      selectedElement: element,
      activeAccordionSection:
        element?.type === 'wall' ? 4 : element?.type === 'roof' ? 3 : state.activeAccordionSection,
      cameraTargetWallId:
        element?.type === 'wall' ? element.id : state.cameraTargetWallId,
    })),

  clearSelection: () => set({ selectedElement: null }),

  clearCameraTarget: () => set({ cameraTargetWallId: null }),

  updateDimensions: (dims) =>
    set((state) => ({
      config: {
        ...state.config,
        dimensions: { ...state.config.dimensions, ...dims },
      },
    })),

  setBuildingType: (type) =>
    set(() => ({
      config: makeDefaultConfig(type),
      selectedElement: null,
    })),

  setRoofType: (type) =>
    set((state) => {
      const sensibleCovering = type === 'flat' ? 'epdm' as const : 'dakpannen' as const;
      return {
        config: {
          ...state.config,
          roof: {
            ...state.config.roof,
            type,
            coveringId: sensibleCovering,
          },
          dimensions: {
            ...state.config.dimensions,
            roofPitch: type === 'flat' ? 0 : 25,
          },
        },
      };
    }),

  updateRoof: (patch) =>
    set((state) => ({
      config: {
        ...state.config,
        roof: { ...state.config.roof, ...patch },
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

  toggleCornerBraces: () =>
    set((state) => ({
      config: {
        ...state.config,
        hasCornerBraces: !state.config.hasCornerBraces,
      },
    })),

  setAccordionSection: (n) => set({ activeAccordionSection: n }),

  resetConfig: () =>
    set({
      config: makeDefaultConfig(),
      selectedElement: null,
      activeAccordionSection: 1,
    }),

  getSelectedWallConfig: (): WallConfig | null => {
    const { config, selectedElement } = get();
    if (!selectedElement || selectedElement.type !== 'wall') return null;
    return config.walls[selectedElement.id] ?? null;
  },

  getTotalQuote: () => calculateQuote(get().config),
}));
