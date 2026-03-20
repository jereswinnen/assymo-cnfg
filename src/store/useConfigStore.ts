import { create } from 'zustand';
import type {
  BuildingEntity,
  BuildingDimensions,
  BuildingType,
  RoofType,
  RoofConfig,
  FloorConfig,
  SelectedElement,
  WallId,
  WallSide,
  WallConfig,
  SnapConnection,
  Orientation,
} from '@/types/building';
import {
  DEFAULT_DIMENSIONS,
  DEFAULT_ROOF,
  DEFAULT_FLOOR,
  DEFAULT_WALL,
  POLE_DIMENSIONS,
  WALL_DIMENSIONS,
  getDefaultWalls,
} from '@/lib/constants';

/** Derive effective height from override or global default */
export function getEffectiveHeight(building: BuildingEntity, defaultHeight: number): number {
  return building.heightOverride ?? defaultHeight;
}

interface ConfigState {
  buildings: BuildingEntity[];
  connections: SnapConnection[];
  roof: RoofConfig;

  selectedBuildingId: string | null;
  selectedElement: SelectedElement;
  draggedBuildingId: string | null;
  cameraTargetWallId: WallId | null;
  defaultHeight: number;
  sidebarTab: 'objects' | 'configure';
  sidebarCollapsed: boolean;
  activeConfigSection: 'dimensions' | 'structure' | 'walls' | 'quote' | null;
  viewMode: 'plan' | '3d';

  // Building CRUD
  addBuilding: (type: BuildingType, position?: [number, number]) => string;
  removeBuilding: (id: string) => void;
  selectBuilding: (id: string | null) => void;

  // Per-building mutations
  updateBuildingDimensions: (id: string, dims: Partial<BuildingDimensions>) => void;
  updateBuildingPosition: (id: string, pos: [number, number]) => void;
  updateBuildingWall: (id: string, wallId: WallId, patch: Partial<WallConfig>) => void;
  updateBuildingFloor: (id: string, patch: Partial<FloorConfig>) => void;
  toggleBuildingBraces: (id: string) => void;

  // Connections
  setConnections: (conns: SnapConnection[]) => void;
  toggleConnectionOpen: (aId: string, sideA: WallSide, bId: string, sideB: WallSide) => void;

  // Shared roof
  setRoofType: (type: RoofType) => void;
  updateRoof: (patch: Partial<RoofConfig>) => void;

  // Selection & UI
  selectElement: (element: SelectedElement) => void;
  clearSelection: () => void;
  clearCameraTarget: () => void;
  setDraggedBuildingId: (id: string | null) => void;

  setSidebarTab: (tab: 'objects' | 'configure') => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveConfigSection: (section: 'dimensions' | 'structure' | 'walls' | 'quote' | null) => void;
  setViewMode: (mode: 'plan' | '3d') => void;

  setDefaultHeight: (height: number) => void;
  setHeightOverride: (id: string, override: number | null) => void;
  setOrientation: (id: string, orientation: Orientation) => void;

  // Reset & load
  resetConfig: () => void;
  loadState: (buildings: BuildingEntity[], connections: SnapConnection[], roof: RoofConfig) => void;

  // Computed
  getSelectedBuilding: () => BuildingEntity | null;
  getSelectedWallConfig: () => WallConfig | null;
  isWallHiddenByConnection: (buildingId: string, wallSide: WallSide) => boolean;
}

function createBuilding(type: BuildingType, position: [number, number]): BuildingEntity {
  const dimensions = type === 'paal'
    ? { ...POLE_DIMENSIONS }
    : type === 'muur'
    ? { ...WALL_DIMENSIONS }
    : { ...DEFAULT_DIMENSIONS };

  return {
    id: crypto.randomUUID(),
    type,
    position,
    dimensions,
    walls: getDefaultWalls(type),
    hasCornerBraces: type === 'overkapping',
    floor: { ...DEFAULT_FLOOR },
    orientation: 'horizontal',
    heightOverride: null,
  };
}

function makeInitialBuilding(): BuildingEntity {
  return createBuilding('berging', [0, 0]);
}

const initialBuilding = makeInitialBuilding();

