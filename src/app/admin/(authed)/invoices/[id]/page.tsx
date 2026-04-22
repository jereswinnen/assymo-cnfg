import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { invoices, orders } from '@/db/schema';
import { auth } from '@/lib/auth';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PageTitle } from '@/components/admin/PageTitle';
import { InvoicePaymentsList } from '@/components/admin/InvoicePaymentsList';
import { RecordPaymentDialog } from '@/components/admin/RecordPaymentDialog';
import { t } from '@/lib/i18n';
import type { BusinessKind } from '@/lib/auth-guards';

interface Props {
  params: Promise<{ id: string }>;
}

function fmtCents(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('nl-BE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
}
function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('nl-BE');
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const kind = session.user.kind as BusinessKind;
  const sessionTenantId = session.user.tenantId as string | null;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);
  if (!invoice) notFound();
  if (kind !== 'super_admin' && sessionTenantId !== invoice.tenantId)
    notFound();

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, invoice.orderId))
    .limit(1);

  const s = invoice.supplierSnapshot;
  return (
    <div className="space-y-6 max-w-4xl">
      <PageTitle title={invoice.number} />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold">{invoice.number}</div>
          <div className="text-sm text-muted-foreground">
            {t('admin.invoice.detail.dates')}: {fmtDate(invoice.issuedAt)} →{' '}
            {fmtDate(invoice.dueAt)}
          </div>
        </div>
        <a
          href={`/api/invoices/${invoice.id}/pdf`}
          className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          target="_blank"
        >
          {t('admin.invoice.detail.downloadPdf')}
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.invoice.detail.supplier')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="font-medium">{s.displayName}</div>
            <div>{s.address}</div>
            {s.vatNumber && <div>BTW: {s.vatNumber}</div>}
            <div className="text-muted-foreground">
              {s.bankIban}
              {s.bankBic ? ` · ${s.bankBic}` : ''}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.invoice.detail.customer')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1 whitespace-pre-wrap">
            <div className="font-medium">{invoice.customerName}</div>
            <div>{invoice.customerAddress}</div>
            {order && (
              <div className="text-muted-foreground">{order.contactEmail}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.invoice.detail.amounts')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div className="flex justify-between">
            <span>{t('invoice.pdf.subtotal')}</span>
            <span>{fmtCents(invoice.subtotalCents, invoice.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span>
              {t('invoice.pdf.vat', {
                rate: (Number(invoice.vatRate) * 100).toFixed(0),
              })}
            </span>
            <span>{fmtCents(invoice.vatCents, invoice.currency)}</span>
          </div>
          <div className="flex justify-between pt-1 border-t font-semibold">
            <span>{t('invoice.pdf.grandTotal')}</span>
            <span>{fmtCents(invoice.totalCents, invoice.currency)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t('admin.invoice.detail.payments')}</span>
            <RecordPaymentDialog invoiceId={invoice.id} totalCents={invoice.totalCents} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InvoicePaymentsList
            invoiceId={invoice.id}
            totalCents={invoice.totalCents}
            currency={invoice.currency}
          />
        </CardContent>
      </Card>
    </div>
  );
}
