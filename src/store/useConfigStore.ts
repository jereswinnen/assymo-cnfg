import { create } from 'zustand';
import { temporal } from 'zundo';
import type {
  BuildingDimensions,
  BuildingEntity,
  BuildingType,
  FloorConfig,
  GateConfig,
  Orientation,
  PolesConfig,
  RoofConfig,
  RoofType,
  SnapConnection,
  WallConfig,
  WallId,
  WallSide,
} from '@/domain/building';
import { BUILDING_KIND_META } from '@/domain/building';
import type { ProductBuildingDefaults } from '@/domain/catalog';
import type { MaterialDefaults } from '@/domain/config';
import {
  addBuilding as mAddBuilding,
  isWallHiddenByConnection as mIsWallHiddenByConnection,
  makeInitialConfig,
  migrateConfig,
  pasteBuildings as mPasteBuildings,
  removeBuilding as mRemoveBuilding,
  resetBuildingPoles as mResetBuildingPoles,
  resetBuildingToDefaults as mResetBuildingToDefaults,
  setBuildingPrimaryMaterial as mSetBuildingPrimaryMaterial,
  setWallDoorSupplierProduct as mSetWallDoorSupplierProduct,
  setWallWindowSupplierProduct as mSetWallWindowSupplierProduct,
  setConnections as mSetConnections,
  setDefaultHeight as mSetDefaultHeight,
  setHeightOverride as mSetHeightOverride,
  setOrientation as mSetOrientation,
  setPoleAttachment as mSetPoleAttachment,
  setRoofType as mSetRoofType,
  toggleBuildingBraces as mToggleBuildingBraces,
  toggleConnectionOpen as mToggleConnectionOpen,
  updateBuildingDimensions as mUpdateBuildingDimensions,
  updateBuildingFloor as mUpdateBuildingFloor,
  updateBuildingPoles as mUpdateBuildingPoles,
  updateBuildingPosition as mUpdateBuildingPosition,
  updateBuildingPositions as mUpdateBuildingPositions,
  updateBuildingWall as mUpdateBuildingWall,
  updateGateConfig as mUpdateGateConfig,
  updateRoof as mUpdateRoof,
} from '@/domain/config';
import type { ConfigData, LegacyBuilding } from '@/domain/config';
import { useUIStore } from './useUIStore';

/** Derive effective height from override or global default */
export function getEffectiveHeight(building: BuildingEntity, defaultHeight: number): number {
  return building.heightOverride ?? defaultHeight;
}

interface ConfigStore extends ConfigData {
  addBuilding: (
    type: BuildingType,
    position?: [number, number],
    productDefaults?: ProductBuildingDefaults,
    materialDefaults?: MaterialDefaults,
  ) => string;
  /** Atomically clear the default initial scene and spawn a single product-
   *  backed building at the origin. Intended for the ?product= hydration
   *  path only — not for general use. */
  replaceWithProduct: (productDefaults: ProductBuildingDefaults) => string;
  /** Append cloned entities to the scene at the default paste offset.
   *  Returns the freshly minted ids in input order. */
  pasteBuildings: (entities: readonly BuildingEntity[]) => string[];
  removeBuilding: (id: string) => void;
  updateBuildingPositions: (updates: { id: string; position: [number, number] }[]) => void;
  updateBuildingDimensions: (id: string, dims: Partial<BuildingDimensions>) => void;
  updateBuildingPosition: (id: string, pos: [number, number]) => void;
  setPoleAttachment: (id: string, attachedTo: string | null) => void;
  updateBuildingWall: (id: string, wallId: WallId, patch: Partial<WallConfig>) => void;
  updateBuildingFloor: (id: string, patch: Partial<FloorConfig>) => void;
  updateGateConfig: (id: string, patch: Partial<GateConfig>) => void;
  setBuildingPrimaryMaterial: (id: string, materialId: string) => void;
  /** Universal material setter — dispatches by `BUILDING_KIND_META[type].material.kind`.
   *  UI components call this; never the underlying `setBuildingPrimaryMaterial` /
   *  `updateGateConfig({ materialId })` directly. Adding a future binding kind
   *  is one switch case here, not a per-component refactor. */
  setEntityMaterial: (id: string, materialId: string) => void;
  toggleBuildingBraces: (id: string) => void;
  updateBuildingPoles: (id: string, poles: PolesConfig) => void;
  resetBuildingPoles: (id: string) => void;
  resetBuildingToDefaults: (id: string, defaults: ProductBuildingDefaults) => void;

  setDoorSupplierProduct: (buildingId: string, wallSide: WallSide, id: string | null) => void;
  setWindowSupplierProduct: (buildingId: string, wallSide: WallSide, windowId: string, id: string | null) => void;

  setConnections: (conns: SnapConnection[]) => void;
  toggleConnectionOpen: (aId: string, sideA: WallSide, bId: string, sideB: WallSide) => void;

  setRoofType: (type: RoofType) => void;
  updateRoof: (patch: Partial<RoofConfig>) => void;

  setDefaultHeight: (height: number) => void;
  setHeightOverride: (id: string, override: number | null) => void;
  setOrientation: (id: string, orientation: Orientation) => void;

  resetConfig: () => void;
  loadState: (buildings: LegacyBuilding[], connections: SnapConnection[], roof: RoofConfig, defaultHeight?: number) => void;

