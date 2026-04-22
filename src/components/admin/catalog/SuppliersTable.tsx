'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { t } from '@/lib/i18n';
import type { SupplierRow } from '@/domain/supplier';

function formatContact(s: SupplierRow): string {
  if (s.contact.email) return s.contact.email;
  if (s.contact.website) return s.contact.website;
  if (s.contact.phone) return s.contact.phone;
  return '—';
}

export function SuppliersTable({ suppliers }: { suppliers: SupplierRow[] }) {
  const router = useRouter();

  async function handleRestore(id: string) {
    const res = await fetch(`/api/admin/suppliers/${id}/restore`, { method: 'POST' });
    if (!res.ok) {
      toast.error(t('admin.catalog.suppliers.action.restore') + ' — ' + res.status);
      return;
    }
    toast.success(t('admin.catalog.suppliers.action.restore'));
    router.refresh();
  }

  if (suppliers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {t('admin.catalog.suppliers.empty')}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.catalog.suppliers.column.name')}</TableHead>
          <TableHead>{t('admin.catalog.suppliers.column.slug')}</TableHead>
          <TableHead>{t('admin.catalog.suppliers.column.contact')}</TableHead>
          <TableHead>{t('admin.catalog.suppliers.column.status')}</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {suppliers.map((s) => (
          <TableRow key={s.id} className={s.archivedAt ? 'opacity-60' : ''}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-3">
                {s.logoUrl ? (
                  <img
                    src={s.logoUrl}
                    alt=""
                    className="h-8 w-8 rounded border object-contain"
                  />
                ) : null}
                <Link href={`/admin/catalog/suppliers/${s.id}`} className="hover:underline">
                  {s.name}
                </Link>
              </div>
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">{s.slug}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{formatContact(s)}</TableCell>
            <TableCell>
              <Badge variant={s.archivedAt ? 'outline' : 'default'}>
                {s.archivedAt
                  ? t('admin.catalog.suppliers.status.archived')
                  : t('admin.catalog.suppliers.status.active')}
              </Badge>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/catalog/suppliers/${s.id}`}>
                      {t('admin.catalog.suppliers.action.edit')}
                    </Link>
                  </DropdownMenuItem>
                  {s.archivedAt && (
                    <DropdownMenuItem onClick={() => { void handleRestore(s.id); }}>
                      {t('admin.catalog.suppliers.action.restore')}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
