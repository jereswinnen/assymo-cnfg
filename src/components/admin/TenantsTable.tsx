'use client';
import Link from 'next/link';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import type { TenantRow } from '@/db/schema';
import { t } from '@/lib/i18n';

interface Props {
  tenants: TenantRow[];
}

export function TenantsTable({ tenants }: Props) {
  if (tenants.length === 0) {
    return <p className="text-sm text-neutral-500">{t('admin.tenants.empty')}</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.tenants.col.id')}</TableHead>
          <TableHead>{t('admin.tenants.col.displayName')}</TableHead>
          <TableHead>{t('admin.tenants.col.locale')}</TableHead>
          <TableHead>{t('admin.tenants.col.currency')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tenants.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <Link
                href={`/admin/tenants/${row.id}`}
                className="font-mono text-sm underline"
              >
                {row.id}
              </Link>
            </TableCell>
            <TableCell>{row.displayName}</TableCell>
            <TableCell>{row.locale}</TableCell>
            <TableCell>{row.currency}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
