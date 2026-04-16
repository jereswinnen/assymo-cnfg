import { describe, it, expect } from 'vite-plus/test';
import { detectPoleSnap } from '@/domain/building';
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
