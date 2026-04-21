import type { Branding } from '@/domain/tenant';
import type { TenantInvoicing } from '@/domain/tenant';
import type { InvoiceSupplierSnapshot } from './types';

interface Input {
  displayName: string;
  branding: Branding;
  invoicing: TenantInvoicing;
}

/** Freeze the supplier-side invoice fields into a self-contained snapshot.
 *  Safe to store as jsonb and re-render years later. */
export function buildSupplierSnapshot(input: Input): InvoiceSupplierSnapshot {
  return {
    displayName: input.displayName,
    address: input.branding.footer.address,
    vatNumber: input.branding.footer.vatNumber,
    contactEmail: input.branding.footer.contactEmail,
    bankIban: input.invoicing.bankIban,
    bankBic: input.invoicing.bankBic,
    paymentTermDays: input.invoicing.paymentTermDays,
  };
}
