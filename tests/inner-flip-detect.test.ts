import { describe, it, expect } from 'vite-plus/test';
import { detectInnerFlip, INNER_FLIP_DETECT_RADIUS } from '@/domain/building';
import { makeBuilding } from './fixtures';

describe('detectInnerFlip', () => {
  it('returns false for non-muur buildings', () => {
    const overkapping = makeBuilding({ id: 'ok', type: 'overkapping', position: [0, 0], dimensions: { width: 4, depth: 4, height: 2.6 } });
    expect(detectInnerFlip(overkapping, [])).toBe(false);
  });

  it('returns false for a muur with no structural neighbours', () => {
    const muur = makeBuilding({
      id: 'm', type: 'muur', position: [50, 50],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'horizontal',
    });
    expect(detectInnerFlip(muur, [muur])).toBe(false);
  });

  it('returns false when the default-inner face already points toward the neighbour centroid', () => {
    // Horizontal muur centred at (1.5, -0.925) (position [0, -1], width 3, depth 0.15).
    // Default outward = [0,-1] in your implementation (see fixtures + outerSign convention).
    // Overkapping at origin, dims 4×4 → centroid at (2, 2). Default inner at +y → CLOSER to centroid → no flip.
    const muur = makeBuilding({
      id: 'm', type: 'muur', position: [0, -1],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'horizontal',
    });
    const ok = makeBuilding({ id: 'ok', type: 'overkapping', position: [0, 0], dimensions: { width: 4, depth: 4, height: 2.6 } });
    expect(detectInnerFlip(muur, [muur, ok])).toBe(false);
  });

  it('returns true when the default-outer face points toward the neighbour centroid (flip needed)', () => {
    // Mirror of the previous test: muur centred at (1.5, 5.075), overkapping at origin
    // (centroid 2,2). Default outward = [0,-1] (per horizontal convention) — points toward -y, i.e. toward
    // the centroid. So outer is CLOSER to centroid → flip needed.
    const muur = makeBuilding({
      id: 'm', type: 'muur', position: [0, 5],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'horizontal',
    });
    const ok = makeBuilding({ id: 'ok', type: 'overkapping', position: [0, 0], dimensions: { width: 4, depth: 4, height: 2.6 } });
    expect(detectInnerFlip(muur, [muur, ok])).toBe(true);
  });

  it('ignores neighbours outside INNER_FLIP_DETECT_RADIUS', () => {
    expect(INNER_FLIP_DETECT_RADIUS).toBe(5);
    const muur = makeBuilding({
      id: 'm', type: 'muur', position: [0, 0],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'horizontal',
    });
    const farOk = makeBuilding({
      id: 'ok', type: 'overkapping', position: [20, 20],
      dimensions: { width: 4, depth: 4, height: 2.6 },
    });
    expect(detectInnerFlip(muur, [muur, farOk])).toBe(false);
  });

  it('ignores paal / muur neighbours (only structural buildings count)', () => {
    const muur = makeBuilding({
      id: 'm', type: 'muur', position: [0, 0],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'horizontal',
    });
    const otherMuur = makeBuilding({
      id: 'm2', type: 'muur', position: [0, 1],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'horizontal',
    });
    const paal = makeBuilding({
      id: 'p', type: 'paal', position: [0, 1],
      dimensions: { width: 0.15, depth: 0.15, height: 2.6 },
    });
    expect(detectInnerFlip(muur, [muur, otherMuur, paal])).toBe(false);
  });
});
