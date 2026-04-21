/** Per-tenant invoicing defaults. Editable through the admin
 *  InvoicingSection; seeded on the assymo tenant with 21% / 30d. */
export interface TenantInvoicing {
  /** VAT rate as a fraction. 0.21 = 21%. Valid range [0, 1]. */
  vatRate: number;
  /** Default due-date offset from issue date. Positive integer days. */
  paymentTermDays: number;
  /** Supplier's bank account for the invoice footer. Admin MUST set
   *  this before issuing the first invoice — the server returns
   *  `supplier_incomplete` (422) otherwise. Empty string = unset. */
  bankIban: string;
  /** Optional BIC; null when the bank doesn't require it. */
  bankBic: string | null;
}

export const DEFAULT_ASSYMO_INVOICING: TenantInvoicing = {
  vatRate: 0.21,
  paymentTermDays: 30,
  bankIban: '',
  bankBic: null,
};

export interface ValidatedInvoicingPatch {
  invoicing: Partial<TenantInvoicing>;
  errors: string[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Validate a partial tenant.invoicing PATCH body. Mirrors the shape of
 *  validateBrandingPatch / validatePriceBookPatch — returns the cleaned
 *  partial + a list of failing field paths. Empty errors = safe to merge. */
export function validateInvoicingPatch(input: unknown): ValidatedInvoicingPatch {
  if (!isObject(input)) return { invoicing: {}, errors: ['body'] };

  const out: Partial<TenantInvoicing> = {};
  const errors: string[] = [];

  if ('vatRate' in input) {
    const v = input.vatRate;
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1) {
      out.vatRate = v;
    } else errors.push('vatRate');
  }
  if ('paymentTermDays' in input) {
    const v = input.paymentTermDays;
    if (typeof v === 'number' && Number.isInteger(v) && v > 0) {
      out.paymentTermDays = v;
    } else errors.push('paymentTermDays');
  }
  if ('bankIban' in input) {
    if (typeof input.bankIban === 'string' && input.bankIban.length > 0) {
      out.bankIban = input.bankIban;
    } else errors.push('bankIban');
  }
  if ('bankBic' in input) {
    const v = input.bankBic;
    if (v === null) out.bankBic = null;
    else if (typeof v === 'string' && v.length > 0) out.bankBic = v;
    else errors.push('bankBic');
  }

  return { invoicing: out, errors };
}
