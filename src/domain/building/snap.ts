import type { BuildingEntity, SnapConnection, WallSide } from '@/domain/building';
import { autoPoleLayout, POST_SIZE } from './constants';

export const SNAP_THRESHOLD = 0.5;
export const SNAP_ALIGN_THRESHOLD = 0.3;
/** Pole snap is intentionally tighter than general building snap — a pole
 *  is a small element and users expect to place it precisely. */
const POLE_SNAP_THRESHOLD = 0.25;
const POLE_DETENT_THRESHOLD = 0.18;

interface Edge {
  axis: 'x' | 'z';
  value: number;
  perpStart: number;
  perpEnd: number;
  side: WallSide;
}

export function getBuildingEdges(b: BuildingEntity): Edge[] {
  const [lx, tz] = b.position;
  const w = b.dimensions.width;
  const d = b.dimensions.depth;
  return [
    { axis: 'x', value: lx + w, perpStart: tz, perpEnd: tz + d, side: 'right' },
    { axis: 'x', value: lx,     perpStart: tz, perpEnd: tz + d, side: 'left' },
    { axis: 'z', value: tz + d, perpStart: lx, perpEnd: lx + w, side: 'back' },
    { axis: 'z', value: tz,     perpStart: lx, perpEnd: lx + w, side: 'front' },
  ];
}

const OPPOSING: [WallSide, WallSide][] = [
  ['right', 'left'],
  ['left', 'right'],
  ['back', 'front'],
  ['front', 'back'],
];

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export interface SnapResult {
  snappedPosition: [number, number];
  newConnections: SnapConnection[];
}

export function detectSnap(
  dragged: BuildingEntity,
  others: BuildingEntity[],
): SnapResult {
  let bestDist = SNAP_THRESHOLD;
  let snapDx = 0;
  let snapDz = 0;
  const connections: SnapConnection[] = [];

  const dragEdges = getBuildingEdges(dragged);

  for (const other of others) {
    const otherEdges = getBuildingEdges(other);

    for (const [sideA, sideB] of OPPOSING) {
      const edgeA = dragEdges.find(e => e.side === sideA)!;
      const edgeB = otherEdges.find(e => e.side === sideB)!;

      if (edgeA.axis !== edgeB.axis) continue;

      const dist = Math.abs(edgeA.value - edgeB.value);
      if (dist > SNAP_THRESHOLD) continue;

      // Check overlap on perpendicular axis
      if (!rangesOverlap(edgeA.perpStart, edgeA.perpEnd, edgeB.perpStart, edgeB.perpEnd)) continue;

      if (dist < bestDist) {
        bestDist = dist;
        const delta = edgeB.value - edgeA.value;
        if (edgeA.axis === 'x') {
          snapDx = delta;
          snapDz = 0;
        } else {
          snapDx = 0;
          snapDz = delta;
        }

        connections.length = 0;
        connections.push({
          buildingAId: dragged.id,
          sideA,
          buildingBId: other.id,
          sideB,
          isOpen: false,
        });
      }
    }
  }

  // Apply primary snap
  let [nx, nz] = dragged.position;
  if (connections.length > 0) {
    nx += snapDx;
    nz += snapDz;

    // Secondary alignment on perpendicular axis — snap to edges, center, or corners
    const conn = connections[0];
    const primaryEdge = dragEdges.find(e => e.side === conn.sideA)!;

    if (primaryEdge.axis === 'x') {
      // Primary snap was on X axis, try to align Z
      for (const other of others) {
        if (other.id !== conn.buildingBId) continue;
        const otherTop = other.position[1];
        const otherBottom = other.position[1] + other.dimensions.depth;
        const otherCenter = otherTop + other.dimensions.depth / 2;
        const draggedTop = nz;
        const draggedBottom = nz + dragged.dimensions.depth;
        const draggedCenter = nz + dragged.dimensions.depth / 2;

        // Try all alignment targets: top-top, bottom-bottom, top-bottom, bottom-top, center-center
        const candidates = [
          otherTop - draggedTop,           // align tops
          otherBottom - draggedBottom,      // align bottoms
          otherTop - draggedBottom,         // dragged bottom to other top
          otherBottom - draggedTop,         // dragged top to other bottom
          otherCenter - draggedCenter,      // align centers
        ];
        let bestAlign = SNAP_ALIGN_THRESHOLD;
        let bestDz = 0;
        for (const dz of candidates) {
          if (Math.abs(dz) < bestAlign) {
            bestAlign = Math.abs(dz);
            bestDz = dz;
          }
        }
        if (bestDz !== 0) nz += bestDz;
      }
    } else {
      // Primary snap was on Z axis, try to align X
      for (const other of others) {
        if (other.id !== conn.buildingBId) continue;
        const otherLeft = other.position[0];
        const otherRight = other.position[0] + other.dimensions.width;
        const otherCenter = otherLeft + other.dimensions.width / 2;
        const draggedLeft = nx;
        const draggedRight = nx + dragged.dimensions.width;
        const draggedCenter = nx + dragged.dimensions.width / 2;

        const candidates = [
          otherLeft - draggedLeft,          // align lefts
          otherRight - draggedRight,        // align rights
          otherLeft - draggedRight,         // dragged right to other left
          otherRight - draggedLeft,         // dragged left to other right
          otherCenter - draggedCenter,      // align centers
        ];
        let bestAlign = SNAP_ALIGN_THRESHOLD;
        let bestDx = 0;
        for (const dx of candidates) {
          if (Math.abs(dx) < bestAlign) {
            bestAlign = Math.abs(dx);
            bestDx = dx;
          }
        }
        if (bestDx !== 0) nx += bestDx;
      }
    }
  }

  return {
    snappedPosition: [nx, nz],
    newConnections: connections,
  };
}

