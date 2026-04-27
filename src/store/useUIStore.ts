import { create } from 'zustand';
import type { BuildingEntity, SelectedElement, WallId } from '@/domain/building';
import { useConfigStore } from '@/store/useConfigStore';

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
  /** Per-tab clipboard for copy/paste of building entities. Holds the
   *  snapshotted entities at copy time, not ids — the source can be
   *  deleted/edited and the clipboard still pastes the original. Cleared
   *  on full reload (not persisted). */
  clipboard: BuildingEntity[] | null;

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

  /** Snapshot the currently-selected buildings into the clipboard. No-op
   *  when nothing is selected. */
  copySelection: () => void;
  /** Append a fresh copy of the clipboard into the scene at the default
   *  paste offset and select the new entities. No-op when the clipboard
   *  is empty. */
  pasteClipboard: () => void;

  /** Reset UI to the initial landing state. Called alongside config resets. */
  resetUI: (initialSelectedId?: string | null) => void;
}

const INITIAL_UI: Omit<UIState, keyof Pick<UIState,
  'selectBuilding' | 'selectBuildings' | 'toggleBuildingSelection' |
  'selectElement' | 'clearSelection' | 'clearCameraTarget' | 'setDraggedBuildingId' |
  'setSidebarTab' | 'setSidebarCollapsed' | 'setActiveConfigSection' |
  'setViewMode' | 'setQualityTier' | 'copySelection' | 'pasteClipboard' | 'resetUI'
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
  clipboard: null,
};

export const useUIStore = create<UIState>()((set, get) => ({
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

  copySelection: () => {
    const ids = get().selectedBuildingIds;
    if (ids.length === 0) return;
    const buildings = useConfigStore.getState().buildings;
    const picked = ids
      .map((id) => buildings.find((b) => b.id === id))
      .filter((b): b is BuildingEntity => b !== undefined);
    if (picked.length === 0) return;
    set({ clipboard: picked.map((b) => structuredClone(b)) });
  },

  pasteClipboard: () => {
    const clip = get().clipboard;
    if (!clip || clip.length === 0) return;
    const ids = useConfigStore.getState().pasteBuildings(clip);
    set({
      selectedBuildingIds: ids,
      selectedElement: null,
      sidebarTab: 'configure',
      sidebarCollapsed: false,
    });
  },

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
