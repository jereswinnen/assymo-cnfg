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
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('nl-BE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function ClientOrderDetail({ order }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/shop/account"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
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
              className="text-foreground hover:underline"
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

      <p className="text-sm text-muted-foreground">{t('shop.order.nextSteps')}</p>
    </div>
  );
}