export interface PoleSnapResult {
  /** Pole center position after snapping. */
  center: [number, number];
  /** Id of the building this pole snapped to, or null if no snap was found. */
  attachedTo: string | null;
}

/** Snap a pole's center to building edges, corners, and midpoints.
 *  Order: edge slide first, then corners/midpoints override as detents.
 *  Returns the snapped center position and the id of the building the pole
 *  attached to (or null if nothing was in snap range). */
export function detectPoleSnap(
  poleCenter: [number, number],
  buildings: BuildingEntity[],
): PoleSnapResult {
  const [px, pz] = poleCenter;
  let bestDist = POLE_SNAP_THRESHOLD;
  let snapX = px;
  let snapZ = pz;
  let attachedTo: string | null = null;

  // Pass 1: edge slide (general snap to nearest point on edge)
  for (const b of buildings) {
    if (b.type === 'paal') continue;

    const [lx, tz] = b.position;
    const w = b.dimensions.width;
    const d = b.dimensions.depth;

    let edges: { fixed: 'x' | 'z'; val: number; min: number; max: number }[];
    if (b.type === 'muur') {
      // Muurs are thin walls — snap the pole to the wall's midline so it
      // sits ON the wall rather than at one of its two parallel edges.
      // For vertical muurs, dimensions.width is the wall length (along Z)
      // and dimensions.depth is the thickness (along X).
      if (b.orientation === 'vertical') {
        edges = [{ fixed: 'x', val: lx + d / 2, min: tz, max: tz + w }];
      } else {
        edges = [{ fixed: 'z', val: tz + d / 2, min: lx, max: lx + w }];
      }
    } else {
      edges = [
        { fixed: 'z', val: tz,     min: lx, max: lx + w },
        { fixed: 'z', val: tz + d, min: lx, max: lx + w },
        { fixed: 'x', val: lx,     min: tz, max: tz + d },
        { fixed: 'x', val: lx + w, min: tz, max: tz + d },
      ];
    }

    for (const e of edges) {
      if (e.fixed === 'z') {
        const distToEdge = Math.abs(pz - e.val);
        const clampedX = Math.max(e.min, Math.min(e.max, px));
        const d = Math.hypot(px - clampedX, pz - e.val);
        if (distToEdge < POLE_SNAP_THRESHOLD && d < bestDist) {
          bestDist = d;
          snapX = clampedX;
          snapZ = e.val;
          attachedTo = b.id;
        }
      } else {
        const distToEdge = Math.abs(px - e.val);
        const clampedZ = Math.max(e.min, Math.min(e.max, pz));
        const d = Math.hypot(px - e.val, pz - clampedZ);
        if (distToEdge < POLE_SNAP_THRESHOLD && d < bestDist) {
          bestDist = d;
          snapX = e.val;
          snapZ = clampedZ;
          attachedTo = b.id;
        }
      }
    }
  }

  // Pass 2: corners and midpoints override as detents.
  // Checked against the edge-snapped position so that once the pole is
  // sliding along an edge, only the along-edge distance to the target matters.
  let detentDist = POLE_DETENT_THRESHOLD;
  for (const b of buildings) {
    if (b.type === 'paal') continue;

    const [lx, tz] = b.position;
    const w = b.dimensions.width;
    const d = b.dimensions.depth;
    const cx = lx + w / 2;
    const cz = tz + d / 2;

    let targets: [number, number][];
    if (b.type === 'muur') {
      // For a muur, meaningful detents are the two midline endpoints.
      if (b.orientation === 'vertical') {
        const midX = lx + d / 2;
        targets = [[midX, tz], [midX, tz + w]];
      } else {
        const midZ = tz + d / 2;
        targets = [[lx, midZ], [lx + w, midZ]];
      }
    } else {
      targets = [
        [lx, tz], [lx + w, tz],
        [lx, tz + d], [lx + w, tz + d],
        [cx, tz], [cx, tz + d],
        [lx, cz], [lx + w, cz],
      ];
    }

    for (const [tx, tz] of targets) {
      const d = Math.hypot(snapX - tx, snapZ - tz);
      if (d < detentDist) {
        detentDist = d;
        snapX = tx;
        snapZ = tz;
        attachedTo = b.id;
      }
    }
  }

  return { center: [snapX, snapZ], attachedTo };
}

