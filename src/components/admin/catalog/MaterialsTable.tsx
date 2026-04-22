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
import type { MaterialRow } from '@/domain/catalog';
import { MaterialThumb } from './MaterialThumb';

function formatPrice(m: MaterialRow): string {
  if (m.pricing.perSqm !== undefined) return `€${m.pricing.perSqm}/m²`;
  if (m.pricing.surcharge !== undefined) return `+€${m.pricing.surcharge}`;
  return '—';
}

export function MaterialsTable({ materials }: { materials: MaterialRow[] }) {
  const router = useRouter();
  async function handleRestore(id: string) {
    const res = await fetch(`/api/admin/materials/${id}/restore`, { method: 'POST' });
    if (!res.ok) {
      toast.error(t('admin.catalog.materials.action.restore') + ' — ' + res.status);
      return;
    }
    toast.success(t('admin.catalog.materials.action.restore'));
    router.refresh();
  }

  if (materials.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {t('admin.catalog.materials.empty')}
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">{t('admin.catalog.materials.column.thumb')}</TableHead>
          <TableHead>{t('admin.catalog.materials.column.name')}</TableHead>
          <TableHead>{t('admin.catalog.materials.column.category')}</TableHead>
          <TableHead>{t('admin.catalog.materials.column.slug')}</TableHead>
          <TableHead>{t('admin.catalog.materials.column.price')}</TableHead>
          <TableHead>{t('admin.catalog.materials.column.status')}</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {materials.map((m) => (
          <TableRow key={m.id} className={m.archivedAt ? 'opacity-60' : ''}>
            <TableCell><MaterialThumb material={m} /></TableCell>
            <TableCell className="font-medium">
              <Link href={`/admin/catalog/materials/${m.id}`} className="hover:underline">
                {m.name}
              </Link>
            </TableCell>
            <TableCell>{t(`admin.catalog.materials.category.${m.category}`)}</TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">{m.slug}</TableCell>
            <TableCell>{formatPrice(m)}</TableCell>
            <TableCell>
              <Badge variant={m.archivedAt ? 'outline' : 'default'}>
                {m.archivedAt
                  ? t('admin.catalog.materials.status.archived')
                  : t('admin.catalog.materials.status.active')}
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
                    <Link href={`/admin/catalog/materials/${m.id}`}>
                      {t('admin.catalog.materials.action.edit')}
                    </Link>
                  </DropdownMenuItem>
                  {m.archivedAt && (
                    <DropdownMenuItem onClick={() => { void handleRestore(m.id); }}>
                      {t('admin.catalog.materials.action.restore')}
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
