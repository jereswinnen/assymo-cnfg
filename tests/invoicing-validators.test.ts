import { describe, it, expect } from 'vite-plus/test';
import {
  validateIssueInvoiceInput,
  validatePaymentInput,
} from '@/domain/invoicing';

describe('validateIssueInvoiceInput', () => {
  const goodBody = {
    customerName: 'Klant NV',
    customerAddress: 'Straat 1\n9000 Gent',
    issuedAt: '2026-04-21',
    dueAt: '2026-05-21',
    vatRate: 0.21,
  };

  it('accepts a complete valid body', () => {
    const { value, errors } = validateIssueInvoiceInput(goodBody);
    expect(errors).toEqual([]);
    expect(value).toEqual(goodBody);
  });
  it('rejects a non-object body', () => {
    expect(validateIssueInvoiceInput(null).errors).toContain('body');
  });
  it('rejects missing required fields', () => {
    const { errors } = validateIssueInvoiceInput({});
    for (const k of ['customerName', 'customerAddress', 'issuedAt', 'dueAt', 'vatRate']) {
      expect(errors).toContain(k);
    }
  });
  it('rejects an empty customerAddress', () => {
    expect(validateIssueInvoiceInput({ ...goodBody, customerAddress: '' }).errors)
      .toContain('customerAddress');
  });
  it('rejects a dueAt that is before issuedAt', () => {
    expect(validateIssueInvoiceInput({ ...goodBody, dueAt: '2026-04-01' }).errors)
      .toContain('dueAt');
  });
  it('rejects malformed ISO dates', () => {
    expect(validateIssueInvoiceInput({ ...goodBody, issuedAt: 'not-a-date' }).errors)
      .toContain('issuedAt');
  });
  it('rejects vatRate outside [0, 1]', () => {
    expect(validateIssueInvoiceInput({ ...goodBody, vatRate: 1.1 }).errors)
      .toContain('vatRate');
  });
});

describe('validatePaymentInput', () => {
  const good = {
    amountCents: 10000,
    method: 'manual' as const,
    paidAt: '2026-04-21',
  };
  it('accepts a minimal valid body', () => {
    const { value, errors } = validatePaymentInput(good);
    expect(errors).toEqual([]);
    expect(value).toEqual({ ...good, providerRef: null, note: null });
  });
  it('accepts optional providerRef + note', () => {
    const { value, errors } = validatePaymentInput({
      ...good,
      providerRef: 'BANK-123',
      note: 'Overschrijving ING',
    });
    expect(errors).toEqual([]);
    expect(value?.providerRef).toBe('BANK-123');
    expect(value?.note).toBe('Overschrijving ING');
  });
  it('rejects non-positive amountCents', () => {
    expect(validatePaymentInput({ ...good, amountCents: 0 }).errors).toContain('amountCents');
    expect(validatePaymentInput({ ...good, amountCents: -1 }).errors).toContain('amountCents');
    expect(validatePaymentInput({ ...good, amountCents: 1.5 }).errors).toContain('amountCents');
  });
  it('rejects non-allowed method', () => {
    expect(validatePaymentInput({ ...good, method: 'cash' as never }).errors).toContain('method');
  });
  it('only allows `manual` in Phase 5 (Mollie/Stripe land with Phase 6)', () => {
    expect(validatePaymentInput({ ...good, method: 'mollie' as never }).errors).toContain('method');
  });
  it('rejects malformed paidAt', () => {
    expect(validatePaymentInput({ ...good, paidAt: '2026-99-99' }).errors).toContain('paidAt');
  });
});
