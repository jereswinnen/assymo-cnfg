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
import { GripVertical, MoreHorizontal } from 'lucide-react';
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
import type { ProductRow } from '@/domain/catalog';

function formatStartPrice(p: ProductRow): string {
  if (p.basePriceCents <= 0) return '—';
  return `€${(p.basePriceCents / 100).toFixed(0)}`;
}

function Row({ product }: { product: ProductRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: product.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };
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
        <Link href={`/admin/catalog/products/${product.id}`} className="hover:underline">
          {product.name}
        </Link>
      </TableCell>
      <TableCell>{t(`admin.catalog.products.kind.${product.kind}`)}</TableCell>
      <TableCell>{formatStartPrice(product)}</TableCell>
      <TableCell>
        <Badge variant={product.archivedAt ? 'outline' : 'default'}>
          {product.archivedAt
            ? t('admin.catalog.products.status.archived')
            : t('admin.catalog.products.status.active')}
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
              <Link href={`/admin/catalog/products/${product.id}`}>
                {t('admin.catalog.products.action.edit')}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export function ProductsTable({ products }: { products: ProductRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(products);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {t('admin.catalog.products.empty')}
      </div>
    );
  }

  async function persistOrder(nextIds: string[]) {
    const res = await fetch('/api/admin/products/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: nextIds }),
    });
    if (!res.ok) {
      toast.error('Volgorde opslaan mislukt');
      setItems(products); // revert local optimistic state
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
            <TableHead className="w-12">{t('admin.catalog.products.column.hero')}</TableHead>
            <TableHead>{t('admin.catalog.products.column.name')}</TableHead>
            <TableHead>{t('admin.catalog.products.column.kind')}</TableHead>
            <TableHead>{t('admin.catalog.products.column.startPrice')}</TableHead>
            <TableHead>{t('admin.catalog.products.column.status')}</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((p) => (
              <Row key={p.id} product={p} />
            ))}
          </SortableContext>
        </TableBody>
      </Table>
    </DndContext>
  );
}
