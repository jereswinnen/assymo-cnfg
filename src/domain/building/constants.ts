import type {
  BuildingDimensions,
  FloorConfig,
  BuildingType,
  WallId,
} from '@/domain/building';

// Default dimensions
export const DEFAULT_DIMENSIONS: BuildingDimensions = {
  width: 4,
  depth: 4,
  height: 2.6,
};

export const DOUBLE_DOOR_W = 1.6;

/** Default building primary material — applied to walls/poles/fascia
 *  whenever no override is set. */
export const DEFAULT_PRIMARY_MATERIAL = 'wood';

export const DEFAULT_FLOOR: FloorConfig = {
  materialId: 'geen',
};

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
    case 'poort':
      return [];
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
export function autoPoleLayout(width: number, depth: number): import('@/domain/building').PolesConfig {
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

/** Proportions of the envelope thickness allocated to each cladding layer
 *  when a panel (wall or roof) has middenlaag and/or inner cladding set.
 *  Sum must equal 1.0. Outer + inner are the painted skins; middenlaag is
 *  the middle filling. These are fixed for v1; a follow-up may derive the
 *  envelope thickness from the chosen middenlaag's `thicknessMm` instead. */
export const PANEL_LAYER_PROPORTIONS = {
  outerCladding: 0.20,
  middenlaag:    0.60,
  innerCladding: 0.20,
} as const;

/** Back-compat alias — historically named for walls; same numbers. */
export const WALL_LAYER_PROPORTIONS = PANEL_LAYER_PROPORTIONS;

/** Describes one strip / slab of a panel cross-section (wall OR roof).
 *  - `offsetNorm`: signed offset of the strip's CENTRE from the panel midline,
 *    as a fraction of the envelope thickness. Positive = outward (away from
 *    the room: outside for walls, up/over for roofs).
 *  - `thicknessNorm`: strip thickness as a fraction of the envelope thickness.
 *  All renderers (2D plattegrond, 3D walls, 3D roof) drive their per-strip /
 *  per-slab geometry from these two numbers, so the layouts stay in lockstep. */
export interface PanelLayer {
  role: 'whole' | 'outerCladding' | 'middenlaag' | 'innerCladding';
  offsetNorm: number;
  thicknessNorm: number;
}

/** Back-compat alias — historically named for walls; same shape. */
export type WallLayer = PanelLayer;

/** Layer layout for a given (has-middenlaag, has-inner-cladding) combo.
 *
 *  Derivations (the centre of a slab whose thickness is `t` and whose outward
 *  edge is at panel-midline offset `+0.5` sits at `+(0.5 - t/2)`):
 *  - 50/50 split when only inner cladding is set → centres at ±0.25.
 *  - Outer cladding fixed at PANEL_LAYER_PROPORTIONS.outerCladding when
 *    middenlaag is involved → outer centre at +(0.5 - outerCladding/2).
 *  - Middenlaag occupies the remaining inward space.
 *  - When inner cladding is ALSO set, inner takes its declared share and the
 *    middenlaag squeezes to PANEL_LAYER_PROPORTIONS.middenlaag.
 */
export function getPanelLayerLayout(opts: {
  hasMiddenlaag: boolean;
  hasInner: boolean;
}): PanelLayer[] {
  const { outerCladding, middenlaag, innerCladding } = PANEL_LAYER_PROPORTIONS;
  const { hasMiddenlaag, hasInner } = opts;

  if (!hasMiddenlaag && !hasInner) {
    return [{ role: 'whole', offsetNorm: 0, thicknessNorm: 1 }];
  }
  if (!hasMiddenlaag && hasInner) {
    // 50/50 split between outer and inner cladding (independent of the
    // three-way proportions, which only apply when middenlaag participates).
    return [
      { role: 'outerCladding', offsetNorm: +0.25, thicknessNorm: 0.50 },
      { role: 'innerCladding', offsetNorm: -0.25, thicknessNorm: 0.50 },
    ];
  }
  if (hasMiddenlaag && !hasInner) {
    // Outer takes its declared share; middenlaag absorbs the inner share.
    const midThickness = middenlaag + innerCladding;
    return [
      { role: 'outerCladding', offsetNorm: +(0.5 - outerCladding / 2), thicknessNorm: outerCladding },
      { role: 'middenlaag',    offsetNorm: -(0.5 - midThickness / 2),  thicknessNorm: midThickness },
    ];
  }
  // hasMiddenlaag && hasInner
  return [
    { role: 'outerCladding', offsetNorm: +(0.5 - outerCladding / 2),  thicknessNorm: outerCladding },
    { role: 'middenlaag',    offsetNorm: 0,                            thicknessNorm: middenlaag },
    { role: 'innerCladding', offsetNorm: -(0.5 - innerCladding / 2),  thicknessNorm: innerCladding },
  ];
}

/** Back-compat alias — keeps existing wall callsites working. */
export const getWallLayerLayout = getPanelLayerLayout;

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
export const EDGE_CLEARANCE = 0;
export const OPENING_GAP = 0.3;

// Pole dimensions (single post). `POLE_DIMENSIONS` keeps the legacy
// 150 mm shape so domain tests / fallback paths don't need to thread the
// tenant value. `poleDimensions(postSize)` is preferred for runtime
// creation paths that have the tenant's geometry available.
export const POLE_DIMENSIONS: BuildingDimensions = {
  width: POST_SIZE,
  depth: POST_SIZE,
  height: 2.6,
};

export function poleDimensions(postSize: number): BuildingDimensions {
  return { width: postSize, depth: postSize, height: 2.6 };
}

// Standalone wall dimensions. Same backward-compat pattern as POLE_DIMENSIONS.
export const WALL_DIMENSIONS: BuildingDimensions = {
  width: POST_SPACING, // 3m
  depth: POST_SIZE,    // 0.15m
  height: 2.6,
};

export function wallDimensions(postSize: number): BuildingDimensions {
  return { width: POST_SPACING, depth: postSize, height: 2.6 };
}

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

/** Post-driven dimensions (paal width/depth, muur depth, poort depth) span
 *  the tenant geometry's `postSizeMm` range (80–300 mm). Validators accept
 *  any value in this band; the configurator picks the tenant's actual
 *  postSize at entity creation time. The `step: 0` marker on each
 *  post-driven dimension keeps the resize-handle UI non-interactive for
 *  that axis — the value is set by tenant geometry, not by user drag. */
export const POST_DRIVEN_DIMENSION: DimensionConstraint = { min: 0.08, max: 0.30, step: 0 };

export const DIMENSION_CONSTRAINTS: Record<string, DimensionConstraints> = {
  structural: {
    width:  { min: 1,    max: 40,  step: 0.1 },
    depth:  { min: 1,    max: 6,   step: 0.1 },
    height: { min: 2.2,  max: 3,   step: 0.1 },
  },
  muur: {
    width:  { min: 0.5,  max: 10,  step: 0.5 },
    depth:  POST_DRIVEN_DIMENSION,
    height: { min: 2.2,  max: 3,   step: 0.1 },
  },
  paal: {
    width:  POST_DRIVEN_DIMENSION,
    depth:  POST_DRIVEN_DIMENSION,
    height: { min: 2.2,  max: 3,   step: 0.1 },
  },
  poort: {
    width:  { min: 0.1,  max: 6,    step: 0.1 },  // permissive — picket-gate parts up to 6m total span
    depth:  POST_DRIVEN_DIMENSION,                // gates are thin like walls
    height: { min: 0.1,  max: 3.5,  step: 0.1 },  // permissive — picket gates up to industrial 3.5m
  },
};

export function getConstraints(type: BuildingType): DimensionConstraints {
  if (type === 'muur') return DIMENSION_CONSTRAINTS.muur;
  if (type === 'paal') return DIMENSION_CONSTRAINTS.paal;
  if (type === 'poort') return DIMENSION_CONSTRAINTS.poort;
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

// Dakbak (fascia ring) bounds — meters.
export const DEFAULT_FASCIA_HEIGHT = 0.36;
export const MIN_FASCIA_HEIGHT = 0.22;
export const MAX_FASCIA_HEIGHT = 0.60;

export const DEFAULT_FASCIA_OVERHANG = 0;
export const MIN_FASCIA_OVERHANG = 0;
export const MAX_FASCIA_OVERHANG = 0.80;
