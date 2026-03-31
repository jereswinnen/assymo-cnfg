export type BuildingType = 'overkapping' | 'berging' | 'paal' | 'muur';
export type Orientation = 'horizontal' | 'vertical';
export type RoofType = 'flat' | 'pitched';
export type RoofCoveringId = 'dakpannen' | 'riet' | 'epdm' | 'polycarbonaat' | 'metaal';
export type TrimColorId = 'antraciet' | 'wit' | 'zwart' | 'bruin' | 'groen';

export interface BuildingDimensions {
  width: number;
  depth: number;
  height: number;
}

export type WallId = 'front' | 'back' | 'left' | 'right';
export type WallSide = 'left' | 'right' | 'front' | 'back';

export interface SurfaceMaterial {
  id: string;
  label: string;
  pricePerSqm: number;
  color: string;
}

export type DoorMaterialId = 'wood' | 'aluminium' | 'pvc' | 'staal';
export type DoorSize = 'enkel' | 'dubbel';
export type DoorPosition = 'links' | 'midden' | 'rechts';
export type DoorSwing = 'dicht' | 'naar_binnen' | 'naar_buiten';

export interface WallConfig {
  materialId: string;
  finish: string;
  hasDoor: boolean;
  doorMaterialId: DoorMaterialId;
  doorSize: DoorSize;
  doorHasWindow: boolean;
  doorPosition: DoorPosition;
  doorSwing: DoorSwing;
  hasWindow: boolean;
  windowCount: number;
}

export type FloorMaterialId = 'geen' | 'tegels' | 'beton' | 'hout';

export interface FloorConfig {
  materialId: FloorMaterialId;
}

export interface RoofConfig {
  type: RoofType;
  pitch: number;
  coveringId: RoofCoveringId;
  trimColorId: TrimColorId;
  insulation: boolean;
  insulationThickness: number; // mm
  hasSkylight: boolean;
}

export interface RoofCovering {
  id: RoofCoveringId;
  label: string;
  pricePerSqm: number;
  color: string;
}

export interface TrimColor {
  id: TrimColorId;
  label: string;
  hex: string;
}

export interface BuildingEntity {
  id: string;
  type: BuildingType;
  /** Top-left corner in world coords [x, z] — left edge, front edge (min X, min Z) */
  position: [number, number];
  dimensions: BuildingDimensions;
  walls: Record<string, WallConfig>;
  hasCornerBraces: boolean;
  floor: FloorConfig;
  orientation: Orientation;
  heightOverride: number | null;
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
