import { describe, it, expect } from 'vite-plus/test';
import { validateMaterialCreate } from '@/domain/catalog';

const base = {
  slug: 'm', name: 'M', color: '#888888',
  flags: {},
  textures: null as null,
  tileSize: null as null,
};

// Helper to extract errors from result (ok:true has no errors)
function getErrors(result: ReturnType<typeof validateMaterialCreate>) {
  return result.ok ? [] : result.errors;
}

describe('validateMaterialCreate — middenlaag pricing', () => {
  it('accepts a well-formed panel row', () => {
    const result = validateMaterialCreate({
      ...base,
      categories: ['middenlaag'],
      pricing: { middenlaag: { kind: 'panel', thicknessMm: 100, perSqm: 12 } },
    });
    expect(getErrors(result)).toEqual([]);
  });

  it('accepts a well-formed frame row', () => {
    const result = validateMaterialCreate({
      ...base,
      categories: ['middenlaag'],
      pricing: {
        middenlaag: {
          kind: 'frame', thicknessMm: 89, beamWidthMm: 38,
          beamSpacingMm: 600, perBeam: 15,
        },
      },
    });
    expect(getErrors(result)).toEqual([]);
  });

  it("rejects a 'middenlaag' row whose pricing slot is missing", () => {
    const result = validateMaterialCreate({
      ...base,
      categories: ['middenlaag'],
      pricing: {},
    });
    expect(getErrors(result).some(e => e.field === 'pricing.middenlaag' && e.code === 'pricing_invalid')).toBe(true);
  });

  it("rejects pricing.middenlaag.kind='panel' that carries beam fields", () => {
    const result = validateMaterialCreate({
      ...base,
      categories: ['middenlaag'],
      pricing: {
        middenlaag: {
          kind: 'panel', thicknessMm: 100, perSqm: 12, beamSpacingMm: 600,
        },
      },
    });
    expect(getErrors(result).some(e => e.field === 'pricing.middenlaag' && e.code === 'pricing_invalid')).toBe(true);
  });

  it("rejects pricing.middenlaag.kind='frame' missing perBeam", () => {
    const result = validateMaterialCreate({
      ...base,
      categories: ['middenlaag'],
      pricing: {
        middenlaag: {
          kind: 'frame', thicknessMm: 89, beamWidthMm: 38, beamSpacingMm: 600,
        },
      },
    });
    expect(getErrors(result).some(e => e.field === 'pricing.middenlaag' && e.code === 'pricing_invalid')).toBe(true);
  });

  it("rejects pricing.middenlaag on a row whose categories doesn't include 'middenlaag'", () => {
    const result = validateMaterialCreate({
      ...base,
      categories: ['wall'],
      pricing: {
        wall: { perSqm: 50 },
        middenlaag: { kind: 'panel', thicknessMm: 100, perSqm: 12 },
      },
    });
    expect(getErrors(result).some(e => e.field === 'pricing.middenlaag' && e.code === 'pricing_category_mismatch')).toBe(true);
  });

  it('rejects perSqm <= 0', () => {
    const result = validateMaterialCreate({
      ...base,
      categories: ['middenlaag'],
      pricing: { middenlaag: { kind: 'panel', thicknessMm: 100, perSqm: 0 } },
    });
    expect(getErrors(result).some(e => e.field === 'pricing.middenlaag' && e.code === 'pricing_invalid')).toBe(true);
  });
});
