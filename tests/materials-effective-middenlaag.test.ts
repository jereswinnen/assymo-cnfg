import { describe, it, expect } from 'vite-plus/test';
import { getEffectiveMiddenlaagMaterial } from '@/domain/materials';
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

describe('getEffectiveMiddenlaagMaterial', () => {
  it('returns null when materialIdMiddenlaag is undefined', () => {
    expect(getEffectiveMiddenlaagMaterial(makeWall())).toBeNull();
  });

  it('returns null when materialIdMiddenlaag is null', () => {
    expect(getEffectiveMiddenlaagMaterial(makeWall({ materialIdMiddenlaag: null }))).toBeNull();
  });

  it('returns the slug when set', () => {
    expect(getEffectiveMiddenlaagMaterial(makeWall({ materialIdMiddenlaag: 'rockwool-100' }))).toBe('rockwool-100');
  });
});
