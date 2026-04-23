'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { OrderStatusBadge } from './OrderStatusBadge';
import { AdminEmpty } from './AdminEmpty';
import { t } from '@/lib/i18n';
import type { OrderStatus } from '@/domain/orders';

interface Row {
  id: string;
  tenantId: string;
  code: string;
  customerId: string | null;
  contactEmail: string;
  contactName: string;
  status: OrderStatus;
  totalCents: number;
  currency: string;
  submittedAt: string | null;
  createdAt: string;
  customerEmail: string | null;
  customerName: string | null;
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
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

export function OrdersTable() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch('/api/admin/orders').then(async (r) => {
      if (r.ok) {
        const { orders } = await r.json();
        setRows(orders);
      }
    });
  }, []);

  if (rows === null) return <p className="text-sm text-neutral-500">…</p>;
  if (rows.length === 0) {
    return (
      <AdminEmpty
        icon={Package}
        title={t('admin.orders.empty.title')}
        description={t('admin.orders.empty.description')}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.orders.col.id')}</TableHead>
          <TableHead>{t('admin.orders.col.customer')}</TableHead>
          <TableHead>{t('admin.orders.col.email')}</TableHead>
          <TableHead>{t('admin.orders.col.status')}</TableHead>
          <TableHead className="text-right">{t('admin.orders.col.total')}</TableHead>
          <TableHead>{t('admin.orders.col.submittedAt')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-mono text-xs">
              <Link href={`/admin/orders/${row.id}`} className="hover:underline">
                {row.id.slice(0, 8)}
              </Link>
            </TableCell>
            <TableCell>{row.customerName ?? row.contactName}</TableCell>
            <TableCell>{row.customerEmail ?? row.contactEmail}</TableCell>
            <TableCell><OrderStatusBadge status={row.status} /></TableCell>
            <TableCell className="text-right">{formatCents(row.totalCents, row.currency)}</TableCell>
            <TableCell>{formatDate(row.submittedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
