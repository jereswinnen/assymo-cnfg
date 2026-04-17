'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { t } from '@/lib/i18n';

interface Row {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  tenantId: string | null;
  createdAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-BE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

export function ClientsTable() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch('/api/admin/clients').then(async (r) => {
      if (r.ok) {
        const { clients } = await r.json();
        setRows(clients);
      }
    });
  }, []);

  if (rows === null) return <p className="text-sm text-neutral-500">…</p>;
  if (rows.length === 0)
    return <p className="text-sm text-neutral-500">{t('admin.clients.empty')}</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.clients.col.email')}</TableHead>
          <TableHead>{t('admin.clients.col.name')}</TableHead>
          <TableHead>{t('admin.clients.col.tenant')}</TableHead>
          <TableHead>{t('admin.clients.col.createdAt')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((c) => (
          <TableRow key={c.id}>
            <TableCell>
              <Link href={`/admin/clients/${c.id}`} className="hover:underline">
                {c.email}
              </Link>
              {!c.emailVerified && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {t('admin.clients.detail.unclaimed')}
                </Badge>
              )}
            </TableCell>
            <TableCell>{c.name ?? '—'}</TableCell>
            <TableCell className="font-mono text-xs">{c.tenantId ?? '—'}</TableCell>
            <TableCell>{formatDate(c.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
