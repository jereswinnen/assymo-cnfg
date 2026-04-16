import { describe, it, expect } from 'vite-plus/test';
import {
  CONFIG_VERSION,
  migrateBuilding,
  migrateConfig,
  type LegacyBuilding,
} from '@/domain/config';
import { DEFAULT_PRIMARY_MATERIAL, DEFAULT_ROOF } from '@/domain/building';

const legacyBuilding: LegacyBuilding = {
  id: 'legacy-1',
  type: 'berging',
  position: [0, 0],
  dimensions: { width: 4, depth: 4, height: 2.6 },
  walls: {},
  hasCornerBraces: false,
  floor: { materialId: 'beton' },
};

describe('migrateBuilding', () => {
  it('backfills primaryMaterialId when missing', () => {
    const out = migrateBuilding({ ...legacyBuilding });
    expect(out.primaryMaterialId).toBe(DEFAULT_PRIMARY_MATERIAL);
  });

  it('backfills orientation to horizontal when missing', () => {
    const out = migrateBuilding({ ...legacyBuilding });
    expect(out.orientation).toBe('horizontal');
  });

  it('backfills heightOverride to null when missing', () => {
    const out = migrateBuilding({ ...legacyBuilding });
    expect(out.heightOverride).toBeNull();
  });

  it('preserves fields that are already present', () => {
    const out = migrateBuilding({
      ...legacyBuilding,
      primaryMaterialId: 'glass',
      orientation: 'vertical',
      heightOverride: 2.8,
    });
    expect(out.primaryMaterialId).toBe('glass');
    expect(out.orientation).toBe('vertical');
    expect(out.heightOverride).toBe(2.8);
  });
});

describe('migrateConfig', () => {
  it('stamps the current CONFIG_VERSION on output', () => {
    const out = migrateConfig({
      buildings: [legacyBuilding],
      connections: [],
      roof: { ...DEFAULT_ROOF },
    });
    expect(out.version).toBe(CONFIG_VERSION);
  });

  it('derives defaultHeight from first structural building when not provided', () => {
    const out = migrateConfig({
      buildings: [{ ...legacyBuilding, dimensions: { width: 4, depth: 4, height: 2.8 } }],
      connections: [],
      roof: { ...DEFAULT_ROOF },
    });
    expect(out.defaultHeight).toBe(2.8);
  });

  it('falls back to 3m when no structural building exists', () => {
    const out = migrateConfig({
      buildings: [{ ...legacyBuilding, id: 'p', type: 'paal' }],
      connections: [],
      roof: { ...DEFAULT_ROOF },
    });
    expect(out.defaultHeight).toBe(3);
  });

  it('passes through an explicit defaultHeight', () => {
    const out = migrateConfig({
      buildings: [legacyBuilding],
      connections: [],
      roof: { ...DEFAULT_ROOF },
      defaultHeight: 2.5,
    });
    expect(out.defaultHeight).toBe(2.5);
  });
});
