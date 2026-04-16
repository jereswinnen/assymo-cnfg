import { describe, it, expect } from 'vite-plus/test';
import {
  autoPoleLayout,
  clampOpeningPosition,
  findBestNewPosition,
  fractionToX,
  xToFraction,
} from '@/domain/building';

describe('fractionToX / xToFraction', () => {
  it('round-trips an interior fraction (EDGE_CLEARANCE aware)', () => {
    const length = 6;
    for (const frac of [0.0, 0.25, 0.5, 0.75, 1.0]) {
      const x = fractionToX(length, frac);
      expect(xToFraction(length, x)).toBeCloseTo(frac, 4);
    }
  });

  it('maps fraction 0.5 to the wall center (x = 0)', () => {
    expect(fractionToX(6, 0.5)).toBeCloseTo(0, 6);
  });

  it('clamps xToFraction results into [0, 1]', () => {
    const length = 4;
    expect(xToFraction(length, -100)).toBeGreaterThanOrEqual(0);
    expect(xToFraction(length, 100)).toBeLessThanOrEqual(1);
  });

  it('returns 0.5 from xToFraction when the wall is too short to have a usable region', () => {
    // Wall length 0.5m with 0.5m clearance either side → no usable space.
    expect(xToFraction(0.5, 0)).toBe(0.5);
  });
});

describe('clampOpeningPosition', () => {
  it('leaves a centered door alone when no other openings exist', () => {
    const frac = clampOpeningPosition(6, 0.9, 0.5, []);
    expect(frac).toBeCloseTo(0.5, 3);
  });

  it('clamps a fraction that would push the opening off the edge', () => {
    const frac = clampOpeningPosition(6, 0.9, 1.5, []);
    expect(frac).toBeLessThanOrEqual(1);
    expect(frac).toBeGreaterThanOrEqual(0);
  });

  it('pushes a new opening away from an existing one', () => {
    // Existing door at position 0.5 with width 0.9 on a 6m wall.
    // Proposing a window at the same position (0.5) with width 1.2 — should move.
    const moved = clampOpeningPosition(6, 1.2, 0.5, [{ position: 0.5, width: 0.9 }]);
    expect(Math.abs(moved - 0.5)).toBeGreaterThan(0);
  });

  it('falls back to 0.5 for a wall with no usable region', () => {
    // Wall length 0.5m, 2 * EDGE_CLEARANCE (1m) exceeds total — no usable space.
    expect(clampOpeningPosition(0.5, 0.9, 0.2, [])).toBe(0.5);
  });
});

describe('findBestNewPosition', () => {
  it('returns 0.5 when the wall has no existing openings', () => {
    expect(findBestNewPosition(6, 0.9, [])).toBeCloseTo(0.5, 3);
  });

  it('places a new opening in the largest gap', () => {
    // Existing door jammed to the left side — largest gap is to the right.
    const pos = findBestNewPosition(
      6,
      0.9,
      [{ position: 0.1, width: 0.9 }],
    );
    expect(pos).toBeGreaterThan(0.5);
  });
});

describe('autoPoleLayout', () => {
  it('emits no intermediate poles for a tiny overkapping (< POST_SPACING)', () => {
    const layout = autoPoleLayout(2, 2);
    expect(layout.front).toEqual([]);
    expect(layout.back).toEqual([]);
    expect(layout.left).toEqual([]);
    expect(layout.right).toEqual([]);
  });

  it('emits additional intermediate poles as spans grow beyond POST_SPACING', () => {
    const small = autoPoleLayout(4, 4);
    const large = autoPoleLayout(12, 6);
    expect(large.front.length).toBeGreaterThan(small.front.length);
    expect(large.left.length).toBeGreaterThan(small.left.length);
  });

  it('mirrors layout across opposite sides (front = back, left = right)', () => {
    const layout = autoPoleLayout(9, 6);
    expect(layout.front).toEqual(layout.back);
    expect(layout.left).toEqual(layout.right);
  });
});
