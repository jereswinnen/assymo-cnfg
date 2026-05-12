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

  it('returns true when the default-outer face points toward the neighbour centroid (flip needed)', () => {
    // Horizontal muur centred at (1.5, -0.925) (position [0, -1], width 3, depth 0.15).
    // Corrected outward = [0, +1] (SchematicWalls 'front' outerSign=+1 → outer in +Y).
    // Overkapping at origin, dims 4×4 → centroid (2, 2).
    // Default outer = (1.5, -0.85), default inner = (1.5, -1.0).
    // dist(outer, centroid) ≈ 2.82, dist(inner, centroid) ≈ 3.04 → outer CLOSER → flip needed.
    const muur = makeBuilding({
      id: 'm', type: 'muur', position: [0, -1],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'horizontal',
    });
    const ok = makeBuilding({ id: 'ok', type: 'overkapping', position: [0, 0], dimensions: { width: 4, depth: 4, height: 2.6 } });
    expect(detectInnerFlip(muur, [muur, ok])).toBe(true);
  });

  it('returns false when the default-inner face already points toward the neighbour centroid', () => {
    // Mirror of the previous test: muur centred at (1.5, 5.075), overkapping at origin (centroid 2, 2).
    // Default outer = (1.5, 5.15), default inner = (1.5, 5.0).
    // dist(outer, centroid) ≈ 3.19, dist(inner, centroid) ≈ 3.04 → inner CLOSER → no flip.
    const muur = makeBuilding({
      id: 'm', type: 'muur', position: [0, 5],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'horizontal',
    });
    const ok = makeBuilding({ id: 'ok', type: 'overkapping', position: [0, 0], dimensions: { width: 4, depth: 4, height: 2.6 } });
    expect(detectInnerFlip(muur, [muur, ok])).toBe(false);
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
