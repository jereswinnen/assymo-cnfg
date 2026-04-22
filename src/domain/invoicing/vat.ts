/** Belgian VAT rates. Selectable from admin pickers; stored as a fractional
 *  number (e.g. 0.21) on tenant invoicing + issued invoices. Kept as a
 *  readonly tuple so TS can narrow at the UI layer. */
export const VAT_RATES = [0, 0.06, 0.12, 0.21] as const;
export type VatRate = (typeof VAT_RATES)[number];

export interface InvoiceAmounts {
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
}

/** Compute invoice subtotal / VAT / total from an ex-VAT subtotal + a
 *  fractional rate. Throws on invalid input so the API layer can 422 with
 *  a specific field path rather than producing nonsensical invoices. */
export function computeInvoiceAmounts(input: {
  subtotalCents: number;
  vatRate: number;
}): InvoiceAmounts {
  const { subtotalCents, vatRate } = input;
  if (!Number.isFinite(subtotalCents) || subtotalCents < 0 || !Number.isInteger(subtotalCents)) {
    throw new Error(`Invalid subtotalCents: ${subtotalCents}`);
  }
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 1) {
    throw new Error(`Invalid vatRate: ${vatRate}`);
  }
  const vatCents = Math.round(subtotalCents * vatRate);
  const totalCents = subtotalCents + vatCents;
  return { subtotalCents, vatCents, totalCents };
}
