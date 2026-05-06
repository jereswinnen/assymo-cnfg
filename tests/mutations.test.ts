import { describe, it, expect } from 'vite-plus/test';
import {
  addBuilding,
  makeInitialConfig,
  pasteBuildings,
  PASTE_OFFSET,
  removeBuilding,
  setBuildingPrimaryMaterial,
  setHeightOverride,
  setRoofType,
  toggleConnectionOpen,
  updateBuildingDimensions,
  updateBuildingFloor,
  updateBuildingWall,
  updateGateConfig,
} from '@/domain/config';
import { defaultGateConfig } from '@/domain/building';
import type { ProductBuildingDefaults } from '@/domain/catalog';
import { makeBuilding, makeConfig } from './fixtures';

describe('addBuilding', () => {
  it('appends a new building and returns its id', () => {
    const cfg = makeInitialConfig();
    const { cfg: next, id } = addBuilding(cfg, 'paal');
    expect(next.buildings).toHaveLength(cfg.buildings.length + 1);
    expect(next.buildings.at(-1)?.id).toBe(id);
    expect(next.buildings.at(-1)?.type).toBe('paal');
  });

  it('places new building to the right of existing ones when no position given', () => {
    const cfg = makeInitialConfig();
    const { cfg: next } = addBuilding(cfg, 'berging');
    const last = next.buildings.at(-1)!;
    const prevMax = Math.max(
      ...cfg.buildings.map((b) => b.position[0] + b.dimensions.width),
    );
    expect(last.position[0]).toBeGreaterThanOrEqual(prevMax);
  });

  it('respects an explicit position', () => {
    const cfg = makeInitialConfig();
    const { cfg: next } = addBuilding(cfg, 'paal', [5, 7]);
    expect(next.buildings.at(-1)?.position).toEqual([5, 7]);
  });
});

describe('removeBuilding', () => {
  it('removes the last structural building (scene becomes empty)', () => {
    const cfg = makeConfig();
    const next = removeBuilding(cfg, cfg.buildings[0].id);
    expect(next.buildings).toHaveLength(0);
  });

  it('returns the same config when the id does not exist', () => {
    const cfg = makeConfig();
    const next = removeBuilding(cfg, 'does-not-exist');
    expect(next).toBe(cfg);
  });

  it('removes a pole and any connections referencing it', () => {
    const cfg = makeConfig({
      buildings: [
        makeBuilding({ id: 'b1', type: 'berging' }),
        makeBuilding({ id: 'p1', type: 'paal' }),
      ],
      connections: [
        { buildingAId: 'b1', sideA: 'right', buildingBId: 'p1', sideB: 'left', isOpen: false },
      ],
    });
    const next = removeBuilding(cfg, 'p1');
    expect(next.buildings.some((b) => b.id === 'p1')).toBe(false);
    expect(next.connections).toHaveLength(0);
  });
});

describe('setBuildingPrimaryMaterial', () => {
  it('propagates material across snap-connected buildings', () => {
    const cfg = makeConfig({
      buildings: [
        makeBuilding({ id: 'a', type: 'berging', primaryMaterialId: 'wood' }),
        makeBuilding({ id: 'b', type: 'overkapping', primaryMaterialId: 'wood' }),
      ],
      connections: [
        { buildingAId: 'a', sideA: 'right', buildingBId: 'b', sideB: 'left', isOpen: false },
      ],
    });
    const next = setBuildingPrimaryMaterial(cfg, 'a', 'glass');
    expect(next.buildings.find((b) => b.id === 'a')?.primaryMaterialId).toBe('glass');
    expect(next.buildings.find((b) => b.id === 'b')?.primaryMaterialId).toBe('glass');
  });

  it('syncs roof.trimMaterialId with the new primary', () => {
    const cfg = makeConfig();
    const next = setBuildingPrimaryMaterial(cfg, cfg.buildings[0].id, 'glass');
    expect(next.roof.trimMaterialId).toBe('glass');
  });

  it('does not propagate to unconnected buildings', () => {
    const cfg = makeConfig({
      buildings: [
        makeBuilding({ id: 'a', type: 'berging', primaryMaterialId: 'wood' }),
        makeBuilding({ id: 'b', type: 'berging', position: [10, 0], primaryMaterialId: 'wood' }),
      ],
    });
    const next = setBuildingPrimaryMaterial(cfg, 'a', 'glass');
    expect(next.buildings.find((b) => b.id === 'b')?.primaryMaterialId).toBe('wood');
  });
});

