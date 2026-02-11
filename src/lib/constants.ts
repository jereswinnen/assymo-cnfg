import type {
  SurfaceMaterial,
  BuildingDimensions,
  WallConfig,
  RoofConfig,
  RoofCovering,
  TrimColor,
  BuildingType,
  WallId,
} from '@/types/building';

// Wall materials with Dutch labels
export const WALL_MATERIALS: SurfaceMaterial[] = [
  { id: 'wood', label: 'Hout', pricePerSqm: 45, color: '#8B6914' },
  { id: 'brick', label: 'Steen', pricePerSqm: 65, color: '#8B4513' },
  { id: 'render', label: 'Stucwerk', pricePerSqm: 55, color: '#F5F5DC' },
  { id: 'metal', label: 'Metaal', pricePerSqm: 70, color: '#708090' },
];

// Roof coverings with 3D colors
export const ROOF_COVERINGS: RoofCovering[] = [
  { id: 'dakpannen', label: 'Dakpannen', pricePerSqm: 55, color: '#8B4513' },
  { id: 'riet', label: 'Riet', pricePerSqm: 85, color: '#C4A84E' },
  { id: 'epdm', label: 'EPDM', pricePerSqm: 35, color: '#2C2C2C' },
  { id: 'polycarbonaat', label: 'Polycarbonaat', pricePerSqm: 40, color: '#D4E8F0' },
  { id: 'metaal', label: 'Staalplaten', pricePerSqm: 50, color: '#708090' },
];

// Trim / edge colors
export const TRIM_COLORS: TrimColor[] = [
  { id: 'antraciet', label: 'Antraciet', hex: '#3C3C3C' },
  { id: 'wit', label: 'Wit', hex: '#F5F5F5' },
  { id: 'zwart', label: 'Zwart', hex: '#1A1A1A' },
  { id: 'bruin', label: 'Bruin', hex: '#5C3317' },
  { id: 'groen', label: 'Groen', hex: '#2E5930' },
];

// Dutch finishes
export const FINISHES = ['Mat', 'Satijn', 'Glans'] as const;

// Default dimensions
export const DEFAULT_DIMENSIONS: BuildingDimensions = {
  width: 8,
  depth: 4,
  height: 3,
  roofPitch: 0,
  bergingWidth: 4,
};

// Default wall config
const DEFAULT_WALL: WallConfig = {
  materialId: 'wood',
  insulation: true,
  insulationThickness: 100,
  finish: 'Mat',
  hasDoor: false,
  hasWindow: false,
  windowCount: 0,
};

// Default roof config (unified)
export const DEFAULT_ROOF: RoofConfig = {
  type: 'flat',
  coveringId: 'epdm',
  trimColorId: 'antraciet',
  insulation: true,
  insulationThickness: 150,
  hasSkylight: false,
};

// Generate default walls for a given building type
export function getDefaultWalls(type: BuildingType): Record<string, WallConfig> {
  switch (type) {
    case 'overkapping':
      // Open carport — no walls
      return {};
    case 'berging':
      // Closed shed — all 4 walls
      return {
        front: { ...DEFAULT_WALL, hasDoor: true, hasWindow: true, windowCount: 2 },
        back: { ...DEFAULT_WALL, hasWindow: true, windowCount: 1 },
        left: { ...DEFAULT_WALL },
        right: { ...DEFAULT_WALL },
      };
    case 'combined':
      // Carport + berging: berging gets 3 outer walls + divider, overkapping is open
      return {
        front: { ...DEFAULT_WALL, hasDoor: true, hasWindow: true, windowCount: 1 },
        back: { ...DEFAULT_WALL, hasWindow: true, windowCount: 1 },
        left: { ...DEFAULT_WALL },
        divider: { ...DEFAULT_WALL },
      };
  }
}

// Available wall IDs for each building type
export function getAvailableWallIds(type: BuildingType): WallId[] {
  switch (type) {
    case 'overkapping':
      return [];
    case 'berging':
      return ['front', 'back', 'left', 'right'];
    case 'combined':
      return ['front', 'back', 'left', 'divider'];
  }
}

// Pricing extras
export const INSULATION_PRICE_PER_SQM_PER_MM = 0.12; // €/m²/mm
export const DOOR_FLAT_FEE = 850;
export const WINDOW_FLAT_FEE = 420;
export const SKYLIGHT_FLAT_FEE = 780;
export const DOOR_AREA_CUTOUT = 2.1 * 0.9; // m²
export const WINDOW_AREA_CUTOUT = 1.2 * 1.0; // m²

// Post pricing for overkapping sections
export const POST_PRICE = 120; // per post
export const POST_SPACING = 3; // meters between posts

export const BRACE_PRICE = 45; // per brace
export const WALL_THICKNESS = 0.15;
