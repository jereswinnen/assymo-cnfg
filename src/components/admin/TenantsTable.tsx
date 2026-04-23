'use client';
import Link from 'next/link';
import { Building2 } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import type { TenantRow } from '@/db/schema';
import { AdminEmpty } from './AdminEmpty';
import { t } from '@/lib/i18n';

interface Props {
  tenants: TenantRow[];
  /** Optional action for the empty state — typically the create dialog. */
  emptyAction?: React.ReactNode;
}

export function TenantsTable({ tenants, emptyAction }: Props) {
  if (tenants.length === 0) {
    return (
      <AdminEmpty
        icon={Building2}
        title={t('admin.tenants.empty.title')}
        description={t('admin.tenants.empty.description')}
        action={emptyAction}
      />
    );
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
