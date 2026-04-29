import { describe, it, expect } from 'vite-plus/test';
import {
  validateSupplierProductCreate,
  validateSupplierProductPatch,
  validateDoorMeta,
  validateWindowMeta,
  validateGateMeta,
  SUPPLIER_ERROR_CODES,
} from '@/domain/supplier';

function baseDoor(overrides: Record<string, unknown> = {}) {
  return {
    supplierId: 'sup-1',
    kind: 'door',
    sku: 'DOOR-001',
    name: 'Steel Entry Door',
    heroImage: null,
    widthMm: 900,
    heightMm: 2100,
    priceCents: 75000,
    meta: {},
    ...overrides,
  };
}

function baseWindow(overrides: Record<string, unknown> = {}) {
  return {
    supplierId: 'sup-1',
    kind: 'window',
    sku: 'WIN-001',
    name: 'Double Glazed Window',
    heroImage: null,
    widthMm: 1200,
    heightMm: 900,
    priceCents: 45000,
    meta: {},
    ...overrides,
  };
}

describe('validateDoorMeta', () => {
  it('accepts an empty meta object', () => {
    const { value, errors } = validateDoorMeta({});
    expect(errors).toEqual([]);
    expect(value).toEqual({});
  });

  it('accepts all valid door meta fields', () => {
    const { value, errors } = validateDoorMeta({
      swingDirection: 'inward',
      lockType: 'cylinder',
      glazing: 'glass-panel',
      rValue: 1.8,
      leadTimeDays: 14,
    });
    expect(errors).toEqual([]);
    expect(value?.swingDirection).toBe('inward');
    expect(value?.glazing).toBe('glass-panel');
  });

  it('rejects invalid swingDirection', () => {
    const { errors } = validateDoorMeta({ swingDirection: 'sideways' });
    expect(errors.some((e) => e.includes('swingDirection'))).toBe(true);
  });

  it('rejects invalid lockType', () => {
    const { errors } = validateDoorMeta({ lockType: 'deadbolt' });
    expect(errors.some((e) => e.includes('lockType'))).toBe(true);
  });

  it('rejects invalid glazing', () => {
    const { errors } = validateDoorMeta({ glazing: 'full-glass' });
    expect(errors.some((e) => e.includes('glazing'))).toBe(true);
  });

  it('rejects negative rValue', () => {
    const { errors } = validateDoorMeta({ rValue: -1 });
    expect(errors.some((e) => e.includes('rValue'))).toBe(true);
  });

  it('rejects non-integer leadTimeDays', () => {
    const { errors } = validateDoorMeta({ leadTimeDays: 14.5 });
    expect(errors.some((e) => e.includes('leadTimeDays'))).toBe(true);
  });

  it('rejects non-object meta', () => {
    const { errors } = validateDoorMeta('not an object');
    expect(errors).toContain(SUPPLIER_ERROR_CODES.metaInvalid);
  });

  it('rejects window-only key glazingType in door meta', () => {
    const { errors } = validateDoorMeta({ glazingType: 'double' });
    expect(errors).toContain(SUPPLIER_ERROR_CODES.metaInvalid);
  });
});

