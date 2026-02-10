export interface BuildingDimensions {
  width: number;
  depth: number;
  height: number;
  roofPitch: number; // angle in degrees
}

export type WallId = 'front' | 'back' | 'left' | 'right';
export type RoofId = 'left-panel' | 'right-panel';

export interface SurfaceMaterial {
  id: string;
  label: string;
  pricePerSqm: number;
  color: string;
}

export interface SurfaceConfig {
  materialId: string;
  insulation: boolean;
  insulationThickness: number; // mm
  finish: string;
}

export interface WallConfig extends SurfaceConfig {
  hasDoor: boolean;
  hasWindow: boolean;
  windowCount: number;
}

export interface RoofConfig extends SurfaceConfig {
  hasSkylight: boolean;
}

export interface BuildingConfig {
  dimensions: BuildingDimensions;
  walls: Record<WallId, WallConfig>;
  roofs: Record<RoofId, RoofConfig>;
}

export type SelectedElement =
  | { type: 'wall'; id: WallId }
  | { type: 'roof'; id: RoofId }
  | null;
