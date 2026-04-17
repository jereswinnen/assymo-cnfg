'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { t } from '@/lib/i18n';
import { allowedNextStatuses, type OrderStatus } from '@/domain/orders';

interface Props {
  orderId: string;
  currentStatus: OrderStatus;
}

/** Renders the current-status pill plus a dropdown of valid next
 *  statuses (sourced from the pure `allowedNextStatuses` so the UI
 *  cannot offer a transition the API would reject). On click, PATCHes
 *  the status endpoint and refreshes the route. */
export function OrderStatusControl({ orderId, currentStatus }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const next = allowedNextStatuses(currentStatus);

  if (next.length === 0) {
    return <span className="text-sm text-neutral-500">{t(`admin.orders.status.${currentStatus}`)}</span>;
  }

  const change = async (target: OrderStatus) => {
    setBusy(target);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: target }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(t('admin.orders.status.transition.error', {
          error: body?.error ?? `${res.status}`,
        }));
        return;
      }
      toast.success(t('admin.orders.status.transition.success', {
        status: t(`admin.orders.status.${target}`),
      }));
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy !== null}>
          {t('admin.orders.status.transition')} <ChevronDown className="ml-1 size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {next.map((s) => (
          <DropdownMenuItem
            key={s}
            disabled={busy === s}
            onClick={() => void change(s)}
          >
            {t(`admin.orders.status.${s}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
