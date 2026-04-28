import { describe, it, expect } from 'vite-plus/test';
import {
  detectPoleSnap,
  detectResizeSnap,
  detectSnap,
  detectWallSnap,
} from '@/domain/building';
import { makeBuilding } from './fixtures';

const structural = makeBuilding({ id: 'b1', type: 'berging', position: [0, 0], dimensions: { width: 4, depth: 4, height: 2.6 } });

describe('detectPoleSnap', () => {
  it('does not snap when pole is well outside threshold', () => {
    const result = detectPoleSnap([10, 10], [structural]);
    expect(result.attachedTo).toBeNull();
    expect(result.center[0]).toBeCloseTo(10, 3);
    expect(result.center[1]).toBeCloseTo(10, 3);
  });

  it('snaps to a building edge when within the tighter pole threshold', () => {
    // Pole at (2, -0.1): 0.1m above the front edge (y=0) of the berging
    const result = detectPoleSnap([2, -0.1], [structural]);
    expect(result.attachedTo).toBe('b1');
    expect(result.center[1]).toBeCloseTo(0, 3);
  });

  it('does not snap a pole 0.3m away (above old 0.5m threshold, below new 0.25m)', () => {
    // Guards the tightened threshold: at 0.3m the old behavior would snap,
    // the new behavior should not.
    const result = detectPoleSnap([2, -0.3], [structural]);
    expect(result.attachedTo).toBeNull();
  });

  it('prefers corner detents over edge slide when both are in range', () => {
    // Pole very close to the top-left corner (0, 0)
    const result = detectPoleSnap([0.08, 0.08], [structural]);
    expect(result.attachedTo).toBe('b1');
    expect(result.center[0]).toBeCloseTo(0, 3);
    expect(result.center[1]).toBeCloseTo(0, 3);
  });

  it('ignores other poles as snap targets (only structural)', () => {
    const other = makeBuilding({ id: 'p1', type: 'paal', position: [2, 0], dimensions: { width: 0.15, depth: 0.15, height: 2.6 } });
    const result = detectPoleSnap([2.05, 0.05], [other]);
    expect(result.attachedTo).toBeNull();
  });
});

describe('detectSnap (building-to-building)', () => {
  it('emits no snap when buildings are far apart', () => {
    const dragged = makeBuilding({ id: 'a', type: 'berging', position: [20, 20] });
    const other = makeBuilding({ id: 'b', type: 'berging', position: [0, 0] });
    const { snappedPosition, newConnections } = detectSnap(dragged, [other]);
    expect(newConnections).toHaveLength(0);
    expect(snappedPosition).toEqual([20, 20]);
  });

  it('snaps abutting edges and emits a connection', () => {
    // Dragged B sits 0.1m to the right of A (A.right = 4, B.left = 4.1)
    const a = makeBuilding({ id: 'a', type: 'berging', position: [0, 0] });
    const b = makeBuilding({ id: 'b', type: 'berging', position: [4.1, 0] });
    const { snappedPosition, newConnections } = detectSnap(b, [a]);
    expect(newConnections).toHaveLength(1);
    expect(snappedPosition[0]).toBeCloseTo(4, 3);
  });

  it('does not snap when perpendicular overlap is absent', () => {
    const a = makeBuilding({ id: 'a', type: 'berging', position: [0, 0] });
    // B sits right of A but vertically offset past A's depth → no overlap
    const b = makeBuilding({ id: 'b', type: 'berging', position: [4.1, 10] });
    const { newConnections } = detectSnap(b, [a]);
    expect(newConnections).toHaveLength(0);
  });
});

