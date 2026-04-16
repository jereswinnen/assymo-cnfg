import { describe, it, expect } from 'vite-plus/test';
import {
  WALL_CATALOG,
  getAtom,
  getEffectiveDoorMaterial,
  getEffectiveWallMaterial,
} from '@/domain/materials';
import { DEFAULT_WALL } from '@/domain/building';
import { makeBuilding } from './fixtures';

describe('materials registry', () => {
  it('returns a MaterialAtom for a known slug', () => {
    const atom = getAtom('wood');
    expect(atom).not.toBeNull();
    expect(atom?.id).toBe('wood');
    expect(typeof atom?.labelKey).toBe('string');
    expect(typeof atom?.color).toBe('string');
  });

  it('returns null for an unknown slug', () => {
    expect(getAtom('unobtainium')).toBeNull();
  });

  it('has WALL_CATALOG entries with pricePerSqm and atomId', () => {
    expect(WALL_CATALOG.length).toBeGreaterThan(0);
    for (const entry of WALL_CATALOG) {
      expect(typeof entry.atomId).toBe('string');
      expect(typeof entry.pricePerSqm).toBe('number');
    }
  });
});

describe('material resolution', () => {
  it('wall falls back to building.primaryMaterialId when no override is set', () => {
    const building = makeBuilding({ id: 'b1', type: 'berging', primaryMaterialId: 'glass' });
    const effective = getEffectiveWallMaterial({ ...DEFAULT_WALL }, building);
    expect(effective).toBe('glass');
  });

  it('wall uses its own materialId when set', () => {
    const building = makeBuilding({ id: 'b1', type: 'berging', primaryMaterialId: 'wood' });
    const effective = getEffectiveWallMaterial({ ...DEFAULT_WALL, materialId: 'glass' }, building);
    expect(effective).toBe('glass');
  });

  it('door falls back to building.primaryMaterialId when no door override', () => {
    const building = makeBuilding({ id: 'b1', type: 'berging', primaryMaterialId: 'wood' });
    const effective = getEffectiveDoorMaterial({ ...DEFAULT_WALL, hasDoor: true }, building);
    expect(effective).toBe('wood');
  });
});