  isWallHiddenByConnection: (buildingId: string, wallSide: WallSide) => boolean;
}

const initialConfig = makeInitialConfig();

export const useConfigStore = create<ConfigStore>()(
  temporal(
    (set, get) => ({
      ...initialConfig,

      addBuilding: (type, position, productDefaults, materialDefaults) => {
        const { cfg, id } = mAddBuilding(get(), type, position, productDefaults, materialDefaults);
        set(cfg);
        useUIStore.getState().selectBuilding(id);
        return id;
      },

      pasteBuildings: (entities) => {
        const { cfg, ids } = mPasteBuildings(get(), entities);
        set(cfg);
        return ids;
      },

      replaceWithProduct: (productDefaults) => {
        // Start from the initial config but with an empty buildings list so
        // addBuilding sees `cfg.buildings.length === 0` and applies roof defaults.
        const empty = { ...makeInitialConfig(), buildings: [] };
        const { cfg, id } = mAddBuilding(empty, productDefaults.type, [0, 0], productDefaults);
        set(cfg);
        useUIStore.getState().selectBuilding(id);
        return id;
      },

      removeBuilding: (id) => {
        const ui = useUIStore.getState();
        const wasSelected = ui.selectedBuildingIds.includes(id);
        const next = mRemoveBuilding(get(), id);
        if (next === get()) return;
        set(next);
        if (wasSelected) {
          const remaining = ui.selectedBuildingIds.filter((i) => i !== id);
          useUIStore.setState({
            selectedBuildingIds: remaining,
            selectedElement: remaining.length === 0 ? null : ui.selectedElement,
            sidebarTab: remaining.length === 0 ? 'objects' : ui.sidebarTab,
          });
        }
      },

      updateBuildingPositions: (updates) => set(mUpdateBuildingPositions(get(), updates)),
      updateBuildingDimensions: (id, dims) => set(mUpdateBuildingDimensions(get(), id, dims)),
      updateBuildingPosition: (id, pos) => set(mUpdateBuildingPosition(get(), id, pos)),
      setPoleAttachment: (id, attachedTo) => set(mSetPoleAttachment(get(), id, attachedTo)),
      updateBuildingWall: (id, wallId, patch) => set(mUpdateBuildingWall(get(), id, wallId, patch)),
      updateBuildingFloor: (id, patch) => set(mUpdateBuildingFloor(get(), id, patch)),
      updateGateConfig: (id, patch) => set(mUpdateGateConfig(get(), id, patch)),
      setBuildingPrimaryMaterial: (id, materialId) => set(mSetBuildingPrimaryMaterial(get(), id, materialId)),
      setEntityMaterial: (id, materialId) => {
        const building = get().buildings.find((b) => b.id === id);
        if (!building) return;
        const meta = BUILDING_KIND_META[building.type];
        switch (meta.material.kind) {
          case 'building':
            set(mSetBuildingPrimaryMaterial(get(), id, materialId));
            return;
          case 'gate':
            set(mUpdateGateConfig(get(), id, { materialId }));
            return;
        }
      },
      toggleBuildingBraces: (id) => set(mToggleBuildingBraces(get(), id)),
      updateBuildingPoles: (id, poles) => set(mUpdateBuildingPoles(get(), id, poles)),
      resetBuildingPoles: (id) => set(mResetBuildingPoles(get(), id)),
      resetBuildingToDefaults: (id, defaults) => set(mResetBuildingToDefaults(get(), id, defaults)),

      setDoorSupplierProduct: (buildingId, wallSide, id) =>
        set(mSetWallDoorSupplierProduct(get(), buildingId, wallSide, id)),
      setWindowSupplierProduct: (buildingId, wallSide, windowId, id) =>
        set(mSetWallWindowSupplierProduct(get(), buildingId, wallSide, windowId, id)),

      setConnections: (conns) => set(mSetConnections(get(), conns)),
      toggleConnectionOpen: (aId, sideA, bId, sideB) =>
        set(mToggleConnectionOpen(get(), aId, sideA, bId, sideB)),

      setRoofType: (type) => set(mSetRoofType(get(), type)),
      updateRoof: (patch) => set(mUpdateRoof(get(), patch)),

      setDefaultHeight: (height) => set(mSetDefaultHeight(get(), height)),
      setHeightOverride: (id, override) => set(mSetHeightOverride(get(), id, override)),
      setOrientation: (id, orientation) => set(mSetOrientation(get(), id, orientation)),

      resetConfig: () => {
        set(makeInitialConfig());
        useUIStore.getState().resetUI();
      },

      loadState: (buildings, connections, roof, defaultHeight) => {
        const migrated = migrateConfig({ buildings, connections, roof, defaultHeight });
        set(migrated);
        useUIStore.setState({
          selectedBuildingIds: migrated.buildings[0] ? [migrated.buildings[0].id] : [],
          selectedElement: null,
          activeConfigSection: 'dimensions',
          sidebarTab: 'objects',
        });
      },

      isWallHiddenByConnection: (buildingId, wallSide) =>
        mIsWallHiddenByConnection(get(), buildingId, wallSide),
    }),
    {
      partialize: (state) => ({
        buildings: state.buildings,
        connections: state.connections,
        roof: state.roof,
        defaultHeight: state.defaultHeight,
      }),
    },
  ),
);