describe('detectWallSnap (standalone muur)', () => {
  it('leaves position unchanged when far from any building', () => {
    const res = detectWallSnap([20, 20], 3, 'horizontal', [structural]);
    expect(res.attachedTo).toBeNull();
    expect(res.position).toEqual([20, 20]);
  });

  it('snaps a wall near the front edge of a structural building', () => {
    // Horizontal muur 3m wide, top-left corner at (0.5, -0.1)
    const res = detectWallSnap([0.5, -0.1], 3, 'horizontal', [structural]);
    expect(res.attachedTo).toBe('b1');
  });

  it('snaps a horizontal wall to the building centerline', () => {
    // 4×4 building. Centerline z = 2. Place wall midline near z=2.
    // Wall position is the top-left corner; midline = z + POST_SIZE/2.
    // To land midline on z=2, position z = 2 - 0.075 = 1.925.
    // Drag near it: 1.85 → midline at 1.925, distance 0.075 from centerline.
    const res = detectWallSnap([0.5, 1.85], 3, 'horizontal', [structural]);
    expect(res.attachedTo).toBe('b1');
    expect(res.position[1]).toBeCloseTo(1.925, 3);
  });

  it('snaps a vertical wall to the building centerline', () => {
    // 4×4 building. Centerline x = 2. Wall midline = x + POST_SIZE/2.
    const res = detectWallSnap([1.85, 0.5], 3, 'vertical', [structural]);
    expect(res.attachedTo).toBe('b1');
    expect(res.position[0]).toBeCloseTo(1.925, 3);
  });

  it('snaps a wall endpoint to an auto-placed intermediate post', () => {
    // 8×4 overkapping → autoPoleLayout puts intermediate posts at
    // x = position[0] + 0.5 * 8 = 4 (front + back). Place a horizontal
    // wall whose right endpoint is near (4, 0) — front edge already
    // captured by Pass 1 edge slide, then Pass 2 detents the endpoint.
    const overkapping = makeBuilding({
      id: 'ok',
      type: 'overkapping',
      position: [0, 0],
      dimensions: { width: 8, depth: 4, height: 2.6 },
    });
    // Wall length 4, right endpoint at x=4.05 → near the auto post at x=4.
    const res = detectWallSnap([0.05, -0.075], 4, 'horizontal', [overkapping]);
    expect(res.attachedTo).toBe('ok');
    // Right endpoint should land on x=4, so position[0] = 4 - 4 = 0.
    expect(res.position[0]).toBeCloseTo(0, 3);
  });

  it('honors a manually-overridden poles config when detenting endpoints', () => {
    const overkapping = makeBuilding({
      id: 'ok',
      type: 'overkapping',
      position: [0, 0],
      dimensions: { width: 6, depth: 4, height: 2.6 },
      poles: { front: [0.25, 0.75], back: [], left: [], right: [] },
    });
    // Manual front pole at x = 0.25 * 6 = 1.5, on z=0.
    // Place a horizontal wall whose left endpoint is near (1.5, 0).
    const res = detectWallSnap([1.55, -0.075], 2, 'horizontal', [overkapping]);
    expect(res.attachedTo).toBe('ok');
    expect(res.position[0]).toBeCloseTo(1.5, 3);
  });

  it('detents a wall endpoint to a 1-part poort the same way it does to a muur', () => {
    // Horizontal poort 1.5m wide at (2, 1), thickness 0.15. Midline z = 1.075.
    // Midline endpoints: (2, 1.075) and (3.5, 1.075).
    const poort = makeBuilding({
      id: 'gate1',
      type: 'poort',
      position: [2, 1],
      dimensions: { width: 1.5, depth: 0.15, height: 2.0 },
      orientation: 'horizontal',
    });
    // Dragged horizontal wall, 2m long, position [2.05, 1] →
    // left endpoint (with half-thickness offset) at (2.05, 1.075),
    // 0.05m east of the poort's left midline endpoint (2, 1.075).
    const res = detectWallSnap([2.05, 1], 2, 'horizontal', [poort]);
    // Pass-1 doesn't engage on poort (it's a primitive), so attachedTo
    // stays null — but Pass-2 detent must shift the wall onto the poort
    // endpoint. Mirror-check against a muur at the same position.
    const muur = makeBuilding({ ...poort, id: 'wall1', type: 'muur' });
    const muurRes = detectWallSnap([2.05, 1], 2, 'horizontal', [muur]);
    expect(res.position[0]).toBeCloseTo(muurRes.position[0], 6);
    expect(res.position[1]).toBeCloseTo(muurRes.position[1], 6);
    // Concretely: left endpoint should land at x=2 → position[0]=2.
    expect(res.position[0]).toBeCloseTo(2, 6);
  });

  it('uses the full outer footprint width of a 2-part poort for endpoint detents', () => {
    // 2-part poort: 3.0m wide, horizontal at (0, 0). Right midline endpoint = (3.0, 0.075).
    const poort = makeBuilding({
      id: 'gate2',
      type: 'poort',
      position: [0, 0],
      dimensions: { width: 3.0, depth: 0.15, height: 2.0 },
      orientation: 'horizontal',
    });
    // Drop a 1m horizontal wall whose left endpoint is near (3.0, 0.075).
    const res = detectWallSnap([2.95, 0], 1, 'horizontal', [poort]);
    // Detent should pull the left endpoint onto x=3.0 → position[0]=3.0.
    expect(res.position[0]).toBeCloseTo(3.0, 6);
  });
});

describe('detectResizeSnap', () => {
  it('returns the edge value unchanged when no neighbors are in range', () => {
    const other = makeBuilding({ id: 'b', type: 'berging', position: [20, 20] });
    const snapped = detectResizeSnap(2, 'x', 'right', 0, 4, [other]);
    expect(snapped).toBe(2);
  });

  it('snaps the dragged edge to an opposing edge within threshold', () => {
    // Neighbor's left edge at x=5; dragging our right edge at x=4.9
    const other = makeBuilding({ id: 'b', type: 'berging', position: [5, 0] });
    const snapped = detectResizeSnap(4.9, 'x', 'right', 0, 4, [other]);
    expect(snapped).toBeCloseTo(5, 3);
  });

  it("snaps the dragged edge to a neighbor's center line when close", () => {
    // Neighbor centered at x = 2 (4m wide at origin); dragging to x = 2.05
    const other = makeBuilding({ id: 'b', type: 'berging', position: [0, 0] });
    const snapped = detectResizeSnap(2.05, 'x', 'right', 0, 4, [other]);
    expect(snapped).toBeCloseTo(2, 3);
  });
});
