import { describe, it, expect } from 'vite-plus/test';
import { derivePaymentStatus } from '@/domain/invoicing';

describe('derivePaymentStatus', () => {
  const total = 10000;
  const payments = (amounts: number[]) =>
    amounts.map((amountCents) => ({ amountCents }));

  it('returns "unpaid" when sum is 0', () => {
    expect(derivePaymentStatus(total, payments([]))).toBe('unpaid');
    expect(derivePaymentStatus(total, payments([0, 0]))).toBe('unpaid');
  });
  it('returns "partial" when 0 < sum < total', () => {
    expect(derivePaymentStatus(total, payments([5000]))).toBe('partial');
    expect(derivePaymentStatus(total, payments([3000, 2000]))).toBe('partial');
  });
  it('returns "paid" when sum equals total', () => {
    expect(derivePaymentStatus(total, payments([10000]))).toBe('paid');
    expect(derivePaymentStatus(total, payments([4000, 6000]))).toBe('paid');
  });
  it('collapses a 1-cent rounding gap into "paid"', () => {
    expect(derivePaymentStatus(total, payments([9999]))).toBe('paid');
  });
  it('returns "overpaid" when sum exceeds total by more than tolerance', () => {
    expect(derivePaymentStatus(total, payments([11000]))).toBe('overpaid');
  });
  it('1-cent overpay stays "paid" (tolerance)', () => {
    expect(derivePaymentStatus(total, payments([10001]))).toBe('paid');
  });
});
