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

  it('omits per-building and total lines when only one structural is present', () => {
    const cfg = makeConfig();
    const lines = computePlanDimensions({ buildings: cfg.buildings, connections: cfg.connections });
    expect(lines.filter((l) => l.id === 'building.width')).toHaveLength(0);
    expect(lines.filter((l) => l.id === 'building.depth')).toHaveLength(0);
    expect(lines.filter((l) => l.id === 'total.width')).toHaveLength(0);
    expect(lines.filter((l) => l.id === 'total.depth')).toHaveLength(0);
  });

  it('emits per-building and total lines when 2+ structurals are present', () => {
    const a = makeBuilding({ id: 'a', type: 'berging', position: [0, 0], dimensions: { width: 4, depth: 3, height: 2.6 } });
    const b = makeBuilding({ id: 'b', type: 'berging', position: [4, 0], dimensions: { width: 4, depth: 3, height: 2.6 } });
    const lines = computePlanDimensions({ buildings: [a, b], connections: [] });
    expect(lines.filter((l) => l.id === 'building.width')).toHaveLength(2);
    expect(lines.filter((l) => l.id === 'building.depth')).toHaveLength(2);
    expect(lines.filter((l) => l.id === 'total.width')).toHaveLength(1);
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
  const a = makeBuilding({ id: 'a', type: 'berging', position: [0, 0], dimensions: { width: 4, depth: 3, height: 2.6 } });
  const b = makeBuilding({ id: 'b', type: 'berging', position: [4, 0], dimensions: { width: 4, depth: 3, height: 2.6 } });

  function override(patch: Partial<DimensionConfig>): DimensionConfig {
    return {
      building: { ...DIMENSION_CONFIG.building, ...(patch.building ?? {}) },
      total:    { ...DIMENSION_CONFIG.total,    ...(patch.total    ?? {}) },
      muur:     { ...DIMENSION_CONFIG.muur,     ...(patch.muur     ?? {}) },
      wall:     {
        openingGaps: {
          ...DIMENSION_CONFIG.wall.openingGaps,
          ...(patch.wall?.openingGaps ?? {}),
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

  it('returns 3 segments for a wall with 1 door + 1 window', () => {
    const c = makeBuilding({
      id: 'c', type: 'berging', position: [0, 0],
      dimensions: { width: 6, depth: 4, height: 2.6 },
      walls: { front: wallWithWindowAndDoor, back: { ...BLANK_WALL }, left: { ...BLANK_WALL }, right: { ...BLANK_WALL } },
    });
    const lines = computeElevationDimensions({ building: c, wallId: 'front', defaultHeight: 2.6 });
    expect(lines).toHaveLength(3);
  });

  it('respects config.wall.openingGaps.elevation = false', () => {
    const c = makeBuilding({
      id: 'c', type: 'berging', position: [0, 0],
      dimensions: { width: 6, depth: 4, height: 2.6 },
      walls: { front: wallWithDoor, back: { ...BLANK_WALL }, left: { ...BLANK_WALL }, right: { ...BLANK_WALL } },
    });
    const cfg: DimensionConfig = {
      ...DIMENSION_CONFIG,
      wall: { openingGaps: { plan: true, elevation: false } },
    };
    expect(computeElevationDimensions({ building: c, wallId: 'front', defaultHeight: 2.6, config: cfg })).toEqual([]);
  });

  it('elevation segments are 1D (y1=y2=0) and ordered start→end', () => {
    const c = makeBuilding({
      id: 'c', type: 'berging', position: [0, 0],
      dimensions: { width: 6, depth: 4, height: 2.6 },
      walls: { front: wallWithDoor, back: { ...BLANK_WALL }, left: { ...BLANK_WALL }, right: { ...BLANK_WALL } },
    });
    const lines = computeElevationDimensions({ building: c, wallId: 'front', defaultHeight: 2.6 });
    for (const l of lines) {
      expect(l.y1).toBe(0);
      expect(l.y2).toBe(0);
      expect(l.x1).toBeLessThan(l.x2);
    }
    // Wall length 6m; chain spans 0..6.
    expect(lines[0].x1).toBeCloseTo(0, 6);
    expect(lines[lines.length - 1].x2).toBeCloseTo(6, 6);
  });

  it('handles a vertical muur (wallLength comes from dimensions.width)', () => {
    const muur = makeBuilding({
      id: 'm', type: 'muur', position: [0, 0],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'vertical',
      walls: { front: wallWithDoor },
    });
    const lines = computeElevationDimensions({ building: muur, wallId: 'front', defaultHeight: 2.6 });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[lines.length - 1].x2).toBeCloseTo(3, 6);
  });
});
