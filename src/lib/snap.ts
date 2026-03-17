import type { BuildingEntity, SnapConnection, WallSide } from '@/types/building';
import { POST_SIZE } from '@/lib/constants';

export const SNAP_THRESHOLD = 0.5;
export const SNAP_ALIGN_THRESHOLD = 0.3;
const POLE_DETENT_THRESHOLD = 0.35;

interface Edge {
  axis: 'x' | 'z';
  value: number;
  perpStart: number;
  perpEnd: number;
  side: WallSide;
}

export function getBuildingEdges(b: BuildingEntity): Edge[] {
  const [cx, cz] = b.position;
  const hw = b.dimensions.width / 2;
  const hd = b.dimensions.depth / 2;
  return [
    { axis: 'x', value: cx + hw, perpStart: cz - hd, perpEnd: cz + hd, side: 'right' },
    { axis: 'x', value: cx - hw, perpStart: cz - hd, perpEnd: cz + hd, side: 'left' },
    { axis: 'z', value: cz + hd, perpStart: cx - hw, perpEnd: cx + hw, side: 'back' },
    { axis: 'z', value: cz - hd, perpStart: cx - hw, perpEnd: cx + hw, side: 'front' },
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

    // Secondary alignment on perpendicular axis
    const conn = connections[0];
    const primaryEdge = dragEdges.find(e => e.side === conn.sideA)!;

    if (primaryEdge.axis === 'x') {
      // Primary snap was on X axis, try to align Z (front/back)
      for (const other of others) {
        if (other.id !== conn.buildingBId) continue;
        const dz = other.position[1] - nz;
        if (Math.abs(dz) < SNAP_ALIGN_THRESHOLD) {
          nz += dz;
        }
      }
    } else {
      // Primary snap was on Z axis, try to align X (left/right)
      for (const other of others) {
        if (other.id !== conn.buildingBId) continue;
        const dx = other.position[0] - nx;
        if (Math.abs(dx) < SNAP_ALIGN_THRESHOLD) {
          nx += dx;
        }
      }
    }
  }

  return {
    snappedPosition: [nx, nz],
    newConnections: connections,
  };
}

/** Snap a pole's center to building edges, corners, and midpoints.
 *  Order: edge slide first, then corners/midpoints override as detents. */
