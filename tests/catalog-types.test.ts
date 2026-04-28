import { describe, it, expect } from 'vite-plus/test';
import {
  PRODUCT_KINDS,
  type ProductKind,
  type ProductDefaults,
  type ProductConstraints,
} from '@/domain/catalog';

describe('PRODUCT_KINDS', () => {
  it('contains overkapping, berging, and poort', () => {
    expect(PRODUCT_KINDS).toContain('overkapping');
    expect(PRODUCT_KINDS).toContain('berging');
    expect(PRODUCT_KINDS).toContain('poort');
  });

  it("admits 'poort' as a ProductKind value", () => {
    const k: ProductKind = 'poort';
    expect((PRODUCT_KINDS as readonly string[]).includes(k)).toBe(true);
  });
});

describe('ProductDefaults.poort', () => {
  it('accepts a fully populated poort subobject', () => {
    const d: ProductDefaults = {
      poort: {
        partCount: 2,
        partWidthMm: 1500,
        heightMm: 1800,
        swingDirection: 'inward',
        motorized: true,
        materialId: 'staal-antraciet',
      },
    };
    expect(d.poort?.partCount).toBe(2);
    expect(d.poort?.swingDirection).toBe('inward');
    expect(d.poort?.materialId).toBe('staal-antraciet');
  });

  it('accepts an undefined poort subobject', () => {
    const d: ProductDefaults = { width: 4 };
    expect(d.poort).toBeUndefined();
  });
});

describe('ProductConstraints.poort', () => {
  it('accepts a fully populated poort subobject', () => {
    const c: ProductConstraints = {
      poort: {
        partCountAllowed: [1, 2],
        partWidthMinMm: 800,
        partWidthMaxMm: 2000,
        heightMinMm: 1200,
        heightMaxMm: 2400,
        swingsAllowed: ['inward', 'outward', 'sliding'],
        motorizedAllowed: true,
        allowedMaterialSlugs: ['staal-antraciet', 'hout-verticaal'],
      },
    };
    expect(c.poort?.partCountAllowed).toEqual([1, 2]);
    expect(c.poort?.swingsAllowed).toContain('sliding');
    expect(c.poort?.allowedMaterialSlugs).toHaveLength(2);
  });
});
