import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { invoices, orders, payments } from '@/db/schema';
import { auth } from '@/lib/auth';
import { derivePaymentStatus } from '@/domain/invoicing';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { t } from '@/lib/i18n';

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
  return new Date(d).toLocaleDateString('nl-BE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function ShopInvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) notFound();

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);
  if (!invoice) notFound();

  const [order] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, invoice.orderId),
        eq(orders.customerId, session.user.id),
      ),
    )
    .limit(1);
  if (!order) notFound();

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, id))
    .orderBy(asc(payments.paidAt));
  const status = derivePaymentStatus(invoice.totalCents, paymentRows);

  const s = invoice.supplierSnapshot;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/shop/account/orders/${order.id}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('shop.invoice.backLink')}
        </Link>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">
          {t('shop.invoice.title', { number: invoice.number })}
        </h1>
        <a
          href={`/api/invoices/${invoice.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          {t('shop.invoice.downloadPdf')}
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('shop.invoice.section.supplier')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div className="font-medium">{s.displayName}</div>
          <div className="whitespace-pre-wrap">{s.address}</div>
          {s.vatNumber && <div>BTW: {s.vatNumber}</div>}
          <div className="text-muted-foreground">
            {s.bankIban}
            {s.bankBic ? ` · ${s.bankBic}` : ''}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('shop.invoice.section.amounts')}</CardTitle>
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
          <div className="pt-2 flex justify-between text-muted-foreground gap-4 flex-wrap">
            <span>
              {t('invoice.pdf.issuedAt')}: {fmtDate(invoice.issuedAt)} ·{' '}
              {t('invoice.pdf.dueAt')}: {fmtDate(invoice.dueAt)}
            </span>
            <span>{t(`payment.status.${status}`)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