export interface WallSnapResult {
  position: [number, number];
  /** Id of the structural building this wall snapped to (edge slide), or null. */
  attachedTo: string | null;
}

/** Snap a standalone wall to building edges, poles, and other wall endpoints.
 *  Pass 1: long-edge slide. The wall's long edge snaps along a structural
 *    building's front, back, OR centerline (likewise left/right/centerline
 *    for vertical walls), so the wall can sit on the perimeter or split
 *    the building down the middle.
 *  Pass 2: endpoint detent. The wall's short ends snap to corners,
 *    intermediate post positions (auto + manual) on the structural
 *    building's perimeter, standalone poles, and other muur endpoints.
 *    This lets a wall placed inside an overkapping land flush with the
 *    existing post grid. */
export function detectWallSnap(
  wallPos: [number, number],
  wallWidth: number,
  orientation: 'horizontal' | 'vertical',
  buildings: BuildingEntity[],
): WallSnapResult {
  const [wx, wz] = wallPos;
  let bestDist = SNAP_THRESHOLD;
  let snapX = wx;
  let snapZ = wz;
  let attachedTo: string | null = null;

  const halfShort = POST_SIZE / 2;

  // Pass 1: edge slide — wall's long edge snaps to a structural building's
  // front/back (horizontal wall) or left/right (vertical) edge, OR the
  // building's centerline so the wall can split it down the middle.
  for (const b of buildings) {
    if (b.type === 'paal' || b.type === 'muur') continue;

    const [lx, tz] = b.position;
    const w = b.dimensions.width;
    const d = b.dimensions.depth;

    if (orientation === 'horizontal') {
      // Wall runs along X — snap Z to top, bottom, or centerline
      const edges = [
        { z: tz,         xMin: lx, xMax: lx + w },  // front
        { z: tz + d,     xMin: lx, xMax: lx + w },  // back
        { z: tz + d / 2, xMin: lx, xMax: lx + w },  // centerline
      ];
      for (const e of edges) {
        const dist = Math.abs((wz + halfShort) - e.z);
        const wallLeft = wx;
        const wallRight = wx + wallWidth;
        if (dist < bestDist && wallRight > e.xMin - SNAP_THRESHOLD && wallLeft < e.xMax + SNAP_THRESHOLD) {
          bestDist = dist;
          snapZ = e.z - halfShort;
          snapX = wx;
          attachedTo = b.id;
        }
      }
    } else {
      // Wall runs along Z — snap X to left, right, or centerline
      const edges = [
        { x: lx,         zMin: tz, zMax: tz + d },  // left
        { x: lx + w,     zMin: tz, zMax: tz + d },  // right
        { x: lx + w / 2, zMin: tz, zMax: tz + d },  // centerline
      ];
      for (const e of edges) {
        const dist = Math.abs((wx + halfShort) - e.x);
        const wallTop = wz;
        const wallBottom = wz + wallWidth;
        if (dist < bestDist && wallBottom > e.zMin - SNAP_THRESHOLD && wallTop < e.zMax + SNAP_THRESHOLD) {
          bestDist = dist;
          snapX = e.x - halfShort;
          snapZ = wz;
          attachedTo = b.id;
        }
      }
    }
  }

  // Pass 2: endpoint detent — wall endpoints snap to corners, intermediate
  // posts on structural buildings (auto-placed grid + manual overrides via
  // building.poles), standalone poles, and other muur endpoints.
  // wallEndpoints are the visual line endpoints (center of wall thickness)
  const wallEndpoints: [number, number][] = orientation === 'horizontal'
    ? [[snapX, snapZ + halfShort], [snapX + wallWidth, snapZ + halfShort]]
    : [[snapX + halfShort, snapZ], [snapX + halfShort, snapZ + wallWidth]];

  let detentDist = POLE_DETENT_THRESHOLD;
  let detentDx = 0;
  let detentDz = 0;
  let detentFound = false;

  const targets: [number, number][] = [];

  for (const b of buildings) {
    if (b.type === 'paal') {
      targets.push([b.position[0] + b.dimensions.width / 2, b.position[1] + b.dimensions.depth / 2]);
      continue;
    }
    if (b.type === 'muur') {
      if (b.orientation === 'horizontal') {
        const cy = b.position[1] + b.dimensions.depth / 2;
        targets.push([b.position[0], cy]);
        targets.push([b.position[0] + b.dimensions.width, cy]);
      } else {
        const cx = b.position[0] + b.dimensions.depth / 2;
        targets.push([cx, b.position[1]]);
        targets.push([cx, b.position[1] + b.dimensions.width]);
      }
      continue;
    }
    // Structural building: corners + edge midpoints + every intermediate
    // post position (manual `poles` config or auto layout fallback).
    const [lx, tz] = b.position;
    const w = b.dimensions.width;
    const d = b.dimensions.depth;
    const cx = lx + w / 2;
    const cz = tz + d / 2;
    targets.push(
      [lx, tz], [lx + w, tz],
      [lx, tz + d], [lx + w, tz + d],
      [cx, tz], [cx, tz + d],
      [lx, cz], [lx + w, cz],
    );
    const poles = b.poles ?? autoPoleLayout(w, d);
    for (const f of poles.front) targets.push([lx + f * w, tz]);
    for (const f of poles.back)  targets.push([lx + f * w, tz + d]);
    for (const f of poles.left)  targets.push([lx,         tz + f * d]);
    for (const f of poles.right) targets.push([lx + w,     tz + f * d]);
  }

  for (const ep of wallEndpoints) {
    for (const [tx, tz] of targets) {
      const d = Math.hypot(ep[0] - tx, ep[1] - tz);
      if (d < detentDist) {
        detentDist = d;
        detentDx = tx - ep[0];
        detentDz = tz - ep[1];
        detentFound = true;
      }
    }
  }

  if (detentFound) {
    snapX += detentDx;
    snapZ += detentDz;
  }

  return { position: [snapX, snapZ], attachedTo };
}

