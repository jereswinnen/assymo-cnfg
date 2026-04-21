import { describe, it, expect } from 'vite-plus/test';
import { computeInvoiceAmounts } from '@/domain/invoicing';

describe('computeInvoiceAmounts', () => {
  it('adds 21% VAT on a round subtotal', () => {
    expect(computeInvoiceAmounts({ subtotalCents: 10000, vatRate: 0.21 }))
      .toEqual({ subtotalCents: 10000, vatCents: 2100, totalCents: 12100 });
  });
  it('rounds half-away-from-zero per Math.round', () => {
    // 12345 * 0.21 = 2592.45 → 2592 (Math.round on 2592.45 = 2592)
    expect(computeInvoiceAmounts({ subtotalCents: 12345, vatRate: 0.21 }))
      .toEqual({ subtotalCents: 12345, vatCents: 2592, totalCents: 14937 });
  });
  it('returns zero VAT when rate is 0', () => {
    expect(computeInvoiceAmounts({ subtotalCents: 10000, vatRate: 0 }))
      .toEqual({ subtotalCents: 10000, vatCents: 0, totalCents: 10000 });
  });
  it('handles the Belgian 6% construction rate', () => {
    expect(computeInvoiceAmounts({ subtotalCents: 10000, vatRate: 0.06 }))
      .toEqual({ subtotalCents: 10000, vatCents: 600, totalCents: 10600 });
  });
  it('handles the Belgian 12% rate', () => {
    expect(computeInvoiceAmounts({ subtotalCents: 10000, vatRate: 0.12 }))
      .toEqual({ subtotalCents: 10000, vatCents: 1200, totalCents: 11200 });
  });
  it('throws on negative subtotal', () => {
    expect(() => computeInvoiceAmounts({ subtotalCents: -1, vatRate: 0.21 })).toThrow();
  });
  it('throws on invalid vatRate', () => {
    expect(() => computeInvoiceAmounts({ subtotalCents: 100, vatRate: -0.1 })).toThrow();
    expect(() => computeInvoiceAmounts({ subtotalCents: 100, vatRate: 1.1 })).toThrow();
    expect(() => computeInvoiceAmounts({ subtotalCents: 100, vatRate: Number.NaN })).toThrow();
  });
});
