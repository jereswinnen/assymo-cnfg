import { describe, it, expect } from 'vite-plus/test';
import { createGateBuildingEntity } from '@/domain/building';
import {
  getGateFootprint,
  getGateSeam,
  getGateSlideArrow,
  getGateSwingArcs,
} from '@/domain/schematic';

describe('getGateFootprint', () => {
  it('uses width as the long axis when horizontal', () => {
    const g = createGateBuildingEntity({ position: [2, 3] });
    const fp = getGateFootprint(g);
    expect(fp.x).toBe(2);
    expect(fp.y).toBe(3);
    expect(fp.width).toBeCloseTo(1.5, 6);
    expect(fp.depth).toBeCloseTo(0.15, 6);
    expect(fp.horizontal).toBe(true);
  });

  it('swaps width and depth when vertical', () => {
    const g = createGateBuildingEntity({ position: [0, 0] });
    g.orientation = 'vertical';
    const fp = getGateFootprint(g);
    expect(fp.width).toBeCloseTo(0.15, 6);
    expect(fp.depth).toBeCloseTo(1.5, 6);
    expect(fp.horizontal).toBe(false);
  });

  it('doubles long-axis width for 2-part gates', () => {
    const g = createGateBuildingEntity({ gateConfig: { partCount: 2 } });
    const fp = getGateFootprint(g);
    expect(fp.width).toBeCloseTo(3.0, 6);
  });
});

describe('getGateSeam', () => {
  it('returns null for 1-part gates', () => {
    const g = createGateBuildingEntity();
    expect(getGateSeam(g)).toBeNull();
  });

  it('crosses the thin axis at the long-axis midpoint for horizontal 2-part', () => {
    const g = createGateBuildingEntity({ position: [0, 0], gateConfig: { partCount: 2 } });
    const seam = getGateSeam(g);
    expect(seam).not.toBeNull();
    expect(seam!.x1).toBeCloseTo(1.5, 6);
    expect(seam!.x2).toBeCloseTo(1.5, 6);
    expect(seam!.y1).toBeCloseTo(0, 6);
    expect(seam!.y2).toBeCloseTo(0.15, 6);
  });

  it('crosses the thin axis horizontally when vertical', () => {
    const g = createGateBuildingEntity({ position: [0, 0], gateConfig: { partCount: 2 } });
    g.orientation = 'vertical';
    const seam = getGateSeam(g);
    expect(seam).not.toBeNull();
    expect(seam!.y1).toBeCloseTo(1.5, 6);
    expect(seam!.y2).toBeCloseTo(1.5, 6);
  });
});

describe('getGateSwingArcs', () => {
  it('emits a single quarter-arc for 1-part inward gate', () => {
    const g = createGateBuildingEntity();
    const arcs = getGateSwingArcs(g);
    expect(arcs).toHaveLength(1);
    expect(arcs[0].radius).toBeCloseTo(1.5, 6);
    expect(arcs[0].path.startsWith('M ')).toBe(true);
    expect(arcs[0].path).toContain('A');
  });

  it('emits two arcs for 2-part gates (one per leaf)', () => {
    const g = createGateBuildingEntity({ gateConfig: { partCount: 2 } });
    const arcs = getGateSwingArcs(g);
    expect(arcs).toHaveLength(2);
  });

  it('returns no arcs for sliding gates', () => {
    const g = createGateBuildingEntity({ gateConfig: { swingDirection: 'sliding' } });
    expect(getGateSwingArcs(g)).toEqual([]);
  });

  it('flips the pivot side for outward vs inward', () => {
    const inward = createGateBuildingEntity({ position: [0, 0] });
    const outward = createGateBuildingEntity({
      position: [0, 0],
      gateConfig: { swingDirection: 'outward' },
    });
    const inA = getGateSwingArcs(inward)[0];
    const outA = getGateSwingArcs(outward)[0];
    // Same pivot x for a horizontal gate (both at x=0 — left endpoint),
    // but the pivot y differs because inward uses the top edge and
    // outward uses the bottom edge of the gate footprint.
    expect(inA.cx).toBeCloseTo(outA.cx, 6);
    expect(inA.cy).not.toBeCloseTo(outA.cy, 3);
  });
});

describe('getGateSlideArrow', () => {
  it('returns null for non-sliding gates', () => {
    const g = createGateBuildingEntity();
    expect(getGateSlideArrow(g)).toBeNull();
  });

  it('produces a horizontal arrow alongside a horizontal sliding gate', () => {
    const g = createGateBuildingEntity({
      position: [0, 0],
      gateConfig: { swingDirection: 'sliding' },
    });
    const arrow = getGateSlideArrow(g);
    expect(arrow).not.toBeNull();
    expect(arrow!.x1).toBeCloseTo(0, 6);
    expect(arrow!.x2).toBeCloseTo(1.5, 6);
    // Same y on both endpoints — horizontal arrow.
    expect(arrow!.y1).toBeCloseTo(arrow!.y2, 6);
  });

  it('produces a vertical arrow when the gate is vertical', () => {
    const g = createGateBuildingEntity({
      position: [0, 0],
      gateConfig: { swingDirection: 'sliding' },
    });
    g.orientation = 'vertical';
    const arrow = getGateSlideArrow(g);
    expect(arrow).not.toBeNull();
    expect(arrow!.x1).toBeCloseTo(arrow!.x2, 6);
    expect(arrow!.y1).toBeCloseTo(0, 6);
    expect(arrow!.y2).toBeCloseTo(1.5, 6);
  });
});
