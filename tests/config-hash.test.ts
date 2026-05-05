import { describe, it, expect } from 'vite-plus/test';
import { canonicalizeConfig, contentHash } from '@/domain/config/hash';
import { makeConfig, makeBuilding } from './fixtures';

describe('canonicalizeConfig', () => {
  it('serialises objects with sorted keys', () => {
    const out = canonicalizeConfig({
      version: 1,
      defaultHeight: 2.6,
      connections: [],
      buildings: [makeBuilding({ id: 'b1', type: 'berging' })],
      roof: { type: 'flat', pitch: 0, coveringId: 'epdm', trimMaterialId: 'wood', insulation: false, insulationThickness: 150, hasSkylight: false, fasciaHeight: 0.36, fasciaOverhang: 0 },
    });
    // Top-level keys appear in alphabetical order.
    const topLevel = Object.keys(JSON.parse(out));
    expect(topLevel).toEqual(['buildings', 'connections', 'defaultHeight', 'roof', 'version']);
  });

  it('is deterministic regardless of input key order', () => {
    const cfg1 = makeConfig();
    const cfg2 = { ...cfg1 };
    // Construct a mirrored copy with swapped property-declaration order.
    const mirrored = {
      roof: cfg2.roof,
      defaultHeight: cfg2.defaultHeight,
      buildings: cfg2.buildings,
      connections: cfg2.connections,
      version: cfg2.version,
    };
    expect(canonicalizeConfig(cfg1)).toBe(canonicalizeConfig(mirrored));
  });
});

describe('contentHash', () => {
  it('returns a 64-char hex SHA-256 digest', async () => {
    const h = await contentHash(makeConfig());
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces the same hash for equivalent configs', async () => {
    const a = await contentHash(makeConfig());
    const b = await contentHash(makeConfig());
    expect(a).toBe(b);
  });

  it('produces different hashes for different configs', async () => {
    const a = await contentHash(makeConfig());
    const b = await contentHash(makeConfig({ defaultHeight: 2.8 }));
    expect(a).not.toBe(b);
  });
});
