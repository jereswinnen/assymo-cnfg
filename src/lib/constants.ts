import type {
  BuildingDimensions,
  WallConfig,
  RoofConfig,
  FloorConfig,
  BuildingType,
  WallId,
} from '@/types/building';

// Default dimensions
export const DEFAULT_DIMENSIONS: BuildingDimensions = {
  width: 4,
  depth: 4,
  height: 2.6,
};

export const DOUBLE_DOOR_W = 1.6;

// Default wall config — materialId/doorMaterialId omitted so new walls
// inherit from the building's primaryMaterialId.
export const DEFAULT_WALL: WallConfig = {
  hasDoor: false,
  doorSize: 'enkel',
  doorHasWindow: false,
  doorPosition: 0.5,
  doorSwing: 'naar_buiten',
  doorMirror: false,
  windows: [],
};

/** Default building primary material — applied to walls/poles/fascia
 *  whenever no override is set. */
export const DEFAULT_PRIMARY_MATERIAL = 'wood';

// Default roof config
export const DEFAULT_ROOF: RoofConfig = {
  type: 'flat',
  pitch: 0,
  coveringId: 'epdm',
  trimMaterialId: 'wood',
  insulation: true,
  insulationThickness: 150,
  hasSkylight: false,
};

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

// Cutout areas used to subtract openings from wall surface
export const DOOR_AREA_CUTOUT = 2.1 * 0.9;
export const WINDOW_AREA_CUTOUT = 1.2 * 1.0;

// Structural post spacing for overkapping — drives both auto pole layout
// and postCount() in the quote calculation. Geometric, not priced.
export const POST_SPACING = 3;

/** Automatic pole layout for an overkapping — mirrors what TimberFrame used to
 *  compute inline. Returns per-side fractions (0–1 along the edge) of the
 *  intermediate posts, corners excluded. */
export function autoPoleLayout(width: number, depth: number): import('@/types/building').PolesConfig {
  const postsW = Math.max(2, Math.floor(width / POST_SPACING) + 1);
  const postsD = Math.max(2, Math.floor(depth / POST_SPACING) + 1);
  const widthFractions: number[] = [];
  for (let i = 1; i < postsW - 1; i++) widthFractions.push(i / (postsW - 1));
  const depthFractions: number[] = [];
  for (let i = 1; i < postsD - 1; i++) depthFractions.push(i / (postsD - 1));
  return {
    front: [...widthFractions],
    back: [...widthFractions],
    left: [...depthFractions],
    right: [...depthFractions],
  };
}

export const WALL_THICKNESS = 0.15;

// Timber frame geometry
export const POST_SIZE = 0.15;
export const BEAM_H = 0.20;
export const DECK_T = 0.04;

// Door / window dimensions
export const DOOR_W = 0.9;
export const WIN_W = 1.2;

export const WIN_W_DEFAULT = 1.2;
export const WIN_H_DEFAULT = 1.0;
export const WIN_SILL_DEFAULT = 1.2;
export const WIN_MIN_SIZE = 0.3;
export const SNAP_INCREMENT = 0.1;

export interface WindowPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const WINDOW_PRESETS: WindowPreset[] = [
  { id: 'standard', label: '120 × 100', width: 1.2, height: 1.0 },
  { id: 'small', label: '80 × 80', width: 0.8, height: 0.8 },
  { id: 'large', label: '150 × 120', width: 1.5, height: 1.2 },
];

// Clearance constants
export const EDGE_CLEARANCE = 0.5;
export const OPENING_GAP = 0.3;

// Pole dimensions (single post)
export const POLE_DIMENSIONS: BuildingDimensions = {
  width: POST_SIZE,
  depth: POST_SIZE,
  height: 2.6,
};

// Standalone wall dimensions
export const WALL_DIMENSIONS: BuildingDimensions = {
  width: POST_SPACING, // 3m
  depth: POST_SIZE,    // 0.15m
  height: 2.6,
};

// ─── Dimension constraints per building type ────────────────────────
export interface DimensionConstraint {
  min: number;
  max: number;
  step: number;
}

export interface DimensionConstraints {
  width: DimensionConstraint;
  depth: DimensionConstraint;
  height: DimensionConstraint;
}

export const DIMENSION_CONSTRAINTS: Record<string, DimensionConstraints> = {
  structural: {
    width:  { min: 1,    max: 40,  step: 0.1 },
    depth:  { min: 1,    max: 6,   step: 0.1 },
    height: { min: 2.2,  max: 3,   step: 0.1 },
  },
  muur: {
    width:  { min: 0.5,  max: 10,  step: 0.5 },
    depth:  { min: 0.15, max: 0.15, step: 0 },
    height: { min: 2.2,  max: 3,   step: 0.1 },
  },
  paal: {
    width:  { min: 0.15, max: 0.15, step: 0 },
    depth:  { min: 0.15, max: 0.15, step: 0 },
    height: { min: 2.2,  max: 3,   step: 0.1 },
  },
};

