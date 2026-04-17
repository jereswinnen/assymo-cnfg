# Phase 2 — Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the orders pipeline end-to-end on the admin side: a public shop endpoint that takes a configurator share-code + contact details, snapshots the priced quote, auto-creates a `client` user, and emails an order confirmation containing a magic link; plus the admin list/detail/status-transition surface and a clients list/detail surface.

**Architecture:** Pure `src/domain/orders/` state machine + snapshot types (no React, no Next, no Drizzle). One new `orders` table holding both the frozen `quoteSnapshot` and `configSnapshot` so the order is renderable years later regardless of price-book or migration drift. Public `POST /api/shop/orders` is the single write entry point; admin endpoints are reads + the validated status transition. Admin UI follows the `(authed)` shell + header-context patterns established in Phase 1.

**Tech Stack:** Next 16 (App Router) + React 19, Drizzle (Neon HTTP), Better Auth (magic-link plugin already wired through Resend), Tailwind v4, shadcn (new-york), Vitest (`vite-plus/test`).

**Spec:** `docs/superpowers/specs/2026-04-17-platform-architecture-design.md` — Phase 2 section + data model + auth-guards table.

**Reference (read-only):** `/Users/jeremy/Projects/assymo/assymo-frontend` — copy admin list/detail visual patterns from `src/app/(admin)/admin/appointments/` and `src/components/admin/appointments/`, NOT the business logic.

---

## File map

Files this plan creates or modifies (grouped by responsibility):

**Domain (pure, no framework imports)**
- Create `src/domain/orders/types.ts` — `OrderStatus`, `OrderQuoteSnapshot`, `OrderConfigSnapshot`, `Currency`, `OrderRecord` view type.
- Create `src/domain/orders/transitions.ts` — `ALLOWED_TRANSITIONS`, `validateOrderTransition`.
- Create `src/domain/orders/snapshot.ts` — `buildQuoteSnapshot(buildings, roof, priceBook, defaultHeight)` wrapping `calculateTotalQuote` with the snapshot envelope.
- Create `src/domain/orders/index.ts` — barrel re-exports.
- Create `tests/orders-transitions.test.ts` — exhaustive transition matrix.
- Create `tests/orders-snapshot.test.ts` — snapshot envelope shape + immutability.

**Schema / migrations**
- Modify `src/db/schema.ts` — add `orders` table.
- Create `src/db/migrations/0005_orders.sql` — `orders` table + indexes.

**Email**
- Create `src/lib/orderConfirmationEmail.ts` — pure HTML template `renderOrderConfirmationEmail({ tenant, order, magicLinkUrl })` + `sendOrderConfirmationEmail(...)` (Resend wrapper, dev-falls-back-to-console).
- Modify `src/lib/auth.ts` — branch the `sendMagicLink` callback on `callbackURL` prefix `/shop/account/orders/`: instead of the generic magic-link template, fetch the order + tenant and dispatch the order-confirmation email so the magic link rides inside it.

**Shop API**
- Create `src/app/api/shop/orders/route.ts` — `POST` (host-scoped, public; auto-creates client user; computes quote snapshot; fires Better-Auth magic link with order-aware callbackURL).

**Admin API — orders**
- Create `src/app/api/admin/orders/route.ts` — `GET` list (scoped).
- Create `src/app/api/admin/orders/[id]/route.ts` — `GET` detail (scoped).
- Create `src/app/api/admin/orders/[id]/status/route.ts` — `PATCH` validated transition.

**Admin API — clients**
- Create `src/app/api/admin/clients/route.ts` — `GET` list of `userType='client'` users in scope.
- Create `src/app/api/admin/clients/[id]/route.ts` — `GET` single client + their orders.

**i18n**
- Modify `src/lib/i18n.ts` — add `admin.orders.*`, `admin.clients.*`, `email.orderConfirmation.*` blocks.

**Admin UI — shell wiring**
- Modify `src/components/admin/Sidebar.tsx` — add Orders + Clients nav items (with lucide icons).
- Modify `src/components/admin/breadcrumbs.ts` — add `/admin/orders` and `/admin/clients` to `STATIC_LABELS`.

**Admin UI — orders pages**
- Create `src/app/admin/(authed)/orders/page.tsx` — list page (server component).
- Create `src/components/admin/OrdersTable.tsx` — client-side fetch + render.
- Create `src/components/admin/OrderStatusBadge.tsx` — status pill (used by table + detail).
- Create `src/app/admin/(authed)/orders/[id]/page.tsx` — detail page (server fetch + `<PageTitle>` registers leaf crumb).
- Create `src/components/admin/OrderStatusControl.tsx` — client component: dropdown of valid next-statuses + `PATCH` call.
- Create `src/components/admin/OrderQuoteTable.tsx` — pure render of `OrderQuoteSnapshot.lineItems`.
- Create `src/components/admin/OrderContactCard.tsx` — contact + customer link.

**Admin UI — clients pages**
- Create `src/app/admin/(authed)/clients/page.tsx` — list page.
- Create `src/components/admin/ClientsTable.tsx` — client-side fetch + render.
- Create `src/app/admin/(authed)/clients/[id]/page.tsx` — detail page (`<PageTitle>` registers leaf crumb).
- Create `src/components/admin/ClientOrdersList.tsx` — small embedded order list.

**Docs**
- Modify `CLAUDE.md` — add the orders module + new endpoints + state machine + Phase 2 admin pages to "Admin UI patterns" + STATIC_LABELS bullet.
- Modify `ROADMAP.md` — replace the (now-stale) Phase 2 description with a link to this plan; mark Phase 2 in progress.
- Modify `docs/superpowers/specs/2026-04-17-platform-architecture-design.md` — tick `[x] Phase 2 — Orders` in the Progress section (final task, after merge).

---

## Wave 1 — Domain (pure state machine + snapshot)

No DB, no Next, no React. Full TDD. Everything in `src/domain/orders/` is safe to import from server routes, tests, and (later) the webshop.

### Task 1: Create the order types

**Files:**
- Create: `src/domain/orders/types.ts`
- Create: `src/domain/orders/index.ts`

- [ ] **Step 1: Create the types file**

Create `src/domain/orders/types.ts`:

```ts
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
```

- [ ] **Step 2: Create the barrel**

Create `src/domain/orders/index.ts`:

```ts
export * from './types';
export * from './transitions';
export * from './snapshot';
```

