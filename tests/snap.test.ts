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
