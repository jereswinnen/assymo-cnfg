import { describe, it, expect } from 'vite-plus/test';
import {
  validateSupplierProductCreate,
  validateSupplierProductPatch,
  validateDoorMeta,
  validateWindowMeta,
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
    expect(errors).toContain('body');
  });

  it('rejects missing supplierId', () => {
    const { errors } = validateSupplierProductCreate(baseDoor({ supplierId: '' }));
    expect(errors).toContain(SUPPLIER_ERROR_CODES.supplierIdRequired);
  });

  it('rejects invalid kind', () => {
    const { errors } = validateSupplierProductCreate(baseDoor({ kind: 'gate' }));
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
    expect(errors).toContain('body');
  });
});
