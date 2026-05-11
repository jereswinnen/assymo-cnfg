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
];

describe('validateConfig — wall inner cladding', () => {
  it('accepts undefined materialIdInner', () => {
    const config = makeConfig();
    const errors = validateConfig(config, FIXTURE_MATERIALS);
    expect(errors).toEqual([]);
  });

  it('accepts null materialIdInner', () => {
    const config = makeConfig();
    config.buildings[0].walls.front.materialIdInner = null;
    const errors = validateConfig(config, FIXTURE_MATERIALS);
    expect(errors).toEqual([]);
  });

  it('accepts a known wall material slug', () => {
    const config = makeConfig();
    config.buildings[0].walls.front.materialIdInner = 'wood';
    const errors = validateConfig(config, FIXTURE_MATERIALS);
    expect(errors).toEqual([]);
  });

  it('rejects an unknown materialIdInner slug', () => {
    const config = makeConfig();
    config.buildings[0].walls.front.materialIdInner = 'ghost';
    const errors = validateConfig(config, FIXTURE_MATERIALS);
    expect(errors.some(e =>
      e.code === 'unknown_material'
      && e.path.endsWith('walls.front.materialIdInner'),
    )).toBe(true);
  });
});
