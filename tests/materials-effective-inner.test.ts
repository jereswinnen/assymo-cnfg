import { describe, it, expect } from 'vite-plus/test';
import { getEffectiveInnerWallMaterial } from '@/domain/materials';
import type { WallConfig, BuildingEntity } from '@/domain/building';

function makeWall(extras: Partial<WallConfig> = {}): WallConfig {
  return {
    hasDoor: false,
    doorSize: 'enkel',
    doorHasWindow: false,
    doorPosition: 0.5,
    doorSwing: 'naar_buiten',
    windows: [],
    ...extras,
  };
}

function makeBuilding(): BuildingEntity {
  return {
    id: 'b1',
    type: 'berging',
    position: [0, 0],
    dimensions: { width: 4, depth: 4, height: 2.6 },
    primaryMaterialId: 'wood',
    walls: {},
    hasCornerBraces: false,
    floor: { materialId: 'beton' },
    orientation: 'horizontal',
    heightOverride: null,
  };
}

describe('getEffectiveInnerWallMaterial', () => {
  it('returns null when materialIdInner is undefined', () => {
    expect(getEffectiveInnerWallMaterial(makeWall(), makeBuilding())).toBeNull();
  });

  it('returns null when materialIdInner is null', () => {
    expect(getEffectiveInnerWallMaterial(makeWall({ materialIdInner: null }), makeBuilding())).toBeNull();
  });

  it('returns the inner material id when set', () => {
    expect(getEffectiveInnerWallMaterial(makeWall({ materialIdInner: 'osb' }), makeBuilding())).toBe('osb');
  });
});
