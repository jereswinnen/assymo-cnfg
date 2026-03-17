import type {
  SurfaceMaterial,
  BuildingDimensions,
  WallConfig,
  RoofConfig,
  FloorConfig,
  FloorMaterialId,
  RoofCovering,
  TrimColor,
  BuildingType,
  WallId,
  DoorSize,
  DoorPosition,
  DoorMaterialId,
} from '@/types/building';

// Wall materials with Dutch labels
export const WALL_MATERIALS: SurfaceMaterial[] = [
  { id: 'wood', label: 'Hout', pricePerSqm: 45, color: '#8B6914' },
  { id: 'brick', label: 'Steen', pricePerSqm: 65, color: '#8B4513' },
  { id: 'render', label: 'Stucwerk', pricePerSqm: 55, color: '#F5F5DC' },
  { id: 'metal', label: 'Metaal', pricePerSqm: 70, color: '#708090' },
  { id: 'glass', label: 'Glas', pricePerSqm: 120, color: '#B8D4E3' },
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
  width: 4,
  depth: 4,
  height: 3,
};

// Door materials
export interface DoorMaterial {
  id: DoorMaterialId;
  label: string;
  surcharge: number;
}

export const DOOR_MATERIALS: DoorMaterial[] = [
  { id: 'wood', label: 'Hout', surcharge: 0 },
  { id: 'aluminium', label: 'Aluminium', surcharge: 150 },
  { id: 'pvc', label: 'PVC', surcharge: 0 },
  { id: 'staal', label: 'Staal', surcharge: 250 },
];

// Door base prices by size + window surcharge
export const DOOR_BASE_PRICE: Record<DoorSize, number> = {
  enkel: 850,
  dubbel: 1350,
};
export const DOOR_WINDOW_SURCHARGE = 200;

export const DOUBLE_DOOR_W = 1.6;

// Default wall config
export const DEFAULT_WALL: WallConfig = {
  materialId: 'wood',
  finish: 'Mat',
  hasDoor: false,
  doorMaterialId: 'wood',
  doorSize: 'enkel',
  doorHasWindow: false,
  doorPosition: 'midden',
  doorSwing: 'dicht',
  hasWindow: false,
  windowCount: 0,
};

// Default roof config
export const DEFAULT_ROOF: RoofConfig = {
  type: 'flat',
  pitch: 0,
  coveringId: 'epdm',
  trimColorId: 'antraciet',
  insulation: true,
  insulationThickness: 150,
  hasSkylight: false,
};

// Floor materials
export interface FloorMaterial {
  id: FloorMaterialId;
  label: string;
  pricePerSqm: number;
  color: string;
}

export const FLOOR_MATERIALS: FloorMaterial[] = [
  { id: 'geen', label: 'Geen', pricePerSqm: 0, color: 'transparent' },
  { id: 'tegels', label: 'Tegels', pricePerSqm: 35, color: '#B0A090' },
  { id: 'beton', label: 'Beton', pricePerSqm: 25, color: '#A0A0A0' },
  { id: 'hout', label: 'Hout (vlonders)', pricePerSqm: 55, color: '#C4A672' },
];

export const DEFAULT_FLOOR: FloorConfig = {
  materialId: 'geen',
};

