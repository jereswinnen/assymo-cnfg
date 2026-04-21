/** Format a per-tenant-per-year invoice number. Pattern: `YYYY-NNNN`
 *  with 4-digit zero-padding; sequences beyond 9999 are rendered as
 *  their natural-length integer (we never truncate). */
export function formatInvoiceNumber(year: number, seq: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new Error(`Invalid invoice-number year: ${year}`);
  }
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`Invalid invoice-number sequence: ${seq}`);
  }
  return `${year}-${String(seq).padStart(4, '0')}`;
}