describe('validateWindowMeta', () => {
  it('accepts an empty meta object', () => {
    const { value, errors } = validateWindowMeta({});
    expect(errors).toEqual([]);
    expect(value).toEqual({});
  });

  it('accepts all valid window meta fields', () => {
    const { value, errors } = validateWindowMeta({
      glazingType: 'triple',
      uValue: 0.7,
      frameMaterial: 'aluminium',
      openable: true,
      leadTimeDays: 21,
    });
    expect(errors).toEqual([]);
    expect(value?.glazingType).toBe('triple');
    expect(value?.openable).toBe(true);
  });

  it('rejects invalid glazingType', () => {
    const { errors } = validateWindowMeta({ glazingType: 'quadruple' });
    expect(errors.some((e) => e.includes('glazingType'))).toBe(true);
  });

  it('rejects negative uValue', () => {
    const { errors } = validateWindowMeta({ uValue: -0.1 });
    expect(errors.some((e) => e.includes('uValue'))).toBe(true);
  });

  it('rejects non-boolean openable', () => {
    const { errors } = validateWindowMeta({ openable: 'yes' });
    expect(errors.some((e) => e.includes('openable'))).toBe(true);
  });

  it('rejects door-only key swingDirection in window meta', () => {
    const { errors } = validateWindowMeta({ swingDirection: 'inward' });
    expect(errors).toContain(SUPPLIER_ERROR_CODES.metaInvalid);
  });

  it('accepts segments with required threshold', () => {
    const r = validateWindowMeta({
      segments: { enabled: true, autoThresholdMm: 1500 },
    });
    expect(r.errors).toEqual([]);
    expect(r.value?.segments).toEqual({ enabled: true, autoThresholdMm: 1500 });
  });

  it('rejects segments enabled without autoThresholdMm', () => {
    const r = validateWindowMeta({ segments: { enabled: true } });
    expect(r.value).toBeNull();
    expect(r.errors).toContain(SUPPLIER_ERROR_CODES.segmentsInvalid);
  });

  it('rejects negative autoThresholdMm', () => {
    const r = validateWindowMeta({
      segments: { enabled: true, autoThresholdMm: -1 },
    });
    expect(r.value).toBeNull();
  });

  it('rejects maxCount < 1', () => {
    const r = validateWindowMeta({
      segments: { enabled: true, autoThresholdMm: 1500, maxCount: 0 },
    });
    expect(r.value).toBeNull();
  });

  it('rejects negative surchargeCentsPerDivider', () => {
    const r = validateWindowMeta({
      segments: { enabled: true, autoThresholdMm: 1500, surchargeCentsPerDivider: -10 },
    });
    expect(r.value).toBeNull();
  });

  it('accepts schuifraam enabled without surcharge', () => {
    const r = validateWindowMeta({ schuifraam: { enabled: true } });
    expect(r.errors).toEqual([]);
    expect(r.value?.schuifraam).toEqual({ enabled: true });
  });

  it('accepts schuifraam with surcharge', () => {
    const r = validateWindowMeta({
      schuifraam: { enabled: true, surchargeCents: 25000 },
    });
    expect(r.value?.schuifraam?.surchargeCents).toBe(25000);
  });

  it('rejects negative schuifraam surcharge', () => {
    const r = validateWindowMeta({
      schuifraam: { enabled: true, surchargeCents: -1 },
    });
    expect(r.value).toBeNull();
  });
});

