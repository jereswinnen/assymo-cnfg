import { describe, it, expect } from 'vite-plus/test';
import { isConfigValid, validateConfig } from '@/domain/config';
import type { MaterialRow } from '@/domain/catalog';
import { makeBuilding, makeConfig, makeRoof } from './fixtures';

const BLANK_WALL = {
  hasDoor: false,
  doorSize: 'enkel' as const,
  doorHasWindow: false,
  doorPosition: 0.5,
  doorSwing: 'naar_buiten' as const,
  windows: [],
};

/** Minimal material fixture: a couple of real slugs so validateConfig can
 *  detect an unknown slug like 'unobtainium'. */
function makeRow(slug: string, category: MaterialRow['category']): MaterialRow {
  return {
    id: slug,
    tenantId: 'test',
    category,
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
  makeRow('pannen', 'roof-cover'),
  makeRow('aluminium', 'roof-trim'),
];

describe('validateConfig', () => {
  it('accepts the default config', () => {
    expect(isConfigValid(makeConfig())).toBe(true);
  });

  it('flags width below structural minimum', () => {
    const cfg = makeConfig({
      buildings: [makeBuilding({ id: 'b1', type: 'berging', dimensions: { width: 0.5, depth: 4, height: 2.6 } })],
    });
    const errors = validateConfig(cfg);
    expect(errors.map((e) => e.code)).toContain('out_of_range');
  });

  it('flags unknown material slugs', () => {
    const cfg = makeConfig({
      buildings: [makeBuilding({ id: 'b1', type: 'berging', primaryMaterialId: 'unobtainium' })],
    });
    const errors = validateConfig(cfg, FIXTURE_MATERIALS);
    expect(errors.some((e) => e.code === 'unknown_material')).toBe(true);
  });

  it('flags duplicate building IDs', () => {
    const cfg = makeConfig({
      buildings: [
        makeBuilding({ id: 'dup', type: 'berging' }),
        makeBuilding({ id: 'dup', type: 'paal' }),
      ],
    });
    const errors = validateConfig(cfg);
    expect(errors.some((e) => e.code === 'duplicate_building_id')).toBe(true);
  });

  it('flags connections referencing missing buildings', () => {
    const cfg = makeConfig({
      connections: [
        { buildingAId: 'b1', sideA: 'right', buildingBId: 'ghost', sideB: 'left', isOpen: false },
      ],
    });
    const errors = validateConfig(cfg);
    expect(errors.some((e) => e.code === 'connection_missing_building')).toBe(true);
  });

  it('flags a door that is wider than its wall', () => {
    const cfg = makeConfig({
      buildings: [
        makeBuilding({
          id: 'b1',
          type: 'berging',
          dimensions: { width: 1.2, depth: 4, height: 2.6 },
          walls: {
            front: { ...BLANK_WALL, hasDoor: true, doorSize: 'dubbel' },
            back: { ...BLANK_WALL },
            left: { ...BLANK_WALL },
            right: { ...BLANK_WALL },
          },
        }),
      ],
    });
    const errors = validateConfig(cfg);
    expect(errors.some((e) => e.code === 'door_too_wide')).toBe(true);
  });

  it('flags pitched roofs with out-of-range pitch', () => {
    const cfg = makeConfig({ roof: makeRoof({ type: 'pitched', pitch: 80 }) });
    const errors = validateConfig(cfg);
    expect(errors.some((e) => e.code === 'pitch_out_of_range')).toBe(true);
  });

  it('requires at least one structural building', () => {
    const cfg = makeConfig({
      buildings: [makeBuilding({ id: 'only-pole', type: 'paal' })],
    });
    const errors = validateConfig(cfg);
    expect(errors.some((e) => e.code === 'no_structural_building')).toBe(true);
  });
});
