'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MoreHorizontal, Package, Plus } from 'lucide-react';
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
import { AdminEmpty } from '../AdminEmpty';
import { t } from '@/lib/i18n';
import type { SupplierProductRow } from '@/domain/supplier';

function formatPrice(priceCents: number): string {
  if (priceCents <= 0) return '—';
  return `€${(priceCents / 100).toFixed(0)}`;
}

function formatSize(widthMm: number, heightMm: number): string {
  return `${widthMm} × ${heightMm} mm`;
}

function Row({
  product,
  supplierId,
}: {
  product: SupplierProductRow;
  supplierId: string;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: product.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  async function handleRestore() {
    const res = await fetch(
      `/api/admin/supplier-products/${product.id}/restore`,
      { method: 'POST' },
    );
    if (!res.ok) {
      toast.error(t('admin.catalog.supplierProducts.action.restore') + ' — ' + res.status);
      return;
    }
    toast.success(t('admin.catalog.supplierProducts.action.restore'));
    router.refresh();
  }

  return (
    <TableRow ref={setNodeRef} style={style} className={product.archivedAt ? 'opacity-60' : ''}>
      <TableCell className="w-10">
        <button
          {...attributes}
          {...listeners}
          aria-label="Reorder"
          className="cursor-grab text-muted-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <TableCell className="w-12">
        {product.heroImage ? (
          <img
            src={product.heroImage}
            alt=""
            className="h-10 w-10 rounded-md border object-cover"
          />
        ) : (
          <div className="h-10 w-10 rounded-md border border-dashed" />
        )}
      </TableCell>
      <TableCell className="font-medium">
        <Link
          href={`/admin/catalog/suppliers/${supplierId}/products/${product.id}`}
          className="hover:underline"
        >
          {product.name}
        </Link>
      </TableCell>
      <TableCell>{t(`admin.catalog.supplierProducts.kind.${product.kind}`)}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{product.sku}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatSize(product.widthMm, product.heightMm)}
      </TableCell>
      <TableCell>{formatPrice(product.priceCents)}</TableCell>
      <TableCell>
        <Badge variant={product.archivedAt ? 'outline' : 'default'}>
          {product.archivedAt
            ? t('admin.catalog.supplierProducts.status.archived')
            : t('admin.catalog.supplierProducts.status.active')}
        </Badge>
      </TableCell>
      <TableCell className="w-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/admin/catalog/suppliers/${supplierId}/products/${product.id}`}>
                {t('admin.catalog.supplierProducts.action.edit')}
              </Link>
            </DropdownMenuItem>
            {product.archivedAt && (
              <DropdownMenuItem onClick={() => { void handleRestore(); }}>
                {t('admin.catalog.supplierProducts.action.restore')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export function SupplierProductsTable({
  products,
  supplierId,
}: {
  products: SupplierProductRow[];
  supplierId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(products);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (items.length === 0) {
    return (
      <AdminEmpty
        icon={Package}
        title={t('admin.catalog.supplierProducts.empty.title')}
        description={t('admin.catalog.supplierProducts.empty.description')}
        action={
          <Button asChild>
            <Link href={`/admin/catalog/suppliers/${supplierId}/products/new`}>
              <Plus />
              {t('admin.catalog.supplierProducts.new')}
            </Link>
          </Button>
        }
      />
    );
  }

  async function persistOrder(nextIds: string[]) {
    const res = await fetch(`/api/admin/suppliers/${supplierId}/products/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: nextIds }),
    });
    if (!res.ok) {
      toast.error(t('admin.catalog.supplierProducts.toast.reorderFailed'));
      setItems(products);
      return;
    }
    router.refresh();
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    void persistOrder(next.map((i) => i.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead className="w-12" />
            <TableHead>{t('admin.catalog.supplierProducts.column.name')}</TableHead>
            <TableHead>{t('admin.catalog.supplierProducts.column.kind')}</TableHead>
            <TableHead>{t('admin.catalog.supplierProducts.column.sku')}</TableHead>
            <TableHead>{t('admin.catalog.supplierProducts.column.size')}</TableHead>
            <TableHead>{t('admin.catalog.supplierProducts.column.price')}</TableHead>
            <TableHead>{t('admin.catalog.supplierProducts.column.status')}</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((p) => (
              <Row key={p.id} product={p} supplierId={supplierId} />
            ))}
          </SortableContext>
        </TableBody>
      </Table>
    </DndContext>
  );
}
