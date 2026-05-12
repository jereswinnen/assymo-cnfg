import { describe, it, expect } from 'vite-plus/test';
import { addBuilding, applyInnerFlipAutoDetect } from '@/domain/config';
import { makeConfig } from './fixtures';

describe('addBuilding (muur)', () => {
  it('writes innerFlipped on a fresh muur based on existing buildings', () => {
    const seed = makeConfig();
    const result = addBuilding(seed, 'muur', [0, 5]);
    const muur = result.cfg.buildings.find(b => b.type === 'muur');
    expect(muur).toBeDefined();
    expect(typeof muur!.walls.front.innerFlipped).toBe('boolean');
    expect(muur!.walls.front.innerFlippedManual).toBeUndefined();
  });

  it('leaves innerFlipped false when no structural neighbours exist', () => {
    const seed = makeConfig();
    const empty = { ...seed, buildings: [] };
    const result = addBuilding(empty, 'muur', [0, 0]);
    const muur = result.cfg.buildings.find(b => b.type === 'muur');
    expect(muur!.walls.front.innerFlipped).toBe(false);
  });
});

describe('applyInnerFlipAutoDetect', () => {
  it('updates innerFlipped on the muur when geometry says so', () => {
    const seed = makeConfig();
    const withMuur = addBuilding(seed, 'muur', [0, 5]);
    const muur = withMuur.cfg.buildings.find(b => b.type === 'muur')!;
    // Force innerFlipped to the opposite of the canonical value, then re-run detect.
    const dirty = {
      ...withMuur.cfg,
      buildings: withMuur.cfg.buildings.map(b =>
        b.id === muur.id
          ? { ...b, walls: { ...b.walls, front: { ...b.walls.front, innerFlipped: !(b.walls.front.innerFlipped ?? false) } } }
          : b,
      ),
    };
    const cleaned = applyInnerFlipAutoDetect(dirty, muur.id);
    const finalMuur = cleaned.buildings.find(b => b.id === muur.id)!;
    // Re-running detect should restore the canonical value.
    expect(finalMuur.walls.front.innerFlipped).toBe(muur.walls.front.innerFlipped);
  });

  it('is a no-op when innerFlippedManual is true', () => {
    const seed = makeConfig();
    const withMuur = addBuilding(seed, 'muur', [0, 5]);
    const muur = withMuur.cfg.buildings.find(b => b.type === 'muur')!;
    const auto = muur.walls.front.innerFlipped ?? false;
    const overridden = {
      ...withMuur.cfg,
      buildings: withMuur.cfg.buildings.map(b =>
        b.id === muur.id
          ? {
              ...b,
              walls: {
                ...b.walls,
                front: {
                  ...b.walls.front,
                  innerFlipped: !auto,
                  innerFlippedManual: true,
                },
              },
            }
          : b,
      ),
    };
    const result = applyInnerFlipAutoDetect(overridden, muur.id);
    const final = result.buildings.find(b => b.id === muur.id)!;
    expect(final.walls.front.innerFlipped).toBe(!auto);
    expect(final.walls.front.innerFlippedManual).toBe(true);
  });

  it('is a no-op for non-muur buildings', () => {
    const seed = makeConfig();
    const bergingId = seed.buildings[0].id;
    const result = applyInnerFlipAutoDetect(seed, bergingId);
    expect(result).toBe(seed); // referential equality — no mutation
  });

  it('is a no-op when the building id is unknown', () => {
    const seed = makeConfig();
    const result = applyInnerFlipAutoDetect(seed, 'no-such-id');
    expect(result).toBe(seed);
  });
});
