import type {
  SurfaceMaterial,
  BuildingDimensions,
  WallConfig,
  RoofConfig,
} from '@/types/building';

export const MATERIALS: SurfaceMaterial[] = [
  { id: 'wood', label: 'Wood Cladding', pricePerSqm: 45, color: '#8B6914' },
  { id: 'brick', label: 'Brick', pricePerSqm: 65, color: '#8B4513' },
  { id: 'render', label: 'Render / Plaster', pricePerSqm: 55, color: '#F5F5DC' },
  { id: 'metal', label: 'Metal Panels', pricePerSqm: 70, color: '#708090' },
];

export const FINISHES = ['Matte', 'Satin', 'Gloss'] as const;

export const DEFAULT_DIMENSIONS: BuildingDimensions = {
  width: 6,
  depth: 8,
  height: 3,
  roofPitch: 25,
};

const DEFAULT_WALL: WallConfig = {
  materialId: 'brick',
  insulation: true,
  insulationThickness: 100,
  finish: 'Matte',
  hasDoor: false,
  hasWindow: false,
  windowCount: 0,
};

const DEFAULT_ROOF: RoofConfig = {
  materialId: 'metal',
  insulation: true,
  insulationThickness: 150,
  finish: 'Matte',
  hasSkylight: false,
};

export const DEFAULT_WALLS: Record<string, WallConfig> = {
  front: { ...DEFAULT_WALL, hasDoor: true, hasWindow: true, windowCount: 2 },
  back: { ...DEFAULT_WALL, hasWindow: true, windowCount: 1 },
  left: { ...DEFAULT_WALL },
  right: { ...DEFAULT_WALL },
};

export const DEFAULT_ROOFS: Record<string, RoofConfig> = {
  'left-panel': { ...DEFAULT_ROOF },
  'right-panel': { ...DEFAULT_ROOF },
};

// Pricing extras
export const INSULATION_PRICE_PER_SQM_PER_MM = 0.12; // €/m²/mm
export const DOOR_FLAT_FEE = 850;
export const WINDOW_FLAT_FEE = 420;
export const SKYLIGHT_FLAT_FEE = 780;
export const DOOR_AREA_CUTOUT = 2.1 * 0.9; // m²
export const WINDOW_AREA_CUTOUT = 1.2 * 1.0; // m²

export const WALL_THICKNESS = 0.15;
