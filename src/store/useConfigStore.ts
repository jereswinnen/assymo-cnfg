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
} from '@/types/building';
import {
  DEFAULT_DIMENSIONS,
  DEFAULT_ROOF,
  DEFAULT_FLOOR,
  DEFAULT_WALL,
  getDefaultWalls,
} from '@/lib/constants';

interface ConfigState {
  buildings: BuildingEntity[];
  connections: SnapConnection[];
  roof: RoofConfig;

  selectedBuildingId: string | null;
  selectedElement: SelectedElement;
  activeAccordionSection: number;
  draggedBuildingId: string | null;
  cameraTargetWallId: WallId | null;

  // Building CRUD
  addBuilding: (type: BuildingType) => string;
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
  setAccordionSection: (n: number) => void;
  setDraggedBuildingId: (id: string | null) => void;

  // Reset & load
  resetConfig: () => void;
  loadState: (buildings: BuildingEntity[], connections: SnapConnection[], roof: RoofConfig) => void;

  // Computed
  getSelectedBuilding: () => BuildingEntity | null;
  getSelectedWallConfig: () => WallConfig | null;
  isWallHiddenByConnection: (buildingId: string, wallSide: WallSide) => boolean;
}

function createBuilding(type: BuildingType, position: [number, number]): BuildingEntity {
  return {
    id: crypto.randomUUID(),
    type,
    position,
    dimensions: { ...DEFAULT_DIMENSIONS },
    walls: getDefaultWalls(type),
    hasCornerBraces: type === 'overkapping',
    floor: { ...DEFAULT_FLOOR },
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
  activeAccordionSection: 2,
  draggedBuildingId: null,
  cameraTargetWallId: null,

  addBuilding: (type) => {
    const b = createBuilding(type, [0, 0]);
    // Offset from existing buildings
    const existing = get().buildings;
    if (existing.length > 0) {
      const maxX = Math.max(...existing.map(e => e.position[0] + e.dimensions.width / 2));
      b.position = [maxX + b.dimensions.width / 2 + 2, 0];
    }
    set((state) => ({
      buildings: [...state.buildings, b],
      selectedBuildingId: b.id,
    }));
    return b.id;
  },

  removeBuilding: (id) =>
    set((state) => {
      if (state.buildings.length <= 1) return state;
      const buildings = state.buildings.filter(b => b.id !== id);
      const connections = state.connections.filter(
        c => c.buildingAId !== id && c.buildingBId !== id,
      );
      const selectedBuildingId =
        state.selectedBuildingId === id ? (buildings[0]?.id ?? null) : state.selectedBuildingId;
      const selectedElement =
        state.selectedElement?.type === 'wall' && state.selectedElement.buildingId === id
          ? null
          : state.selectedElement;
      return { buildings, connections, selectedBuildingId, selectedElement };
    }),

  selectBuilding: (id) => set({ selectedBuildingId: id }),

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
      activeAccordionSection:
        element?.type === 'wall' ? 4 : element?.type === 'roof' ? 3 : state.activeAccordionSection,
      cameraTargetWallId:
        element?.type === 'wall' ? element.id : state.cameraTargetWallId,
    })),

  clearSelection: () => set({ selectedElement: null }),

  clearCameraTarget: () => set({ cameraTargetWallId: null }),

  setAccordionSection: (n) => set({ activeAccordionSection: n }),

  setDraggedBuildingId: (id) => set({ draggedBuildingId: id }),

  resetConfig: () => {
    const initial = makeInitialBuilding();
    set({
      buildings: [initial],
      connections: [],
      roof: { ...DEFAULT_ROOF },
      selectedBuildingId: null,
      selectedElement: null,
      activeAccordionSection: 1,
      draggedBuildingId: null,
      cameraTargetWallId: null,
    });
  },

  loadState: (buildings, connections, roof) =>
    set({
      buildings,
      connections,
      roof,
      selectedBuildingId: buildings[0]?.id ?? null,
      selectedElement: null,
      activeAccordionSection: 1,
    }),

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
