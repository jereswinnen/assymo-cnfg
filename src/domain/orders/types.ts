import type { ConfigData } from '@/domain/config';
import type { LineItem, PriceBook } from '@/domain/pricing';
import type { Currency } from '@/domain/tenant';

/** Order lifecycle.
 *  - draft     — created server-side without a contact submit (reserved; not used by current routes).
 *  - submitted — what `POST /api/shop/orders` produces.
 *  - quoted    — admin has reviewed + confirmed numbers (manually) and replied to the customer.
 *  - accepted  — customer agreed; ready for invoicing in Phase 5.
 *  - cancelled — terminal; either side aborted. */
export type OrderStatus =
  | 'draft'
  | 'submitted'
  | 'quoted'
  | 'accepted'
  | 'cancelled';

/** Frozen quote at the moment of submit. Multi-item-shaped (`items` array)
 *  so a future cart can land without a schema change; today every order
 *  has exactly one item. `priceBook` is captured verbatim so the same
 *  numbers can be re-rendered years later even if the tenant's live
 *  price book has drifted. */
export interface OrderQuoteSnapshot {
  items: Array<{
    /** The configurator share code this item came from (so admins can
     *  open it back up in the configurator). */
    code: string;
    lineItems: LineItem[];
    subtotalCents: number;
  }>;
  totalCents: number;
  currency: Currency;
  priceBook: PriceBook;
  /** ISO timestamp the snapshot was taken. */
  snapshotAt: string;
}

/** Frozen ConfigData — also multi-item-shaped for future use. */
export interface OrderConfigSnapshot {
  items: Array<{
    code: string;
    config: ConfigData;
  }>;
}

/** View type returned by API handlers + consumed by admin UI. The DB
 *  row maps 1:1 onto this except `createdAt`/`updatedAt`/`submittedAt`
 *  serialize to ISO strings over the wire. */
export interface OrderRecord {
  id: string;
  tenantId: string;
  configId: string | null;
  code: string;
  customerId: string | null;
  contactEmail: string;
  contactName: string;
  contactPhone: string | null;
  notes: string | null;
  status: OrderStatus;
  totalCents: number;
  currency: Currency;
  quoteSnapshot: OrderQuoteSnapshot;
  configSnapshot: OrderConfigSnapshot;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
}
