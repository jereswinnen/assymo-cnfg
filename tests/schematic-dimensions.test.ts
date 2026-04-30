import { describe, it, expect } from 'vite-plus/test';
import {
  DIMENSION_CONFIG,
  computeElevationDimensions,
  computePlanDimensions,
  type DimensionConfig,
} from '@/domain/schematic';
import type { WallConfig } from '@/domain/building';
import { makeBuilding, makeConfig } from './fixtures';

const BLANK_WALL: WallConfig = {
  hasDoor: false,
  doorSize: 'enkel',
  doorHasWindow: false,
  doorPosition: 0.5,
  doorSwing: 'naar_buiten',
  windows: [],
};

const wallWithDoor: WallConfig = { ...BLANK_WALL, hasDoor: true, doorPosition: 0.5 };
const wallWithWindowAndDoor: WallConfig = {
  ...BLANK_WALL,
  hasDoor: true,
  doorPosition: 0.3,
  windows: [{ id: 'w1', position: 0.7, width: 1.2, height: 1.2, sillHeight: 0.9 }],
};
const wallWithTwoWindowsAndDoor: WallConfig = {
  ...BLANK_WALL,
  hasDoor: true,
  doorPosition: 0.5,
  windows: [
    { id: 'w1', position: 0.2, width: 1.2, height: 1.2, sillHeight: 0.9 },
    { id: 'w2', position: 0.8, width: 1.2, height: 1.2, sillHeight: 0.9 },
  ],
};

describe('computePlanDimensions — context-aware emission', () => {
  it('returns [] for an empty scene', () => {
    expect(computePlanDimensions({ buildings: [], connections: [] })).toEqual([]);
  });

  it('emits per-building lines but suppresses totals when only one structural is present', () => {
    const cfg = makeConfig();
    const lines = computePlanDimensions({ buildings: cfg.buildings, connections: cfg.connections });
    expect(lines.filter((l) => l.id === 'building.width')).toHaveLength(1);
    expect(lines.filter((l) => l.id === 'building.depth')).toHaveLength(1);
    expect(lines.filter((l) => l.id === 'total.width')).toHaveLength(0);
    expect(lines.filter((l) => l.id === 'total.depth')).toHaveLength(0);
  });

  it('emits per-building and total when widths AND depths differ from totals', () => {
    // Side-by-side: gebouw 3.6×3.0, overkapping 4.2×3.0. Widths sum to 7.8
    // (each per-building != total), depths both equal total 3.0.
    const a = makeBuilding({ id: 'a', type: 'berging', position: [0, 0], dimensions: { width: 3.6, depth: 3, height: 2.6 } });
    const b = makeBuilding({ id: 'b', type: 'overkapping', position: [3.6, 0], dimensions: { width: 4.2, depth: 3, height: 2.6 } });
    const lines = computePlanDimensions({ buildings: [a, b], connections: [] });
    expect(lines.filter((l) => l.id === 'building.width')).toHaveLength(2);
    expect(lines.filter((l) => l.id === 'building.depth')).toHaveLength(0);
    expect(lines.filter((l) => l.id === 'total.width')).toHaveLength(1);
    expect(lines.filter((l) => l.id === 'total.depth')).toHaveLength(1);
  });

  it('suppresses per-building lines on an axis when every value equals the total', () => {
    // 4×3 + 4×3 side-by-side: widths both 4 != total 8 → per-building shown.
    // Depths both 3 == total 3 → per-building.depth suppressed.
    const a = makeBuilding({ id: 'a', type: 'berging', position: [0, 0], dimensions: { width: 4, depth: 3, height: 2.6 } });
    const b = makeBuilding({ id: 'b', type: 'berging', position: [4, 0], dimensions: { width: 4, depth: 3, height: 2.6 } });
    const lines = computePlanDimensions({ buildings: [a, b], connections: [] });
    expect(lines.filter((l) => l.id === 'building.width')).toHaveLength(2);
    expect(lines.filter((l) => l.id === 'building.depth')).toHaveLength(0);
    expect(lines.filter((l) => l.id === 'total.width')).toHaveLength(1);
    expect(lines.filter((l) => l.id === 'total.depth')).toHaveLength(1);
  });

  it('suppresses only the per-building line whose own value equals the total', () => {
    // gebouw 3.6×3.1, overkapping 4.2×4.3 side-by-side: total depth = 4.3.
    // Overkapping.depth (4.3) duplicates the total → drop it.
    // Gebouw.depth (3.1) is distinct → keep it.
    const a = makeBuilding({ id: 'a', type: 'berging', position: [0, 0], dimensions: { width: 3.6, depth: 3.1, height: 2.6 } });
    const b = makeBuilding({ id: 'b', type: 'overkapping', position: [3.6, 0], dimensions: { width: 4.2, depth: 4.3, height: 2.6 } });
    const lines = computePlanDimensions({ buildings: [a, b], connections: [] });
    expect(lines.filter((l) => l.id === 'building.width')).toHaveLength(2);
    const depthLines = lines.filter((l) => l.id === 'building.depth');
    expect(depthLines).toHaveLength(1);
    expect(depthLines[0].groupKey).toBe('building:a');
    expect(lines.filter((l) => l.id === 'total.depth')).toHaveLength(1);
  });

  it('emits muur.length regardless of structural count', () => {
    const muur = makeBuilding({
      id: 'm', type: 'muur', position: [0, 0],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'horizontal',
      walls: { front: { ...BLANK_WALL } },
    });
    const lines = computePlanDimensions({ buildings: [muur], connections: [] });
    expect(lines.filter((l) => l.id === 'muur.length')).toHaveLength(1);
  });

  it('total bounding box spans across non-adjacent structurals', () => {
    const a = makeBuilding({ id: 'a', type: 'berging', position: [0, 0], dimensions: { width: 4, depth: 3, height: 2.6 } });
    const b = makeBuilding({ id: 'b', type: 'berging', position: [10, 5], dimensions: { width: 4, depth: 3, height: 2.6 } });
    const lines = computePlanDimensions({ buildings: [a, b], connections: [] });
    const totalW = lines.find((l) => l.id === 'total.width')!;
    expect(totalW.label).toContain('14.0m');
    const totalD = lines.find((l) => l.id === 'total.depth')!;
    expect(totalD.label).toContain('8.0m');
  });
});

