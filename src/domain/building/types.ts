export type BuildingType = 'overkapping' | 'berging' | 'paal' | 'muur';
export type Orientation = 'horizontal' | 'vertical';
export type RoofType = 'flat' | 'pitched';
export type RoofCoveringId = 'dakpannen' | 'riet' | 'epdm' | 'polycarbonaat' | 'metaal';

export interface BuildingDimensions {
  width: number;
  depth: number;
  height: number;
}

export type WallId = 'front' | 'back' | 'left' | 'right';
export type WallSide = 'left' | 'right' | 'front' | 'back';

export type DoorMaterialId = 'wood' | 'aluminium' | 'pvc' | 'staal';
export type DoorSize = 'enkel' | 'dubbel';
export type DoorSwing = 'dicht' | 'naar_binnen' | 'naar_buiten';

export interface WallWindow {
  id: string;
  position: number;    // 0.0–1.0 horizontal fraction of usable wall length
  width: number;       // meters
  height: number;      // meters
  sillHeight: number;  // meters from ground to bottom of window
}

export interface WallConfig {
  /** Override of the building's primaryMaterialId. When undefined the wall
   *  inherits from `BuildingEntity.primaryMaterialId`. */
  materialId?: string;
  hasDoor: boolean;
  /** Override for the door panel. When undefined the door inherits from
   *  the building's primaryMaterialId. */
  doorMaterialId?: DoorMaterialId | string;
  doorSize: DoorSize;
  doorHasWindow: boolean;
  doorPosition: number;
  doorSwing: DoorSwing;
  doorMirror?: boolean;
  windows: WallWindow[];
}

export type FloorMaterialId = 'geen' | 'tegels' | 'beton' | 'hout';

export interface FloorConfig {
  materialId: FloorMaterialId;
}

export interface RoofConfig {
  type: RoofType;
  pitch: number;
  coveringId: RoofCoveringId;
  trimMaterialId: string;
  insulation: boolean;
  insulationThickness: number; // mm
  hasSkylight: boolean;
}

/** Per-side intermediate post fractions (0–1 along the edge, corners excluded).
 *  When a building entity has no `poles`, TimberFrame falls back to the
 *  automatic `autoPoleLayout()` computation. */
export interface PolesConfig {
  front: number[];
  back: number[];
  left: number[];
  right: number[];
}

export interface BuildingEntity {
  id: string;
  type: BuildingType;
  /** Top-left corner in world coords [x, z] — left edge, front edge (min X, min Z) */
  position: [number, number];
  dimensions: BuildingDimensions;
  /** Material every wall, door, and pole defaults to unless individually
   *  overridden. The roof's trim material auto-syncs with this when the
   *  building-level picker is used. Always set; default 'wood'. */
  primaryMaterialId: string;
  walls: Record<string, WallConfig>;
  hasCornerBraces: boolean;
  floor: FloorConfig;
  orientation: Orientation;
  heightOverride: number | null;
  poles?: PolesConfig;
  /** For Paals only: id of the structural building the pole was last snapped
   *  onto. Used to inherit primaryMaterial from that building so the pole
   *  follows the global material. Cleared when the pole is moved away from
   *  any snap target. */
  attachedTo?: string;
  /** Set when the building was spawned from a Product (Phase 5.5.2).
   *  Drives per-product material-picker filtering and dimension clamps.
   *  Null for primitives (paal/muur) and free-build (Bouw van nul)
   *  buildings. Rides along into `configSnapshot` at order submit so
   *  historical orders record which product spawned each building. */
  sourceProductId?: string;
}

export interface SnapConnection {
  buildingAId: string;
  sideA: WallSide;
  buildingBId: string;
  sideB: WallSide;
  isOpen: boolean;
}

export type SelectedElement =
  | { type: 'wall'; id: WallId; buildingId: string }
  | { type: 'roof' }
  | null;
