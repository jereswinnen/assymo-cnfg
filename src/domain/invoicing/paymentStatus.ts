export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overpaid';

const TOLERANCE_CENTS = 1;

/** Pure derivation of an invoice's payment bucket from its total and
 *  a list of payment amounts (cents). `paid` and `overpaid` are
 *  separated by a ±1 cent tolerance to absorb rounding drift. */
export function derivePaymentStatus(
  totalCents: number,
  payments: readonly { amountCents: number }[],
): PaymentStatus {
  const sum = payments.reduce((acc, p) => acc + p.amountCents, 0);
  if (sum <= 0) return 'unpaid';
  if (sum >= totalCents - TOLERANCE_CENTS && sum <= totalCents + TOLERANCE_CENTS) return 'paid';
  if (sum < totalCents) return 'partial';
  return 'overpaid';
}
