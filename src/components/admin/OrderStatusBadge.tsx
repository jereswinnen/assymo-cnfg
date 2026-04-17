import { Badge } from '@/components/ui/badge';
import { t } from '@/lib/i18n';
import type { OrderStatus } from '@/domain/orders';

interface Props { status: OrderStatus }

/** Colour-keyed status pill. Variants are picked from the shadcn Badge
 *  set; we don't introduce custom colours so the admin theme stays
 *  consistent. */
const VARIANT: Record<OrderStatus, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  draft: 'outline',
  submitted: 'secondary',
  quoted: 'default',
  accepted: 'default',
  cancelled: 'destructive',
};

export function OrderStatusBadge({ status }: Props) {
  return <Badge variant={VARIANT[status]}>{t(`admin.orders.status.${status}`)}</Badge>;
}