describe('updateBuildingDimensions', () => {
  it('merges the patch without touching other fields', () => {
    const cfg = makeConfig();
    const id = cfg.buildings[0].id;
    const next = updateBuildingDimensions(cfg, id, { width: 5 });
    const b = next.buildings.find((x) => x.id === id)!;
    expect(b.dimensions.width).toBe(5);
    expect(b.dimensions.depth).toBe(cfg.buildings[0].dimensions.depth);
    expect(b.dimensions.height).toBe(cfg.buildings[0].dimensions.height);
  });

  it('does not mutate the input config', () => {
    const cfg = makeConfig();
    const snapshot = JSON.stringify(cfg);
    updateBuildingDimensions(cfg, cfg.buildings[0].id, { width: 5 });
    expect(JSON.stringify(cfg)).toBe(snapshot);
  });
});

describe('updateBuildingWall', () => {
  it('merges a wall patch over the defaults when the wall did not exist', () => {
    const cfg = makeConfig({
      buildings: [makeBuilding({ id: 'b1', type: 'berging', walls: {} })],
    });
    const next = updateBuildingWall(cfg, 'b1', 'front', { hasDoor: true });
    const wall = next.buildings[0].walls.front;
    expect(wall.hasDoor).toBe(true);
    expect(wall.doorSize).toBe('enkel');
  });
});

describe('toggleConnectionOpen', () => {
  it('flips the matching connection regardless of A/B ordering', () => {
    const cfg = makeConfig({
      connections: [
        { buildingAId: 'a', sideA: 'right', buildingBId: 'b', sideB: 'left', isOpen: false },
      ],
    });
    const next = toggleConnectionOpen(cfg, 'b', 'left', 'a', 'right');
    expect(next.connections[0].isOpen).toBe(true);
  });
});

describe('setRoofType', () => {
  it('switches flat → pitched with a sensible covering (dakpannen) and non-zero pitch', () => {
    const cfg = makeConfig();
    const next = setRoofType(cfg, 'pitched');
    expect(next.roof.type).toBe('pitched');
    expect(next.roof.pitch).toBeGreaterThan(0);
    expect(next.roof.coveringId).toBe('dakpannen');
  });

  it('switches pitched → flat with epdm covering and zero pitch', () => {
    const cfg = makeConfig({
      roof: {
        type: 'pitched',
        pitch: 30,
        coveringId: 'dakpannen',
        trimMaterialId: 'wood',
        insulation: true,
        insulationThickness: 150,
        hasSkylight: false,
        fasciaHeight: 0.36,
        fasciaOverhang: 0,
      },
    });
    const next = setRoofType(cfg, 'flat');
    expect(next.roof.type).toBe('flat');
    expect(next.roof.pitch).toBe(0);
    expect(next.roof.coveringId).toBe('epdm');
  });
});

describe('updateBuildingFloor', () => {
  it('merges the floor patch', () => {
    const cfg = makeConfig();
    const id = cfg.buildings[0].id;
    const next = updateBuildingFloor(cfg, id, { materialId: 'hout' });
    expect(next.buildings[0].floor.materialId).toBe('hout');
  });
});

describe('setHeightOverride', () => {
  it('sets a numeric override', () => {
    const cfg = makeConfig();
    const id = cfg.buildings[0].id;
    const next = setHeightOverride(cfg, id, 2.8);
    expect(next.buildings[0].heightOverride).toBe(2.8);
  });

  it('clears the override when passed null', () => {
    const cfg = makeConfig({
      buildings: [{ ...makeConfig().buildings[0], heightOverride: 2.8 }],
    });
    const id = cfg.buildings[0].id;
    const next = setHeightOverride(cfg, id, null);
    expect(next.buildings[0].heightOverride).toBeNull();
  });
});