export function detectPoleSnap(
  polePos: [number, number],
  buildings: BuildingEntity[],
): [number, number] {
  const [px, pz] = polePos;
  let bestDist = SNAP_THRESHOLD;
  let snapX = px;
  let snapZ = pz;

  // Pass 1: edge slide (general snap to nearest point on edge)
  for (const b of buildings) {
    if (b.type === 'paal') continue;

    const [cx, cz] = b.position;
    const hw = b.dimensions.width / 2;
    const hd = b.dimensions.depth / 2;

    const edges: { fixed: 'x' | 'z'; val: number; min: number; max: number }[] = [
      { fixed: 'z', val: cz - hd, min: cx - hw, max: cx + hw },
      { fixed: 'z', val: cz + hd, min: cx - hw, max: cx + hw },
      { fixed: 'x', val: cx - hw, min: cz - hd, max: cz + hd },
      { fixed: 'x', val: cx + hw, min: cz - hd, max: cz + hd },
    ];

    for (const e of edges) {
      if (e.fixed === 'z') {
        const distToEdge = Math.abs(pz - e.val);
        const clampedX = Math.max(e.min, Math.min(e.max, px));
        const d = Math.hypot(px - clampedX, pz - e.val);
        if (distToEdge < SNAP_THRESHOLD && d < bestDist) {
          bestDist = d;
          snapX = clampedX;
          snapZ = e.val;
        }
      } else {
        const distToEdge = Math.abs(px - e.val);
        const clampedZ = Math.max(e.min, Math.min(e.max, pz));
        const d = Math.hypot(px - e.val, pz - clampedZ);
        if (distToEdge < SNAP_THRESHOLD && d < bestDist) {
          bestDist = d;
          snapX = e.val;
          snapZ = clampedZ;
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

    const [cx, cz] = b.position;
    const hw = b.dimensions.width / 2;
    const hd = b.dimensions.depth / 2;

    const targets: [number, number][] = [
      // 4 corners
      [cx - hw, cz - hd], [cx + hw, cz - hd],
      [cx - hw, cz + hd], [cx + hw, cz + hd],
      // 4 edge midpoints
      [cx, cz - hd], [cx, cz + hd],
      [cx - hw, cz], [cx + hw, cz],
    ];

    for (const [tx, tz] of targets) {
      const d = Math.hypot(snapX - tx, snapZ - tz);
      if (d < detentDist) {
        detentDist = d;
        snapX = tx;
        snapZ = tz;
      }
    }
  }

  return [snapX, snapZ];
}

/** Snap a standalone wall to building edges, poles, and other wall endpoints.
 *  Pass 1: edge slide (long edge along building edges).
 *  Pass 2: endpoint detent (short ends snap to corners/poles/wall ends). */
export function detectWallSnap(
  wallPos: [number, number],
  wallWidth: number,
  orientation: 'horizontal' | 'vertical',
  buildings: BuildingEntity[],
): [number, number] {
  const [wx, wz] = wallPos;
  let bestDist = SNAP_THRESHOLD;
  let snapX = wx;
  let snapZ = wz;

  const halfLong = wallWidth / 2;
  const halfShort = POST_SIZE / 2;

  // Pass 1: edge slide — wall's long edge slides along building edges
  for (const b of buildings) {
    if (b.type === 'paal' || b.type === 'muur') continue;

    const [cx, cz] = b.position;
    const hw = b.dimensions.width / 2;
    const hd = b.dimensions.depth / 2;

    if (orientation === 'horizontal') {
      // Wall runs along X — snap Z to top/bottom edges of buildings
      const edges = [
        { z: cz - hd, xMin: cx - hw, xMax: cx + hw },
        { z: cz + hd, xMin: cx - hw, xMax: cx + hw },
      ];
      for (const e of edges) {
        const dist = Math.abs(wz - e.z);
        const wallLeft = wx - halfLong;
        const wallRight = wx + halfLong;
        if (dist < bestDist && wallRight > e.xMin - SNAP_THRESHOLD && wallLeft < e.xMax + SNAP_THRESHOLD) {
          bestDist = dist;
          snapZ = e.z;
          snapX = wx;
        }
      }
    } else {
      // Wall runs along Z — snap X to left/right edges of buildings
      const edges = [
        { x: cx - hw, zMin: cz - hd, zMax: cz + hd },
        { x: cx + hw, zMin: cz - hd, zMax: cz + hd },
      ];
      for (const e of edges) {
        const dist = Math.abs(wx - e.x);
        const wallTop = wz - halfLong;
        const wallBottom = wz + halfLong;
        if (dist < bestDist && wallBottom > e.zMin - SNAP_THRESHOLD && wallTop < e.zMax + SNAP_THRESHOLD) {
          bestDist = dist;
          snapX = e.x;
          snapZ = wz;
        }
      }
    }
  }

  // Pass 2: endpoint detent — wall endpoints snap to corners, poles, other wall endpoints
  const wallEndpoints: [number, number][] = orientation === 'horizontal'
    ? [[snapX - halfLong, snapZ], [snapX + halfLong, snapZ]]
    : [[snapX, snapZ - halfLong], [snapX, snapZ + halfLong]];

  let detentDist = POLE_DETENT_THRESHOLD;
  let detentDx = 0;
  let detentDz = 0;
  let detentFound = false;

  const targets: [number, number][] = [];

  for (const b of buildings) {
    if (b.type === 'paal') {
      targets.push([...b.position]);
      continue;
    }
    if (b.type === 'muur') {
      const oHalfLong = b.dimensions.width / 2;
      if (b.orientation === 'horizontal') {
        targets.push([b.position[0] - oHalfLong, b.position[1]]);
        targets.push([b.position[0] + oHalfLong, b.position[1]]);
      } else {
        targets.push([b.position[0], b.position[1] - oHalfLong]);
        targets.push([b.position[0], b.position[1] + oHalfLong]);
      }
      continue;
    }
    // Building corners
    const [cx, cz] = b.position;
    const hw = b.dimensions.width / 2;
    const hd = b.dimensions.depth / 2;
    targets.push(
      [cx - hw, cz - hd], [cx + hw, cz - hd],
      [cx - hw, cz + hd], [cx + hw, cz + hd],
    );
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

  return [snapX, snapZ];
}
