import { describe, it, expect } from 'vite-plus/test';
import { getEffectiveInnerWallMaterial } from '@/domain/materials';
import { makeBuilding } from './fixtures';
import type { WallConfig } from '@/domain/building';

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

describe('getEffectiveInnerWallMaterial', () => {
  it('returns null when materialIdInner is undefined', () => {
    expect(getEffectiveInnerWallMaterial(makeWall())).toBeNull();
  });

  it('returns null when materialIdInner is null', () => {
    expect(getEffectiveInnerWallMaterial(makeWall({ materialIdInner: null }))).toBeNull();
  });

  it('returns the inner material id when set', () => {
    expect(getEffectiveInnerWallMaterial(makeWall({ materialIdInner: 'osb' }))).toBe('osb');
  });
});
