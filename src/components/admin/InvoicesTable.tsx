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
import { t } from '@/lib/i18n';

interface Row {
  id: string;
  number: string;
  issuedAt: string;
  dueAt: string;
  totalCents: number;
  currency: string;
  customerAddress: string;
}

function fmtCents(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('nl-BE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-BE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function InvoicesTable() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    fetch('/api/admin/invoices').then(async (r) => {
      if (r.ok) {
        const { invoices } = await r.json();
        setRows(invoices);
      } else setRows([]);
    });
  }, []);
  if (rows === null) return <p className="text-sm text-muted-foreground">…</p>;
  if (rows.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        {t('admin.invoices.empty')}
      </p>
    );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.invoices.col.number')}</TableHead>
          <TableHead>{t('admin.invoices.col.issuedAt')}</TableHead>
          <TableHead>{t('admin.invoices.col.dueAt')}</TableHead>
          <TableHead className="text-right">
            {t('admin.invoices.col.total')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-mono text-xs">
              <Link
                href={`/admin/invoices/${row.id}`}
                className="hover:underline"
              >
                {row.number}
              </Link>
            </TableCell>
            <TableCell>{fmtDate(row.issuedAt)}</TableCell>
            <TableCell>{fmtDate(row.dueAt)}</TableCell>
            <TableCell className="text-right">
              {fmtCents(row.totalCents, row.currency)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