describe('validateGateMeta', () => {
  it('accepts an empty meta object', () => {
    const { value, errors } = validateGateMeta({});
    expect(errors).toEqual([]);
    expect(value).toEqual({});
  });

  it('accepts a fully populated gate meta', () => {
    const { value, errors } = validateGateMeta({
      partCount: 'configurable',
      motorized: 'optional',
      motorizedSurchargeCents: 85000,
      swingDirections: ['inward', 'outward', 'sliding'],
      defaultDimensions: { widthMm: 3000, heightMm: 2000 },
      maxDimensions: { widthMm: 4000, heightMm: 2500 },
      glazing: 'partial',
      availableColors: [
        { sku: 'ral-7016', label: 'Antraciet', ralCode: 'RAL 7016' },
        { sku: 'ral-9005', label: 'Zwart', ralCode: 'RAL 9005', surchargeCents: 5000 },
      ],
      availableLocks: [{ sku: 'cyl', label: 'Cilinderslot' }],
      availableHandles: [{ sku: 'standard', labelKey: 'gate.handle.std' }],
      rValue: 1.2,
      leadTimeDays: 14,
    });
    expect(errors).toEqual([]);
    expect(value?.partCount).toBe('configurable');
    expect(value?.availableColors?.[1].surchargeCents).toBe(5000);
  });

  it('rejects unknown top-level meta key', () => {
    const { errors } = validateGateMeta({ unknownKey: 1 });
    expect(errors).toContain(SUPPLIER_ERROR_CODES.metaInvalid);
  });

  it('rejects invalid partCount', () => {
    const { errors } = validateGateMeta({ partCount: 3 });
    expect(errors.some((e) => e.includes('partCount'))).toBe(true);
  });

  it('rejects invalid motorized', () => {
    const { errors } = validateGateMeta({ motorized: 'maybe' });
    expect(errors.some((e) => e.includes('motorized'))).toBe(true);
  });

  it('rejects invalid swingDirections entry', () => {
    const { errors } = validateGateMeta({ swingDirections: ['inward', 'sideways'] });
    expect(errors.some((e) => e.includes('swingDirections'))).toBe(true);
  });

  it('rejects invalid glazing', () => {
    const { errors } = validateGateMeta({ glazing: 'tempered' });
    expect(errors.some((e) => e.includes('glazing'))).toBe(true);
  });

  it('rejects defaultDimensions with extra keys', () => {
    const { errors } = validateGateMeta({
      defaultDimensions: { widthMm: 1000, heightMm: 1000, depthMm: 100 },
    });
    expect(errors.some((e) => e.includes('defaultDimensions'))).toBe(true);
  });

  it('rejects maxDimensions with non-positive values', () => {
    const { errors } = validateGateMeta({ maxDimensions: { widthMm: 0, heightMm: 1000 } });
    expect(errors.some((e) => e.includes('maxDimensions'))).toBe(true);
  });

  it('rejects an option without sku', () => {
    const { errors } = validateGateMeta({ availableColors: [{ label: 'X' }] });
    expect(errors.some((e) => e.includes('availableColors'))).toBe(true);
  });

  it('rejects an option without label or labelKey', () => {
    const { errors } = validateGateMeta({ availableLocks: [{ sku: 'x' }] });
    expect(errors.some((e) => e.includes('availableLocks'))).toBe(true);
  });

  it('rejects an option with negative surcharge', () => {
    const { errors } = validateGateMeta({
      availableHandles: [{ sku: 'x', label: 'Greep', surchargeCents: -1 }],
    });
    expect(errors.some((e) => e.includes('availableHandles'))).toBe(true);
  });

  it('rejects duplicate option skus within one list', () => {
    const { errors } = validateGateMeta({
      availableColors: [
        { sku: 'a', label: 'A' },
        { sku: 'a', label: 'B' },
      ],
    });
    expect(errors.some((e) => e.includes('availableColors'))).toBe(true);
  });

  it('rejects an option with unknown key', () => {
    const { errors } = validateGateMeta({
      availableColors: [{ sku: 'a', label: 'A', extra: 1 }],
    });
    expect(errors.some((e) => e.includes('availableColors'))).toBe(true);
  });
});

