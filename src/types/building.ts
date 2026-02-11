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

export type WallId = 'front' | 'back' | 'left' | 'right' | 'divider';

export interface SurfaceMaterial {
  id: string;
  label: string;
  pricePerSqm: number;
  color: string;
}

export interface WallConfig {
  materialId: string;
  insulation: boolean;
  insulationThickness: number; // mm
  finish: string;
  hasDoor: boolean;
  hasWindow: boolean;
  windowCount: number;
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
  walls: Record<string, WallConfig>;
  hasCornerBraces: boolean;
}

export type SelectedElement =
  | { type: 'wall'; id: WallId }
  | { type: 'roof' }
  | null;
