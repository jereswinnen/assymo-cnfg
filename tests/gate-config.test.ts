import { describe, it, expect } from 'vite-plus/test';
import {
  createGateBuildingEntity,
  defaultGateConfig,
} from '@/domain/building';
import { validateConfig } from '@/domain/config';
import { makeConfig } from './fixtures';

describe('defaultGateConfig', () => {
  it('returns the documented defaults', () => {
    expect(defaultGateConfig()).toEqual({
      partCount: 1,
      materialId: '',
      swingDirection: 'inward',
      motorized: false,
    });
  });

  it('returns a fresh object each call (no shared reference)', () => {
    const a = defaultGateConfig();
    const b = defaultGateConfig();
    expect(a).not.toBe(b);
    a.partCount = 2;
    expect(b.partCount).toBe(1);
  });
});

describe('createGateBuildingEntity', () => {
  it('returns a poort entity with a fresh UUID, default config, default position [0,0]', () => {
    const e = createGateBuildingEntity();
    expect(e.type).toBe('poort');
    expect(e.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(e.position).toEqual([0, 0]);
    expect(e.gateConfig).toEqual(defaultGateConfig());
  });

  it('overrides position when provided', () => {
    const e = createGateBuildingEntity({ position: [3, 4] });
    expect(e.position).toEqual([3, 4]);
  });

  it('deep-merges gateConfig overrides on top of the defaults', () => {
    const e = createGateBuildingEntity({ gateConfig: { partCount: 2 } });
    expect(e.gateConfig.partCount).toBe(2);
    expect(e.gateConfig.swingDirection).toBe('inward');
    expect(e.gateConfig.motorized).toBe(false);
    expect(e.gateConfig.materialId).toBe('');
  });

  it('produces different UUIDs across calls', () => {
    const a = createGateBuildingEntity();
    const b = createGateBuildingEntity();
    expect(a.id).not.toBe(b.id);
  });

  it('uses GATE_DEFAULT_DIMENSIONS for a fresh entity (1.5m × 0.15m × 2.0m)', () => {
    const e = createGateBuildingEntity();
    expect(e.dimensions.width).toBeCloseTo(1.5, 6);
    expect(e.dimensions.depth).toBeCloseTo(0.15, 6);
    expect(e.dimensions.height).toBeCloseTo(2.0, 6);
  });

  it('accepts dimensions overrides independently of gateConfig', () => {
    const e = createGateBuildingEntity({
      gateConfig: { partCount: 2 },
      dimensions: { width: 3.0, height: 2.4 },
    });
    expect(e.dimensions.width).toBeCloseTo(3.0, 6);
    expect(e.dimensions.height).toBeCloseTo(2.4, 6);
    expect(e.gateConfig.partCount).toBe(2);
  });

  it('produces a poort that satisfies validateConfig out of the box', () => {
    // A fresh poort defaults to 1500mm × 2000mm. Round-trip it through
    // validateConfig (alongside a structural building, since validateConfig
    // requires one) and assert no out_of_range errors fire on the poort.
    const poort = createGateBuildingEntity();
    const cfg = makeConfig({
      buildings: [
        // makeConfig's default berging stays as the structural anchor; we
        // append the poort entity afterwards.
        ...makeConfig().buildings,
        poort,
      ],
    });
    const errors = validateConfig(cfg);
    const poortErrors = errors.filter((e) => e.path.startsWith('buildings[1]'));
    expect(poortErrors).toEqual([]);
  });
});
