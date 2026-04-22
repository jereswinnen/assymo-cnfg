import { describe, it, expect } from 'vite-plus/test';
import {
  getEffectiveDoorMaterial,
  getEffectivePrimaryMaterial,
  getEffectiveWallMaterial,
} from '@/domain/materials';
import { makeBuilding } from './fixtures';

const BLANK_WALL = {
  hasDoor: false,
  doorSize: 'enkel' as const,
  doorHasWindow: false,
  doorPosition: 0.5,
  doorSwing: 'naar_buiten' as const,
  windows: [],
};

describe('material resolution', () => {
  it('wall falls back to building.primaryMaterialId when no override is set', () => {
    const building = makeBuilding({ id: 'b1', type: 'berging', primaryMaterialId: 'glass' });
    const effective = getEffectiveWallMaterial({ ...BLANK_WALL }, building);
    expect(effective).toBe('glass');
  });

  it('wall uses its own materialId when set', () => {
    const building = makeBuilding({ id: 'b1', type: 'berging', primaryMaterialId: 'wood' });
    const effective = getEffectiveWallMaterial({ ...BLANK_WALL, materialId: 'glass' }, building);
    expect(effective).toBe('glass');
  });

  it('door falls back to building.primaryMaterialId when no door override', () => {
    const building = makeBuilding({ id: 'b1', type: 'berging', primaryMaterialId: 'wood' });
    const effective = getEffectiveDoorMaterial({ ...BLANK_WALL, hasDoor: true }, building);
    expect(effective).toBe('wood');
  });
});

describe('getEffectivePrimaryMaterial (attachment chain)', () => {
  it('returns the building\'s own primary for a structural building', () => {
    const b = makeBuilding({ id: 'a', type: 'berging', primaryMaterialId: 'glass' });
    expect(getEffectivePrimaryMaterial(b, [b])).toBe('glass');
  });

  it('walks attachedTo from a paal up to a structural parent', () => {
    const parent = makeBuilding({ id: 'a', type: 'berging', primaryMaterialId: 'glass' });
    const pole = makeBuilding({
      id: 'p',
      type: 'paal',
      primaryMaterialId: 'wood',
      attachedTo: 'a',
    });
    expect(getEffectivePrimaryMaterial(pole, [parent, pole])).toBe('glass');
  });

  it('falls back to its own primary when the attachment chain is broken', () => {
    const pole = makeBuilding({
      id: 'p',
      type: 'paal',
      primaryMaterialId: 'wood',
      attachedTo: 'ghost',
    });
    expect(getEffectivePrimaryMaterial(pole, [pole])).toBe('wood');
  });

  it('returns own primary when no buildings list is provided', () => {
    const pole = makeBuilding({
      id: 'p',
      type: 'paal',
      primaryMaterialId: 'wood',
      attachedTo: 'a',
    });
    expect(getEffectivePrimaryMaterial(pole)).toBe('wood');
  });
});