export const useConfigStore = create<ConfigState>((set, get) => ({
  buildings: [initialBuilding],
  connections: [],
  roof: { ...DEFAULT_ROOF },

  selectedBuildingId: initialBuilding.id,
  selectedElement: null,
  draggedBuildingId: null,
  cameraTargetWallId: null,
  defaultHeight: 3,
  sidebarTab: 'objects',
  sidebarCollapsed: false,
  activeConfigSection: 'dimensions',
  viewMode: 'plan',

  addBuilding: (type, position) => {
    const b = createBuilding(type, position ?? [0, 0]);
    if (!position) {
      const existing = get().buildings;
      if (existing.length > 0) {
        const maxX = Math.max(...existing.map(e => e.position[0] + e.dimensions.width / 2));
        b.position = [maxX + b.dimensions.width / 2 + 2, 0];
      }
    }
    set((state) => ({
      buildings: [...state.buildings, b],
      selectedBuildingId: b.id,
      sidebarTab: 'configure' as const,
      sidebarCollapsed: false,
    }));
    return b.id;
  },

  removeBuilding: (id) =>
    set((state) => {
      const target = state.buildings.find(b => b.id === id);
      // Always keep at least one structural building
      const structuralCount = state.buildings.filter(b => b.type !== 'paal' && b.type !== 'muur').length;
      if (!target) return state;
      if (target.type !== 'paal' && target.type !== 'muur' && structuralCount <= 1) return state;
      const buildings = state.buildings.filter(b => b.id !== id);
      const connections = state.connections.filter(
        c => c.buildingAId !== id && c.buildingBId !== id,
      );
      const selectedBuildingId =
        state.selectedBuildingId === id ? null : state.selectedBuildingId;
      const selectedElement =
        state.selectedBuildingId === id ? null : state.selectedElement;
      const sidebarTab =
        state.selectedBuildingId === id ? 'objects' as const : state.sidebarTab;
      return { buildings, connections, selectedBuildingId, selectedElement, sidebarTab };
    }),

  selectBuilding: (id) => set({
    selectedBuildingId: id,
    ...(id ? { sidebarTab: 'configure' as const, sidebarCollapsed: false } : {}),
  }),

  updateBuildingDimensions: (id, dims) =>
    set((state) => ({
      buildings: state.buildings.map(b =>
        b.id === id ? { ...b, dimensions: { ...b.dimensions, ...dims } } : b,
      ),
    })),

  updateBuildingPosition: (id, pos) =>
    set((state) => ({
      buildings: state.buildings.map(b => (b.id === id ? { ...b, position: pos } : b)),
    })),

  updateBuildingWall: (id, wallId, patch) =>
    set((state) => ({
      buildings: state.buildings.map(b =>
        b.id === id
          ? {
              ...b,
              walls: {
                ...b.walls,
                [wallId]: { ...(b.walls[wallId] ?? DEFAULT_WALL), ...patch },
              },
            }
          : b,
      ),
    })),

  updateBuildingFloor: (id, patch) =>
    set((state) => ({
      buildings: state.buildings.map(b =>
        b.id === id ? { ...b, floor: { ...b.floor, ...patch } } : b,
      ),
    })),

  toggleBuildingBraces: (id) =>
    set((state) => ({
      buildings: state.buildings.map(b =>
        b.id === id ? { ...b, hasCornerBraces: !b.hasCornerBraces } : b,
      ),
    })),

  setConnections: (conns) => set({ connections: conns }),

  toggleConnectionOpen: (aId, sideA, bId, sideB) =>
    set((state) => ({
      connections: state.connections.map(c => {
        const match =
          (c.buildingAId === aId && c.sideA === sideA && c.buildingBId === bId && c.sideB === sideB) ||
          (c.buildingAId === bId && c.sideA === sideB && c.buildingBId === aId && c.sideB === sideA);
        return match ? { ...c, isOpen: !c.isOpen } : c;
      }),
    })),

  setRoofType: (type) =>
    set((state) => {
      const sensibleCovering = type === 'flat' ? ('epdm' as const) : ('dakpannen' as const);
      return {
        roof: {
          ...state.roof,
          type,
          pitch: type === 'flat' ? 0 : 25,
          coveringId: sensibleCovering,
        },
      };
    }),

  updateRoof: (patch) =>
    set((state) => ({
      roof: { ...state.roof, ...patch },
    })),

  selectElement: (element) =>
    set((state) => ({
      selectedElement: element,
      selectedBuildingId:
        element?.type === 'wall' ? element.buildingId : state.selectedBuildingId,
      activeConfigSection:
        element?.type === 'wall' ? 'walls' : element?.type === 'roof' ? 'structure' : state.activeConfigSection,
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

  setDefaultHeight: (height) => set({ defaultHeight: height }),

  setHeightOverride: (id, override) =>
    set((state) => ({
      buildings: state.buildings.map(b =>
        b.id === id ? { ...b, heightOverride: override } : b,
      ),
    })),

  setOrientation: (id, orientation) =>
    set((state) => ({
      buildings: state.buildings.map(b =>
        b.id === id ? { ...b, orientation } : b,
      ),
    })),

  resetConfig: () => {
    const initial = makeInitialBuilding();
    set({
      buildings: [initial],
      connections: [],
      roof: { ...DEFAULT_ROOF },
      selectedBuildingId: null,
      selectedElement: null,
      draggedBuildingId: null,
      cameraTargetWallId: null,
      defaultHeight: 3,
      activeConfigSection: 'dimensions',
      sidebarTab: 'objects',
      sidebarCollapsed: false,
      viewMode: 'plan',
    });
  },

  loadState: (buildings, connections, roof) => {
    // Migration: add orientation and heightOverride for legacy configs
    const migrated = buildings.map(b => ({
      ...b,
      orientation: (b as any).orientation ?? ('horizontal' as Orientation),
      heightOverride: (b as any).heightOverride ?? null,
    }));
    // Derive defaultHeight from first structural building
    const structural = migrated.find(b => b.type !== 'paal' && b.type !== 'muur');
    const defaultHeight = structural?.dimensions.height ?? 3;

    set({
      buildings: migrated,
      connections,
      roof,
      defaultHeight,
      selectedBuildingId: migrated[0]?.id ?? null,
      selectedElement: null,
      activeConfigSection: 'dimensions',
      sidebarTab: 'objects',
    });
  },

  getSelectedBuilding: () => {
    const { buildings, selectedBuildingId } = get();
    if (!selectedBuildingId) return null;
    return buildings.find(b => b.id === selectedBuildingId) ?? null;
  },

  getSelectedWallConfig: () => {
    const { buildings, selectedElement } = get();
    if (!selectedElement || selectedElement.type !== 'wall') return null;
    const building = buildings.find(b => b.id === selectedElement.buildingId);
    if (!building) return null;
    return building.walls[selectedElement.id] ?? null;
  },

  isWallHiddenByConnection: (buildingId, wallSide) => {
    const { connections } = get();
    return connections.some(
      c =>
        c.isOpen &&
        ((c.buildingAId === buildingId && c.sideA === wallSide) ||
          (c.buildingBId === buildingId && c.sideB === wallSide)),
    );
  },
}));