describe('computePlanDimensions — config gates', () => {
  // Buildings spread on both axes so neither per-building width nor
  // depth equals its respective total — the redundancy guard then
  // leaves both pairs intact and the config gate is what we're testing.
  const a = makeBuilding({ id: 'a', type: 'berging', position: [0, 0], dimensions: { width: 3, depth: 2, height: 2.6 } });
  const b = makeBuilding({ id: 'b', type: 'berging', position: [5, 5], dimensions: { width: 4, depth: 3, height: 2.6 } });

  type Patch = {
    building?: Partial<DimensionConfig['building']>;
    total?: Partial<DimensionConfig['total']>;
    muur?: Partial<DimensionConfig['muur']>;
    wall?: {
      openingGaps?: Partial<DimensionConfig['wall']['openingGaps']>;
      openingHeights?: Partial<DimensionConfig['wall']['openingHeights']>;
    };
  };
  function override(patch: Patch): DimensionConfig {
    return {
      building: { ...DIMENSION_CONFIG.building, ...(patch.building ?? {}) },
      total:    { ...DIMENSION_CONFIG.total,    ...(patch.total    ?? {}) },
      muur:     { ...DIMENSION_CONFIG.muur,     ...(patch.muur     ?? {}) },
      wall:     {
        openingGaps: {
          ...DIMENSION_CONFIG.wall.openingGaps,
          ...(patch.wall?.openingGaps ?? {}),
        },
        openingHeights: {
          ...DIMENSION_CONFIG.wall.openingHeights,
          ...(patch.wall?.openingHeights ?? {}),
        },
      },
    };
  }

  it('config.building.width = false suppresses building.width even with 2 structurals', () => {
    const cfg = override({ building: { width: false, depth: true } });
    const lines = computePlanDimensions({ buildings: [a, b], connections: [], config: cfg });
    expect(lines.filter((l) => l.id === 'building.width')).toHaveLength(0);
    expect(lines.filter((l) => l.id === 'building.depth')).toHaveLength(2);
  });

  it('config.muur.length = false suppresses muur.length even when muurs exist', () => {
    const muur = makeBuilding({
      id: 'm', type: 'muur', position: [0, 0],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'horizontal',
      walls: { front: { ...BLANK_WALL } },
    });
    const cfg = override({ muur: { length: false } });
    const lines = computePlanDimensions({ buildings: [muur], connections: [], config: cfg });
    expect(lines.filter((l) => l.id === 'muur.length')).toHaveLength(0);
  });

  it('config.wall.openingGaps.plan = false suppresses plan gap chains', () => {
    const c = makeBuilding({
      id: 'c', type: 'berging', position: [0, 0],
      dimensions: { width: 6, depth: 4, height: 2.6 },
      walls: { front: wallWithDoor, back: { ...BLANK_WALL }, left: { ...BLANK_WALL }, right: { ...BLANK_WALL } },
    });
    const cfg = override({ wall: { openingGaps: { plan: false, elevation: true } } });
    const lines = computePlanDimensions({ buildings: [c], connections: [], config: cfg });
    expect(lines.filter((l) => l.id === 'wall.openingGaps.plan')).toHaveLength(0);
  });

  it('omitting config uses DIMENSION_CONFIG defaults', () => {
    const c = makeBuilding({
      id: 'c', type: 'berging', position: [0, 0],
      dimensions: { width: 6, depth: 4, height: 2.6 },
      walls: { front: wallWithDoor, back: { ...BLANK_WALL }, left: { ...BLANK_WALL }, right: { ...BLANK_WALL } },
    });
    const lines = computePlanDimensions({ buildings: [c], connections: [] });
    expect(lines.filter((l) => l.id === 'wall.openingGaps.plan').length).toBeGreaterThan(0);
  });
});

