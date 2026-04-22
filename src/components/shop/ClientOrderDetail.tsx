import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { OrderStatusBadge } from '@/components/admin/OrderStatusBadge';
import { OrderQuoteTable } from '@/components/admin/OrderQuoteTable';
import { t } from '@/lib/i18n';
import type {
  OrderQuoteSnapshot,
  OrderStatus,
} from '@/domain/orders';
import type { PaymentStatus } from '@/domain/invoicing';

interface Props {
  order: {
    id: string;
    status: OrderStatus;
    contactName: string;
    contactEmail: string;
    contactPhone: string | null;
    notes: string | null;
    quoteSnapshot: OrderQuoteSnapshot;
    submittedAt: string | null;
  };
  invoice?: {
    id: string;
    number: string;
    totalCents: number;
  } | null;
  invoiceStatus?: PaymentStatus;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('nl-BE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function ClientOrderDetail({ order, invoice, invoiceStatus }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/shop/account"
          className="text-sm text-muted-foreground hover:text-[var(--brand-primary)] transition-colors"
        >
          {t('shop.order.backLink')}
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">
            {t('shop.order.title', { id: order.id.slice(0, 8) })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('shop.order.submittedAt', {
              date: formatDate(order.submittedAt),
            })}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('shop.order.section.quote')}</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderQuoteTable snapshot={order.quoteSnapshot} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('shop.order.section.contact')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>{order.contactName}</div>
          <div>
            <a
              href={`mailto:${order.contactEmail}`}
              className="text-[var(--brand-primary)] hover:underline"
            >
              {order.contactEmail}
            </a>
          </div>
          {order.contactPhone && <div>{order.contactPhone}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('shop.order.section.notes')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm whitespace-pre-wrap">
          {order.notes ?? (
            <span className="text-muted-foreground italic">
              {t('shop.order.noNotes')}
            </span>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('shop.order.invoice.title')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {invoice ? (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="font-medium">{invoice.number}</div>
                <div className="text-muted-foreground">
                  {t(`payment.status.${invoiceStatus ?? 'unpaid'}`)}
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/shop/account/invoices/${invoice.id}`}
                  className="rounded-md border px-3 py-1 hover:bg-muted"
                >
                  {t('shop.order.invoice.linkLabel')}
                </Link>
                <a
                  href={`/api/invoices/${invoice.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-[var(--brand-primary)] text-white px-3 py-1 hover:opacity-90 transition-opacity"
                >
                  {t('shop.invoice.downloadPdf')}
                </a>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground italic">
              {t('shop.order.invoice.none')}
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">{t('shop.order.nextSteps')}</p>
    </div>
  );
}
