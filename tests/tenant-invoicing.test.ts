import { describe, it, expect } from 'vite-plus/test';
import {
  DEFAULT_ASSYMO_INVOICING,
  validateInvoicingPatch,
} from '@/domain/tenant';

describe('DEFAULT_ASSYMO_INVOICING', () => {
  it('ships a 21% VAT rate and 30-day term', () => {
    expect(DEFAULT_ASSYMO_INVOICING.vatRate).toBe(0.21);
    expect(DEFAULT_ASSYMO_INVOICING.paymentTermDays).toBe(30);
  });
  it('has a blank bankIban sentinel (admin must fill)', () => {
    expect(DEFAULT_ASSYMO_INVOICING.bankIban).toBe('');
    expect(DEFAULT_ASSYMO_INVOICING.bankBic).toBeNull();
  });
});

describe('validateInvoicingPatch', () => {
  it('accepts a complete valid patch', () => {
    const { invoicing, errors } = validateInvoicingPatch({
      vatRate: 0.06,
      paymentTermDays: 45,
      bankIban: 'BE68 5390 0754 7034',
      bankBic: 'BBRUBEBB',
    });
    expect(errors).toEqual([]);
    expect(invoicing).toEqual({
      vatRate: 0.06,
      paymentTermDays: 45,
      bankIban: 'BE68 5390 0754 7034',
      bankBic: 'BBRUBEBB',
    });
  });

  it('accepts a partial patch (only paymentTermDays)', () => {
    const { invoicing, errors } = validateInvoicingPatch({ paymentTermDays: 60 });
    expect(errors).toEqual([]);
    expect(invoicing).toEqual({ paymentTermDays: 60 });
  });

  it('rejects a non-object body', () => {
    const { errors } = validateInvoicingPatch(null);
    expect(errors).toContain('body');
  });

  it('rejects vatRate outside 0-1 inclusive', () => {
    expect(validateInvoicingPatch({ vatRate: 1.5 }).errors).toContain('vatRate');
    expect(validateInvoicingPatch({ vatRate: -0.1 }).errors).toContain('vatRate');
    expect(validateInvoicingPatch({ vatRate: 0 }).errors).toEqual([]);
    expect(validateInvoicingPatch({ vatRate: 1 }).errors).toEqual([]);
  });

  it('rejects non-positive paymentTermDays', () => {
    expect(validateInvoicingPatch({ paymentTermDays: 0 }).errors).toContain('paymentTermDays');
    expect(validateInvoicingPatch({ paymentTermDays: -5 }).errors).toContain('paymentTermDays');
    expect(validateInvoicingPatch({ paymentTermDays: 1.5 }).errors).toContain('paymentTermDays');
  });

  it('rejects empty bankIban when key is present', () => {
    expect(validateInvoicingPatch({ bankIban: '' }).errors).toContain('bankIban');
  });

  it('accepts null bankBic (explicit clear) but not empty string', () => {
    expect(validateInvoicingPatch({ bankBic: null }).errors).toEqual([]);
    expect(validateInvoicingPatch({ bankBic: '' }).errors).toContain('bankBic');
  });
});