describe('computePlanDimensions — opening gap chains', () => {
  it('emits 0 segments for a wall with no openings', () => {
    const c = makeBuilding({
      id: 'c', type: 'berging', position: [0, 0],
      dimensions: { width: 6, depth: 4, height: 2.6 },
      walls: { front: { ...BLANK_WALL }, back: { ...BLANK_WALL }, left: { ...BLANK_WALL }, right: { ...BLANK_WALL } },
    });
    const lines = computePlanDimensions({ buildings: [c], connections: [] });
    expect(lines.filter((l) => l.id === 'wall.openingGaps.plan')).toHaveLength(0);
  });

  it('emits 2 segments for a wall with 1 door (left edge → door, door → right edge)', () => {
    const c = makeBuilding({
      id: 'c', type: 'berging', position: [0, 0],
      dimensions: { width: 6, depth: 4, height: 2.6 },
      walls: { front: wallWithDoor, back: { ...BLANK_WALL }, left: { ...BLANK_WALL }, right: { ...BLANK_WALL } },
    });
    const lines = computePlanDimensions({ buildings: [c], connections: [] });
    expect(lines.filter((l) => l.id === 'wall.openingGaps.plan')).toHaveLength(2);
  });

  it('emits 4 segments for a wall with 1 door + 2 windows (sorted by position)', () => {
    const c = makeBuilding({
      id: 'c', type: 'berging', position: [0, 0],
      dimensions: { width: 8, depth: 4, height: 2.6 },
      walls: { front: wallWithTwoWindowsAndDoor, back: { ...BLANK_WALL }, left: { ...BLANK_WALL }, right: { ...BLANK_WALL } },
    });
    const lines = computePlanDimensions({ buildings: [c], connections: [] });
    expect(lines.filter((l) => l.id === 'wall.openingGaps.plan')).toHaveLength(4);
  });

  // Convention: 'front' = +Y side (= position[1] + depth),
  //             'back'  = −Y side (= position[1]).
  // Mirrors SchematicWalls.tsx::getWallGeometries.
  it('front-wall plan-gap segments lie on y = position[1] + depth', () => {
    const c = makeBuilding({
      id: 'c', type: 'berging', position: [0, 0],
      dimensions: { width: 6, depth: 4, height: 2.6 },
      walls: { front: wallWithDoor, back: { ...BLANK_WALL }, left: { ...BLANK_WALL }, right: { ...BLANK_WALL } },
    });
    const lines = computePlanDimensions({ buildings: [c], connections: [] });
    const gaps = lines.filter((l) => l.id === 'wall.openingGaps.plan');
    for (const g of gaps) {
      expect(g.y1).toBeCloseTo(4, 6);
      expect(g.y2).toBeCloseTo(4, 6);
    }
  });

  it('back-wall plan-gap segments lie on y = position[1]', () => {
    const c = makeBuilding({
      id: 'c', type: 'berging', position: [0, 0],
      dimensions: { width: 6, depth: 4, height: 2.6 },
      walls: { front: { ...BLANK_WALL }, back: wallWithDoor, left: { ...BLANK_WALL }, right: { ...BLANK_WALL } },
    });
    const lines = computePlanDimensions({ buildings: [c], connections: [] });
    const gaps = lines.filter((l) => l.id === 'wall.openingGaps.plan');
    for (const g of gaps) {
      expect(g.y1).toBeCloseTo(0, 6);
      expect(g.y2).toBeCloseTo(0, 6);
    }
  });

  it('left-wall plan-gap segments lie on x = building.left', () => {
    const c = makeBuilding({
      id: 'c', type: 'berging', position: [0, 0],
      dimensions: { width: 6, depth: 4, height: 2.6 },
      walls: { front: { ...BLANK_WALL }, back: { ...BLANK_WALL }, left: wallWithDoor, right: { ...BLANK_WALL } },
    });
    const lines = computePlanDimensions({ buildings: [c], connections: [] });
    const gaps = lines.filter((l) => l.id === 'wall.openingGaps.plan');
    for (const g of gaps) {
      expect(g.x1).toBeCloseTo(0, 6);
      expect(g.x2).toBeCloseTo(0, 6);
    }
  });

  it('right-wall plan-gap segments lie on x = building.right', () => {
    const c = makeBuilding({
      id: 'c', type: 'berging', position: [0, 0],
      dimensions: { width: 6, depth: 4, height: 2.6 },
      walls: { front: { ...BLANK_WALL }, back: { ...BLANK_WALL }, left: { ...BLANK_WALL }, right: wallWithDoor },
    });
    const lines = computePlanDimensions({ buildings: [c], connections: [] });
    const gaps = lines.filter((l) => l.id === 'wall.openingGaps.plan');
    for (const g of gaps) {
      expect(g.x1).toBeCloseTo(6, 6);
      expect(g.x2).toBeCloseTo(6, 6);
    }
  });

  it('horizontal-muur plan-gap segments lie on the muur centreline along y', () => {
    const muur = makeBuilding({
      id: 'm', type: 'muur', position: [0, 0],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'horizontal',
      walls: { front: wallWithDoor },
    });
    const lines = computePlanDimensions({ buildings: [muur], connections: [] });
    const gaps = lines.filter((l) => l.id === 'wall.openingGaps.plan');
    expect(gaps.length).toBeGreaterThan(0);
    for (const g of gaps) {
      expect(g.y1).toBeCloseTo(0.075, 6);
      expect(g.y2).toBeCloseTo(0.075, 6);
    }
  });

  it('vertical-muur plan-gap segments lie on the muur centreline along x', () => {
    const muur = makeBuilding({
      id: 'm', type: 'muur', position: [0, 0],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'vertical',
      walls: { front: wallWithDoor },
    });
    const lines = computePlanDimensions({ buildings: [muur], connections: [] });
    const gaps = lines.filter((l) => l.id === 'wall.openingGaps.plan');
    expect(gaps.length).toBeGreaterThan(0);
    for (const g of gaps) {
      expect(g.x1).toBeCloseTo(0.075, 6);
      expect(g.x2).toBeCloseTo(0.075, 6);
    }
  });
});