export function getConstraints(type: BuildingType): DimensionConstraints {
  if (type === 'muur') return DIMENSION_CONSTRAINTS.muur;
  if (type === 'paal') return DIMENSION_CONSTRAINTS.paal;
  return DIMENSION_CONSTRAINTS.structural;
}

// ─── Width categories (future-ready) ────────────────────────────────
export interface WidthCategory {
  id: number;
  label: string;
  maxWidth: number;
}

export const WIDTH_CATEGORIES: WidthCategory[] = [
  { id: 1, label: 'Categorie 1', maxWidth: 4 },
  { id: 2, label: 'Categorie 2', maxWidth: 6 },
];

export function getWidthCategory(width: number): WidthCategory | null {
  return WIDTH_CATEGORIES.find(c => width <= c.maxWidth) ?? null;
}

// Snap thresholds
export const SNAP_THRESHOLD = 0.5;
export const SNAP_ALIGN_THRESHOLD = 0.3;

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

/** Convert a 0–1 fraction to meters from wall center */
export function fractionToX(wallLength: number, fraction: number): number {
  const usableStart = -wallLength / 2 + EDGE_CLEARANCE;
  const usableEnd = wallLength / 2 - EDGE_CLEARANCE;
  return usableStart + fraction * (usableEnd - usableStart);
}

/** Convert meters from wall center to 0–1 fraction */
export function xToFraction(wallLength: number, x: number): number {
  const usableStart = -wallLength / 2 + EDGE_CLEARANCE;
  const usableEnd = wallLength / 2 - EDGE_CLEARANCE;
  const usableLen = usableEnd - usableStart;
  if (usableLen <= 0) return 0.5;
  return Math.max(0, Math.min(1, (x - usableStart) / usableLen));
}

/** Resolve fractional positions to meters from wall center */
export function resolveOpeningPositions(
  wallLength: number,
  doorPosition: number | null,
  windows: { position: number }[],
): { doorX: number | null; windowXs: number[] } {
  const doorX = doorPosition !== null
    ? fractionToX(wallLength, doorPosition)
    : null;
  const windowXs = windows.map(w => fractionToX(wallLength, w.position));
  return { doorX, windowXs };
}

/** Clamp an opening position to avoid edges and other openings */
export function clampOpeningPosition(
  wallLength: number,
  openingWidth: number,
  proposedFraction: number,
  otherOpenings: { position: number; width: number }[],
): number {
  const usableLen = wallLength - 2 * EDGE_CLEARANCE;
  if (usableLen <= 0) return 0.5;

  const halfW = openingWidth / 2;
  const minFrac = halfW / usableLen;
  const maxFrac = 1 - halfW / usableLen;
  let frac = Math.max(minFrac, Math.min(maxFrac, proposedFraction));

  // Push away from other openings (iterate until stable)
  const others = otherOpenings
    .map(o => ({ frac: o.position, halfW: o.width / 2 }))
    .sort((a, b) => a.frac - b.frac);

  for (let iter = 0; iter < 10; iter++) {
    let moved = false;
    for (const o of others) {
      const minGapFrac = (halfW + o.halfW + OPENING_GAP) / usableLen;
      const dist = frac - o.frac;
      if (Math.abs(dist) < minGapFrac) {
        const newFrac = dist >= 0 ? o.frac + minGapFrac : o.frac - minGapFrac;
        if (newFrac !== frac) {
          frac = newFrac;
          moved = true;
        }
      }
    }
    frac = Math.max(minFrac, Math.min(maxFrac, frac));
    if (!moved) break;
  }

  return frac;
}

/** Find the best position for a new opening (largest gap) */
export function findBestNewPosition(
  wallLength: number,
  openingWidth: number,
  existingOpenings: { position: number; width: number }[],
): number {
  const usableLen = wallLength - 2 * EDGE_CLEARANCE;
  if (usableLen <= 0) return 0.5;

  const halfW = openingWidth / 2;
  const minFrac = halfW / usableLen;
  const maxFrac = 1 - halfW / usableLen;

  if (existingOpenings.length === 0) return 0.5;

  const zones = existingOpenings
    .map(o => ({
      start: o.position - (o.width / 2 + OPENING_GAP) / usableLen,
      end: o.position + (o.width / 2 + OPENING_GAP) / usableLen,
    }))
    .sort((a, b) => a.start - b.start);

  let bestCenter = 0.5;
  let bestGap = 0;

  const gapBefore = zones[0].start - minFrac;
  if (gapBefore > bestGap) {
    bestGap = gapBefore;
    bestCenter = minFrac + gapBefore / 2;
  }

  for (let i = 0; i < zones.length - 1; i++) {
    const gap = zones[i + 1].start - zones[i].end;
    if (gap > bestGap) {
      bestGap = gap;
      bestCenter = zones[i].end + gap / 2;
    }
  }

  const gapAfter = maxFrac - zones[zones.length - 1].end;
  if (gapAfter > bestGap) {
    bestGap = gapAfter;
    bestCenter = zones[zones.length - 1].end + gapAfter / 2;
  }

  return Math.max(minFrac, Math.min(maxFrac, bestCenter));
}
