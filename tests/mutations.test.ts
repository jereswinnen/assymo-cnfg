import { describe, it, expect } from 'vite-plus/test';
import {
  addBuilding,
  makeInitialConfig,
  removeBuilding,
  setBuildingPrimaryMaterial,
  toggleConnectionOpen,
  updateBuildingDimensions,
  updateBuildingWall,
} from '@/domain/config';
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
  it('refuses to remove the last structural building', () => {
    const cfg = makeConfig();
    const before = cfg.buildings.length;
    const next = removeBuilding(cfg, cfg.buildings[0].id);
    expect(next.buildings).toHaveLength(before);
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