/** Snap a single dragged edge to opposing edges of other buildings */
export function detectResizeSnap(
  edgeValue: number,
  edgeAxis: 'x' | 'z',
  edgeSide: WallSide,
  perpStart: number,
  perpEnd: number,
  otherBuildings: BuildingEntity[],
): number {
  let bestDist = SNAP_THRESHOLD;
  let snapped = edgeValue;

  for (const other of otherBuildings) {
    const otherEdges = getBuildingEdges(other);

    for (const oe of otherEdges) {
      if (oe.axis !== edgeAxis) continue;

      const dist = Math.abs(edgeValue - oe.value);
      if (dist >= bestDist) continue;

      // For opposing edges, require perpendicular overlap (abutting)
      // For same-axis edges (corners), just check proximity
      const isOpposing =
        (edgeSide === 'left' && oe.side === 'right') ||
        (edgeSide === 'right' && oe.side === 'left') ||
        (edgeSide === 'front' && oe.side === 'back') ||
        (edgeSide === 'back' && oe.side === 'front');

      if (isOpposing && !rangesOverlap(perpStart, perpEnd, oe.perpStart, oe.perpEnd)) continue;

      bestDist = dist;
      snapped = oe.value;
    }

    // Also snap to center of other building on this axis
    const centerVal = edgeAxis === 'x'
      ? other.position[0] + other.dimensions.width / 2
      : other.position[1] + other.dimensions.depth / 2;
    const centerDist = Math.abs(edgeValue - centerVal);
    if (centerDist < bestDist) {
      bestDist = centerDist;
      snapped = centerVal;
    }
  }

  return snapped;
}
