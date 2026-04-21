import { describe, it, expect } from 'vite-plus/test';
import {
  filterCatalog,
  filterCatalogAllowing,
  isMaterialEnabled,
  ALWAYS_ENABLED_SLUGS,
  WALL_CATALOG,
  FLOOR_CATALOG,
  DOOR_CATALOG,
} from '@/domain/materials';

describe('filterCatalog', () => {
  it('returns the original catalog when enabled is null (unrestricted)', () => {
    const result = filterCatalog(WALL_CATALOG, null);
    expect(result).toBe(WALL_CATALOG);
  });

  it('returns only entries whose atomId is in the enabled set', () => {
    const result = filterCatalog(WALL_CATALOG, ['wood', 'brick']);
    expect(result.map((e) => e.atomId).sort()).toEqual(['brick', 'wood']);
  });

  it('returns an empty array for empty enabled list (explicitly nothing enabled) — except always-enabled sentinels', () => {
    const result = filterCatalog(WALL_CATALOG, []);
    expect(result).toEqual([]);
  });

  it('always includes always-enabled sentinel slugs (geen) in the FLOOR catalog even when not in enabled list', () => {
    const result = filterCatalog(FLOOR_CATALOG, ['tegels']);
    const slugs = result.map((e) => e.atomId).sort();
    expect(slugs).toEqual(['geen', 'tegels']);
  });

  it('exposes ALWAYS_ENABLED_SLUGS containing at least "geen"', () => {
    expect(ALWAYS_ENABLED_SLUGS).toContain('geen');
  });

  it('is a pure function (does not mutate the enabled list)', () => {
    const enabled = ['wood'];
    filterCatalog(WALL_CATALOG, enabled);
    expect(enabled).toEqual(['wood']);
  });
});

describe('filterCatalogAllowing', () => {
  it('returns original catalog when enabled is null', () => {
    const result = filterCatalogAllowing(WALL_CATALOG, null, 'wood');
    expect(result).toBe(WALL_CATALOG);
  });

  it('keeps the current selection even when it is disabled', () => {
    const result = filterCatalogAllowing(WALL_CATALOG, ['brick'], 'wood');
    const slugs = result.map((e) => e.atomId).sort();
    expect(slugs).toEqual(['brick', 'wood']);
  });

  it('does not duplicate the current selection when it is already enabled', () => {
    const result = filterCatalogAllowing(WALL_CATALOG, ['wood', 'brick'], 'wood');
    const slugs = result.map((e) => e.atomId);
    expect(slugs.filter((s) => s === 'wood')).toHaveLength(1);
  });

  it('handles null current selection by passing through to filterCatalog', () => {
    const result = filterCatalogAllowing(DOOR_CATALOG, ['wood'], null);
    expect(result.map((e) => e.atomId)).toEqual(['wood']);
  });

  it('preserves the catalog order of retained entries', () => {
    const result = filterCatalogAllowing(WALL_CATALOG, ['wood', 'brick', 'render'], null);
    // WALL_CATALOG is in order [wood, brick, render, ...].
    expect(result.map((e) => e.atomId)).toEqual(['wood', 'brick', 'render']);
  });
});

describe('isMaterialEnabled', () => {
  it('returns true for any slug when enabled is null', () => {
    expect(isMaterialEnabled('anything', null)).toBe(true);
  });

  it('returns true when slug is in the enabled list', () => {
    expect(isMaterialEnabled('wood', ['wood', 'brick'])).toBe(true);
  });

  it('returns false when slug is NOT in the enabled list', () => {
    expect(isMaterialEnabled('metal', ['wood', 'brick'])).toBe(false);
  });

  it('returns true for always-enabled sentinel slugs even when not in the list', () => {
    expect(isMaterialEnabled('geen', [])).toBe(true);
  });
});