describe('computePlanDimensions — groupKey tagging', () => {
  it("per-building lines tagged 'building:<id>'", () => {
    const a = makeBuilding({ id: 'a', type: 'berging', position: [0, 0], dimensions: { width: 4, depth: 3, height: 2.6 } });
    const b = makeBuilding({ id: 'b', type: 'berging', position: [4, 0], dimensions: { width: 4, depth: 3, height: 2.6 } });
    const lines = computePlanDimensions({ buildings: [a, b], connections: [] });
    const perBuilding = lines.filter((l) => l.id === 'building.width' || l.id === 'building.depth');
    for (const l of perBuilding) {
      expect(l.groupKey).toMatch(/^building:(a|b)$/);
    }
  });

  it("total lines tagged 'total' (not 'building:<id>')", () => {
    const a = makeBuilding({ id: 'a', type: 'berging', position: [0, 0], dimensions: { width: 4, depth: 3, height: 2.6 } });
    const b = makeBuilding({ id: 'b', type: 'berging', position: [4, 0], dimensions: { width: 4, depth: 3, height: 2.6 } });
    const lines = computePlanDimensions({ buildings: [a, b], connections: [] });
    const totals = lines.filter((l) => l.id === 'total.width' || l.id === 'total.depth');
    for (const l of totals) {
      expect(l.groupKey).toBe('total');
    }
  });

  it("opening-gap segments tagged 'wall:<buildingId>:<wallId>'", () => {
    const c = makeBuilding({
      id: 'c', type: 'berging', position: [0, 0],
      dimensions: { width: 6, depth: 4, height: 2.6 },
      walls: { front: wallWithDoor, back: { ...BLANK_WALL }, left: { ...BLANK_WALL }, right: { ...BLANK_WALL } },
    });
    const lines = computePlanDimensions({ buildings: [c], connections: [] });
    const gaps = lines.filter((l) => l.id === 'wall.openingGaps.plan');
    for (const g of gaps) {
      expect(g.groupKey).toBe('wall:c:front');
    }
  });

  it("muur length tagged 'muur:<id>'", () => {
    const muur = makeBuilding({
      id: 'm', type: 'muur', position: [0, 0],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'horizontal',
      walls: { front: { ...BLANK_WALL } },
    });
    const lines = computePlanDimensions({ buildings: [muur], connections: [] });
    const lengthLine = lines.find((l) => l.id === 'muur.length')!;
    expect(lengthLine.groupKey).toBe('muur:m');
  });
});

