export interface IssueInvoiceInput {
  customerName: string;
  customerAddress: string;
  issuedAt: string; // ISO date (YYYY-MM-DD)
  dueAt: string;    // ISO date
  vatRate: number;
}

export interface PaymentInput {
  amountCents: number;
  method: 'manual';
  paidAt: string;
  providerRef: string | null;
  note: string | null;
}

interface Validated<T> {
  value: T | null;
  errors: string[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isIsoDateString(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(s)) return false;
  const t = Date.parse(s);
  return Number.isFinite(t);
}

export function validateIssueInvoiceInput(input: unknown): Validated<IssueInvoiceInput> {
  if (!isObject(input)) return { value: null, errors: ['body'] };
  const errors: string[] = [];

  const customerName =
    typeof input.customerName === 'string' && input.customerName.trim().length > 0
      ? input.customerName
      : (errors.push('customerName'), '');
  const customerAddress =
    typeof input.customerAddress === 'string' && input.customerAddress.trim().length > 0
      ? input.customerAddress
      : (errors.push('customerAddress'), '');
  const issuedAtOk = isIsoDateString(input.issuedAt);
  const dueAtOk = isIsoDateString(input.dueAt);
  if (!issuedAtOk) errors.push('issuedAt');
  if (!dueAtOk) errors.push('dueAt');
  if (issuedAtOk && dueAtOk && Date.parse(input.dueAt as string) < Date.parse(input.issuedAt as string)) {
    errors.push('dueAt');
  }
  const vatRateOk =
    typeof input.vatRate === 'number' &&
    Number.isFinite(input.vatRate) &&
    input.vatRate >= 0 &&
    input.vatRate <= 1;
  if (!vatRateOk) errors.push('vatRate');

  if (errors.length > 0) return { value: null, errors };

  return {
    value: {
      customerName,
      customerAddress,
      issuedAt: input.issuedAt as string,
      dueAt: input.dueAt as string,
      vatRate: input.vatRate as number,
    },
    errors: [],
  };
}

export function validatePaymentInput(input: unknown): Validated<PaymentInput> {
  if (!isObject(input)) return { value: null, errors: ['body'] };
  const errors: string[] = [];

  const amountOk =
    typeof input.amountCents === 'number' &&
    Number.isInteger(input.amountCents) &&
    input.amountCents > 0;
  if (!amountOk) errors.push('amountCents');

  const methodOk = input.method === 'manual';
  if (!methodOk) errors.push('method');

  const paidAtOk = isIsoDateString(input.paidAt);
  if (!paidAtOk) errors.push('paidAt');

  const providerRef =
    'providerRef' in input
      ? (typeof input.providerRef === 'string' ? input.providerRef : null)
      : null;
  const note =
    'note' in input
      ? (typeof input.note === 'string' ? input.note : null)
      : null;

  if (errors.length > 0) return { value: null, errors };

  return {
    value: {
      amountCents: input.amountCents as number,
      method: 'manual',
      paidAt: input.paidAt as string,
      providerRef,
      note,
    },
    errors: [],
  };
}