describe('pasteBuildings', () => {
  it('appends a copy with a fresh id and the default offset', () => {
    const cfg = makeConfig();
    const source = cfg.buildings[0];
    const { cfg: next, ids } = pasteBuildings(cfg, [source]);
    expect(next.buildings).toHaveLength(cfg.buildings.length + 1);
    expect(ids).toHaveLength(1);
    expect(ids[0]).not.toBe(source.id);
    const pasted = next.buildings.at(-1)!;
    expect(pasted.id).toBe(ids[0]);
    expect(pasted.position).toEqual([
      source.position[0] + PASTE_OFFSET[0],
      source.position[1] + PASTE_OFFSET[1],
    ]);
    expect(pasted.dimensions).toEqual(source.dimensions);
    expect(pasted.primaryMaterialId).toBe(source.primaryMaterialId);
  });

  it('strips attachedTo and sourceProductId so paste lands as a free primitive', () => {
    const cfg = makeConfig({
      buildings: [
        makeBuilding({
          id: 'p',
          type: 'paal',
          attachedTo: 'b1',
          sourceProductId: 'kit-1',
        }),
      ],
    });
    const { cfg: next } = pasteBuildings(cfg, [cfg.buildings[0]]);
    const pasted = next.buildings.at(-1)!;
    expect(pasted.attachedTo).toBeUndefined();
    expect(pasted.sourceProductId).toBeUndefined();
  });

  it('preserves relative positions when pasting multiple', () => {
    const a = makeBuilding({ id: 'a', type: 'paal', position: [2, 3] });
    const b = makeBuilding({ id: 'b', type: 'paal', position: [5, 7] });
    const cfg = makeConfig({ buildings: [a, b] });
    const { cfg: next } = pasteBuildings(cfg, [a, b]);
    const pasted = next.buildings.slice(-2);
    expect(pasted[0].position).toEqual([2 + PASTE_OFFSET[0], 3 + PASTE_OFFSET[1]]);
    expect(pasted[1].position).toEqual([5 + PASTE_OFFSET[0], 7 + PASTE_OFFSET[1]]);
    const dxBefore = b.position[0] - a.position[0];
    const dxAfter = pasted[1].position[0] - pasted[0].position[0];
    expect(dxAfter).toBe(dxBefore);
  });

  it('does not mutate the source entity', () => {
    const cfg = makeConfig();
    const source = cfg.buildings[0];
    const sourceWalls = source.walls;
    const { cfg: next } = pasteBuildings(cfg, [source]);
    expect(source.walls).toBe(sourceWalls);
    const pasted = next.buildings.at(-1)!;
    expect(pasted.walls).not.toBe(source.walls);
  });

  it('does not duplicate snap connections', () => {
    const a = makeBuilding({ id: 'a', type: 'berging' });
    const b = makeBuilding({ id: 'b', type: 'berging' });
    const cfg = makeConfig({
      buildings: [a, b],
      connections: [{ buildingAId: 'a', sideA: 'right', buildingBId: 'b', sideB: 'left', isOpen: false }],
    });
    const { cfg: next } = pasteBuildings(cfg, [a]);
    expect(next.connections).toHaveLength(cfg.connections.length);
  });

  it('respects a custom offset', () => {
    const cfg = makeConfig();
    const source = cfg.buildings[0];
    const { cfg: next } = pasteBuildings(cfg, [source], [3, -2]);
    const pasted = next.buildings.at(-1)!;
    expect(pasted.position).toEqual([source.position[0] + 3, source.position[1] - 2]);
  });
});

