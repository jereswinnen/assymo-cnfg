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
  const poleHalf = POST_SIZE / 2;

  // Pass 1: face slide. Each building face / muur long-side emits three
  // perp candidates — paal outside, paal straddle (same extent as the
  // structural posts / wall), paal inside — so the user can park the paal
  // ON the structural line or next to it.
  for (const b of buildings) {
    if (b.type === 'paal') continue;

    const [lx, tz] = b.position;
    const w = b.dimensions.width;
    const d = b.dimensions.depth;

    let edges: { fixed: 'x' | 'z'; val: number; min: number; max: number }[];
    if (b.type === 'muur' || b.type === 'poort') {
      if (b.orientation === 'vertical') {
        const midX = lx + d / 2;
        edges = [
          { fixed: 'x', val: lx - poleHalf,     min: tz, max: tz + w }, // paal west of wall
          { fixed: 'x', val: midX,              min: tz, max: tz + w }, // paal on wall midline
          { fixed: 'x', val: lx + d + poleHalf, min: tz, max: tz + w }, // paal east of wall
        ];
      } else {
        const midZ = tz + d / 2;
        edges = [
          { fixed: 'z', val: tz - poleHalf,     min: lx, max: lx + w }, // paal above wall
          { fixed: 'z', val: midZ,              min: lx, max: lx + w }, // paal on wall midline
          { fixed: 'z', val: tz + d + poleHalf, min: lx, max: lx + w }, // paal below wall
        ];
      }
    } else {
      // Building face — three candidates per face: outside, straddle
      // (paal centre on the edge line, same extent as the corner posts),
      // inside.
      edges = [
        { fixed: 'z', val: tz - poleHalf,         min: lx, max: lx + w }, // front, outside
        { fixed: 'z', val: tz,                    min: lx, max: lx + w }, // front, straddle
        { fixed: 'z', val: tz + poleHalf,         min: lx, max: lx + w }, // front, inside
        { fixed: 'z', val: tz + d - poleHalf,     min: lx, max: lx + w }, // back, inside
        { fixed: 'z', val: tz + d,                min: lx, max: lx + w }, // back, straddle
        { fixed: 'z', val: tz + d + poleHalf,     min: lx, max: lx + w }, // back, outside
        { fixed: 'x', val: lx - poleHalf,         min: tz, max: tz + d }, // left, outside
        { fixed: 'x', val: lx,                    min: tz, max: tz + d }, // left, straddle
        { fixed: 'x', val: lx + poleHalf,         min: tz, max: tz + d }, // left, inside
        { fixed: 'x', val: lx + w - poleHalf,     min: tz, max: tz + d }, // right, inside
        { fixed: 'x', val: lx + w,                min: tz, max: tz + d }, // right, straddle
        { fixed: 'x', val: lx + w + poleHalf,     min: tz, max: tz + d }, // right, outside
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

  // Pass 2: anchor detent. Paal snaps face-flush against corner posts,
  // intermediate posts, edge midpoints, muur ends, and other standalone
  // palen. Each anchor emits its face-flush positions; the three perp
  // candidates align with Pass 1 (outside/straddle/inside) so the
  // detent only shifts along the anchor's edge axis.
  // Important: distances are measured from the Pass-1 position (baseX/baseZ),
  // not the running snap, so picking the BEST target rather than chaining
  // detents from the just-moved one.
  const baseX = snapX;
  const baseZ = snapZ;
  let detentDist = POLE_DETENT_THRESHOLD;
  const tryTarget = (id: string, tx: number, tz: number) => {
    const dd = Math.hypot(baseX - tx, baseZ - tz);
    if (dd < detentDist) {
      detentDist = dd;
      snapX = tx;
      snapZ = tz;
      attachedTo = id;
    }
  };

  for (const b of buildings) {
    const [lx, tz] = b.position;
    const w = b.dimensions.width;
    const d = b.dimensions.depth;

    if (b.type === 'paal') {
      // Paal-to-paal: 4 side flushes (N/S/E/W) + 4 corner-of-corner flushes.
      const halfW = w / 2;
      const halfD = d / 2;
      const pcx = lx + halfW;
      const pcz = tz + halfD;
      const left  = pcx - halfW - poleHalf;
      const right = pcx + halfW + poleHalf;
      const above = pcz - halfD - poleHalf;
      const below = pcz + halfD + poleHalf;
      tryTarget(b.id, pcx,  above);
      tryTarget(b.id, pcx,  below);
      tryTarget(b.id, left, pcz);
      tryTarget(b.id, right, pcz);
      tryTarget(b.id, left, above);  tryTarget(b.id, right, above);
      tryTarget(b.id, left, below);  tryTarget(b.id, right, below);
      continue;
    }
    if (b.type === 'muur' || b.type === 'poort') {
      // Paal continues the wall line — flush against the end face, sharing
      // the wall's midline on the perpendicular axis.
      if (b.orientation === 'vertical') {
        const midX = lx + d / 2;
        tryTarget(b.id, midX, tz - poleHalf);
        tryTarget(b.id, midX, tz + w + poleHalf);
      } else {
        const midZ = tz + d / 2;
        tryTarget(b.id, lx - poleHalf,     midZ);
        tryTarget(b.id, lx + w + poleHalf, midZ);
      }
      continue;
    }
    // Structural building.
    const cx = lx + w / 2;
    const cz = tz + d / 2;
    const frontPerps = [tz - poleHalf, tz, tz + poleHalf];
    const backPerps  = [tz + d - poleHalf, tz + d, tz + d + poleHalf];
    const leftPerps  = [lx - poleHalf, lx, lx + poleHalf];
    const rightPerps = [lx + w - poleHalf, lx + w, lx + w + poleHalf];
    // Corner posts. Each corner emits paal-east / paal-west positions on
    // the parallel edge (front or back), and paal-north / paal-south
    // positions on the perpendicular edge (left or right). The three perp
    // values per anchor cover the outside/straddle/inside levels.
    for (const z of frontPerps) {
      tryTarget(b.id, lx - POST_SIZE,     z);
      tryTarget(b.id, lx + POST_SIZE,     z);
      tryTarget(b.id, lx + w - POST_SIZE, z);
      tryTarget(b.id, lx + w + POST_SIZE, z);
    }
    for (const z of backPerps) {
      tryTarget(b.id, lx - POST_SIZE,     z);
      tryTarget(b.id, lx + POST_SIZE,     z);
      tryTarget(b.id, lx + w - POST_SIZE, z);
      tryTarget(b.id, lx + w + POST_SIZE, z);
    }
    for (const x of leftPerps) {
      tryTarget(b.id, x, tz - POST_SIZE);
      tryTarget(b.id, x, tz + POST_SIZE);
      tryTarget(b.id, x, tz + d - POST_SIZE);
      tryTarget(b.id, x, tz + d + POST_SIZE);
    }
    for (const x of rightPerps) {
      tryTarget(b.id, x, tz - POST_SIZE);
      tryTarget(b.id, x, tz + POST_SIZE);
      tryTarget(b.id, x, tz + d - POST_SIZE);
      tryTarget(b.id, x, tz + d + POST_SIZE);
    }
    // Edge midpoints — paal centred on the midpoint along the edge, with
    // the three perp flush positions.
    for (const z of frontPerps) tryTarget(b.id, cx, z);
    for (const z of backPerps)  tryTarget(b.id, cx, z);
    for (const x of leftPerps)  tryTarget(b.id, x, cz);
    for (const x of rightPerps) tryTarget(b.id, x, cz);
    // Intermediate posts.
    const poles = b.poles ?? autoPoleLayout(w, d);
    for (const f of poles.front) {
      const px2 = lx + f * w;
      for (const z of frontPerps) {
        tryTarget(b.id, px2 - POST_SIZE, z);
        tryTarget(b.id, px2 + POST_SIZE, z);
      }
    }
    for (const f of poles.back) {
      const px2 = lx + f * w;
      for (const z of backPerps) {
        tryTarget(b.id, px2 - POST_SIZE, z);
        tryTarget(b.id, px2 + POST_SIZE, z);
      }
    }
    for (const f of poles.left) {
      const pz2 = tz + f * d;
      for (const x of leftPerps) {
        tryTarget(b.id, x, pz2 - POST_SIZE);
        tryTarget(b.id, x, pz2 + POST_SIZE);
      }
    }
    for (const f of poles.right) {
      const pz2 = tz + f * d;
      for (const x of rightPerps) {
        tryTarget(b.id, x, pz2 - POST_SIZE);
        tryTarget(b.id, x, pz2 + POST_SIZE);
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
    if (b.type === 'paal' || b.type === 'muur' || b.type === 'poort') continue;

    const [lx, tz] = b.position;
    const w = b.dimensions.width;
    const d = b.dimensions.depth;

    // Three perpendicular candidates per face — wall outside, wall straddle
    // (midline on the edge, same extent as the structural posts), wall
    // inside — plus the centerline split detent. Straddle is the most
    // common "wall on the building line" pose; outside/inside cover the
    // "wall adjacent to but not sharing the structure" cases.
    if (orientation === 'horizontal') {
      const candidates = [
        { snapZ: tz - 2 * halfShort,         xMin: lx, xMax: lx + w }, // front, wall outside
        { snapZ: tz - halfShort,             xMin: lx, xMax: lx + w }, // front, wall straddle
        { snapZ: tz,                         xMin: lx, xMax: lx + w }, // front, wall inside
        { snapZ: tz + d - 2 * halfShort,     xMin: lx, xMax: lx + w }, // back, wall inside
        { snapZ: tz + d - halfShort,         xMin: lx, xMax: lx + w }, // back, wall straddle
        { snapZ: tz + d,                     xMin: lx, xMax: lx + w }, // back, wall outside
        { snapZ: tz + d / 2 - halfShort,     xMin: lx, xMax: lx + w }, // centerline split
      ];
      for (const c of candidates) {
        const dist = Math.abs(wz - c.snapZ);
        const wallLeft = wx;
        const wallRight = wx + wallWidth;
        if (dist < bestDist && wallRight > c.xMin - SNAP_THRESHOLD && wallLeft < c.xMax + SNAP_THRESHOLD) {
          bestDist = dist;
          snapZ = c.snapZ;
          snapX = wx;
          attachedTo = b.id;
        }
      }
    } else {
      const candidates = [
        { snapX: lx - 2 * halfShort,         zMin: tz, zMax: tz + d }, // left, wall outside
        { snapX: lx - halfShort,             zMin: tz, zMax: tz + d }, // left, wall straddle
        { snapX: lx,                         zMin: tz, zMax: tz + d }, // left, wall inside
        { snapX: lx + w - 2 * halfShort,     zMin: tz, zMax: tz + d }, // right, wall inside
        { snapX: lx + w - halfShort,         zMin: tz, zMax: tz + d }, // right, wall straddle
        { snapX: lx + w,                     zMin: tz, zMax: tz + d }, // right, wall outside
        { snapX: lx + w / 2 - halfShort,     zMin: tz, zMax: tz + d }, // centerline split
      ];
      for (const c of candidates) {
        const dist = Math.abs(wx - c.snapX);
        const wallTop = wz;
        const wallBottom = wz + wallWidth;
        if (dist < bestDist && wallBottom > c.zMin - SNAP_THRESHOLD && wallTop < c.zMax + SNAP_THRESHOLD) {
          bestDist = dist;
          snapX = c.snapX;
          snapZ = wz;
          attachedTo = b.id;
        }
      }
    }
  }

  // Pass 2: endpoint detent — wall endpoints snap to corners, intermediate
  // posts on structural buildings (auto-placed grid + manual overrides via
  // building.poles), standalone poles, and other muur endpoints.
  // wallEndpoints[0] is the "near" end (left for horizontal / top for
  // vertical) — the wall body extends OUTWARD from that endpoint into the
  // wall's positive long-axis direction. wallEndpoints[1] is the far end.
  const wallEndpoints: [number, number][] = orientation === 'horizontal'
    ? [[snapX, snapZ + halfShort], [snapX + wallWidth, snapZ + halfShort]]
    : [[snapX + halfShort, snapZ], [snapX + halfShort, snapZ + wallWidth]];

  let detentDist = POLE_DETENT_THRESHOLD;
  let detentDx = 0;
  let detentDz = 0;
  let detentFound = false;

  // Pass 2 maintains TWO target sets — one per wall endpoint — because pole
  // snap is direction-aware: a pole sits on the side of the endpoint AWAY
  // from the wall body, so the endpoint's "near face" target on the pole
  // depends on which endpoint we're snapping. Targets that don't depend on
  // direction (edge midpoints, muur/poort endpoints) go into both sets.
  const longHalf = POST_SIZE / 2;
  const targetsA: [number, number][] = []; // for wallEndpoints[0]
  const targetsB: [number, number][] = []; // for wallEndpoints[1]

  /** Add face-flush candidates for a POST_SIZE pole at (cx, cz). The wall's
   *  near end face touches the pole's far face along the wall's long axis;
   *  the perpendicular axis emits two flush candidates (wall outside / wall
   *  inside the structural edge the pole sits on, encoded by callers via
   *  the perpZs argument). */
  const addPole = (cx: number, cz: number, perpZsOrXs: number[]) => {
    if (orientation === 'horizontal') {
      // A (left endpoint, body extends +X): wall's left end at pole's +X face
      for (const z of perpZsOrXs) targetsA.push([cx + longHalf, z]);
      // B (right endpoint, body extends -X): wall's right end at pole's -X face
      for (const z of perpZsOrXs) targetsB.push([cx - longHalf, z]);
    } else {
      // A (top endpoint, body extends +Z): wall's top end at pole's +Z face
      for (const x of perpZsOrXs) targetsA.push([x, cz + longHalf]);
      for (const x of perpZsOrXs) targetsB.push([x, cz - longHalf]);
    }
  };

  /** Direction-symmetric target — pushed to both endpoint sets. */
  const addBoth = (tx: number, tz: number) => {
    targetsA.push([tx, tz]);
    targetsB.push([tx, tz]);
  };

  for (const b of buildings) {
    if (b.type === 'paal') {
      const pcx = b.position[0] + b.dimensions.width / 2;
      const pcz = b.position[1] + b.dimensions.depth / 2;
      if (orientation === 'horizontal') addPole(pcx, pcz, [pcz]);
      else addPole(pcx, pcz, [pcx]);
      continue;
    }
    if (b.type === 'muur' || b.type === 'poort') {
      if (b.orientation === 'horizontal') {
        const cy = b.position[1] + b.dimensions.depth / 2;
        addBoth(b.position[0], cy);
        addBoth(b.position[0] + b.dimensions.width, cy);
      } else {
        const cx = b.position[0] + b.dimensions.depth / 2;
        addBoth(cx, b.position[1]);
        addBoth(cx, b.position[1] + b.dimensions.width);
      }
      continue;
    }
    // Structural building.
    const [lx, tz] = b.position;
    const w = b.dimensions.width;
    const d = b.dimensions.depth;
    const cx = lx + w / 2;
    const cz = tz + d / 2;
    // For poles on a building face, the perp candidates are the three Pass-1
    // outputs at that face (wall outside / wall straddle / wall inside) so
    // whichever Pass 1 picked stays the matching Pass 2 target — Pass 2
    // only shifts the long axis to the pole's near face, never undoing the
    // user's intended perp position.
    const frontPerps = orientation === 'horizontal'
      ? [tz - longHalf, tz, tz + longHalf]
      : [lx - longHalf, lx, lx + longHalf];
    const backPerps  = orientation === 'horizontal'
      ? [tz + d - longHalf, tz + d, tz + d + longHalf]
      : [lx + w - longHalf, lx + w, lx + w + longHalf];
    // Corner posts (POST_SIZE square centered on each building corner).
    if (orientation === 'horizontal') {
      addPole(lx, tz,         frontPerps);
      addPole(lx + w, tz,     frontPerps);
      addPole(lx, tz + d,     backPerps);
      addPole(lx + w, tz + d, backPerps);
    } else {
      addPole(lx, tz,         frontPerps);
      addPole(lx + w, tz,     backPerps);
      addPole(lx, tz + d,     frontPerps);
      addPole(lx + w, tz + d, backPerps);
    }
    // Edge midpoints. The "parallel edge" (along the wall's long axis) emits
    // three perp candidates (matching Pass 1's outside/straddle/inside). The
    // "perpendicular edge" (across the wall) emits a single target where the
    // wall's near end face meets the building edge.
    if (orientation === 'horizontal') {
      for (const z of frontPerps) addBoth(cx, z);
      for (const z of backPerps)  addBoth(cx, z);
      addBoth(lx, cz);
      addBoth(lx + w, cz);
    } else {
      for (const x of frontPerps) addBoth(x, cz);
      for (const x of backPerps)  addBoth(x, cz);
      addBoth(cx, tz);
      addBoth(cx, tz + d);
    }
    // Intermediate grid posts.
    const poles = b.poles ?? autoPoleLayout(w, d);
    if (orientation === 'horizontal') {
      for (const f of poles.front) addPole(lx + f * w, tz,         frontPerps);
      for (const f of poles.back)  addPole(lx + f * w, tz + d,     backPerps);
      // Poles on left/right edges are perpendicular to a horizontal wall's
      // long axis. Only the pole's centre Z is a meaningful perp candidate.
      for (const f of poles.left)  addPole(lx,         tz + f * d, [tz + f * d]);
      for (const f of poles.right) addPole(lx + w,     tz + f * d, [tz + f * d]);
    } else {
      for (const f of poles.front) addPole(lx + f * w, tz,         [lx + f * w]);
      for (const f of poles.back)  addPole(lx + f * w, tz + d,     [lx + f * w]);
      for (const f of poles.left)  addPole(lx,         tz + f * d, frontPerps);
      for (const f of poles.right) addPole(lx + w,     tz + f * d, backPerps);
    }
  }

  const tryAll = (ep: [number, number], list: [number, number][]) => {
    for (const [tx, tz] of list) {
      const d = Math.hypot(ep[0] - tx, ep[1] - tz);
      if (d < detentDist) {
        detentDist = d;
        detentDx = tx - ep[0];
        detentDz = tz - ep[1];
        detentFound = true;
      }
    }
  };
  tryAll(wallEndpoints[0], targetsA);
  tryAll(wallEndpoints[1], targetsB);

  if (detentFound) {
    snapX += detentDx;
    snapZ += detentDz;
  }

  return { position: [snapX, snapZ], attachedTo };
}

/** Snap a wall-resize endpoint along the wall's long axis to nearby pole
 *  positions on structural buildings — both manually-placed poles
 *  (`b.poles`) and the auto-derived layout fallback (`autoPoleLayout`).
 *
 *  Companion to `detectResizeSnap`: that function only knows about a
 *  building's own edges and centerlines, which means manual poles at
 *  fractional positions never attract a resizing wall. Callers should
 *  invoke both and pick whichever candidate sits closer to the raw pointer
 *  value, so adding pole snap is purely additive.
 *
 *  A pole only counts when its perpendicular world coordinate is within
 *  `POLE_DETENT_THRESHOLD` of the wall's midline on the perpendicular axis,
 *  so a pole on the far side of an overkapping doesn't yank the wall over.
 *
 *  @param edgeValue Current world coord of the dragged endpoint along the long axis.
 *  @param longAxis  'x' for a horizontal wall, 'z' for a vertical wall.
 *  @param wallPerp  Wall's midline coord on the perpendicular axis (constant during resize).
 *  @param buildings All other buildings; structural entities are scanned, walls/paals are skipped.
 */
export function detectWallPoleSnap(
  edgeValue: number,
  longAxis: 'x' | 'z',
  wallPerp: number,
  buildings: BuildingEntity[],
): number {
  let bestDist = SNAP_THRESHOLD;
  let snapped = edgeValue;
  const halfPost = POST_SIZE / 2;

  for (const b of buildings) {
    if (b.type === 'muur' || b.type === 'poort') continue;

    if (b.type === 'paal') {
      // Standalone pole — emit both long-axis faces as snap candidates so
      // the wall's resize edge meets the pole side-to-side, not centre-to-
      // centre.
      const pcx = b.position[0] + b.dimensions.width / 2;
      const pcz = b.position[1] + b.dimensions.depth / 2;
      const halfW = b.dimensions.width / 2;
      const halfD = b.dimensions.depth / 2;
      const along = longAxis === 'x' ? pcx : pcz;
      const halfAlong = longAxis === 'x' ? halfW : halfD;
      const perp = longAxis === 'x' ? pcz : pcx;
      const halfPerp = longAxis === 'x' ? halfD : halfW;
      if (Math.abs(perp - wallPerp) > POLE_DETENT_THRESHOLD + halfPerp) continue;
      for (const t of [along - halfAlong, along + halfAlong]) {
        const dist = Math.abs(edgeValue - t);
        if (dist < bestDist) {
          bestDist = dist;
          snapped = t;
        }
      }
      continue;
    }

    const [lx, tz] = b.position;
    const w = b.dimensions.width;
    const d = b.dimensions.depth;
    const poles = b.poles ?? autoPoleLayout(w, d);

    // Every structural building has implicit POST_SIZE corner posts at its
    // four corners on top of any intermediate posts. Both contribute snap
    // targets at the post's near face along the wall's long axis.
    const points: [number, number][] = [
      [lx, tz], [lx + w, tz], [lx, tz + d], [lx + w, tz + d],
    ];
    for (const f of poles.front) points.push([lx + f * w, tz]);
    for (const f of poles.back)  points.push([lx + f * w, tz + d]);
    for (const f of poles.left)  points.push([lx,         tz + f * d]);
    for (const f of poles.right) points.push([lx + w,     tz + f * d]);

    for (const [px, pz] of points) {
      const along = longAxis === 'x' ? px : pz;
      const perp = longAxis === 'x' ? pz : px;
      if (Math.abs(perp - wallPerp) > POLE_DETENT_THRESHOLD) continue;
      for (const t of [along - halfPost, along + halfPost]) {
        const dist = Math.abs(edgeValue - t);
        if (dist < bestDist) {
          bestDist = dist;
          snapped = t;
        }
      }
    }
  }

  return snapped;
}

/** Wall-resize endpoint snap that combines `detectResizeSnap` (structural
 *  edges + centerlines) with `detectWallPoleSnap` (pole positions, including
 *  manually-placed ones). Picks whichever snapped candidate sits closer to
 *  the raw pointer value, treating the input value as the "no snap" sentinel
 *  both helpers return when nothing is in range. */
export function detectWallResizeSnap(
  rawValue: number,
  axis: 'x' | 'z',
  edgeSide: WallSide,
  perpStart: number,
  perpEnd: number,
  wallPerp: number,
  buildings: BuildingEntity[],
): number {
  const edgeSnap = detectResizeSnap(rawValue, axis, edgeSide, perpStart, perpEnd, buildings);
  const poleSnap = detectWallPoleSnap(rawValue, axis, wallPerp, buildings);
  // Pole-face snap is preferred over building-edge snap whenever it engages:
  // a building's outer edge coincides with the corner post's CENTRE, so
  // landing on the post's near face (poleSnap) is the side-to-side meeting
  // the user expects, not landing on the post's midline.
  if (poleSnap !== rawValue) return poleSnap;
  return edgeSnap;
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
