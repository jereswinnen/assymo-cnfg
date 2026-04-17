import type { OrderStatus } from './types';

export const ALL_ORDER_STATUSES: readonly OrderStatus[] = [
  'draft',
  'submitted',
  'quoted',
  'accepted',
  'cancelled',
] as const;

/** Forward graph. `cancelled` is terminal; `accepted` is terminal except
 *  for cancellation (refund/abort path). `draft` exists for future
 *  internal-creation flows; `POST /api/shop/orders` always lands on
 *  `submitted` directly. */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['quoted', 'cancelled'],
  quoted: ['accepted', 'cancelled'],
  accepted: ['cancelled'],
  cancelled: [],
};

export function allowedNextStatuses(from: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[from] ?? [];
}

export type OrderTransitionError =
  | { code: 'unknown_status'; to: string }
  | { code: 'noop_transition'; from: OrderStatus; to: OrderStatus }
  | { code: 'invalid_transition'; from: OrderStatus; to: OrderStatus };

function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === 'string' && (ALL_ORDER_STATUSES as readonly string[]).includes(v);
}

/** Pure validator. Returns an array (matches the project's `validate*`
 *  convention) so multiple-error futures are non-breaking — currently
 *  every failing call returns at most one element. */
export function validateOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
): OrderTransitionError[] {
  if (!isOrderStatus(to)) {
    return [{ code: 'unknown_status', to: String(to) }];
  }
  if (from === to) {
    return [{ code: 'noop_transition', from, to }];
  }
  const next = ALLOWED_TRANSITIONS[from] ?? [];
  if (!next.includes(to)) {
    return [{ code: 'invalid_transition', from, to }];
  }
  return [];
}
