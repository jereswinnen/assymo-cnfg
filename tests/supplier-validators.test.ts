import { describe, it, expect } from 'vite-plus/test';
import {
  slugify,
  validateSupplierCreate,
  validateSupplierPatch,
  SUPPLIER_ERROR_CODES,
} from '@/domain/supplier';

describe('slugify', () => {
  it('lowercases and trims', () => {
    expect(slugify('  Hello World  ')).toBe('hello-world');
  });
  it('strips non-alphanumeric characters', () => {
    expect(slugify('Béton & Co.')).toBe('bton-co');
  });
  it('collapses multiple hyphens', () => {
    expect(slugify('foo  --  bar')).toBe('foo-bar');
  });
  it('strips leading and trailing hyphens', () => {
    expect(slugify('---foo---')).toBe('foo');
  });
  it('handles already-valid slug', () => {
    expect(slugify('my-supplier')).toBe('my-supplier');
  });
});

describe('validateSupplierCreate', () => {
  const base = {
    name: 'Velux NV',
    slug: 'velux',
    logoUrl: null,
    contact: {},
    notes: null,
  };

  it('accepts a minimal valid supplier', () => {
    const { value, errors } = validateSupplierCreate(base);
    expect(errors).toEqual([]);
    expect(value?.name).toBe('Velux NV');
    expect(value?.slug).toBe('velux');
  });

  it('trims name whitespace', () => {
    const { value } = validateSupplierCreate({ ...base, name: '  Velux NV  ' });
    expect(value?.name).toBe('Velux NV');
  });

  it('rejects a non-object body', () => {
    const { errors } = validateSupplierCreate(null);
    expect(errors).toContain(SUPPLIER_ERROR_CODES.bodyInvalid);
  });

  it('rejects missing name', () => {
    const { errors } = validateSupplierCreate({ ...base, name: '' });
    expect(errors).toContain(SUPPLIER_ERROR_CODES.nameRequired);
  });

  it('rejects name that is too long', () => {
    const { errors } = validateSupplierCreate({ ...base, name: 'x'.repeat(101) });
    expect(errors).toContain(SUPPLIER_ERROR_CODES.nameRequired);
  });

  it('rejects an invalid slug (uppercase)', () => {
    const { errors } = validateSupplierCreate({ ...base, slug: 'Velux' });
    expect(errors).toContain(SUPPLIER_ERROR_CODES.slugInvalid);
  });

  it('rejects an invalid slug (spaces)', () => {
    const { errors } = validateSupplierCreate({ ...base, slug: 'my supplier' });
    expect(errors).toContain(SUPPLIER_ERROR_CODES.slugInvalid);
  });

  it('accepts a logo URL when set', () => {
    const { value, errors } = validateSupplierCreate({ ...base, logoUrl: 'https://cdn.example.com/logo.png' });
    expect(errors).toEqual([]);
    expect(value?.logoUrl).toBe('https://cdn.example.com/logo.png');
  });

  it('defaults logoUrl to null when omitted', () => {
    const { value } = validateSupplierCreate({ ...base, logoUrl: undefined });
    expect(value?.logoUrl).toBeNull();
  });

  it('accepts contact with valid email', () => {
    const { value, errors } = validateSupplierCreate({ ...base, contact: { email: 'info@velux.be' } });
    expect(errors).toEqual([]);
    expect(value?.contact.email).toBe('info@velux.be');
  });

  it('rejects contact with broken email', () => {
    const { errors } = validateSupplierCreate({ ...base, contact: { email: 'not-an-email' } });
    expect(errors).toContain(SUPPLIER_ERROR_CODES.contactInvalid);
  });

  it('accepts contact with valid website', () => {
    const { value, errors } = validateSupplierCreate({ ...base, contact: { website: 'https://velux.be' } });
    expect(errors).toEqual([]);
    expect(value?.contact.website).toBe('https://velux.be');
  });

  it('rejects contact with website that lacks https scheme', () => {
    const { errors } = validateSupplierCreate({ ...base, contact: { website: 'velux.be' } });
    expect(errors).toContain(SUPPLIER_ERROR_CODES.contactInvalid);
  });

  it('accepts http:// websites', () => {
    const { errors } = validateSupplierCreate({ ...base, contact: { website: 'http://velux.be' } });
    expect(errors).toEqual([]);
  });

  it('accepts notes string', () => {
    const { value } = validateSupplierCreate({ ...base, notes: 'Preferred supplier' });
    expect(value?.notes).toBe('Preferred supplier');
  });

  it('defaults notes to null when omitted', () => {
    const { value } = validateSupplierCreate({ ...base, notes: undefined });
    expect(value?.notes).toBeNull();
  });

  it('accepts a phone in contact', () => {
    const { value, errors } = validateSupplierCreate({ ...base, contact: { phone: '+32 9 123 45 67' } });
    expect(errors).toEqual([]);
    expect(value?.contact.phone).toBe('+32 9 123 45 67');
  });
});

describe('validateSupplierPatch', () => {
  it('accepts an empty patch', () => {
    const { value, errors } = validateSupplierPatch({});
    expect(errors).toEqual([]);
    expect(value).toEqual({});
  });

  it('accepts a name-only patch', () => {
    const { value, errors } = validateSupplierPatch({ name: 'Renson NV' });
    expect(errors).toEqual([]);
    expect(value?.name).toBe('Renson NV');
  });

  it('accepts a slug-only patch', () => {
    const { value, errors } = validateSupplierPatch({ slug: 'renson' });
    expect(errors).toEqual([]);
    expect(value?.slug).toBe('renson');
  });

  it('rejects an invalid slug on patch', () => {
    const { errors } = validateSupplierPatch({ slug: 'Renson NV' });
    expect(errors).toContain(SUPPLIER_ERROR_CODES.slugInvalid);
  });

  it('accepts clearing logoUrl to null', () => {
    const { value, errors } = validateSupplierPatch({ logoUrl: null });
    expect(errors).toEqual([]);
    expect(value?.logoUrl).toBeNull();
  });

  it('accepts a contact patch', () => {
    const { value, errors } = validateSupplierPatch({ contact: { email: 'new@example.com' } });
    expect(errors).toEqual([]);
    expect(value?.contact?.email).toBe('new@example.com');
  });

  it('rejects non-object body on patch', () => {
    const { errors } = validateSupplierPatch('string');
    expect(errors).toContain(SUPPLIER_ERROR_CODES.bodyInvalid);
  });
});