- [ ] **Step 3: Verify types compile (transitions + snapshot don't exist yet, but the barrel will fail — that's fine; we'll fix in Tasks 2 + 3)**

Run: `pnpm exec tsc --noEmit src/domain/orders/types.ts`

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/domain/orders/types.ts src/domain/orders/index.ts
git commit -m "feat(domain/orders): add OrderStatus, OrderQuoteSnapshot, OrderConfigSnapshot, OrderRecord"
```

### Task 2: `validateOrderTransition` — state machine

**Files:**
- Create: `tests/orders-transitions.test.ts`
- Create: `src/domain/orders/transitions.ts`

- [ ] **Step 1: Write the tests first**

Create `tests/orders-transitions.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import {
  ALLOWED_TRANSITIONS,
  validateOrderTransition,
  allowedNextStatuses,
} from '@/domain/orders';
import type { OrderStatus } from '@/domain/orders';

describe('ALLOWED_TRANSITIONS', () => {
  it('covers every status as a key (so allowedNextStatuses never returns undefined)', () => {
    const all: OrderStatus[] = ['draft', 'submitted', 'quoted', 'accepted', 'cancelled'];
    for (const s of all) {
      expect(ALLOWED_TRANSITIONS[s]).toBeDefined();
    }
  });

  it('treats cancelled as terminal', () => {
    expect(ALLOWED_TRANSITIONS.cancelled).toEqual([]);
  });

  it('treats accepted as terminal except for cancellation', () => {
    expect(ALLOWED_TRANSITIONS.accepted).toEqual(['cancelled']);
  });
});

describe('allowedNextStatuses', () => {
  it('returns the configured set', () => {
    expect(allowedNextStatuses('submitted').sort()).toEqual(['cancelled', 'quoted'].sort());
  });
});

describe('validateOrderTransition', () => {
  it('accepts an allowed transition', () => {
    const errors = validateOrderTransition('submitted', 'quoted');
    expect(errors).toEqual([]);
  });

  it('rejects a disallowed transition with a stable code', () => {
    const errors = validateOrderTransition('cancelled', 'quoted');
    expect(errors).toEqual([{ code: 'invalid_transition', from: 'cancelled', to: 'quoted' }]);
  });

  it('rejects a no-op transition', () => {
    const errors = validateOrderTransition('submitted', 'submitted');
    expect(errors).toEqual([{ code: 'noop_transition', from: 'submitted', to: 'submitted' }]);
  });

  it('rejects an unknown target status', () => {
    // @ts-expect-error — runtime call from API with bad input
    const errors = validateOrderTransition('submitted', 'completed');
    expect(errors).toEqual([{ code: 'unknown_status', to: 'completed' }]);
  });

  it('allows draft → submitted (reserved future path)', () => {
    expect(validateOrderTransition('draft', 'submitted')).toEqual([]);
  });

  it('allows submitted → cancelled', () => {
    expect(validateOrderTransition('submitted', 'cancelled')).toEqual([]);
  });

  it('allows quoted → accepted', () => {
    expect(validateOrderTransition('quoted', 'accepted')).toEqual([]);
  });

  it('allows accepted → cancelled', () => {
    expect(validateOrderTransition('accepted', 'cancelled')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, see them fail**

```bash
pnpm test tests/orders-transitions.test.ts
```

Expected: import errors for `ALLOWED_TRANSITIONS`, `validateOrderTransition`, `allowedNextStatuses`.

- [ ] **Step 3: Implement**

Create `src/domain/orders/transitions.ts`:

```ts
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
  to: OrderStatus | string,
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
```

- [ ] **Step 4: Run, confirm green**

```bash
pnpm test tests/orders-transitions.test.ts
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/domain/orders/transitions.ts tests/orders-transitions.test.ts
git commit -m "feat(domain/orders): order state machine + validateOrderTransition"
```

### Task 3: `buildQuoteSnapshot` — freeze the priced quote

**Files:**
- Create: `tests/orders-snapshot.test.ts`
- Create: `src/domain/orders/snapshot.ts`

- [ ] **Step 1: Write the tests**

Create `tests/orders-snapshot.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import { buildQuoteSnapshot } from '@/domain/orders';
import { DEFAULT_PRICE_BOOK } from '@/domain/pricing';
import { migrateConfig } from '@/domain/config';
import { decodeState } from '@/domain/config';
import { SAMPLE_CODE } from './fixtures';

describe('buildQuoteSnapshot', () => {
  it('wraps the priced quote in a snapshot envelope', () => {
    const config = migrateConfig(decodeState(SAMPLE_CODE));
    const snap = buildQuoteSnapshot({
      code: SAMPLE_CODE,
      buildings: config.buildings,
      roof: config.roof,
      priceBook: DEFAULT_PRICE_BOOK,
      defaultHeight: config.defaultHeight,
      currency: 'EUR',
    });
    expect(snap.items).toHaveLength(1);
    expect(snap.items[0].code).toBe(SAMPLE_CODE);
    expect(snap.items[0].lineItems.length).toBeGreaterThan(0);
    expect(snap.totalCents).toBe(snap.items[0].subtotalCents);
    expect(snap.currency).toBe('EUR');
    expect(snap.priceBook).toEqual(DEFAULT_PRICE_BOOK);
    expect(typeof snap.snapshotAt).toBe('string');
    expect(new Date(snap.snapshotAt).toString()).not.toBe('Invalid Date');
  });

  it('converts euro totals to integer cents (no floats)', () => {
    const config = migrateConfig(decodeState(SAMPLE_CODE));
    const snap = buildQuoteSnapshot({
      code: SAMPLE_CODE,
      buildings: config.buildings,
      roof: config.roof,
      priceBook: DEFAULT_PRICE_BOOK,
      defaultHeight: config.defaultHeight,
      currency: 'EUR',
    });
    expect(Number.isInteger(snap.totalCents)).toBe(true);
    for (const item of snap.items) {
      expect(Number.isInteger(item.subtotalCents)).toBe(true);
    }
  });

  it('captures the priceBook by deep clone (mutating the original does not leak)', () => {
    const config = migrateConfig(decodeState(SAMPLE_CODE));
    const pb = structuredClone(DEFAULT_PRICE_BOOK);
    const snap = buildQuoteSnapshot({
      code: SAMPLE_CODE,
      buildings: config.buildings,
      roof: config.roof,
      priceBook: pb,
      defaultHeight: config.defaultHeight,
      currency: 'EUR',
    });
    // Mutate the source — snapshot must remain unchanged.
    pb.posts.pricePerUnit = 999_999;
    expect(snap.priceBook.posts.pricePerUnit).not.toBe(999_999);
  });
});
```

If `tests/fixtures.ts` does not export `SAMPLE_CODE`, add a short helper:

```ts
// Append to tests/fixtures.ts
export const SAMPLE_CODE =
  // any deterministic short code from `pricing.test.ts` or the configurator
  // — pick one that decodes cleanly with the current migrator. If unsure,
  // run `node -e "import('./src/domain/config/codec.ts').then(m => console.log(m.encodeState(...)))"`
  // to generate one. Today the simplest known-good code is the empty
  // overkapping default:
  'TODO_PASTE_CODE_HERE';
```

If you discover that `SAMPLE_CODE` is more easily produced by encoding a
default ConfigData inside the test file itself, do that:

```ts
import { encodeState, DEFAULT_CONFIG_DATA } from '@/domain/config';
const SAMPLE_CODE = encodeState(DEFAULT_CONFIG_DATA);
```

(Adjust the import name to whatever export is canonical — `pricing.test.ts`
already builds `BuildingEntity` instances inline; mirror its approach.)

- [ ] **Step 2: Run, see them fail**

```bash
pnpm test tests/orders-snapshot.test.ts
```

Expected: import errors for `buildQuoteSnapshot`.

- [ ] **Step 3: Implement**

Create `src/domain/orders/snapshot.ts`:

```ts
import type { BuildingEntity, RoofConfig } from '@/domain/building';
import { calculateTotalQuote, type PriceBook } from '@/domain/pricing';
import type { ConfigData } from '@/domain/config';
import type { Currency } from '@/domain/tenant';
import type {
  OrderConfigSnapshot,
  OrderQuoteSnapshot,
} from './types';

interface BuildQuoteSnapshotInput {
  code: string;
  buildings: BuildingEntity[];
  roof: RoofConfig;
  priceBook: PriceBook;
  defaultHeight: number;
  currency: Currency;
  /** Override for tests; defaults to `Date.now()`. */
  now?: () => Date;
}

const eurosToCents = (eur: number): number => Math.round(eur * 100);

/** Snapshot the priced quote in the multi-item-shaped envelope. Today
 *  every order has exactly one item; this shape lets us add a cart in
 *  the future without a schema migration. The priceBook is deep-cloned
 *  so the snapshot is immune to subsequent mutations of the source. */
export function buildQuoteSnapshot(input: BuildQuoteSnapshotInput): OrderQuoteSnapshot {
  const { lineItems, total } = calculateTotalQuote(
    input.buildings,
    input.roof,
    input.priceBook,
    input.defaultHeight,
  );
  const subtotalCents = eurosToCents(total);
  return {
    items: [{ code: input.code, lineItems, subtotalCents }],
    totalCents: subtotalCents,
    currency: input.currency,
    priceBook: structuredClone(input.priceBook),
    snapshotAt: (input.now?.() ?? new Date()).toISOString(),
  };
}

/** Mirror snapshot for ConfigData. Deep-cloned for the same reason. */
export function buildConfigSnapshot(code: string, config: ConfigData): OrderConfigSnapshot {
  return { items: [{ code, config: structuredClone(config) }] };
}
```

- [ ] **Step 4: Run, confirm green**

```bash
pnpm test tests/orders-snapshot.test.ts
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/domain/orders/snapshot.ts tests/orders-snapshot.test.ts tests/fixtures.ts
git commit -m "feat(domain/orders): buildQuoteSnapshot + buildConfigSnapshot

Snapshots freeze the priced quote and the ConfigData at submit time.
Multi-item-shaped envelopes accommodate a future cart without a
schema change; today every order has exactly one item. Currency totals
are stored in integer cents to match the invoice schema landing in
Phase 5."
```

---

## Wave 2 — Schema + migration

### Task 4: Add `orders` table to the Drizzle schema

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add the table definition**

Append to `src/db/schema.ts` (above the trailing `export type` block):

```ts
import type {
  OrderConfigSnapshot,
  OrderQuoteSnapshot,
  OrderStatus,
} from '@/domain/orders';
// ↑ if there is already a top-of-file import group, merge into it instead
//   of adding a new line. Drizzle imports go at the top; domain types
//   below them.

/** Customer orders. Each row freezes the priced quote (`quoteSnapshot`)
 *  and the ConfigData (`configSnapshot`) at submit time so the order is
 *  re-renderable years later regardless of price-book or migration drift.
 *  `customerId` is nullable until the client claims the magic link;
 *  `configId` is nullable so an order is preserved even if a config row
 *  is later GC'd. `code` is the base58 share code — the same value lives
 *  inside `quoteSnapshot.items[*].code`, denormalized to the row for
 *  cheap list-view filtering. */
export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .references(() => tenants.id, { onDelete: 'restrict' })
      .notNull(),
    configId: text('config_id').references(() => configs.id, { onDelete: 'set null' }),
    code: text('code').notNull(),
    customerId: text('customer_id'),
    contactEmail: text('contact_email').notNull(),
    contactName: text('contact_name').notNull(),
    contactPhone: text('contact_phone'),
    notes: text('notes'),
    status: text('status').$type<OrderStatus>().notNull(),
    totalCents: integer('total_cents').notNull(),
    currency: text('currency').$type<Currency>().notNull(),
    quoteSnapshot: jsonb('quote_snapshot').$type<OrderQuoteSnapshot>().notNull(),
    configSnapshot: jsonb('config_snapshot').$type<OrderConfigSnapshot>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
  },
  (t) => [
    index('orders_tenant_id_idx').on(t.tenantId),
    index('orders_customer_id_idx').on(t.customerId),
    index('orders_status_idx').on(t.status),
  ],
);

export type OrderRow = typeof orders.$inferSelect;
export type NewOrderRow = typeof orders.$inferInsert;
```

- [ ] **Step 2: Verify TypeScript is happy**

```bash
pnpm exec tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(db/schema): add orders table

Each order freezes its priced quote and ConfigData at submit time so
the row is re-renderable years later regardless of price-book or
migration drift. customerId is nullable until the client claims the
magic link; configId is nullable on cascade so a GC'd config row
doesn't drop the order."
```

### Task 5: Generate + apply the SQL migration

**Files:**
- Create: `src/db/migrations/0005_orders.sql` (Drizzle will pick the suffix)

- [ ] **Step 1: Generate**

```bash
pnpm db:generate
```

Expected: a new file `src/db/migrations/0005_<random>.sql` is created with the `CREATE TABLE "orders"` + indexes. Inspect it.

- [ ] **Step 2: Sanity-check the generated SQL**

The file should contain (Drizzle's exact phrasing may differ — verify the columns are present, no unrelated drift):

```sql
CREATE TABLE "orders" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "config_id" text,
  "code" text NOT NULL,
  "customer_id" text,
  "contact_email" text NOT NULL,
  "contact_name" text NOT NULL,
  "contact_phone" text,
  "notes" text,
  "status" text NOT NULL,
  "total_cents" integer NOT NULL,
  "currency" text NOT NULL,
  "quote_snapshot" jsonb NOT NULL,
  "config_snapshot" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "submitted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_config_id_configs_id_fk"
  FOREIGN KEY ("config_id") REFERENCES "public"."configs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "orders_tenant_id_idx" ON "orders" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "orders_customer_id_idx" ON "orders" ("customer_id");
--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" ("status");
```

If Drizzle produced unrelated drift (e.g., a column rename you didn't intend), regenerate from a clean schema.

- [ ] **Step 3: (Optional) rename for readability**

Rename the file to `0005_orders.sql` and update the `tag` in `src/db/migrations/meta/_journal.json` to match `"0005_orders"`. Drizzle reads the journal as the source of truth, so the rename is purely cosmetic.

- [ ] **Step 4: Apply the migration**

```bash
pnpm db:migrate
```

Expected: migration applies cleanly. Verify with:

```bash
pnpm db:studio
# In the browser: confirm "orders" table exists with the columns above.
```

- [ ] **Step 5: Commit**

```bash
git add src/db/migrations/0005_orders.sql src/db/migrations/meta/
git commit -m "feat(db): migration for orders table"
```

---

## Wave 3 — i18n keys

All UI + email copy this phase introduces. Doing this up-front means the API and UI tasks below can reference final keys without a back-and-forth.

### Task 6: Add `admin.orders.*`, `admin.clients.*`, `email.orderConfirmation.*` blocks

**Files:**
- Modify: `src/lib/i18n.ts`

- [ ] **Step 1: Append the new key blocks**

Add these blocks to the `nl` map in `src/lib/i18n.ts` immediately before the closing `}` (after the existing "Admin — common" block):

```ts
  // Admin — orders
  'admin.nav.orders': 'Bestellingen',
  'admin.orders.title': 'Bestellingen',
  'admin.orders.empty': 'Nog geen bestellingen.',
  'admin.orders.col.id': 'Bestel-ID',
  'admin.orders.col.customer': 'Klant',
  'admin.orders.col.email': 'E-mail',
  'admin.orders.col.status': 'Status',
  'admin.orders.col.total': 'Totaal',
  'admin.orders.col.tenant': 'Tenant',
  'admin.orders.col.submittedAt': 'Ingediend',
  'admin.orders.detail.section.contact': 'Contact',
  'admin.orders.detail.section.quote': 'Offerte',
  'admin.orders.detail.section.config': 'Configuratie',
  'admin.orders.detail.section.status': 'Status',
  'admin.orders.detail.notes': 'Notities',
  'admin.orders.detail.code': 'Configuratiecode',
  'admin.orders.detail.openConfigurator': 'Open in configurator',
  'admin.orders.detail.openCustomer': 'Klantprofiel openen',
  'admin.orders.detail.noCustomer': 'Nog niet geclaimd',
  'admin.orders.status.transition': 'Status wijzigen naar…',
  'admin.orders.status.transition.submit': 'Wijzigen',
  'admin.orders.status.transition.success': 'Status bijgewerkt naar {status}.',
  'admin.orders.status.transition.error': 'Wijzigen mislukt: {error}',
  'admin.orders.status.draft': 'Concept',
  'admin.orders.status.submitted': 'Ingediend',
  'admin.orders.status.quoted': 'Offerte verstuurd',
  'admin.orders.status.accepted': 'Aanvaard',
  'admin.orders.status.cancelled': 'Geannuleerd',

  // Admin — clients
  'admin.nav.clients': 'Klanten',
  'admin.clients.title': 'Klanten',
  'admin.clients.empty': 'Nog geen klanten.',
  'admin.clients.col.email': 'E-mail',
  'admin.clients.col.name': 'Naam',
  'admin.clients.col.tenant': 'Tenant',
  'admin.clients.col.createdAt': 'Aangemaakt',
  'admin.clients.detail.section.profile': 'Profiel',
  'admin.clients.detail.section.orders': 'Bestellingen',
  'admin.clients.detail.email': 'E-mail',
  'admin.clients.detail.name': 'Naam',
  'admin.clients.detail.claimed': 'Account geclaimd',
  'admin.clients.detail.unclaimed': 'Account nog niet geclaimd',
  'admin.clients.detail.noOrders': 'Deze klant heeft nog geen bestellingen.',

  // Email — order confirmation
  'email.orderConfirmation.subject': 'Je bestelling bij {brand} ({orderId})',
  'email.orderConfirmation.greeting': 'Hallo {name},',
  'email.orderConfirmation.intro':
    'Bedankt voor je aanvraag. We bekijken je configuratie en sturen je binnen één werkdag een offerte op maat.',
  'email.orderConfirmation.summary': 'Samenvatting:',
  'email.orderConfirmation.total': 'Geschatte totaal',
  'email.orderConfirmation.claimIntro':
    'Klik hieronder om je account aan te maken en de status van je bestelling te volgen. De link verloopt binnen 24 uur.',
  'email.orderConfirmation.claimCta': 'Bekijk mijn bestelling',
  'email.orderConfirmation.footer':
    'Vragen? Antwoord op deze e-mail of bel ons.',
```

- [ ] **Step 2: Run i18n tests**

```bash
pnpm test tests/i18n.test.ts
```

Expected: still green.

- [ ] **Step 3: Commit**

```bash
git add src/lib/i18n.ts
git commit -m "feat(i18n): add admin.orders.*, admin.clients.*, email.orderConfirmation.* blocks"
```

---

## Wave 4 — Order-confirmation email

The order-confirmation email and the magic link share a single message. We accomplish that by branching the existing `sendMagicLink` callback in `src/lib/auth.ts` on the `callbackURL`: when it points at `/shop/account/orders/<id>`, we render the order-aware template (with the magic link inside) instead of the generic one.

### Task 7: Order-confirmation email helper

**Files:**
- Create: `src/lib/orderConfirmationEmail.ts`

- [ ] **Step 1: Create the helper**

Create `src/lib/orderConfirmationEmail.ts`:

```ts
import { Resend } from 'resend';
import type { Branding } from '@/domain/tenant';
import type { OrderRow } from '@/db/schema';
import { t } from './i18n';

const resendClient = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

/** Format integer cents as a human EUR string ("€ 1.234,56" — Dutch). */
function formatCents(cents: number): string {
  const value = (cents / 100).toLocaleString('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value;
}

interface RenderInput {
  branding: Pick<Branding, 'displayName' | 'primaryColor'>;
  order: Pick<OrderRow, 'id' | 'contactName' | 'totalCents'>;
  magicLinkUrl: string;
}

/** Pure HTML renderer — no side effects, easy to snapshot-test if we
 *  ever feel the need. The brand color paints the CTA button so the
 *  email matches the admin's branding settings. */
export function renderOrderConfirmationEmail({
  branding,
  order,
  magicLinkUrl,
}: RenderInput): { subject: string; html: string } {
  const subject = t('email.orderConfirmation.subject', {
    brand: branding.displayName,
    orderId: order.id.slice(0, 8),
  });
  const greeting = t('email.orderConfirmation.greeting', { name: order.contactName });
  const intro = t('email.orderConfirmation.intro');
  const summary = t('email.orderConfirmation.summary');
  const totalLabel = t('email.orderConfirmation.total');
  const claimIntro = t('email.orderConfirmation.claimIntro');
  const claimCta = t('email.orderConfirmation.claimCta');
  const footer = t('email.orderConfirmation.footer');

  const html = `
<!doctype html>
<html lang="nl">
  <body style="font-family: system-ui, -apple-system, sans-serif; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">${branding.displayName}</h1>
    <p>${greeting}</p>
    <p>${intro}</p>
    <h2 style="font-size: 14px; text-transform: uppercase; color: #6b7280; margin: 24px 0 8px;">${summary}</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr>
        <td style="padding: 8px 0;">${totalLabel}</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formatCents(order.totalCents)}</td>
      </tr>
    </table>
    <p style="margin-top: 24px;">${claimIntro}</p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="${magicLinkUrl}"
         style="display: inline-block; background: ${branding.primaryColor}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        ${claimCta}
      </a>
    </p>
    <p style="font-size: 12px; color: #6b7280; margin-top: 32px;">${footer}</p>
  </body>
</html>`;
  return { subject, html };
}

interface SendInput extends RenderInput {
  toEmail: string;
  fromAddress?: string;
}

/** Dispatch via Resend. In dev (no RESEND_API_KEY) logs the magic-link
 *  URL to the console — same fallback as Better Auth's default. */
export async function sendOrderConfirmationEmail(input: SendInput): Promise<void> {
  const { subject, html } = renderOrderConfirmationEmail(input);
  const from = input.fromAddress ?? process.env.AUTH_EMAIL_FROM ?? 'Assymo <auth@assymo.be>';

  if (!resendClient) {
    console.log(
      `[dev] Order confirmation for ${input.toEmail}: ${input.magicLinkUrl}`,
    );
    return;
  }
  await resendClient.emails.send({
    from,
    to: input.toEmail,
    subject,
    html,
  });
}
```

- [ ] **Step 2: Verify it compiles**

```bash
pnpm exec tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/orderConfirmationEmail.ts
git commit -m "feat(lib): order-confirmation email helper

Pure renderer + Resend wrapper. The brand primaryColor paints the CTA
button so the email matches the admin's branding settings. In dev
(no RESEND_API_KEY) the magic-link URL is logged to the console —
same fallback as the magic-link template in auth.ts."
```

### Task 8: Branch `sendMagicLink` to use the order template when relevant

**Files:**
- Modify: `src/lib/auth.ts`

The Better Auth `magicLink` plugin invokes `sendMagicLink({ email, url, token })` synchronously when `auth.api.signInMagicLink` is called. We detect "this magic link is for an order" by inspecting the `callbackURL` segment encoded in the URL: when it starts with `/shop/account/orders/`, fetch the order + tenant from the DB and dispatch the order-aware template; otherwise fall back to the generic template.

- [ ] **Step 1: Replace the `sendMagicLink` body**

Open `src/lib/auth.ts` and replace the `magicLink({ sendMagicLink: ... })` invocation with:

```ts
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders, tenants } from '@/db/schema';
import { sendOrderConfirmationEmail } from './orderConfirmationEmail';
// ↑ add these imports at the top of the file alongside the existing ones.

// Then, inside `plugins: [ magicLink({ ... }) ]`, replace `sendMagicLink`:

magicLink({
  sendMagicLink: async ({ email, url }) => {
    // Detect an order-confirmation context. The Better Auth magic-link
    // URL embeds `callbackURL` as a query param; parse it and route to
    // the order-aware template when applicable.
    let orderId: string | null = null;
    try {
      const parsed = new URL(url);
      const callback = parsed.searchParams.get('callbackURL') ?? '';
      const match = callback.match(/^\/shop\/account\/orders\/([^/?]+)/);
      if (match) orderId = match[1];
    } catch {
      // Fall through to the generic template.
    }

    if (orderId) {
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      if (order) {
        const [tenant] = await db
          .select()
          .from(tenants)
          .where(eq(tenants.id, order.tenantId))
          .limit(1);
        if (tenant) {
          await sendOrderConfirmationEmail({
            toEmail: email,
            branding: tenant.branding,
            order,
            magicLinkUrl: url,
          });
          return;
        }
      }
      // If the order/tenant lookup failed for any reason, fall through
      // to the generic template so the magic link still ships.
    }

    // Generic magic-link template (unchanged from Phase 1).
    if (!resendClient) {
      console.log(`[dev] Magic link for ${email}: ${url}`);
      return;
    }
    await resendClient.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject: 'Je inlog-link voor Assymo',
      html: `
        <p>Klik op de onderstaande link om in te loggen. De link verloopt binnen 5 minuten.</p>
        <p><a href="${url}">Inloggen bij Assymo</a></p>
        <p>Heb je deze link niet aangevraagd? Dan kun je deze e-mail negeren.</p>
      `,
    });
  },
}),
```

- [ ] **Step 2: Verify nothing else broke**

```bash
pnpm exec tsc --noEmit
pnpm test
```

Expected: all green. (No tests target `sendMagicLink` directly — the Phase 1 magic-link path is unchanged for non-order callbacks.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat(auth): branch sendMagicLink on /shop/account/orders/* callbackURL

When the magic link's callbackURL points at an order claim page,
fetch the order + tenant and dispatch the order-confirmation
template (CTA painted with the tenant's primaryColor). Otherwise
the generic magic-link template ships as before."
```

---

## Wave 5 — Shop API: `POST /api/shop/orders`

The single write entry point. Public (no admin session required). Creates the `client` user automatically when one doesn't yet exist for this email; reuses the row when one does. Always fires a magic link with `callbackURL=/shop/account/orders/<id>` so the order-confirmation template (Wave 4) ships.

### Task 9: `POST /api/shop/orders`

**Files:**
- Create: `src/app/api/shop/orders/route.ts`

- [ ] **Step 1: Create the handler**

Create `src/app/api/shop/orders/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { configs, orders } from '@/db/schema';
import { user } from '@/db/auth-schema';
import { migrateConfig, validateConfig } from '@/domain/config';
import { buildConfigSnapshot, buildQuoteSnapshot } from '@/domain/orders';
import { auth } from '@/lib/auth';
import { resolveApiTenant } from '@/lib/apiTenant';

interface ContactBody {
  email?: unknown;
  name?: unknown;
  phone?: unknown;
  notes?: unknown;
}
interface PostBody {
  code?: unknown;
  contact?: ContactBody;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

/** Public endpoint: anyone with a valid share code + contact details
 *  can submit an order. The tenant is derived from the request host
 *  (per project convention — see `src/lib/apiTenant.ts`). */
export async function POST(req: NextRequest) {
  const tenant = await resolveApiTenant();
  if (!tenant) {
    return NextResponse.json({ error: 'unknown_tenant' }, { status: 404 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // ── Input validation ────────────────────────────────────────────
  const errors: string[] = [];
  if (!isNonEmptyString(body.code)) errors.push('code');
  const contact = body.contact ?? {};
  if (!isNonEmptyString(contact.email) || !EMAIL_RE.test(contact.email as string)) {
    errors.push('contact.email');
  }
  if (!isNonEmptyString(contact.name)) errors.push('contact.name');
  if (contact.phone !== undefined && contact.phone !== null && !isNonEmptyString(contact.phone)) {
    errors.push('contact.phone');
  }
  if (contact.notes !== undefined && contact.notes !== null && typeof contact.notes !== 'string') {
    errors.push('contact.notes');
  }
  if (errors.length > 0) {
    return NextResponse.json(
      { error: 'validation_failed', details: errors },
      { status: 422 },
    );
  }

  const code = (body.code as string).trim();
  const email = (contact.email as string).toLowerCase();
  const name = (contact.name as string).trim();
  const phone =
    typeof contact.phone === 'string' && contact.phone.trim().length > 0
      ? contact.phone.trim()
      : null;
  const notes =
    typeof contact.notes === 'string' && contact.notes.trim().length > 0
      ? contact.notes.trim()
      : null;

  // ── Resolve the config ──────────────────────────────────────────
  const [configRow] = await db
    .select()
    .from(configs)
    .where(and(eq(configs.tenantId, tenant.id), eq(configs.code, code)))
    .limit(1);
  if (!configRow) {
    return NextResponse.json({ error: 'config_not_found' }, { status: 404 });
  }
  const migrated = migrateConfig(configRow.data);
  const configErrors = validateConfig(migrated);
  if (configErrors.length > 0) {
    return NextResponse.json(
      { error: 'config_invalid', details: configErrors },
      { status: 422 },
    );
  }

  // ── Snapshot the priced quote ───────────────────────────────────
  const quoteSnapshot = buildQuoteSnapshot({
    code,
    buildings: migrated.buildings,
    roof: migrated.roof,
    priceBook: tenant.priceBook,
    defaultHeight: migrated.defaultHeight,
    currency: tenant.currency,
  });
  const configSnapshot = buildConfigSnapshot(code, migrated);

  // ── Resolve / create the client user ────────────────────────────
  // Global-unique emails (project convention). If the email already
  // belongs to a business user we refuse to attach the order to that
  // row — it would mix the two userTypes; instead we surface a
  // dedicated 409. If it belongs to a client we reuse the row.
  const [existingUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  let customerId: string;
  if (existingUser) {
    if (existingUser.userType !== 'client') {
      return NextResponse.json(
        { error: 'email_in_use_by_business' },
        { status: 409 },
      );
    }
    customerId = existingUser.id;
  } else {
    customerId = crypto.randomUUID();
    const now = new Date();
    await db.insert(user).values({
      id: customerId,
      email,
      name,
      emailVerified: false,
      tenantId: tenant.id,
      role: 'tenant_admin', // unused by clients; kept for column-non-null compat with auth-schema default
      userType: 'client' as const,
      createdAt: now,
      updatedAt: now,
    });
  }

  // ── Create the order row ────────────────────────────────────────
  const orderId = crypto.randomUUID();
  const now = new Date();
  const [inserted] = await db
    .insert(orders)
    .values({
      id: orderId,
      tenantId: tenant.id,
      configId: configRow.id,
      code,
      customerId,
      contactEmail: email,
      contactName: name,
      contactPhone: phone,
      notes,
      status: 'submitted' as const,
      totalCents: quoteSnapshot.totalCents,
      currency: tenant.currency,
      quoteSnapshot,
      configSnapshot,
      createdAt: now,
      updatedAt: now,
      submittedAt: now,
    })
    .returning();

  // ── Fire the magic-link email (carries the order template) ──────
  // Best-effort: order is already persisted, so we still 201 even if
  // delivery flakes. The admin can resend later.
  let emailDispatched = true;
  try {
    await auth.api.signInMagicLink({
      body: {
        email,
        callbackURL: `/shop/account/orders/${orderId}`,
      },
      headers: new Headers(),
    });
  } catch {
    emailDispatched = false;
  }

  return NextResponse.json(
    {
      id: inserted.id,
      status: inserted.status,
      totalCents: inserted.totalCents,
      currency: inserted.currency,
      emailDispatched,
    },
    { status: 201 },
  );
}
```

- [ ] **Step 2: Smoke test (requires `pnpm dev` + a saved share code)**

```bash
# 1. Save a share code first via the existing /api/configs endpoint:
#    open the configurator in a browser, click "deel" / save, copy the code.
# 2. Submit it as an order:
curl -s -X POST http://localhost:3000/api/shop/orders \
  -H "Content-Type: application/json" \
  -d '{"code":"<paste-share-code>","contact":{"email":"alice@example.com","name":"Alice","phone":"+32 123","notes":"Graag in mei"}}' \
  | jq .
```

Expected: `{ "id": "<uuid>", "status": "submitted", "totalCents": <int>, "currency": "EUR", "emailDispatched": true }`. Check the Next dev terminal for the magic-link URL (RESEND_API_KEY unset → console fallback).

Re-submit with the same `email` but a new `code` → second order created, customerId reused (verify in `pnpm db:studio`).

Validation cases:
```bash
curl -s -X POST http://localhost:3000/api/shop/orders \
  -H "Content-Type: application/json" -d '{}' | jq .
# → { "error":"validation_failed", "details":["code","contact.email","contact.name"] }
curl -s -X POST http://localhost:3000/api/shop/orders \
  -H "Content-Type: application/json" \
  -d '{"code":"NOSUCHCODE","contact":{"email":"a@b.co","name":"A"}}' | jq .
# → { "error":"config_not_found" }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/shop/orders/route.ts
git commit -m "feat(shop-api): POST /api/shop/orders

Public host-scoped endpoint that takes a share code + contact details,
freezes the priced quote and ConfigData into snapshots, auto-creates
(or reuses) a client user keyed by email, and fires a magic link with
callbackURL=/shop/account/orders/<id> so the order-confirmation
template ships."
```

---

## Wave 6 — Admin API: orders

Three endpoints, same shape: `withSession` + `requireBusiness` + scope check (super_admin sees everything; tenant_admin sees only its own tenant's rows).

### Task 10: `GET /api/admin/orders` (scoped list)

**Files:**
- Create: `src/app/api/admin/orders/route.ts`

- [ ] **Step 1: Create the handler**

```ts
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { user } from '@/db/auth-schema';
import { requireBusiness, type Role } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

/** List orders in scope, newest first. Joined to user.email/name so the
 *  admin table can render "claimed by" without a second round-trip. */
export const GET = withSession(async (session) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const actorRole = session.user.role as Role;
  const actorTenantId = session.user.tenantId as string | null;

  const fields = {
    id: orders.id,
    tenantId: orders.tenantId,
    code: orders.code,
    customerId: orders.customerId,
    contactEmail: orders.contactEmail,
    contactName: orders.contactName,
    status: orders.status,
    totalCents: orders.totalCents,
    currency: orders.currency,
    submittedAt: orders.submittedAt,
    createdAt: orders.createdAt,
    customerEmail: user.email,
    customerName: user.name,
  } as const;

  const baseQuery = db
    .select(fields)
    .from(orders)
    .leftJoin(user, eq(orders.customerId, user.id))
    .orderBy(desc(orders.createdAt));

  const rows =
    actorRole === 'super_admin'
      ? await baseQuery
      : await db
          .select(fields)
          .from(orders)
          .leftJoin(user, eq(orders.customerId, user.id))
          .where(eq(orders.tenantId, actorTenantId ?? '__none__'))
          .orderBy(desc(orders.createdAt));

  return NextResponse.json({ orders: rows });
});
```

- [ ] **Step 2: Smoke test**

```bash
curl -s http://localhost:3000/api/admin/orders -H "Cookie: ..." | jq .
```

Expected: `{ "orders": [...] }`, newest first, scoped to the actor's tenant.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/orders/route.ts
git commit -m "feat(admin-api): GET /api/admin/orders (scoped list, newest first)"
```

### Task 11: `GET /api/admin/orders/[id]` (scoped detail)

**Files:**
- Create: `src/app/api/admin/orders/[id]/route.ts`

- [ ] **Step 1: Create the handler**

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { user } from '@/db/auth-schema';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

/** Read one order. tenant_admin gets a 403 for orders outside its
 *  tenant; super_admin reads any. Joined to user for the customer
 *  display fields. */
export const GET = withSession(
  async (session, _req, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;

    const [row] = await db
      .select({
        order: orders,
        customer: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
        },
      })
      .from(orders)
      .leftJoin(user, eq(orders.customerId, user.id))
      .where(eq(orders.id, id))
      .limit(1);

    if (!row) return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
    requireTenantScope(session, row.order.tenantId);

    return NextResponse.json({ order: row.order, customer: row.customer });
  },
);
```

- [ ] **Step 2: Smoke test**

```bash
curl -s http://localhost:3000/api/admin/orders/<id> -H "Cookie: ..." | jq .
```

Expected: `{ "order": { ... }, "customer": { ... } | { "id":null, ... } }`. tenant_admin asking for another tenant's id → `{ "error":"forbidden_tenant" }` 403.

- [ ] **Step 3: Commit**

```bash
git add 'src/app/api/admin/orders/[id]/route.ts'
git commit -m "feat(admin-api): GET /api/admin/orders/[id] (scoped detail)"
```

### Task 12: `PATCH /api/admin/orders/[id]/status` (validated transition)

**Files:**
- Create: `src/app/api/admin/orders/[id]/status/route.ts`

- [ ] **Step 1: Create the handler**

```ts
import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import {
  validateOrderTransition,
  type OrderStatus,
} from '@/domain/orders';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

interface PatchBody {
  status?: unknown;
}

/** Move an order to a new status. The transition is validated in the
 *  pure domain layer (`validateOrderTransition`) — the route is a thin
 *  wrapper that loads the row, scopes it, and persists the change. */
export const PATCH = withSession(
  async (session, req, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;

    let body: PatchBody;
    try {
      body = (await req.json()) as PatchBody;
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }
    if (typeof body.status !== 'string') {
      return NextResponse.json(
        { error: 'validation_failed', details: ['status'] },
        { status: 422 },
      );
    }

    const [row] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!row) return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
    requireTenantScope(session, row.tenantId);

    const transitionErrors = validateOrderTransition(
      row.status as OrderStatus,
      body.status,
    );
    if (transitionErrors.length > 0) {
      return NextResponse.json(
        { error: 'invalid_transition', details: transitionErrors },
        { status: 422 },
      );
    }

    const [updated] = await db
      .update(orders)
      .set({ status: body.status as OrderStatus, updatedAt: sql`now()` })
      .where(eq(orders.id, id))
      .returning();

    return NextResponse.json({ order: updated });
  },
);
```

- [ ] **Step 2: Smoke test**

```bash
curl -s -X PATCH http://localhost:3000/api/admin/orders/<id>/status \
  -H "Content-Type: application/json" -H "Cookie: ..." \
  -d '{"status":"quoted"}' | jq .

# Invalid:
curl -s -X PATCH http://localhost:3000/api/admin/orders/<id>/status \
  -H "Content-Type: application/json" -H "Cookie: ..." \
  -d '{"status":"accepted"}' | jq .
# → { "error":"invalid_transition", "details":[{"code":"invalid_transition","from":"submitted","to":"accepted"}] }
```

- [ ] **Step 3: Commit**

```bash
git add 'src/app/api/admin/orders/[id]/status/route.ts'
git commit -m "feat(admin-api): PATCH /api/admin/orders/[id]/status (validated transition)"
```

---

## Wave 7 — Admin API: clients

The Phase-1 deferred endpoints. Read-only — clients are never invited from the admin (they're created by the shop POST in Wave 5).

### Task 13: `GET /api/admin/clients` (list)

**Files:**
- Create: `src/app/api/admin/clients/route.ts`

- [ ] **Step 1: Create the handler**

```ts
import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { user } from '@/db/auth-schema';
import { requireBusiness, type Role } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

/** List client users in scope. super_admin sees all; tenant_admin sees
 *  only its own tenant. Mirrors the shape of GET /api/admin/users. */
export const GET = withSession(async (session) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const actorRole = session.user.role as Role;
  const actorTenantId = session.user.tenantId as string | null;

  const fields = {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    tenantId: user.tenantId,
    createdAt: user.createdAt,
  } as const;

  const where =
    actorRole === 'super_admin'
      ? eq(user.userType, 'client')
      : and(eq(user.userType, 'client'), eq(user.tenantId, actorTenantId ?? '__none__'));

  const rows = await db
    .select(fields)
    .from(user)
    .where(where)
    .orderBy(desc(user.createdAt));

  return NextResponse.json({ clients: rows });
});
```

- [ ] **Step 2: Smoke test**

```bash
curl -s http://localhost:3000/api/admin/clients -H "Cookie: ..." | jq .
```

Expected: `{ "clients": [...] }`, scoped.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/clients/route.ts
git commit -m "feat(admin-api): GET /api/admin/clients (scoped list of client users)"
```

### Task 14: `GET /api/admin/clients/[id]` (detail + their orders)

**Files:**
- Create: `src/app/api/admin/clients/[id]/route.ts`

- [ ] **Step 1: Create the handler**

```ts
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { user } from '@/db/auth-schema';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

/** Read one client + their orders. tenant_admin gets a 403 for clients
 *  outside its tenant. */
export const GET = withSession(
  async (session, _req, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;

    const [client] = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        userType: user.userType,
        tenantId: user.tenantId,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);

    if (!client || client.userType !== 'client') {
      return NextResponse.json({ error: 'client_not_found' }, { status: 404 });
    }
    if (!client.tenantId) {
      return NextResponse.json({ error: 'client_orphaned' }, { status: 500 });
    }
    requireTenantScope(session, client.tenantId);

    const clientOrders = await db
      .select({
        id: orders.id,
        code: orders.code,
        status: orders.status,
        totalCents: orders.totalCents,
        currency: orders.currency,
        createdAt: orders.createdAt,
        submittedAt: orders.submittedAt,
      })
      .from(orders)
      .where(eq(orders.customerId, id))
      .orderBy(desc(orders.createdAt));

    return NextResponse.json({ client, orders: clientOrders });
  },
);
```

- [ ] **Step 2: Smoke test**

```bash
curl -s http://localhost:3000/api/admin/clients/<id> -H "Cookie: ..." | jq .
```

Expected: `{ "client": {...}, "orders": [...] }`. Asking for a business user's id → 404 `client_not_found` (clients endpoint never leaks business rows).

- [ ] **Step 3: Commit**

```bash
git add 'src/app/api/admin/clients/[id]/route.ts'
git commit -m "feat(admin-api): GET /api/admin/clients/[id] (scoped detail + their orders)"
```

---

## Wave 8 — Admin UI shell wiring

Tiny but enables the new pages to find their place in the navigation + breadcrumb. Doing it before the page tasks lets us click around as we add pages.

### Task 15: Add Orders + Clients to the sidebar

**Files:**
- Modify: `src/components/admin/Sidebar.tsx`

- [ ] **Step 1: Extend the icon imports + nav array**

In `src/components/admin/Sidebar.tsx`, extend the `lucide-react` import to include `ClipboardList` and `Contact2`, then extend `ITEMS`:

```ts
import {
  Building2,
  ChevronsUpDownIcon,
  ClipboardList,
  Contact2,
  LayoutDashboard,
  LogOutIcon,
  Store,
  Users,
} from 'lucide-react';

// …

const ITEMS: NavItem[] = [
  { href: '/admin', labelKey: 'admin.nav.dashboard', icon: LayoutDashboard, visible: () => true },
  { href: '/admin/orders', labelKey: 'admin.nav.orders', icon: ClipboardList, visible: () => true },
  { href: '/admin/clients', labelKey: 'admin.nav.clients', icon: Contact2, visible: () => true },
  { href: '/admin/tenants', labelKey: 'admin.nav.tenants', icon: Building2, visible: (r) => r === 'super_admin' },
  { href: '/admin/users', labelKey: 'admin.nav.users', icon: Users, visible: () => true },
];
```

- [ ] **Step 2: Verify build**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/Sidebar.tsx
git commit -m "feat(admin): add Orders + Clients nav items to sidebar"
```

### Task 16: Add Orders + Clients to STATIC_LABELS

**Files:**
- Modify: `src/components/admin/breadcrumbs.ts`

- [ ] **Step 1: Extend the map**

```ts
const STATIC_LABELS: Record<string, string> = {
  '/admin': 'admin.nav.dashboard',
  '/admin/orders': 'admin.nav.orders',
  '/admin/clients': 'admin.nav.clients',
  '/admin/tenants': 'admin.nav.tenants',
  '/admin/users': 'admin.nav.users',
};
```

This is enough for `/admin/orders` and `/admin/clients` (static crumbs) and for `/admin/orders/[id]` and `/admin/clients/[id]` (dynamic — parent is auto-chained, leaf comes from `<PageTitle>`).

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/breadcrumbs.ts
git commit -m "feat(admin): register /admin/orders + /admin/clients in STATIC_LABELS"
```

---

## Wave 9 — Admin UI: orders

### Task 17: `OrderStatusBadge` (shared between table + detail)

**Files:**
- Create: `src/components/admin/OrderStatusBadge.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/OrderStatusBadge.tsx
git commit -m "feat(admin): OrderStatusBadge"
```

### Task 18: `OrdersTable` (client component)

**Files:**
- Create: `src/components/admin/OrdersTable.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { OrderStatusBadge } from './OrderStatusBadge';
import { t } from '@/lib/i18n';
import type { OrderStatus } from '@/domain/orders';

interface Row {
  id: string;
  tenantId: string;
  code: string;
  customerId: string | null;
  contactEmail: string;
  contactName: string;
  status: OrderStatus;
  totalCents: number;
  currency: string;
  submittedAt: string | null;
  createdAt: string;
  customerEmail: string | null;
  customerName: string | null;
}

function formatCents(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('nl-BE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('nl-BE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

export function OrdersTable() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch('/api/admin/orders').then(async (r) => {
      if (r.ok) {
        const { orders } = await r.json();
        setRows(orders);
      }
    });
  }, []);

  if (rows === null) return <p className="text-sm text-neutral-500">…</p>;
  if (rows.length === 0)
    return <p className="text-sm text-neutral-500">{t('admin.orders.empty')}</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.orders.col.id')}</TableHead>
          <TableHead>{t('admin.orders.col.customer')}</TableHead>
          <TableHead>{t('admin.orders.col.email')}</TableHead>
          <TableHead>{t('admin.orders.col.status')}</TableHead>
          <TableHead className="text-right">{t('admin.orders.col.total')}</TableHead>
          <TableHead>{t('admin.orders.col.submittedAt')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-mono text-xs">
              <Link href={`/admin/orders/${row.id}`} className="hover:underline">
                {row.id.slice(0, 8)}
              </Link>
            </TableCell>
            <TableCell>{row.customerName ?? row.contactName}</TableCell>
            <TableCell>{row.customerEmail ?? row.contactEmail}</TableCell>
            <TableCell><OrderStatusBadge status={row.status} /></TableCell>
            <TableCell className="text-right">{formatCents(row.totalCents, row.currency)}</TableCell>
            <TableCell>{formatDate(row.submittedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/OrdersTable.tsx
git commit -m "feat(admin): OrdersTable (client-side fetch + render)"
```

### Task 19: `/admin/orders` list page

**Files:**
- Create: `src/app/admin/(authed)/orders/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { OrdersTable } from '@/components/admin/OrdersTable';

export default function OrdersPage() {
  // Static breadcrumb comes from STATIC_LABELS — no <PageTitle> here.
  return (
    <div className="space-y-6">
      <OrdersTable />
    </div>
  );
}
```

- [ ] **Step 2: Click test**

```bash
pnpm dev
# Visit http://localhost:3000/admin/orders → table renders, breadcrumb says "Bestellingen".
```

- [ ] **Step 3: Commit**

```bash
git add 'src/app/admin/(authed)/orders/page.tsx'
git commit -m "feat(admin): /admin/orders list page"
```

### Task 20: `OrderQuoteTable` (pure render of snapshot lineItems)

**Files:**
- Create: `src/components/admin/OrderQuoteTable.tsx`

- [ ] **Step 1: Create the component**

```tsx
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { t } from '@/lib/i18n';
import type { OrderQuoteSnapshot } from '@/domain/orders';

interface Props { snapshot: OrderQuoteSnapshot }

function formatEuros(eur: number, currency: string): string {
  return eur.toLocaleString('nl-BE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
}

/** Render the frozen quote line items. Labels go through `t(labelKey,
 *  labelParams)` per the project convention — never pre-formatted. */
export function OrderQuoteTable({ snapshot }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Onderdeel</TableHead>
          <TableHead className="text-right">Bedrag</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {snapshot.items.flatMap((item) =>
          item.lineItems.map((li, idx) => (
            <TableRow key={`${item.code}-${idx}`}>
              <TableCell>{t(li.labelKey, li.labelParams)}</TableCell>
              <TableCell className="text-right">
                {formatEuros(li.total, snapshot.currency)}
              </TableCell>
            </TableRow>
          )),
        )}
        <TableRow>
          <TableCell className="font-semibold">{t('email.orderConfirmation.total')}</TableCell>
          <TableCell className="text-right font-semibold">
            {formatEuros(snapshot.totalCents / 100, snapshot.currency)}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
```

Note: `LineItem.labelKey` and `LineItem.labelParams` are the structured shape returned by `calculateTotalQuote` (see `src/domain/pricing/calculate.ts`). Confirm the field names match before wiring this component — if `LineItem` doesn't expose `labelParams`, fall back to `t(li.labelKey)` only.

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/OrderQuoteTable.tsx
git commit -m "feat(admin): OrderQuoteTable (renders snapshot.items[*].lineItems)"
```

### Task 21: `OrderStatusControl` (PATCH client component)

**Files:**
- Create: `src/components/admin/OrderStatusControl.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/OrderStatusControl.tsx
git commit -m "feat(admin): OrderStatusControl — dropdown of valid next statuses"
```

### Task 22: `OrderContactCard`

**Files:**
- Create: `src/components/admin/OrderContactCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { t } from '@/lib/i18n';

interface Props {
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  customerId: string | null;
  notes: string | null;
}

export function OrderContactCard({
  contactName, contactEmail, contactPhone, customerId, notes,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.orders.detail.section.contact')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div><span className="text-neutral-500">Naam:</span> {contactName}</div>
        <div><span className="text-neutral-500">E-mail:</span> {contactEmail}</div>
        {contactPhone && <div><span className="text-neutral-500">Telefoon:</span> {contactPhone}</div>}
        {customerId ? (
          <div>
            <Link href={`/admin/clients/${customerId}`} className="text-blue-600 hover:underline">
              {t('admin.orders.detail.openCustomer')}
            </Link>
          </div>
        ) : (
          <div className="text-xs text-neutral-500">{t('admin.orders.detail.noCustomer')}</div>
        )}
        {notes && (
          <div className="pt-2 border-t border-neutral-100 mt-2">
            <div className="text-xs text-neutral-500 mb-1">{t('admin.orders.detail.notes')}</div>
            <p className="whitespace-pre-wrap">{notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/OrderContactCard.tsx
git commit -m "feat(admin): OrderContactCard"
```

### Task 23: `/admin/orders/[id]` detail page

**Files:**
- Create: `src/app/admin/(authed)/orders/[id]/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { user } from '@/db/auth-schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTitle } from '@/components/admin/PageTitle';
import { PageHeaderActions } from '@/components/admin/PageHeaderActions';
import { OrderStatusBadge } from '@/components/admin/OrderStatusBadge';
import { OrderStatusControl } from '@/components/admin/OrderStatusControl';
import { OrderQuoteTable } from '@/components/admin/OrderQuoteTable';
import { OrderContactCard } from '@/components/admin/OrderContactCard';
import { t } from '@/lib/i18n';
import type { OrderStatus } from '@/domain/orders';

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const role = session.user.role as string;
  const actorTenantId = session.user.tenantId as string | null;

  const [row] = await db
    .select({
      order: orders,
      customer: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
      },
    })
    .from(orders)
    .leftJoin(user, eq(orders.customerId, user.id))
    .where(eq(orders.id, id))
    .limit(1);

  if (!row) notFound();
  if (role !== 'super_admin' && row.order.tenantId !== actorTenantId) {
    redirect('/admin/orders');
  }

  const order = row.order;

  return (
    <div className="space-y-6">
      <PageTitle title={`#${order.id.slice(0, 8)}`} />
      <PageHeaderActions>
        <OrderStatusBadge status={order.status as OrderStatus} />
        <OrderStatusControl orderId={order.id} currentStatus={order.status as OrderStatus} />
      </PageHeaderActions>

      <div className="grid gap-6 md:grid-cols-2">
        <OrderContactCard
          contactName={order.contactName}
          contactEmail={order.contactEmail}
          contactPhone={order.contactPhone}
          customerId={order.customerId}
          notes={order.notes}
        />
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.orders.detail.section.config')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="font-mono text-xs break-all">
              {t('admin.orders.detail.code')}: {order.code}
            </div>
            <a
              href={`/?code=${order.code}`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline text-sm"
            >
              {t('admin.orders.detail.openConfigurator')} ↗
            </a>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.orders.detail.section.quote')}</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderQuoteTable snapshot={order.quoteSnapshot} />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Click test**

```bash
pnpm dev
# Visit http://localhost:3000/admin/orders/<id>
# Verify breadcrumb is "Bestellingen / #abc12345", status badge + dropdown render,
# clicking a valid next status updates the row + triggers a sonner toast.
```

- [ ] **Step 3: Verify rejected transition shows error toast**

Use the dropdown to attempt a forbidden transition (e.g. submit twice quickly to land on a terminal state). Confirm a destructive toast displays the API error.

- [ ] **Step 4: Commit**

```bash
git add 'src/app/admin/(authed)/orders/[id]/page.tsx'
git commit -m "feat(admin): /admin/orders/[id] detail page

Renders contact + config + quote + status. Status changes go through
the pure validateOrderTransition (in OrderStatusControl) so the UI
cannot offer a transition the API would reject."
```

---

## Wave 10 — Admin UI: clients

### Task 24: `ClientsTable` (client component)

**Files:**
- Create: `src/components/admin/ClientsTable.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { t } from '@/lib/i18n';

interface Row {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  tenantId: string | null;
  createdAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-BE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

export function ClientsTable() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch('/api/admin/clients').then(async (r) => {
      if (r.ok) {
        const { clients } = await r.json();
        setRows(clients);
      }
    });
  }, []);

  if (rows === null) return <p className="text-sm text-neutral-500">…</p>;
  if (rows.length === 0)
    return <p className="text-sm text-neutral-500">{t('admin.clients.empty')}</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.clients.col.email')}</TableHead>
          <TableHead>{t('admin.clients.col.name')}</TableHead>
          <TableHead>{t('admin.clients.col.tenant')}</TableHead>
          <TableHead>{t('admin.clients.col.createdAt')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((c) => (
          <TableRow key={c.id}>
            <TableCell>
              <Link href={`/admin/clients/${c.id}`} className="hover:underline">
                {c.email}
              </Link>
              {!c.emailVerified && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {t('admin.clients.detail.unclaimed')}
                </Badge>
              )}
            </TableCell>
            <TableCell>{c.name ?? '—'}</TableCell>
            <TableCell className="font-mono text-xs">{c.tenantId ?? '—'}</TableCell>
            <TableCell>{formatDate(c.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/ClientsTable.tsx
git commit -m "feat(admin): ClientsTable"
```

### Task 25: `/admin/clients` list page

**Files:**
- Create: `src/app/admin/(authed)/clients/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { ClientsTable } from '@/components/admin/ClientsTable';

export default function ClientsPage() {
  // Static breadcrumb from STATIC_LABELS — no <PageTitle>.
  return (
    <div className="space-y-6">
      <ClientsTable />
    </div>
  );
}
```

- [ ] **Step 2: Click test**

```bash
pnpm dev
# Visit http://localhost:3000/admin/clients → list renders.
```

- [ ] **Step 3: Commit**

```bash
git add 'src/app/admin/(authed)/clients/page.tsx'
git commit -m "feat(admin): /admin/clients list page"
```

### Task 26: `ClientOrdersList` (embedded mini-list)

**Files:**
- Create: `src/components/admin/ClientOrdersList.tsx`

- [ ] **Step 1: Create the component**

```tsx
import Link from 'next/link';
import { OrderStatusBadge } from './OrderStatusBadge';
import { t } from '@/lib/i18n';
import type { OrderStatus } from '@/domain/orders';

interface Order {
  id: string;
  status: OrderStatus;
  totalCents: number;
  currency: string;
  submittedAt: string | null;
}

interface Props { orders: Order[] }

function formatCents(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('nl-BE', {
    style: 'currency', currency, minimumFractionDigits: 2,
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('nl-BE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

export function ClientOrdersList({ orders }: Props) {
  if (orders.length === 0) {
    return <p className="text-sm text-neutral-500">{t('admin.clients.detail.noOrders')}</p>;
  }
  return (
    <ul className="divide-y divide-neutral-100">
      {orders.map((o) => (
        <li key={o.id} className="py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs hover:underline">
              #{o.id.slice(0, 8)}
            </Link>
            <OrderStatusBadge status={o.status} />
            <span className="text-xs text-neutral-500">{formatDate(o.submittedAt)}</span>
          </div>
          <div className="text-sm font-medium">{formatCents(o.totalCents, o.currency)}</div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/ClientOrdersList.tsx
git commit -m "feat(admin): ClientOrdersList (embedded mini-list)"
```

### Task 27: `/admin/clients/[id]` detail page

**Files:**
- Create: `src/app/admin/(authed)/clients/[id]/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { user } from '@/db/auth-schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTitle } from '@/components/admin/PageTitle';
import { ClientOrdersList } from '@/components/admin/ClientOrdersList';
import { Badge } from '@/components/ui/badge';
import { t } from '@/lib/i18n';
import type { OrderStatus } from '@/domain/orders';

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const role = session.user.role as string;
  const actorTenantId = session.user.tenantId as string | null;

  const [client] = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      userType: user.userType,
      tenantId: user.tenantId,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);

  if (!client || client.userType !== 'client') notFound();
  if (role !== 'super_admin' && client.tenantId !== actorTenantId) {
    redirect('/admin/clients');
  }

  const clientOrders = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalCents: orders.totalCents,
      currency: orders.currency,
      submittedAt: orders.submittedAt,
    })
    .from(orders)
    .where(eq(orders.customerId, id))
    .orderBy(desc(orders.createdAt));

  return (
    <div className="space-y-6">
      <PageTitle title={client.name ?? client.email} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t('admin.clients.detail.section.profile')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-neutral-500">{t('admin.clients.detail.email')}:</span> {client.email}</div>
            <div><span className="text-neutral-500">{t('admin.clients.detail.name')}:</span> {client.name ?? '—'}</div>
            <div className="pt-2">
              {client.emailVerified ? (
                <Badge>{t('admin.clients.detail.claimed')}</Badge>
              ) : (
                <Badge variant="outline">{t('admin.clients.detail.unclaimed')}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t('admin.clients.detail.section.orders')}</CardTitle></CardHeader>
          <CardContent>
            <ClientOrdersList
              orders={clientOrders.map((o) => ({
                ...o,
                status: o.status as OrderStatus,
                submittedAt: o.submittedAt ? o.submittedAt.toISOString() : null,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Click test**

```bash
pnpm dev
# Visit http://localhost:3000/admin/clients/<id>
# Verify breadcrumb "Klanten / <name>", profile + orders render.
```

- [ ] **Step 3: Commit**

```bash
git add 'src/app/admin/(authed)/clients/[id]/page.tsx'
git commit -m "feat(admin): /admin/clients/[id] detail page"
```

---

## Wave 11 — Verify, document, ship

### Task 28: Full test + build sweep

**Files:** none (verification only)

- [ ] **Step 1: Tests**

```bash
pnpm test
```

Expected: all green, including the new `orders-transitions.test.ts` and `orders-snapshot.test.ts`. Tally should be Phase-1 baseline (113+) + the new specs.

- [ ] **Step 2: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Build**

```bash
pnpm build
```

Expected: clean.

- [ ] **Step 4: Lint sanity**

```bash
pnpm lint
```

Expected: no NET-new errors versus `main`. (Pre-existing warnings are out of scope.)

If any of these fail, fix the failure here — do NOT proceed to docs.

### Task 29: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the orders module to "Architecture → src/domain/"**

Insert this bullet under the existing list (alphabetical neighbours: between `materials/` and `pricing/`):

```markdown
- `orders/` — pure order types (`OrderStatus`, `OrderQuoteSnapshot`, `OrderConfigSnapshot`, `OrderRecord`), state machine (`ALLOWED_TRANSITIONS`, `validateOrderTransition`, `allowedNextStatuses`), and `buildQuoteSnapshot` / `buildConfigSnapshot` for freezing the priced quote + ConfigData at submit time
```

- [ ] **Step 2: Add the `orders` table description under `src/db/`**

Right after the `tenant_hosts` description, append:

```markdown
- `orders` — customer orders. Each row freezes the priced quote
  (`quoteSnapshot`) and the ConfigData (`configSnapshot`) at submit
  time so the order is re-renderable years later regardless of
  price-book or migration drift. `customerId` is nullable until the
  client claims their magic-link account; `configId` cascades to NULL
  if the source config row is later GC'd.
```

- [ ] **Step 3: Add the new endpoints to `src/app/api/admin/*`**

Append to the bullet list of admin endpoints (after the `users` endpoints):

```markdown
  - `GET /api/admin/orders` — list orders in scope (newest first)
  - `GET /api/admin/orders/[id]` — order detail (joined with customer)
  - `PATCH /api/admin/orders/[id]/status` — validated transition via
    `validateOrderTransition` from `@/domain/orders`
  - `GET /api/admin/clients` — list `userType='client'` users in scope
  - `GET /api/admin/clients/[id]` — client detail + their orders
```

- [ ] **Step 4: Add the shop endpoint section**

Below the existing `src/app/api/admin/*` block, add a new top-level subsection:

```markdown
- `src/app/api/shop/*` — public + client-facing API.
  - `POST /api/shop/orders` — public, host-scoped. Takes
    `{ code, contact: { email, name, phone?, notes? } }`, snapshots the
    priced quote via `buildQuoteSnapshot`, auto-creates (or reuses) a
    `client` user keyed by email, and fires Better Auth's magic link
    with `callbackURL=/shop/account/orders/<id>`. The `sendMagicLink`
    callback in `src/lib/auth.ts` branches on that prefix and
    dispatches the order-confirmation template
    (`src/lib/orderConfirmationEmail.ts`) so the magic link rides
    inside the order email.
```

- [ ] **Step 5: Document the order state machine in "Conventions"**

Append a new bullet to the Conventions section:

```markdown
- **Order state machine** lives in `@/domain/orders/transitions.ts`.
  Allowed transitions: `submitted → quoted | cancelled`,
  `quoted → accepted | cancelled`, `accepted → cancelled`,
  `draft → submitted | cancelled` (reserved). `cancelled` is terminal.
  All transitions go through `validateOrderTransition`; the admin
  status dropdown sources its options from `allowedNextStatuses` so
  the UI cannot offer a transition the API would reject.
```

- [ ] **Step 6: Update the "Adding a new admin page" snippet**

In the existing "Admin UI patterns" subsection, the line that lists
STATIC_LABELS examples can stay generic. Verify the existing wording
("add the route to STATIC_LABELS") still applies — no rewrite needed.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): add orders module + endpoints + state machine"
```

### Task 30: Update ROADMAP.md

**Files:**
- Modify: `ROADMAP.md`

- [ ] **Step 1: Replace the stale Phase 2 description with a link**

Find the existing `## Phase 2 — Orders layer` section and replace its body with:

```markdown
## Phase 2 — Orders (in progress)

Detailed plan: `docs/superpowers/plans/2026-04-17-phase-2-orders.md`.
Spec progress is tracked at the bottom of
`docs/superpowers/specs/2026-04-17-platform-architecture-design.md`.
```

(Keep the Phase 3+ sections as-is — they're still accurate stubs.)

- [ ] **Step 2: Update the "Current state" block**

In the `## Current state` block at the top, append a bullet:

```markdown
- **Phase 2 (orders) in progress** on branch `phase-2-orders`
```

(If the Phase 1 "in progress" line is still there, replace it with a
"Phase 1 (admin foundation) shipped" bullet — Phase 1 is `[x]` in the
spec.)

- [ ] **Step 3: Commit**

```bash
git add ROADMAP.md
git commit -m "docs(roadmap): point Phase 2 at the new plan"
```

### Task 31: Tick `[x] Phase 2` in the spec

**Files:**
- Modify: `docs/superpowers/specs/2026-04-17-platform-architecture-design.md`

This is the LAST task — only tick the box once everything is merged. If the merge happens later, do this step in the same PR so docs and code stay in lockstep.

- [ ] **Step 1: Update the Progress section**

In the `## Progress` block at the bottom of the spec, change:

```markdown
- [ ] Phase 2 — Orders
```

to:

```markdown
- [x] Phase 2 — Orders — [plan](../plans/2026-04-17-phase-2-orders.md)
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-17-platform-architecture-design.md
git commit -m "docs(spec): tick [x] Phase 2 — Orders"
```

### Task 32: Merge

- [ ] **Step 1: Push the branch**

```bash
git push -u origin phase-2-orders
```

- [ ] **Step 2: Open a PR (or merge locally if the project hasn't been opened to PR review yet)**

```bash
gh pr create --title "Phase 2 — Orders" --body "$(cat <<'EOF'
## Summary
- New `src/domain/orders/` (state machine, snapshot helpers).
- `orders` table + migration `0005_orders.sql`.
- Public `POST /api/shop/orders` (auto-creates client user, snapshots quote, fires magic link with order-aware callback).
- Admin endpoints: `GET /api/admin/orders`, `GET /api/admin/orders/[id]`, `PATCH /api/admin/orders/[id]/status`, `GET /api/admin/clients`, `GET /api/admin/clients/[id]`.
- Admin UI: `/admin/orders`, `/admin/orders/[id]` (with status dropdown sourced from pure `allowedNextStatuses`), `/admin/clients`, `/admin/clients/[id]`.
- Order-confirmation email shipped by branching the existing `sendMagicLink` on the callback URL.

Closes Phase 2 of `docs/superpowers/specs/2026-04-17-platform-architecture-design.md`.

## Test plan
- [ ] `pnpm test` — green (Phase 1 baseline + new orders specs).
- [ ] `pnpm exec tsc --noEmit` — clean.
- [ ] `pnpm build` — clean.
- [ ] Submit an order via `POST /api/shop/orders` against `localhost:3000` with a saved share code; confirm `201`, magic link in the dev terminal points at `/shop/account/orders/<id>`, and the order is visible at `/admin/orders`.
- [ ] Walk the status flow `submitted → quoted → accepted` from `/admin/orders/<id>`; confirm sonner toasts.
- [ ] Confirm `tenant_admin` cannot see another tenant's orders or clients (403).
EOF
)"
```

Merge once green.

---

## Self-Review Notes (run BEFORE handing off)

After writing every task, the plan author re-checked the spec section by section. Findings:

- **Spec → tasks coverage:** every Phase-2 deliverable in the spec maps to at least one task. `orders` table → T4/T5; state machine → T2; `POST /api/shop/orders` → T9 (incl. auto-create client user); admin orders endpoints → T10/T11/T12; admin clients endpoints → T13/T14; admin pages → T17–T27; sidebar + breadcrumbs → T15/T16; order-confirmation email with magic link inside → T7+T8 (intercepted via callbackURL prefix); CLAUDE.md update → T29; spec progress tick → T31.
- **Out-of-scope guardrails:** the configurator submit button (Phase 3) and webshop shell (Phase 4) are intentionally absent. The order-claim page at `/shop/account/orders/<id>` is referenced as the magic-link target but is NOT built here — Phase 4 builds it. The dev consequence is that clicking the magic link in Phase 2 dev lands on a 404; that's expected.
- **Type consistency:** `OrderStatus` (T1) is used consistently across T2, T9, T11, T12, T18, T21, T23, T26, T27. `OrderQuoteSnapshot.totalCents` (T1) is used by T9 (insert), T18, T20. `OrderRecord` is exported but not strictly required by any task (UI types are bespoke + thinner). `validateOrderTransition` (T2) is the single source of truth for transition rules — used by both T12 (API) and T21 (UI via `allowedNextStatuses`).
- **No placeholders:** every code-bearing step shows the full code. Two task notes acknowledge known unknowns to verify in-the-moment (T3 fixture export name, T20 `LineItem.labelParams` field name) — both with concrete fallbacks.