// Generate default walls for a given building type
export function getDefaultWalls(type: BuildingType): Record<string, WallConfig> {
  switch (type) {
    case 'overkapping':
      return {};
    case 'berging':
      return {
        front: { ...DEFAULT_WALL },
        back: { ...DEFAULT_WALL },
        left: { ...DEFAULT_WALL },
        right: { ...DEFAULT_WALL },
      };
    case 'paal':
      return {};
    case 'muur':
      return {
        front: { ...DEFAULT_WALL },
      };
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

// Available wall IDs for each building type
export function getAvailableWallIds(type: BuildingType): WallId[] {
  switch (type) {
    case 'overkapping':
      return [];
    case 'berging':
      return ['front', 'back', 'left', 'right'];
    case 'paal':
      return [];
    case 'muur':
      return ['front'];
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

// Pricing extras
export const INSULATION_PRICE_PER_SQM_PER_MM = 0.12;
export const DOOR_FLAT_FEE = 850;
export const WINDOW_FLAT_FEE = 420;
export const SKYLIGHT_FLAT_FEE = 780;
export const DOOR_AREA_CUTOUT = 2.1 * 0.9;
export const WINDOW_AREA_CUTOUT = 1.2 * 1.0;

// Post pricing for overkapping sections
export const POST_PRICE = 120;
export const POST_SPACING = 3;

export const BRACE_PRICE = 45;
export const WALL_THICKNESS = 0.15;

// Timber frame geometry
export const POST_SIZE = 0.15;
export const BEAM_H = 0.20;
export const DECK_T = 0.04;

// Door / window dimensions
export const DOOR_W = 0.9;
export const WIN_W = 1.2;

// Pole dimensions (single post)
export const POLE_DIMENSIONS: BuildingDimensions = {
  width: POST_SIZE,
  depth: POST_SIZE,
  height: 3,
};

// Standalone wall dimensions
export const WALL_DIMENSIONS: BuildingDimensions = {
  width: POST_SPACING, // 3m
  depth: POST_SIZE,    // 0.15m
  height: 3,
};

// Snap thresholds
export const SNAP_THRESHOLD = 0.5;
export const SNAP_ALIGN_THRESHOLD = 0.3;

function doorWidth(doorSize: DoorSize): number {
  return doorSize === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W;
}

export function computeDoorX(wallLength: number, doorPosition: DoorPosition, doorSize: DoorSize): number {
  const margin = 0.5;
  const dw = doorWidth(doorSize);
  const usableHalf = wallLength / 2 - margin - dw / 2;
  switch (doorPosition) {
    case 'links':
      return -usableHalf;
    case 'rechts':
      return usableHalf;
    case 'midden':
    default:
      return 0;
  }
}

export function computeOpeningPositions(
  wallLength: number,
  hasDoor: boolean,
  doorPosition: DoorPosition,
  doorSize: DoorSize,
  windowCount: number,
): { doorX: number; windowXs: number[] } {
  const margin = 0.5;
  let doorX = 0;
  const windowXs: number[] = [];
  const dw = doorWidth(doorSize);

  if (hasDoor) {
    doorX = computeDoorX(wallLength, doorPosition, doorSize);
  }

  if (hasDoor && windowCount > 0) {
    const doorLeft = doorX - dw / 2 - 0.3;
    const doorRight = doorX + dw / 2 + 0.3;
    const wallLeft = -wallLength / 2 + margin;
    const wallRight = wallLength / 2 - margin;

    const spans: [number, number][] = [];
    if (doorLeft - wallLeft > WIN_W) spans.push([wallLeft, doorLeft]);
    if (wallRight - doorRight > WIN_W) spans.push([doorRight, wallRight]);

    const totalSpan = spans.reduce((s, [a, b]) => s + (b - a), 0);
    let placed = 0;
    for (const [start, end] of spans) {
      const spanLen = end - start;
      const count = Math.round((spanLen / totalSpan) * windowCount) || 0;
      const toPlace = Math.min(count, windowCount - placed);
      if (toPlace > 0) {
        const step = spanLen / toPlace;
        for (let i = 0; i < toPlace; i++) {
          windowXs.push(start + step * (i + 0.5));
        }
        placed += toPlace;
      }
    }
    while (placed < windowCount && spans.length > 0) {
      const [start, end] = spans[spans.length - 1];
      const step = (end - start) / (windowCount - placed + 1);
      windowXs.push(start + step);
      placed++;
    }
  } else if (windowCount > 0) {
    const usable = wallLength - 2 * margin;
    const step = usable / windowCount;
    for (let i = 0; i < windowCount; i++) {
      windowXs.push(-wallLength / 2 + margin + step * (i + 0.5));
    }
  }

  return { doorX, windowXs };
}

/** Get the length of a wall based on its ID and dimensions */
export function getWallLength(wallId: WallId, dimensions: BuildingDimensions): number {
  const { width, depth } = dimensions;
  switch (wallId) {
    case 'front':
    case 'back':
      return width;
    case 'left':
    case 'right':
      return depth;
    default: {
      const _exhaustive: never = wallId;
      return _exhaustive;
    }
  }
}
