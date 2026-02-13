export type BuildingType = 'overkapping' | 'berging' | 'combined';
export type RoofType = 'flat' | 'pitched';
export type RoofCoveringId = 'dakpannen' | 'riet' | 'epdm' | 'polycarbonaat' | 'metaal';
export type TrimColorId = 'antraciet' | 'wit' | 'zwart' | 'bruin' | 'groen';

export interface BuildingDimensions {
  width: number;
  depth: number;
  height: number;
  roofPitch: number; // angle in degrees
  bergingWidth: number; // width of berging section (for combined type)
}

export type WallId = 'front' | 'back' | 'left' | 'right' | 'divider' | 'ov_front' | 'ov_back' | 'ov_right';

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

export interface BuildingConfig {
  buildingType: BuildingType;
  dimensions: BuildingDimensions;
  roof: RoofConfig;
  floor: FloorConfig;
  walls: Record<string, WallConfig>;
  hasCornerBraces: boolean;
}

export type SelectedElement =
  | { type: 'wall'; id: WallId }
  | { type: 'roof' }
  | null;
