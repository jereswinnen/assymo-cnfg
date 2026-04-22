import { describe, it, expect } from 'vite-plus/test';
import {
  getAtom,
  getAtomColor,
  getEffectiveDoorMaterial,
  getEffectivePrimaryMaterial,
  getEffectiveWallMaterial,
} from '@/domain/materials';
import type { MaterialRow } from '@/domain/catalog';
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

describe('getAtom / getAtomColor category scoping (unified materials)', () => {
  // Unified materials: one row per (tenant, slug), possibly serving
  // multiple categories. `getAtom(slug, category)` checks `categories`
  // membership. Rows without the requested category are not returned.
  const woodMulti: MaterialRow = {
    id: 'w1', tenantId: 't', categories: ['wall', 'door', 'roof-trim'],
    slug: 'wood', name: 'Hout',
    color: '#aaa000', textures: { color: 'w-c', normal: 'w-n', roughness: 'w-r' },
    tileSize: [1, 1],
    pricing: { wall: { perSqm: 40 }, door: { surcharge: 20 } },
    flags: {},
    archivedAt: null, createdAt: '', updatedAt: '',
  };
  const concreteFloor: MaterialRow = {
    id: 'f1', tenantId: 't', categories: ['floor'],
    slug: 'beton', name: 'Beton',
    color: '#cccccc', textures: null, tileSize: null,
    pricing: { floor: { perSqm: 25 } }, flags: {},
    archivedAt: null, createdAt: '', updatedAt: '',
  };
  const materials = [woodMulti, concreteFloor];

  it('getAtom returns the row when the slug + category match', () => {
    expect(getAtom(materials, 'wood', 'wall')?.id).toBe('w1');
    expect(getAtom(materials, 'wood', 'door')?.id).toBe('w1');
    expect(getAtom(materials, 'wood', 'roof-trim')?.id).toBe('w1');
  });

  it('getAtom returns null when the row does not serve that category', () => {
    expect(getAtom(materials, 'wood', 'floor')).toBeNull();
    expect(getAtom(materials, 'beton', 'wall')).toBeNull();
  });

  it('getAtomColor returns the row color for any of its categories', () => {
    expect(getAtomColor(materials, 'wood', 'wall')).toBe('#aaa000');
    expect(getAtomColor(materials, 'wood', 'door')).toBe('#aaa000');
  });

  it('without a category, returns the first slug match (useful for legacy lookups)', () => {
    expect(getAtom(materials, 'wood')?.id).toBe('w1');
  });

  it('returns null / fallback color when nothing matches', () => {
    expect(getAtom(materials, 'nonexistent', 'wall')).toBeNull();
    expect(getAtomColor(materials, 'nonexistent', 'wall')).toBe('#808080');
  });
});
