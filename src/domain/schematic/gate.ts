import type { BuildingEntity } from '@/domain/building';

export interface GateFootprint {
  /** Top-left x in world coords. */
  x: number;
  /** Top-left z in world coords. */
  y: number;
  /** Visual width of the gate footprint (along its long axis). */
  width: number;
  /** Visual depth/thickness of the gate footprint (perpendicular to the long axis). */
  depth: number;
  /** True when the gate's long axis is horizontal (X). */
  horizontal: boolean;
}

/** Compute the gate's top-down footprint rectangle in world coords.
 *  The gate's long axis follows orientation: horizontal → axis along X
 *  (width spans X, depth spans Z), vertical → swapped. */
export function getGateFootprint(building: BuildingEntity): GateFootprint {
  const horizontal = building.orientation !== 'vertical';
  const longAxis = building.dimensions.width;
  const thickness = building.dimensions.depth;
  const visualW = horizontal ? longAxis : thickness;
  const visualD = horizontal ? thickness : longAxis;
  return {
    x: building.position[0],
    y: building.position[1],
    width: visualW,
    depth: visualD,
    horizontal,
  };
}

/** Endpoints of the seam tick that visually splits a 2-part gate down
 *  the middle. Returns null for 1-part gates. The tick crosses the
 *  thin axis at the midpoint of the long axis. */
export function getGateSeam(
  building: BuildingEntity,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const partCount = building.gateConfig?.partCount ?? 1;
  if (partCount < 2) return null;
  const fp = getGateFootprint(building);
  if (fp.horizontal) {
    const cx = fp.x + fp.width / 2;
    return { x1: cx, y1: fp.y, x2: cx, y2: fp.y + fp.depth };
  }
  const cy = fp.y + fp.depth / 2;
  return { x1: fp.x, y1: cy, x2: fp.x + fp.width, y2: cy };
}

export interface GateSwingArc {
  /** Pivot point (one end of the gate's long edge facing the swing side). */
  cx: number;
  cy: number;
  /** Arc radius in metres (one leaf width). */
  radius: number;
  /** SVG path for a quarter-circle arc from start to end. */
  path: string;
}

/** Quarter-circle SVG arcs indicating the swing of one (or two) gate
 *  leaves. Returns [] for sliding gates (those use a different indicator).
 *
 *  Convention: 'inward' arcs sweep into the +Y (south) hemisphere for a
 *  horizontal gate, and into the +X (east) hemisphere for a vertical
 *  gate. 'outward' arcs sweep into the opposite hemisphere. The pivot is
 *  always the gate's leftmost / topmost endpoint along its long axis;
 *  for 2-part gates the second leaf pivots on the rightmost / bottommost
 *  endpoint and sweeps the same direction so the two arcs meet at the
 *  centre seam. */
export function getGateSwingArcs(building: BuildingEntity): GateSwingArc[] {
  const dir = building.gateConfig?.swingDirection ?? 'inward';
  if (dir === 'sliding') return [];

  const fp = getGateFootprint(building);
  const partCount = building.gateConfig?.partCount ?? 1;
  const partWidthM = building.dimensions.width / partCount;

  // Outward sign on the perpendicular axis. inward → +1 (south for
  // horizontal, east for vertical); outward → −1. Picking the +Y / +X
  // hemisphere as 'inward' is arbitrary but consistent — the schematic
  // is purely directional information, not a literal "inside vs outside
  // of the building" claim.
  const sign = dir === 'inward' ? 1 : -1;

  const arcs: GateSwingArc[] = [];

  if (fp.horizontal) {
    // Long axis along X. Pivots at the gate's two short edges; arcs
    // sweep into the +Y half-plane (sign=1) or −Y (sign=−1).
    const yPivot = fp.y + (sign > 0 ? 0 : fp.depth);
    const left = { cx: fp.x, cy: yPivot };
    const right = { cx: fp.x + fp.width, cy: yPivot };
    // Leaf swings 90°: from along the gate (x-axis) to perpendicular
    // (y-axis). Path uses SVG arc (rx ry x-axis-rotation large-arc sweep x y).
    // Sweep flag picks the "near" side of the circle (sign-dependent).
    const sweep = sign > 0 ? 1 : 0;
    arcs.push({
      ...left,
      radius: partWidthM,
      path: `M ${left.cx + partWidthM} ${left.cy} A ${partWidthM} ${partWidthM} 0 0 ${sweep} ${left.cx} ${left.cy + sign * partWidthM}`,
    });
    if (partCount === 2) {
      arcs.push({
        ...right,
        radius: partWidthM,
        // Second leaf pivots on the right endpoint, sweeps the
        // opposite rotational direction so both arcs meet at the
        // centre seam.
        path: `M ${right.cx - partWidthM} ${right.cy} A ${partWidthM} ${partWidthM} 0 0 ${1 - sweep} ${right.cx} ${right.cy + sign * partWidthM}`,
      });
    }
  } else {
    // Long axis along Y. Pivots at the gate's two short edges (top + bottom).
    const xPivot = fp.x + (sign > 0 ? 0 : fp.width);
    const top = { cx: xPivot, cy: fp.y };
    const bottom = { cx: xPivot, cy: fp.y + fp.depth };
    const sweep = sign > 0 ? 0 : 1;
    arcs.push({
      ...top,
      radius: partWidthM,
      path: `M ${top.cx} ${top.cy + partWidthM} A ${partWidthM} ${partWidthM} 0 0 ${sweep} ${top.cx + sign * partWidthM} ${top.cy}`,
    });
    if (partCount === 2) {
      arcs.push({
        ...bottom,
        radius: partWidthM,
        path: `M ${bottom.cx} ${bottom.cy - partWidthM} A ${partWidthM} ${partWidthM} 0 0 ${1 - sweep} ${bottom.cx + sign * partWidthM} ${bottom.cy}`,
      });
    }
  }

  return arcs;
}

export interface GateSlideArrow {
  /** Endpoints of the slide-direction arrow (along the gate's long axis). */
  x1: number; y1: number; x2: number; y2: number;
}

/** A double-headed arrow drawn alongside the gate's long axis,
 *  indicating slide direction. Returns null when the gate isn't sliding.
 *  The arrow sits offset from the gate by ~half the thickness on the
 *  +Y / +X side. */
export function getGateSlideArrow(building: BuildingEntity): GateSlideArrow | null {
  const dir = building.gateConfig?.swingDirection ?? 'inward';
  if (dir !== 'sliding') return null;
  const fp = getGateFootprint(building);
  const offset = 0.25;
  if (fp.horizontal) {
    const y = fp.y + fp.depth + offset;
    return { x1: fp.x, y1: y, x2: fp.x + fp.width, y2: y };
  }
  const x = fp.x + fp.width + offset;
  return { x1: x, y1: fp.y, x2: x, y2: fp.y + fp.depth };
}
