import type { Currency } from '@/domain/tenant';
import type { PaymentStatus } from './paymentStatus';

/** Frozen supplier details on the invoice — re-renders years later
 *  even if the tenant's live `invoicing` or `branding.footer` drift. */
export interface InvoiceSupplierSnapshot {
  displayName: string;
  address: string;
  vatNumber: string | null;
  contactEmail: string;
  bankIban: string;
  bankBic: string | null;
  paymentTermDays: number;
}

export type InvoicePaymentMethod = 'manual' | 'mollie' | 'stripe';

/** View type returned by API handlers + consumed by admin/shop UI. */
export interface InvoiceRecord {
  id: string;
  tenantId: string;
  orderId: string;
  number: string;              // "YYYY-NNNN"
  issuedAt: string;            // ISO
  dueAt: string;               // ISO
  customerAddress: string;
  customerName: string;
  subtotalCents: number;
  vatRate: number;             // 0.21 etc.
  vatCents: number;
  totalCents: number;          // = subtotal + vat
  currency: Currency;
  supplierSnapshot: InvoiceSupplierSnapshot;
  pdfUrl: string | null;       // always null in Phase 5; reserved for blob-cache later
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  amountCents: number;
  currency: Currency;
  method: InvoicePaymentMethod;
  providerRef: string | null;
  paidAt: string;              // ISO
  note: string | null;
  createdAt: string;
}

/** Convenience: invoice + its payments + derived status, the shape
 *  the admin detail page and the PDF renderer both want. */
export interface InvoiceWithPayments {
  invoice: InvoiceRecord;
  payments: PaymentRecord[];
  status: PaymentStatus;
}