describe('computeElevationDimensions', () => {
  it('returns [] when the wall has no openings', () => {
    const c = makeBuilding({
      id: 'c', type: 'berging', position: [0, 0],
      dimensions: { width: 6, depth: 4, height: 2.6 },
      walls: { front: { ...BLANK_WALL }, back: { ...BLANK_WALL }, left: { ...BLANK_WALL }, right: { ...BLANK_WALL } },
    });
    expect(computeElevationDimensions({ building: c, wallId: 'front', defaultHeight: 2.6 })).toEqual([]);
  });

  it('returns 3 gap segments for a wall with 1 door + 1 window', () => {
    const c = makeBuilding({
      id: 'c', type: 'berging', position: [0, 0],
      dimensions: { width: 6, depth: 4, height: 2.6 },
      walls: { front: wallWithWindowAndDoor, back: { ...BLANK_WALL }, left: { ...BLANK_WALL }, right: { ...BLANK_WALL } },
    });
    const lines = computeElevationDimensions({ building: c, wallId: 'front', defaultHeight: 2.6 });
    expect(lines.filter(l => l.id === 'wall.openingGaps.elevation')).toHaveLength(3);
  });

  it('respects config.wall.openingGaps.elevation = false', () => {
    const c = makeBuilding({
      id: 'c', type: 'berging', position: [0, 0],
      dimensions: { width: 6, depth: 4, height: 2.6 },
      walls: { front: wallWithDoor, back: { ...BLANK_WALL }, left: { ...BLANK_WALL }, right: { ...BLANK_WALL } },
    });
    const cfg: DimensionConfig = {
      ...DIMENSION_CONFIG,
      wall: {
        openingGaps: { plan: true, elevation: false },
        openingHeights: { elevation: false },
      },
    };
    expect(computeElevationDimensions({ building: c, wallId: 'front', defaultHeight: 2.6, config: cfg })).toEqual([]);
  });

  it('elevation gap segments are 1D (y1=y2=0) and ordered start→end', () => {
    const c = makeBuilding({
      id: 'c', type: 'berging', position: [0, 0],
      dimensions: { width: 6, depth: 4, height: 2.6 },
      walls: { front: wallWithDoor, back: { ...BLANK_WALL }, left: { ...BLANK_WALL }, right: { ...BLANK_WALL } },
    });
    const lines = computeElevationDimensions({ building: c, wallId: 'front', defaultHeight: 2.6 });
    const gaps = lines.filter(l => l.id === 'wall.openingGaps.elevation');
    for (const l of gaps) {
      expect(l.y1).toBe(0);
      expect(l.y2).toBe(0);
      expect(l.x1).toBeLessThan(l.x2);
    }
    // Wall length 6m; chain spans 0..6.
    expect(gaps[0].x1).toBeCloseTo(0, 6);
    expect(gaps[gaps.length - 1].x2).toBeCloseTo(6, 6);
  });

  it('handles a vertical muur (wallLength comes from dimensions.width)', () => {
    const muur = makeBuilding({
      id: 'm', type: 'muur', position: [0, 0],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'vertical',
      walls: { front: wallWithDoor },
    });
    const lines = computeElevationDimensions({ building: muur, wallId: 'front', defaultHeight: 2.6 });
    const gaps = lines.filter(l => l.id === 'wall.openingGaps.elevation');
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps[gaps.length - 1].x2).toBeCloseTo(3, 6);
  });

  it('emits opening-height segments for a window with non-zero sill', () => {
    const c = makeBuilding({
      id: 'c', type: 'berging', position: [0, 0],
      dimensions: { width: 6, depth: 4, height: 2.6 },
      walls: {
        front: {
          ...BLANK_WALL,
          windows: [{ id: 'w1', position: 0.5, width: 1.2, height: 1.2, sillHeight: 0.9 }],
        },
        back: { ...BLANK_WALL },
        left: { ...BLANK_WALL },
        right: { ...BLANK_WALL },
      },
    });
    const lines = computeElevationDimensions({ building: c, wallId: 'front', defaultHeight: 2.6 });
    const heights = lines.filter(l => l.id === 'wall.openingHeights.elevation');
    // below segment (sill 0.9) + above segment (2.6 - 0.9 - 1.2 = 0.5)
    expect(heights).toHaveLength(2);
    const labels = heights.map(h => h.label).sort();
    expect(labels).toEqual(['0.50m', '0.90m']);
  });

  it('emits only the above-segment for a door (door bottom is the baseline)', () => {
    const c = makeBuilding({
      id: 'c', type: 'berging', position: [0, 0],
      dimensions: { width: 6, depth: 4, height: 2.6 },
      walls: { front: wallWithDoor, back: { ...BLANK_WALL }, left: { ...BLANK_WALL }, right: { ...BLANK_WALL } },
    });
    const lines = computeElevationDimensions({ building: c, wallId: 'front', defaultHeight: 2.6 });
    const heights = lines.filter(l => l.id === 'wall.openingHeights.elevation');
    expect(heights).toHaveLength(1);
    expect(heights[0].groupKey).toBe('wall:c:front:door:above');
    // Door height = min(2.1, 2.6 - 0.05) = 2.1 → above = 0.5
    expect(heights[0].label).toBe('0.50m');
  });

  it('respects config.wall.openingHeights.elevation = false', () => {
    const c = makeBuilding({
      id: 'c', type: 'berging', position: [0, 0],
      dimensions: { width: 6, depth: 4, height: 2.6 },
      walls: { front: wallWithWindowAndDoor, back: { ...BLANK_WALL }, left: { ...BLANK_WALL }, right: { ...BLANK_WALL } },
    });
    const cfg: DimensionConfig = {
      ...DIMENSION_CONFIG,
      wall: {
        openingGaps: { plan: true, elevation: true },
        openingHeights: { elevation: false },
      },
    };
    const lines = computeElevationDimensions({ building: c, wallId: 'front', defaultHeight: 2.6, config: cfg });
    expect(lines.filter(l => l.id === 'wall.openingHeights.elevation')).toHaveLength(0);
  });
});
