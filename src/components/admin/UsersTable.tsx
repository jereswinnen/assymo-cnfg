'use client';
import { useEffect, useState } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { t } from '@/lib/i18n';

interface Row {
  id: string;
  email: string;
  name: string | null;
  kind: string;
  tenantId: string | null;
}

export function UsersTable() {
  const [users, setUsers] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch('/api/admin/users').then(async (r) => {
      if (r.ok) {
        const { users } = await r.json();
        setUsers(users);
      }
    });
  }, []);

  if (users === null) return <p className="text-sm text-neutral-500">…</p>;
  if (users.length === 0)
    return <p className="text-sm text-neutral-500">{t('admin.users.empty')}</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.users.col.email')}</TableHead>
          <TableHead>{t('admin.users.col.name')}</TableHead>
          <TableHead>{t('admin.users.col.role')}</TableHead>
          <TableHead>{t('admin.users.col.tenant')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u) => (
          <TableRow key={u.id}>
            <TableCell>{u.email}</TableCell>
            <TableCell>{u.name ?? '—'}</TableCell>
            <TableCell>{t(`admin.role.${u.kind}`)}</TableCell>
            <TableCell className="font-mono text-xs">{u.tenantId ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
