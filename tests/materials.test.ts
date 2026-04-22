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

describe('getAtom / getAtomColor category scoping', () => {
  // Slug collisions across categories are the norm (wall-wood vs door-wood
  // are distinct rows). Without a category argument, `find` returns the
  // first match — which was the source of the Phase 5.5.3 texture bug
  // where wall lookups returned the textureless door row.
  const wallWood: MaterialRow = {
    id: 'w1', tenantId: 't', category: 'wall', slug: 'wood', name: 'Wall Wood',
    color: '#aaa000', textures: { color: 'w-c', normal: 'w-n', roughness: 'w-r' },
    tileSize: [1, 1], pricing: { perSqm: 40 }, flags: {},
    archivedAt: null, createdAt: '', updatedAt: '',
  };
  const doorWood: MaterialRow = {
    id: 'd1', tenantId: 't', category: 'door', slug: 'wood', name: 'Door Wood',
    color: '#bbb000', textures: null, tileSize: null,
    pricing: { surcharge: 20 }, flags: {},
    archivedAt: null, createdAt: '', updatedAt: '',
  };
  // Door comes BEFORE wall in the array — simulates the DB ordering that
  // tripped up the unscoped lookup in production.
  const materials = [doorWood, wallWood];

  it('getAtom returns the category-scoped row, not the first slug match', () => {
    const w = getAtom(materials, 'wood', 'wall');
    const d = getAtom(materials, 'wood', 'door');
    expect(w?.id).toBe('w1');
    expect(d?.id).toBe('d1');
    expect(w?.textures).not.toBeNull();
    expect(d?.textures).toBeNull();
  });

  it('getAtomColor returns the category-scoped row color', () => {
    expect(getAtomColor(materials, 'wood', 'wall')).toBe('#aaa000');
    expect(getAtomColor(materials, 'wood', 'door')).toBe('#bbb000');
  });

  it('without a category, falls back to the first match (legacy behaviour)', () => {
    expect(getAtom(materials, 'wood')?.id).toBe('d1');
  });

  it('returns null / fallback color when nothing matches', () => {
    expect(getAtom(materials, 'nonexistent', 'wall')).toBeNull();
    expect(getAtomColor(materials, 'nonexistent', 'wall')).toBe('#808080');
  });
});