describe('addBuilding (poort)', () => {
  it('spawns a poort with default gateConfig and the supplied position', () => {
    const cfg = makeInitialConfig();
    const { cfg: next, id } = addBuilding(cfg, 'poort', [3, 4]);
    const b = next.buildings.find((x) => x.id === id)!;
    expect(b.type).toBe('poort');
    expect(b.position).toEqual([3, 4]);
    expect(b.gateConfig).toEqual(defaultGateConfig());
  });

  it('mints distinct ids across consecutive poort spawns', () => {
    const cfg = makeInitialConfig();
    const { cfg: c1, id: id1 } = addBuilding(cfg, 'poort');
    const { id: id2 } = addBuilding(c1, 'poort');
    expect(id1).not.toBe(id2);
  });

  it('applies productDefaults.gateConfig + dimensions and stamps sourceProductId', () => {
    const cfg = makeInitialConfig();
    const { cfg: next, id } = addBuilding(cfg, 'poort', [1, 2], {
      sourceProductId: 'gate-kit-1',
      type: 'poort',
      dimensions: { width: 3.0, height: 2.4 },
      gateConfig: { partCount: 2, motorized: true },
    });
    const b = next.buildings.find((x) => x.id === id)!;
    const baseline = defaultGateConfig();
    expect(b.type).toBe('poort');
    expect(b.position).toEqual([1, 2]);
    expect(b.sourceProductId).toBe('gate-kit-1');
    expect(b.gateConfig?.partCount).toBe(2);
    expect(b.gateConfig?.motorized).toBe(true);
    expect(b.gateConfig?.swingDirection).toBe(baseline.swingDirection);
    expect(b.gateConfig?.materialId).toBe(baseline.materialId);
    expect(b.dimensions.width).toBeCloseTo(3.0, 6);
    expect(b.dimensions.height).toBeCloseTo(2.4, 6);
  });

  it('falls back to defaultGateConfig when productDefaults omits gateConfig', () => {
    const cfg = makeInitialConfig();
    const { cfg: next, id } = addBuilding(cfg, 'poort', [0, 0], {
      sourceProductId: 'gate-kit-2',
      type: 'poort',
      dimensions: {},
    });
    const b = next.buildings.find((x) => x.id === id)!;
    expect(b.gateConfig).toEqual(defaultGateConfig());
    expect(b.sourceProductId).toBe('gate-kit-2');
  });

  it('pins productDefaults.dimensions.height onto heightOverride for poort (heightSource=override)', () => {
    // Without this, the renderer's getEffectiveHeight = heightOverride ??
    // defaultHeight would silently fall back to the scene defaultHeight, and
    // the product's specified height would be dead code.
    const cfg = makeInitialConfig();
    const { cfg: next, id } = addBuilding(cfg, 'poort', [0, 0], {
      sourceProductId: 'gate-kit-3',
      type: 'poort',
      dimensions: { width: 2.0, height: 1.2 },
    });
    const b = next.buildings.find((x) => x.id === id)!;
    expect(b.heightOverride).toBeCloseTo(1.2, 6);
    expect(b.dimensions.height).toBeCloseTo(1.2, 6);
  });
});

describe('addBuilding — product height routing', () => {
  it('updates scene defaultHeight from productDefaults for structural kinds (heightSource=default), but only on first spawn', () => {
    const cfg = makeInitialConfig();
    expect(cfg.defaultHeight).toBeCloseTo(2.6, 6);

    const { cfg: c1 } = addBuilding(cfg, 'overkapping', [0, 0], {
      sourceProductId: 'kit-1',
      type: 'overkapping',
      dimensions: { width: 4, depth: 3, height: 2.4 },
    });
    expect(c1.defaultHeight).toBeCloseTo(2.4, 6);

    // Second spawn does NOT mutate scene defaultHeight.
    const { cfg: c2 } = addBuilding(c1, 'overkapping', [10, 0], {
      sourceProductId: 'kit-2',
      type: 'overkapping',
      dimensions: { width: 4, depth: 3, height: 3.0 },
    });
    expect(c2.defaultHeight).toBeCloseTo(2.4, 6);
  });

  it('does not write heightOverride for structural kinds', () => {
    const cfg = makeInitialConfig();
    const { cfg: next, id } = addBuilding(cfg, 'overkapping', [0, 0], {
      sourceProductId: 'kit-1',
      type: 'overkapping',
      dimensions: { width: 4, depth: 3, height: 2.4 },
    });
    const b = next.buildings.find((x) => x.id === id)!;
    expect(b.heightOverride).toBeNull();
  });
});

