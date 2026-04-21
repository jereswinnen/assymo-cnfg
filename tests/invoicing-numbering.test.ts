import { describe, it, expect } from 'vite-plus/test';
import { formatInvoiceNumber } from '@/domain/invoicing';

describe('formatInvoiceNumber', () => {
  it('zero-pads sequence to four digits', () => {
    expect(formatInvoiceNumber(2026, 1)).toBe('2026-0001');
    expect(formatInvoiceNumber(2026, 42)).toBe('2026-0042');
    expect(formatInvoiceNumber(2026, 9999)).toBe('2026-9999');
  });
  it('allows sequences beyond 9999 without truncation', () => {
    // Extremely unlikely but should be resilient.
    expect(formatInvoiceNumber(2026, 10000)).toBe('2026-10000');
    expect(formatInvoiceNumber(2026, 123456)).toBe('2026-123456');
  });
  it('throws on a negative or non-integer sequence', () => {
    expect(() => formatInvoiceNumber(2026, 0)).toThrow();
    expect(() => formatInvoiceNumber(2026, -1)).toThrow();
    expect(() => formatInvoiceNumber(2026, 1.5)).toThrow();
  });
  it('throws on a non-4-digit year', () => {
    expect(() => formatInvoiceNumber(99, 1)).toThrow();
    expect(() => formatInvoiceNumber(20260, 1)).toThrow();
    expect(() => formatInvoiceNumber(1999, 1)).not.toThrow();
  });
});
