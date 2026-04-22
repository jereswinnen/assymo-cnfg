import { asc, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { invoices, orders, payments } from '@/db/schema';
import { derivePaymentStatus, type InvoiceRecord, type PaymentStatus } from '@/domain/invoicing';
import type { OrderRecord } from '@/domain/orders';
import type { UserKind } from '@/lib/auth-guards';
import { renderInvoicePdfStream } from '@/lib/renderInvoicePdf';

export const runtime = 'nodejs';

/** Stream the invoice PDF. Auth branches:
 *  - business tenant-scoped (super_admin any, tenant_admin own)
 *  - client own-order only
 *  - 404 on failure (no discrimination between "no invoice" / "not yours"). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response(null, { status: 401 });

  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!invoice) return new Response(null, { status: 404 });

  const [order] = await db.select().from(orders).where(eq(orders.id, invoice.orderId)).limit(1);
  if (!order) return new Response(null, { status: 404 });

  const kind = session.user.kind as UserKind | null;
  if (kind === 'super_admin' || kind === 'tenant_admin') {
    const sessionTenantId = session.user.tenantId as string | null;
    if (kind !== 'super_admin' && sessionTenantId !== invoice.tenantId) {
      return new Response(null, { status: 404 });
    }
  } else if (kind === 'client') {
    if (order.customerId !== session.user.id) {
      return new Response(null, { status: 404 });
    }
  } else {
    return new Response(null, { status: 403 });
  }

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, id))
    .orderBy(asc(payments.paidAt));
  const status: PaymentStatus = derivePaymentStatus(invoice.totalCents, paymentRows);

  const stream = await renderInvoicePdfStream({
    invoice: invoice as unknown as InvoiceRecord,
    order: order as unknown as OrderRecord,
    status,
  });

  return new Response(stream as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.number}.pdf"`,
    },
  });
}