describe('updateGateConfig', () => {
  it('toggles partCount 1→2 and doubles dimensions.width to preserve per-part width', () => {
    const start = makeInitialConfig();
    const { cfg, id } = addBuilding(start, 'poort');
    // Default: 1 part × 1.5m = 1.5m total. Toggle to 2 parts → 2 × 1.5m = 3.0m total.
    const next = updateGateConfig(cfg, id, { partCount: 2 });
    const b = next.buildings.find((x) => x.id === id)!;
    expect(b.gateConfig?.partCount).toBe(2);
    expect(b.gateConfig?.swingDirection).toBe('inward');
    expect(b.gateConfig?.motorized).toBe(false);
    expect(b.dimensions.width).toBeCloseTo(3.0, 6);
  });

  it('flips motorized without touching partCount', () => {
    const start = makeInitialConfig();
    const { cfg, id } = addBuilding(start, 'poort');
    const next = updateGateConfig(cfg, id, { motorized: true });
    const b = next.buildings.find((x) => x.id === id)!;
    expect(b.gateConfig?.motorized).toBe(true);
    expect(b.gateConfig?.partCount).toBe(1);
  });

  it('is a no-op when the id does not exist', () => {
    const start = makeInitialConfig();
    const { cfg } = addBuilding(start, 'poort');
    const next = updateGateConfig(cfg, 'does-not-exist', { partCount: 2 });
    expect(next.buildings).toEqual(cfg.buildings);
  });

  it('is a no-op when the targeted building is not a poort', () => {
    const cfg = makeConfig({
      buildings: [makeBuilding({ id: 'wall1', type: 'muur' })],
    });
    const next = updateGateConfig(cfg, 'wall1', { partCount: 2 });
    const b = next.buildings.find((x) => x.id === 'wall1')!;
    expect(b.type).toBe('muur');
    expect((b as { gateConfig?: unknown }).gateConfig).toBeUndefined();
    expect(b.dimensions.width).toBe(cfg.buildings[0].dimensions.width);
  });
});

describe('addBuilding — product dakbak hydration', () => {
  it('applies fasciaHeight and fasciaOverhang from product on first building', () => {
    const cfg = makeInitialConfig();
    const productDefaults: ProductBuildingDefaults = {
      sourceProductId: 'pp',
      type: 'overkapping',
      dimensions: { width: 4, depth: 3 },
      roof: { fasciaHeight: 0.5, fasciaOverhang: 0.4 },
    };
    const { cfg: next } = addBuilding(cfg, 'overkapping', [0, 0], productDefaults);
    expect(next.roof.fasciaHeight).toBe(0.5);
    expect(next.roof.fasciaOverhang).toBe(0.4);
  });

  it('preserves an explicit zero overhang from product defaults', () => {
    const cfg = makeInitialConfig();
    const productDefaults: ProductBuildingDefaults = {
      sourceProductId: 'pp',
      type: 'overkapping',
      dimensions: {},
      roof: { fasciaOverhang: 0 },
    };
    const { cfg: next } = addBuilding(cfg, 'overkapping', [0, 0], productDefaults);
    expect(next.roof.fasciaOverhang).toBe(0);
  });

  it('does not overwrite fascia fields on subsequent product builds', () => {
    let cfg = makeInitialConfig();
    cfg = addBuilding(cfg, 'overkapping', [0, 0], {
      sourceProductId: 'a', type: 'overkapping', dimensions: {},
      roof: { fasciaHeight: 0.5, fasciaOverhang: 0.4 },
    }).cfg;
    cfg = addBuilding(cfg, 'berging', [10, 0], {
      sourceProductId: 'b', type: 'berging', dimensions: {},
      roof: { fasciaHeight: 0.3, fasciaOverhang: 0.1 },
    }).cfg;
    expect(cfg.roof.fasciaHeight).toBe(0.5);
    expect(cfg.roof.fasciaOverhang).toBe(0.4);
  });
});
