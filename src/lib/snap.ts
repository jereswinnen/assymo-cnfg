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
