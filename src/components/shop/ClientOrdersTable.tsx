'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OrderStatusBadge } from '@/components/admin/OrderStatusBadge';
import { t } from '@/lib/i18n';
import type { OrderStatus } from '@/domain/orders';

interface Row {
  id: string;
  code: string;
  status: OrderStatus;
  totalCents: number;
  currency: string;
  submittedAt: string | null;
  createdAt: string;
}

function formatCents(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('nl-BE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('nl-BE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function ClientOrdersTable() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/shop/orders').then(async (r) => {
      if (r.ok) {
        const { orders } = await r.json();
        setRows(orders);
      } else {
        setError(true);
      }
    }).catch(() => setError(true));
  }, []);

  if (error) {
    return <p className="text-sm text-destructive">{t('shop.error.loading')}</p>;
  }
  if (rows === null) {
    return <p className="text-sm text-muted-foreground">…</p>;
  }
  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('shop.account.empty')}
        </p>
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium hover:underline"
        >
          {t('shop.account.backToConfigurator')}
        </Link>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('shop.account.col.id')}</TableHead>
          <TableHead>{t('shop.account.col.status')}</TableHead>
          <TableHead className="text-right">
            {t('shop.account.col.total')}
          </TableHead>
          <TableHead>{t('shop.account.col.submittedAt')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-mono text-xs">
              <Link
                href={`/shop/account/orders/${row.id}`}
                className="hover:underline"
              >
                {row.id.slice(0, 8)}
              </Link>
            </TableCell>
            <TableCell>
              <OrderStatusBadge status={row.status} />
            </TableCell>
            <TableCell className="text-right">
              {formatCents(row.totalCents, row.currency)}
            </TableCell>
            <TableCell>{formatDate(row.submittedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
