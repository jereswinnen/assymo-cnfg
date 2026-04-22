import { describe, it, expect } from 'vite-plus/test';
import {
  setWallDoorSupplierProduct,
  setWallWindowSupplierProduct,
} from '@/domain/config';
import { makeBuilding, makeConfig } from './fixtures';

const BLANK_WALL = {
  hasDoor: true,
  doorSize: 'enkel' as const,
  doorHasWindow: false,
  doorPosition: 0.5,
  doorSwing: 'naar_buiten' as const,
  windows: [
    { id: 'w1', position: 0.3, width: 0.9, height: 1.2, sillHeight: 0.9 },
  ],
};

function makeConfigWithWall() {
  return makeConfig({
    buildings: [
      makeBuilding({
        id: 'b1',
        type: 'berging',
        walls: { front: { ...BLANK_WALL } },
      }),
    ],
  });
}

describe('setWallDoorSupplierProduct', () => {
  it('sets doorSupplierProductId on the target wall', () => {
    const cfg = makeConfigWithWall();
    const next = setWallDoorSupplierProduct(cfg, 'b1', 'front', 'prod-abc');
    expect(next.buildings[0].walls.front.doorSupplierProductId).toBe('prod-abc');
  });

  it('clears doorSupplierProductId when passed null', () => {
    const cfg = makeConfigWithWall();
    const withId = setWallDoorSupplierProduct(cfg, 'b1', 'front', 'prod-abc');
    const cleared = setWallDoorSupplierProduct(withId, 'b1', 'front', null);
    expect(cleared.buildings[0].walls.front.doorSupplierProductId).toBeNull();
  });

  it('preserves other wall fields when setting supplier product', () => {
    const cfg = makeConfigWithWall();
    const next = setWallDoorSupplierProduct(cfg, 'b1', 'front', 'prod-xyz');
    const wall = next.buildings[0].walls.front;
    expect(wall.hasDoor).toBe(true);
    expect(wall.doorSize).toBe('enkel');
    expect(wall.doorSwing).toBe('naar_buiten');
    expect(wall.doorPosition).toBe(0.5);
  });

  it('does not mutate the input config', () => {
    const cfg = makeConfigWithWall();
    const snapshot = JSON.stringify(cfg);
    setWallDoorSupplierProduct(cfg, 'b1', 'front', 'prod-abc');
    expect(JSON.stringify(cfg)).toBe(snapshot);
  });
});

describe('setWallWindowSupplierProduct', () => {
  it('sets supplierProductId on the target window', () => {
    const cfg = makeConfigWithWall();
    const next = setWallWindowSupplierProduct(cfg, 'b1', 'front', 'w1', 'win-prod-1');
    const win = next.buildings[0].walls.front.windows[0];
    expect(win.supplierProductId).toBe('win-prod-1');
  });

  it('clears supplierProductId when passed null', () => {
    const cfg = makeConfigWithWall();
    const withId = setWallWindowSupplierProduct(cfg, 'b1', 'front', 'w1', 'win-prod-1');
    const cleared = setWallWindowSupplierProduct(withId, 'b1', 'front', 'w1', null);
    const win = cleared.buildings[0].walls.front.windows[0];
    expect(win.supplierProductId).toBeNull();
  });

  it('preserves window dimensions when setting supplier product', () => {
    const cfg = makeConfigWithWall();
    const next = setWallWindowSupplierProduct(cfg, 'b1', 'front', 'w1', 'win-prod-2');
    const win = next.buildings[0].walls.front.windows[0];
    expect(win.width).toBe(0.9);
    expect(win.height).toBe(1.2);
    expect(win.sillHeight).toBe(0.9);
    expect(win.position).toBe(0.3);
  });

  it('does not mutate the input config', () => {
    const cfg = makeConfigWithWall();
    const snapshot = JSON.stringify(cfg);
    setWallWindowSupplierProduct(cfg, 'b1', 'front', 'w1', 'win-prod-1');
    expect(JSON.stringify(cfg)).toBe(snapshot);
  });
});
