import { describe, it, expect } from 'vite-plus/test';
import { validateConfig } from '@/domain/config';
import { makeConfig } from './fixtures';
import type { MaterialRow } from '@/domain/catalog';

function makeRow(slug: string, category: MaterialRow['categories'][number]): MaterialRow {
  return {
    id: slug,
    tenantId: 'test',
    categories: [category],
    slug,
    name: slug,
    color: '#000',
    textures: null,
    tileSize: null,
    pricing: {},
    flags: {},
    archivedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const FIXTURE_MATERIALS: MaterialRow[] = [
  makeRow('wood', 'wall'),
  makeRow('brick', 'wall'),
  makeRow('beton', 'floor'),
  makeRow('epdm', 'roof-cover'),
  makeRow('pannen', 'roof-cover'),
  makeRow('aluminium', 'roof-trim'),
  makeRow('rockwool-100', 'middenlaag'),
];

describe('validateConfig — wall middenlaag', () => {
  it('accepts undefined', () => {
    const config = makeConfig();
    const errors = validateConfig(config, FIXTURE_MATERIALS);
    expect(errors).toEqual([]);
  });

  it('accepts null', () => {
    const config = makeConfig();
    config.buildings[0].walls.front.materialIdMiddenlaag = null;
    const errors = validateConfig(config, FIXTURE_MATERIALS);
    expect(errors).toEqual([]);
  });

  it('accepts a known middenlaag slug', () => {
    const config = makeConfig();
    config.buildings[0].walls.front.materialIdMiddenlaag = 'rockwool-100';
    const errors = validateConfig(config, FIXTURE_MATERIALS);
    expect(errors).toEqual([]);
  });

  it('rejects an unknown slug', () => {
    const config = makeConfig();
    config.buildings[0].walls.front.materialIdMiddenlaag = 'ghost';
    const errors = validateConfig(config, FIXTURE_MATERIALS);
    expect(errors.some(e =>
      e.code === 'unknown_material'
      && e.path.endsWith('walls.front.materialIdMiddenlaag'),
    )).toBe(true);
  });
});