describe('validateSupplierProductCreate', () => {
  it('accepts a valid door product', () => {
    const { value, errors } = validateSupplierProductCreate(baseDoor());
    expect(errors).toEqual([]);
    expect(value?.kind).toBe('door');
    expect(value?.sku).toBe('DOOR-001');
  });

  it('accepts a valid window product', () => {
    const { value, errors } = validateSupplierProductCreate(baseWindow());
    expect(errors).toEqual([]);
    expect(value?.kind).toBe('window');
  });

  it('rejects a non-object body', () => {
    const { errors } = validateSupplierProductCreate(null);
    expect(errors).toContain(SUPPLIER_ERROR_CODES.bodyInvalid);
  });

  it('rejects missing supplierId', () => {
    const { errors } = validateSupplierProductCreate(baseDoor({ supplierId: '' }));
    expect(errors).toContain(SUPPLIER_ERROR_CODES.supplierIdRequired);
  });

  it('rejects invalid kind', () => {
    const { errors } = validateSupplierProductCreate(baseDoor({ kind: 'shutter' }));
    expect(errors).toContain(SUPPLIER_ERROR_CODES.kindInvalid);
  });

  it('rejects empty sku', () => {
    const { errors } = validateSupplierProductCreate(baseDoor({ sku: '' }));
    expect(errors).toContain(SUPPLIER_ERROR_CODES.skuRequired);
  });

  it('rejects empty name', () => {
    const { errors } = validateSupplierProductCreate(baseDoor({ name: '' }));
    expect(errors).toContain(SUPPLIER_ERROR_CODES.nameMissing);
  });

  it('rejects widthMm of zero', () => {
    const { errors } = validateSupplierProductCreate(baseDoor({ widthMm: 0 }));
    expect(errors).toContain(SUPPLIER_ERROR_CODES.widthInvalid);
  });

  it('rejects widthMm exceeding 10000', () => {
    const { errors } = validateSupplierProductCreate(baseDoor({ widthMm: 10001 }));
    expect(errors).toContain(SUPPLIER_ERROR_CODES.widthInvalid);
  });

  it('rejects non-integer widthMm', () => {
    const { errors } = validateSupplierProductCreate(baseDoor({ widthMm: 900.5 }));
    expect(errors).toContain(SUPPLIER_ERROR_CODES.widthInvalid);
  });

  it('rejects heightMm of zero', () => {
    const { errors } = validateSupplierProductCreate(baseDoor({ heightMm: 0 }));
    expect(errors).toContain(SUPPLIER_ERROR_CODES.heightInvalid);
  });

  it('rejects negative priceCents', () => {
    const { errors } = validateSupplierProductCreate(baseDoor({ priceCents: -1 }));
    expect(errors).toContain(SUPPLIER_ERROR_CODES.priceInvalid);
  });

  it('accepts priceCents of zero (free product)', () => {
    const { errors } = validateSupplierProductCreate(baseDoor({ priceCents: 0 }));
    expect(errors).toEqual([]);
  });

  it('rejects non-integer priceCents', () => {
    const { errors } = validateSupplierProductCreate(baseDoor({ priceCents: 750.5 }));
    expect(errors).toContain(SUPPLIER_ERROR_CODES.priceInvalid);
  });

  it('defaults sortOrder to 0 when omitted', () => {
    const { value } = validateSupplierProductCreate(baseDoor({ sortOrder: undefined }));
    expect(value?.sortOrder).toBe(0);
  });

  it('accepts a non-null heroImage string', () => {
    const { value, errors } = validateSupplierProductCreate(baseDoor({ heroImage: 'https://blob/door.jpg' }));
    expect(errors).toEqual([]);
    expect(value?.heroImage).toBe('https://blob/door.jpg');
  });

  it('passes door meta through kind-specific validator', () => {
    const { errors } = validateSupplierProductCreate(baseDoor({ meta: { swingDirection: 'bad-value' } }));
    expect(errors.some((e) => e.includes('swingDirection'))).toBe(true);
  });

  it('passes window meta through kind-specific validator', () => {
    const { errors } = validateSupplierProductCreate(baseWindow({ meta: { glazingType: 'quadruple' } }));
    expect(errors.some((e) => e.includes('glazingType'))).toBe(true);
  });

  it('rejects kind=door with window-only meta key glazingType', () => {
    const { value, errors } = validateSupplierProductCreate(baseDoor({ meta: { glazingType: 'double' } }));
    expect(value).toBeNull();
    expect(errors).toContain(SUPPLIER_ERROR_CODES.metaInvalid);
  });

  it('rejects kind=window with door-only meta key swingDirection', () => {
    const { value, errors } = validateSupplierProductCreate(baseWindow({ meta: { swingDirection: 'inward' } }));
    expect(value).toBeNull();
    expect(errors).toContain(SUPPLIER_ERROR_CODES.metaInvalid);
  });
});

describe('validateSupplierProductPatch', () => {
  it('accepts an empty patch', () => {
    const { value, errors } = validateSupplierProductPatch({});
    expect(errors).toEqual([]);
    expect(value).toEqual({});
  });

  it('accepts a sku-only patch', () => {
    const { value, errors } = validateSupplierProductPatch({ sku: 'DOOR-002' });
    expect(errors).toEqual([]);
    expect(value?.sku).toBe('DOOR-002');
  });

  it('rejects empty sku on patch', () => {
    const { errors } = validateSupplierProductPatch({ sku: '' });
    expect(errors).toContain(SUPPLIER_ERROR_CODES.skuRequired);
  });

  it('accepts widthMm patch', () => {
    const { value, errors } = validateSupplierProductPatch({ widthMm: 1000 });
    expect(errors).toEqual([]);
    expect(value?.widthMm).toBe(1000);
  });

  it('rejects invalid widthMm on patch', () => {
    const { errors } = validateSupplierProductPatch({ widthMm: -100 });
    expect(errors).toContain(SUPPLIER_ERROR_CODES.widthInvalid);
  });

  it('accepts clearing heroImage to null', () => {
    const { value, errors } = validateSupplierProductPatch({ heroImage: null });
    expect(errors).toEqual([]);
    expect(value?.heroImage).toBeNull();
  });

  it('rejects non-object body on patch', () => {
    const { errors } = validateSupplierProductPatch(42);
    expect(errors).toContain(SUPPLIER_ERROR_CODES.bodyInvalid);
  });
});
