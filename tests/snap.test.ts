import { describe, it, expect } from 'vite-plus/test';
import {
  detectPoleSnap,
  detectResizeSnap,
  detectSnap,
  detectWallSnap,
  detectWallPoleSnap,
  detectWallResizeSnap,
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
    // Pole at (2, -0.1): 0.1m above the front edge (y=0) of the berging.
    // Face-flush candidates: pole outside at z = -POST_SIZE/2 = -0.075, pole
    // inside at z = +0.075. -0.1 is closer to -0.075 → outside-flush.
    const result = detectPoleSnap([2, -0.1], [structural]);
    expect(result.attachedTo).toBe('b1');
    expect(result.center[1]).toBeCloseTo(-0.075, 3);
  });

  it('does not snap a pole well outside any face-flush candidate', () => {
    // Guards the tightened threshold. With face-flush snap the outermost
    // candidate is at z = -POST_SIZE/2 = -0.075 and the threshold is 0.25, so
    // anything beyond ~0.325 is out of range. -0.35 is safely past that.
    const result = detectPoleSnap([2, -0.35], [structural]);
    expect(result.attachedTo).toBeNull();
  });

  it('detents to a face-flush position next to a corner post', () => {
    // Pole near the front-left corner (corner post at (0, 0)). Pass 1
    // catches the inside-flush front face (snapZ = 0.075). Pass 2 corner
    // detent pulls the X to the corner post's east face (lx + POST_SIZE
    // = 0.15) — pole sits beside the corner post on the inside-flush row.
    const result = detectPoleSnap([0.08, 0.08], [structural]);
    expect(result.attachedTo).toBe('b1');
    expect(result.center[0]).toBeCloseTo(0.15, 3);
    expect(result.center[1]).toBeCloseTo(0.075, 3);
  });

  it('snaps face-flush against another standalone paal', () => {
    // Static paal at (2, 0) — centre at (2.075, 0.075). Dragged paal at
    // (2.05, -0.05) is unambiguously above the static paal; the "north"
    // face-flush target is (2.075, -0.075).
    const other = makeBuilding({
      id: 'p1',
      type: 'paal',
      position: [2, 0],
      dimensions: { width: 0.15, depth: 0.15, height: 2.6 },
    });
    const result = detectPoleSnap([2.05, -0.05], [other]);
    expect(result.attachedTo).toBe('p1');
    expect(result.center[0]).toBeCloseTo(2.075, 3);
    expect(result.center[1]).toBeCloseTo(-0.075, 3);
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
    // Pole at x=4 has long-axis faces at x=4 ± POST_SIZE/2 = 3.925, 4.075.
    // Right endpoint 4.05 is closer to 4.075 → wall ends flush with pole's
    // far face. position[0] = 4.075 - 4 = 0.075.
    expect(res.position[0]).toBeCloseTo(0.075, 3);
  });

  it('respects a non-default postSize parameter (tenant geometry)', () => {
    // With postSize = 0.12 m, the corner post is 120 mm — its right face
    // sits at x = lx + 0.06 instead of the default 0.075. Wall left endpoint
    // near (0, -0.06) should snap to (0.06, -0.06) — flush with the smaller
    // post and the straddle Z aligned to the smaller wall envelope.
    const overkapping = makeBuilding({
      id: 'ok',
      type: 'overkapping',
      position: [0, 0],
      dimensions: { width: 8, depth: 4, height: 2.6 },
    });
    const res = detectWallSnap([0, -0.06], 3, 'horizontal', [overkapping], 0.12);
    expect(res.attachedTo).toBe('ok');
    expect(res.position[0]).toBeCloseTo(0.06, 3);
    expect(res.position[1]).toBeCloseTo(-0.06, 3);
  });

  it('seats a wall flush against a corner post without overlapping it', () => {
    // 7.8m × 3m overkapping at the origin has implicit POST_SIZE-square corner
    // posts at each corner. Drag a 3m horizontal wall near the front-left
    // corner so its centre roughly straddles the front edge.
    const overkapping = makeBuilding({
      id: 'ok',
      type: 'overkapping',
      position: [0, 0],
      dimensions: { width: 7.8, depth: 3, height: 2.6 },
    });
    const res = detectWallSnap([0, -0.075], 3, 'horizontal', [overkapping]);
    expect(res.attachedTo).toBe('ok');
    // Wall's left end at the corner post's right face (lx + POST_SIZE/2),
    // wall midline straddling the front edge so it shares the post line.
    expect(res.position[0]).toBeCloseTo(0.075, 3);
    expect(res.position[1]).toBeCloseTo(-0.075, 3);
  });

  it('snaps a vertical wall to the corner post when approaching from the left', () => {
    // Depth 8 keeps the wall's far endpoint clear of the left-edge midpoint
    // detent (the test's interest is the near endpoint vs the corner post).
    const overkapping = makeBuilding({
      id: 'ok',
      type: 'overkapping',
      position: [0, 0],
      dimensions: { width: 4, depth: 8, height: 2.6 },
    });
    // Vertical wall 3m long, top endpoint near front-left corner pole.
    const res = detectWallSnap([-0.075, 0], 3, 'vertical', [overkapping]);
    expect(res.attachedTo).toBe('ok');
    // Wall straddles the left edge, top end seated against the corner post.
    expect(res.position[0]).toBeCloseTo(-0.075, 3);
    expect(res.position[1]).toBeCloseTo(0.075, 3);
  });

  it('honors a manually-overridden poles config when detenting endpoints', () => {
    const overkapping = makeBuilding({
      id: 'ok',
      type: 'overkapping',
      position: [0, 0],
      dimensions: { width: 6, depth: 4, height: 2.6 },
      poles: { front: [0.25, 0.75], back: [], left: [], right: [] },
    });
    // Manual front pole at x = 0.25 * 6 = 1.5, on z=0. Pole long-axis faces
    // at 1.425, 1.575. Wall body extends right from its left endpoint, so the
    // endpoint at 1.55 is closer to 1.575 → wall lands inner-flush (left end
    // touches pole's right face). position[0] = 1.575.
    const res = detectWallSnap([1.55, -0.075], 2, 'horizontal', [overkapping]);
    expect(res.attachedTo).toBe('ok');
    expect(res.position[0]).toBeCloseTo(1.575, 3);
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

describe('detectWallPoleSnap', () => {
  it('returns the edge value unchanged when no buildings are in range', () => {
    const snapped = detectWallPoleSnap(3, 'x', 0, []);
    expect(snapped).toBe(3);
  });

  it('snaps a horizontal wall endpoint to the near face of a manual pole on the front edge', () => {
    // Manual pole at fraction 0.4 → world X = 3.6. The resize edge snaps
    // to the pole's near long-axis face (X = 3.6 ± POST_SIZE/2), not its
    // centre. Pointer 3.55 → nearest face is 3.525.
    const ok = makeBuilding({
      id: 'ok',
      type: 'overkapping',
      position: [0, 0],
      dimensions: { width: 9, depth: 4, height: 2.6 },
      poles: { front: [0.4], back: [], left: [], right: [] },
    });
    const snapped = detectWallPoleSnap(3.55, 'x', 0, [ok]);
    expect(snapped).toBeCloseTo(3.525, 3);
  });

  it('snaps a vertical wall endpoint to the near face of a manual pole on the left edge', () => {
    // Manual pole at fraction 1/3 of d=9 → world Z = 3. Faces at 2.925, 3.075.
    const ok = makeBuilding({
      id: 'ok',
      type: 'overkapping',
      position: [0, 0],
      dimensions: { width: 6, depth: 9, height: 2.6 },
      poles: { front: [], back: [], left: [1 / 3], right: [] },
    });
    const snapped = detectWallPoleSnap(2.95, 'z', 0, [ok]);
    expect(snapped).toBeCloseTo(2.925, 3);
  });

  it('snaps to the near face of an auto pole when no manual override is set', () => {
    // Auto front poles at fractions [1/3, 2/3] → X = 3, 6. Faces at 5.925, 6.075.
    const ok = makeBuilding({
      id: 'ok',
      type: 'overkapping',
      position: [0, 0],
      dimensions: { width: 9, depth: 4, height: 2.6 },
    });
    const snapped = detectWallPoleSnap(5.95, 'x', 0, [ok]);
    expect(snapped).toBeCloseTo(5.925, 3);
  });

  it('snaps to the near face of a corner post', () => {
    // Wall sitting on the front edge (wallPerp = 0) being resized along X.
    // The corner posts at (lx=0, tz=0) and (lx+w=9, tz=0) are now snap
    // targets too — pointer 8.95 should snap to the right corner post's
    // left face (X = 9 − POST_SIZE/2 = 8.925), not its centre (X = 9).
    const ok = makeBuilding({
      id: 'ok',
      type: 'overkapping',
      position: [0, 0],
      dimensions: { width: 9, depth: 4, height: 2.6 },
    });
    const snapped = detectWallPoleSnap(8.95, 'x', 0, [ok]);
    expect(snapped).toBeCloseTo(8.925, 3);
  });

  it('does not snap to a pole on the opposite edge of the building', () => {
    // Wall sits on the front edge (perp Z=0). A manual pole on the BACK edge
    // (z=4) at fraction 0.4 must not yank the wall — the perpendicular
    // distance is 4m, far above the threshold.
    const ok = makeBuilding({
      id: 'ok',
      type: 'overkapping',
      position: [0, 0],
      dimensions: { width: 9, depth: 4, height: 2.6 },
      poles: { front: [], back: [0.4], left: [], right: [] },
    });
    const snapped = detectWallPoleSnap(3.55, 'x', 0, [ok]);
    expect(snapped).toBe(3.55);
  });

  it('ignores muur and poort entities (but standalone palen are valid snap targets)', () => {
    // muur/poort have their own end-face snap handled elsewhere — they don't
    // contribute resize-pole candidates. Standalone palen do.
    const m = makeBuilding({ id: 'm', type: 'muur', position: [0, 0], dimensions: { width: 4, depth: 0.15, height: 2.6 } });
    const snapped = detectWallPoleSnap(3.55, 'x', 0, [m]);
    expect(snapped).toBe(3.55);

    // Standalone paal at (3, 0): faces along X at 3.075, 2.925.
    const p = makeBuilding({ id: 'p', type: 'paal', position: [3, 0], dimensions: { width: 0.15, depth: 0.15, height: 2.6 } });
    // Wall on the same perp Z as the paal — paal's right face is X=3.225 (paal lx=3 + width 0.15 = 3.15; centre 3.075).
    // Centre = 3 + 0.15/2 = 3.075. Faces at 3.0 and 3.15. Pointer 3.05 closer to 3.0.
    const snappedToPaal = detectWallPoleSnap(3.05, 'x', 0.075, [p]);
    expect(snappedToPaal).toBeCloseTo(3.0, 3);
  });
});

describe('detectWallResizeSnap', () => {
  it('snaps to the near face of a manual pole', () => {
    // Manual pole at X = 3.6, faces at 3.525 / 3.675. Pointer 3.55 → 3.525.
    const ok = makeBuilding({
      id: 'ok',
      type: 'overkapping',
      position: [0, 0],
      dimensions: { width: 9, depth: 4, height: 2.6 },
      poles: { front: [0.4], back: [], left: [], right: [] },
    });
    const snapped = detectWallResizeSnap(3.55, 'x', 'right', -0.075, 0.075, 0, [ok]);
    expect(snapped).toBeCloseTo(3.525, 3);
  });

  it('snaps to a building edge when no pole is in range', () => {
    // Wall perp Z = 2 (middle of building) so no corner posts engage.
    const ok = makeBuilding({
      id: 'ok',
      type: 'overkapping',
      position: [0, 0],
      dimensions: { width: 9, depth: 4, height: 2.6 },
    });
    const snapped = detectWallResizeSnap(8.95, 'x', 'right', 1.925, 2.075, 2, [ok]);
    expect(snapped).toBeCloseTo(9, 3);
  });

  it('prefers a pole-face snap over a building-edge snap at the same coordinate', () => {
    // The building's right edge at X = 9 coincides with the right corner
    // post's centre, but the user wants side-to-side contact with the post,
    // not the post's midline. Pointer 8.95 → corner post's left face at 8.925.
    const ok = makeBuilding({
      id: 'ok',
      type: 'overkapping',
      position: [0, 0],
      dimensions: { width: 9, depth: 4, height: 2.6 },
    });
    const snapped = detectWallResizeSnap(8.95, 'x', 'right', -0.075, 0.075, 0, [ok]);
    expect(snapped).toBeCloseTo(8.925, 3);
  });

  it('returns the raw value when nothing is in range', () => {
    const ok = makeBuilding({
      id: 'ok',
      type: 'overkapping',
      position: [20, 20],
      dimensions: { width: 4, depth: 4, height: 2.6 },
    });
    const snapped = detectWallResizeSnap(0, 'x', 'right', -0.075, 0.075, 0, [ok]);
    expect(snapped).toBe(0);
  });
});
