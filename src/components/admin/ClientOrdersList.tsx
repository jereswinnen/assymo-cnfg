import Link from 'next/link';
import { OrderStatusBadge } from './OrderStatusBadge';
import { t } from '@/lib/i18n';
import type { OrderStatus } from '@/domain/orders';

interface Order {
  id: string;
  status: OrderStatus;
  totalCents: number;
  currency: string;
  submittedAt: string | null;
}

interface Props { orders: Order[] }

function formatCents(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('nl-BE', {
    style: 'currency', currency, minimumFractionDigits: 2,
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('nl-BE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

export function ClientOrdersList({ orders }: Props) {
  if (orders.length === 0) {
    return <p className="text-sm text-neutral-500">{t('admin.clients.detail.noOrders')}</p>;
  }
  return (
    <ul className="divide-y divide-neutral-100">
      {orders.map((o) => (
        <li key={o.id} className="py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs hover:underline">
              #{o.id.slice(0, 8)}
            </Link>
            <OrderStatusBadge status={o.status} />
            <span className="text-xs text-neutral-500">{formatDate(o.submittedAt)}</span>
          </div>
          <div className="text-sm font-medium">{formatCents(o.totalCents, o.currency)}</div>
        </li>
      ))}
    </ul>
  );
}
