import { create } from 'zustand';
import type { SelectedElement, WallId } from '@/domain/building';

export type SidebarTab = 'objects' | 'configure';
export type ConfigSection = 'dimensions' | 'material' | 'structure' | 'walls' | 'quote' | null;
export type ViewMode = 'plan' | '3d' | 'split';
export type QualityTier = 'high' | 'low';

interface UIState {
  selectedBuildingIds: string[];
  selectedElement: SelectedElement;
  draggedBuildingId: string | null;
  cameraTargetWallId: WallId | null;
  sidebarTab: SidebarTab;
  sidebarCollapsed: boolean;
  activeConfigSection: ConfigSection;
  viewMode: ViewMode;
  qualityTier: QualityTier;

  selectBuilding: (id: string | null) => void;
  selectBuildings: (ids: string[]) => void;
  toggleBuildingSelection: (id: string) => void;

  selectElement: (element: SelectedElement) => void;
  clearSelection: () => void;
  clearCameraTarget: () => void;
  setDraggedBuildingId: (id: string | null) => void;

  setSidebarTab: (tab: SidebarTab) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveConfigSection: (section: ConfigSection) => void;
  setViewMode: (mode: ViewMode) => void;
  setQualityTier: (tier: QualityTier) => void;

  /** Reset UI to the initial landing state. Called alongside config resets. */
  resetUI: (initialSelectedId?: string | null) => void;
}

const INITIAL_UI: Omit<UIState, keyof Pick<UIState,
  'selectBuilding' | 'selectBuildings' | 'toggleBuildingSelection' |
  'selectElement' | 'clearSelection' | 'clearCameraTarget' | 'setDraggedBuildingId' |
  'setSidebarTab' | 'setSidebarCollapsed' | 'setActiveConfigSection' |
  'setViewMode' | 'setQualityTier' | 'resetUI'
>> = {
  selectedBuildingIds: [],
  selectedElement: null,
  draggedBuildingId: null,
  cameraTargetWallId: null,
  sidebarTab: 'objects',
  sidebarCollapsed: false,
  activeConfigSection: 'dimensions',
  viewMode: 'plan',
  qualityTier: 'high',
};

export const useUIStore = create<UIState>()((set) => ({
  ...INITIAL_UI,

  selectBuilding: (id) =>
    set({
      selectedBuildingIds: id ? [id] : [],
      ...(id ? { sidebarTab: 'configure' as const, sidebarCollapsed: false } : {}),
    }),

  selectBuildings: (ids) => set({ selectedBuildingIds: ids }),

  toggleBuildingSelection: (id) =>
    set((state) => {
      const exists = state.selectedBuildingIds.includes(id);
      return {
        selectedBuildingIds: exists
          ? state.selectedBuildingIds.filter((i) => i !== id)
          : [...state.selectedBuildingIds, id],
      };
    }),

  selectElement: (element) =>
    set((state) => ({
      selectedElement: element,
      selectedBuildingIds:
        element?.type === 'wall' ? [element.buildingId] : state.selectedBuildingIds,
      activeConfigSection:
        element?.type === 'wall'
          ? 'walls'
          : element?.type === 'roof'
          ? 'structure'
          : state.activeConfigSection,
      sidebarTab: 'configure' as const,
      sidebarCollapsed: false,
      cameraTargetWallId:
        element?.type === 'wall' ? element.id : state.cameraTargetWallId,
    })),

  clearSelection: () => set({ selectedElement: null }),
  clearCameraTarget: () => set({ cameraTargetWallId: null }),
  setDraggedBuildingId: (id) => set({ draggedBuildingId: id }),

  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setActiveConfigSection: (section) => set({ activeConfigSection: section }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setQualityTier: (tier) => set({ qualityTier: tier }),

  resetUI: (initialSelectedId = null) =>
    set({
      selectedBuildingIds: initialSelectedId ? [initialSelectedId] : [],
      selectedElement: null,
      draggedBuildingId: null,
      cameraTargetWallId: null,
      sidebarTab: 'objects',
      sidebarCollapsed: false,
      activeConfigSection: 'dimensions',
      viewMode: 'plan',
    }),
}));

/** Returns the single selected building ID, or null if 0 or 2+ are selected. */
export const selectSingleBuildingId = (s: UIState) =>
  s.selectedBuildingIds.length === 1 ? s.selectedBuildingIds[0] : null;
