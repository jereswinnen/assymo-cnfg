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

  it('vertical muur — returns true when default-outer points toward centroid (flip needed)', () => {
    // Vertical muur: world centre = (position.x + depth/2, position.z + width/2)
    //   = (-1 + 0.075, 0 + 1.5) = (-0.925, 1.5).
    // Overkapping at origin (4×4) → centroid (2, 2).
    // Vertical default-outer = [+1, 0] (π/2 Y-rotation maps local +Z → world +X).
    // Outer face: (-0.925 + 0.075, 1.5) = (-0.85, 1.5).
    // dist(outer (-0.85, 1.5), centroid (2, 2)) = sqrt(2.85²+0.5²) ≈ 2.89
    // dist(inner (-1.00, 1.5), centroid (2, 2)) = sqrt(3.00²+0.5²) ≈ 3.04
    // Outer closer → flip needed → expect true.
    const muur = makeBuilding({
      id: 'm', type: 'muur', position: [-1, 0],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'vertical',
    });
    const ok = makeBuilding({ id: 'ok', type: 'overkapping', position: [0, 0], dimensions: { width: 4, depth: 4, height: 2.6 } });
    expect(detectInnerFlip(muur, [muur, ok])).toBe(true);
  });

  it('vertical muur — returns false when default-inner already points toward centroid', () => {
    // Vertical muur: world centre = (5 + 0.075, 0 + 1.5) = (5.075, 1.5).
    // Overkapping at origin (4×4) → centroid (2, 2).
    // Vertical default-outer = [+1, 0].
    // Outer face: (5.15, 1.5). Inner face: (5.0, 1.5).
    // dist(outer (5.15, 1.5), centroid (2, 2)) = sqrt(3.15²+0.5²) ≈ 3.19
    // dist(inner (5.00, 1.5), centroid (2, 2)) = sqrt(3.00²+0.5²) ≈ 3.04
    // Inner closer → no flip → expect false.
    const muur = makeBuilding({
      id: 'm', type: 'muur', position: [5, 0],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'vertical',
    });
    const ok = makeBuilding({ id: 'ok', type: 'overkapping', position: [0, 0], dimensions: { width: 4, depth: 4, height: 2.6 } });
    expect(detectInnerFlip(muur, [muur, ok])).toBe(false);
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
