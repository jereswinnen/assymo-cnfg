import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { invoices, orders, payments as paymentsTable } from '@/db/schema';
import { auth } from '@/lib/auth';
import { derivePaymentStatus, type PaymentStatus } from '@/domain/invoicing';
import { ClientOrderDetail } from '@/components/shop/ClientOrderDetail';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ShopOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) notFound();
  const tenantId = (session.user.tenantId as string | null) ?? '__none__';

  const [row] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, id),
        eq(orders.customerId, session.user.id),
        eq(orders.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!row) notFound();

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.orderId, row.id))
    .limit(1);

  let invoiceStatus: PaymentStatus = 'unpaid';
  if (invoice) {
    const paymentRows = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.invoiceId, invoice.id))
      .orderBy(asc(paymentsTable.paidAt));
    invoiceStatus = derivePaymentStatus(invoice.totalCents, paymentRows);
  }

  return (
    <ClientOrderDetail
      order={{
        id: row.id,
        status: row.status,
        contactName: row.contactName,
        contactEmail: row.contactEmail,
        contactPhone: row.contactPhone,
        notes: row.notes,
        quoteSnapshot: row.quoteSnapshot,
        submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
      }}
      invoice={
        invoice
          ? {
              id: invoice.id,
              number: invoice.number,
              totalCents: invoice.totalCents,
            }
          : null
      }
      invoiceStatus={invoice ? invoiceStatus : undefined}
    />
  );
}
