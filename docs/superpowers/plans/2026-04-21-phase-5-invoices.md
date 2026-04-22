# Phase 5 — Invoices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a lean, VAT-compliant invoicing surface on top of Phase 2 orders. Admin (super_admin + tenant_admin) issues an invoice for an accepted order, records manual bank-transfer payments against it, and reads a derived payment status. Invoices render as PDFs on demand via `@react-pdf/renderer`. Clients see their invoice(s) on `/shop/account/invoices/[id]` with a download link. No online payments (Phase 6). No email-out (manual for now). No credit notes (deferred).

**Architecture:** Follow the existing "pure domain → schema → admin API → admin UI → shop UI" slicing. A new `src/domain/invoicing/` module owns numbering, VAT math, payment-status derivation, supplier snapshotting, and patch validators — all framework-free, TDD'd. Tenants grow an `invoicing` jsonb column (`vatRate`, `paymentTermDays`, `bankIban`, `bankBic`) that admins edit via a new `InvoicingSection`. A new `invoices` table holds the frozen line-of-business invoice (tenant snapshot + VAT + number + dates + customer address); `invoice_numbers` tracks the atomic per-tenant per-year sequence; `payments` records bank-transfer entries. PDFs are rendered on demand (not stored) through `@react-pdf/renderer`. The invoice's line items are not duplicated — they're read from the frozen `orders.quoteSnapshot` at render time, which is already immutable by Phase 2's design.

**Tech Stack:** Next 16 (App Router), Drizzle (Neon HTTP), Better Auth, `@react-pdf/renderer` (new), Tailwind v4, shadcn (new-york), Vitest via `vite-plus/test`.

**Spec:** `docs/superpowers/specs/2026-04-17-platform-architecture-design.md` — Phase 5 section (lines 236–242), Data model (`invoices`, `invoice_numbers`, `payments`), Route map (`/admin/invoices/*`, `/shop/account/invoices/[id]`, `/api/admin/invoices/*`, `/api/shop/*`), Auth-guards table.

**Reference (read-only):** The Phase 2 orders plan (`docs/superpowers/plans/2026-04-17-phase-2-orders.md`) for data-model + pure-domain precedent, and the Phase 4.5 plan (`docs/superpowers/plans/2026-04-21-phase-4.5-material-catalog.md`) for admin-section style. Existing admin PATCH endpoints (`src/app/api/admin/tenants/[id]/{branding,price-book,enabled-materials}/route.ts`) are the canonical endpoint shape.

---

## Design decisions (locked at plan time)

1. **VAT model.** `order.totalCents` is ex-VAT (confirmed: `calculateTotalQuote` in `src/domain/pricing/calculate.ts` sums scalar priceBook dials without adding VAT; `buildQuoteSnapshot` uses that sum verbatim as both `subtotalCents` and `totalCents` inside the quote snapshot). Phase 5 adds VAT at invoice time:
   - `invoice.subtotalCents` = `order.totalCents` (copied at issue)
   - `invoice.vatRate` = captured at issue (default from `tenant.invoicing.vatRate`, editable per-invoice — handles 6% construction VAT edge cases without a new tenant setting)
   - `invoice.vatCents` = `round(subtotalCents * vatRate)` (banker's rounding — `Math.round` in JS is half-away-from-zero for positives, which matches typical Belgian invoice-rounding practice)
   - `invoice.totalCents` = `subtotalCents + vatCents` (grand total incl. VAT — matches the spec's `totalCents, vatCents` columns)
2. **Numbering.** Format `"YYYY-NNNN"` (four-digit zero-padded sequence, calendar year). Per-tenant, gapless within a year. Reset at Jan-1 rollover via the atomic UPDATE below. Initialised lazily: the `invoice_numbers` row for a tenant only exists after the first invoice.
3. **Atomic sequence allocation.** Single SQL round-trip per invoice issuance — no advisory locks, no explicit transactions (Neon HTTP doesn't support them cheaply):
   ```sql
   INSERT INTO invoice_numbers (tenant_id, year, last_seq)
   VALUES ($tenantId, $currentYear, 1)
   ON CONFLICT (tenant_id) DO UPDATE SET
     year     = $currentYear,
     last_seq = CASE WHEN invoice_numbers.year = $currentYear
                     THEN invoice_numbers.last_seq + 1
                     ELSE 1 END
   RETURNING year, last_seq;
   ```
   The upsert handles three cases atomically: first-ever invoice for the tenant (INSERT), same-year next invoice (increment), new-year first invoice (reset). `invoice_numbers(tenant_id)` is a single-row-per-tenant PK.
4. **Customer address at issue time, not submit time.** Phase 2 captured `contactName / contactEmail / contactPhone / notes` on orders — no address. Belgian invoices legally require a customer address. **Phase 5 collects the address at invoice-issue time** via the admin's IssueInvoiceDialog (and stores it on `invoices.customerAddress`, not on the order). Customers never have to think about it upfront. Future work could add a `user.defaultAddress` field on claim, but that's out of scope here.
5. **Supplier snapshot.** Same immutability pattern as `quoteSnapshot` — freeze tenant supplier details on the invoice row as `supplierSnapshot jsonb`: `{ displayName, address, vatNumber, bankIban, bankBic, contactEmail, paymentTermDays }`. Re-renders years later even if `tenant.invoicing` or `tenant.branding.footer` drift. Line items are NOT duplicated: the invoice references the order, and `orders.quoteSnapshot.items[*].lineItems` is already immutable.
6. **PDF strategy.** `@react-pdf/renderer` (React-renderable Document/Page/View/Text primitives; serverless-safe; no Chromium dependency; ~100 ms cold-start overhead). On-demand generation via a `GET /api/invoices/[id]/pdf` route that streams `application/pdf`. `invoices.pdfUrl` stays `null` for Phase 5 — revisit if we add "email the invoice" flows.
7. **Payment status (derived, never stored).** Pure helper `derivePaymentStatus(totalCents, payments)` returns one of `'unpaid' | 'partial' | 'paid' | 'overpaid'`. No status column on the invoice. A 1-cent tolerance collapses rounding drift (`paid` = sum ≥ total − 1, `overpaid` = sum > total + 1).
8. **Status-machine coupling.** Invoice issuance requires `order.status === 'accepted'` (422 `order_not_invoiceable`) and `orders.id` UNIQUE on `invoices.orderId` (409 `already_invoiced`). No new order state is added; Phase 5 does not mutate the order's status.
9. **Method enum.** `payments.method ∈ {'manual', 'mollie', 'stripe'}` today. Phase 5 only accepts `'manual'` via the admin API; the column + enum are wider so Phase 6 (online payments) lands without a migration.
10. **Tenant-supplier gate.** Issuing an invoice requires `tenant.invoicing.bankIban` to be set; otherwise 422 `supplier_incomplete`. The InvoicingSection is the remedy.
11. **Route-name nit.** The spec's route map has a standalone `/shop/account/invoices/[id]`; we keep it (so the client can deep-link to a single invoice PDF) AND surface a "Factuur" row on the existing `/shop/account/orders/[id]` detail so clients don't have to hunt. No `/shop/account/invoices` list page — the orders list is the entry point.
12. **What we DON'T ship in Phase 5.** Credit notes, invoice edits (immutable), email delivery, Mollie/Stripe providers, order-item multi-invoicing, bulk PDF, invoice listing on the shop side, tenant-branded PDF themes (uses tenant name/colour only), dunning/reminders.

---

## File map

Files this plan creates or modifies (grouped by responsibility):

**Domain (pure, no framework imports)**
- Create `src/domain/invoicing/types.ts` — `InvoiceRecord`, `PaymentRecord`, `PaymentStatus`, `InvoiceSupplierSnapshot`, `InvoicePaymentMethod`.
- Create `src/domain/invoicing/numbering.ts` — `formatInvoiceNumber(year, seq)` + tests.
- Create `src/domain/invoicing/vat.ts` — `computeInvoiceAmounts({ subtotalCents, vatRate })` + tests.
- Create `src/domain/invoicing/paymentStatus.ts` — `derivePaymentStatus(totalCents, payments)` + tests.
- Create `src/domain/invoicing/supplierSnapshot.ts` — `buildSupplierSnapshot(tenant)` + tests.
- Create `src/domain/invoicing/validators.ts` — `validateIssueInvoiceInput`, `validatePaymentInput`, `validateInvoicingPatch` + tests.
- Create `src/domain/invoicing/index.ts` — barrel.
- Create `src/domain/tenant/invoicing.ts` — `TenantInvoicing` type + `DEFAULT_ASSYMO_INVOICING` constant + `validateInvoicingPatch` (re-exported from invoicing module).
- Modify `src/domain/tenant/types.ts` — add `invoicing: TenantInvoicing` to `TenantContext`.
- Modify `src/domain/tenant/index.ts` — re-export `./invoicing`.

**DB + seed**
- Modify `src/db/schema.ts` — add `tenants.invoicing` jsonb (NOT NULL, default via seed) + three new tables: `invoices`, `invoice_numbers`, `payments`.
- Generate `src/db/migrations/0007_invoices.sql` via `pnpm db:generate` (name may vary; `0007_` prefix is what matters).
- Modify `src/db/seed.ts` — seed assymo tenant with `DEFAULT_ASSYMO_INVOICING`.

**Admin API**
- Create `src/app/api/admin/tenants/[id]/invoicing/route.ts` — `PATCH` for supplier defaults.
- Create `src/app/api/admin/orders/[id]/invoice/route.ts` — `POST` to issue.
- Create `src/app/api/admin/invoices/route.ts` — `GET` list.
- Create `src/app/api/admin/invoices/[id]/route.ts` — `GET` detail (with payments[]).
- Create `src/app/api/admin/invoices/[id]/payments/route.ts` — `POST` record payment.

**Dual-audience API**
- Create `src/app/api/invoices/[id]/pdf/route.ts` — `GET` streams the PDF; auth-scoped (business tenant-scope OR client own-order).

**Shop API**
- Create `src/app/api/shop/invoices/[id]/route.ts` — `GET` ownership-scoped detail (read-only).

**Admin UI**
- Create `src/components/admin/InvoicingSection.tsx` — tenant supplier defaults editor.
- Create `src/components/admin/InvoicesTable.tsx` — client-fetch list for `/admin/invoices`.
- Create `src/components/admin/InvoicePaymentsList.tsx` — renders payments on the detail page + derived status.
- Create `src/components/admin/IssueInvoiceDialog.tsx` — button + modal on `/admin/orders/[id]`.
- Create `src/components/admin/RecordPaymentDialog.tsx` — button + modal on `/admin/invoices/[id]`.
- Modify `src/app/admin/(authed)/tenants/[id]/page.tsx` — mount `<InvoicingSection>` next to Materials/PriceBook/Branding.
- Create `src/app/admin/(authed)/invoices/page.tsx` — list page.
- Create `src/app/admin/(authed)/invoices/[id]/page.tsx` — detail page.
- Modify `src/app/admin/(authed)/orders/[id]/page.tsx` — render `<IssueInvoiceDialog>` when `order.status === 'accepted' && !hasInvoice`; show invoice link + status when `hasInvoice`.
- Modify `src/components/admin/Sidebar.tsx` — add Invoices nav item (both roles visible).
- Modify `src/components/admin/breadcrumbs.ts` — register `/admin/invoices`.

**Shop UI**
- Modify `src/app/shop/(authed)/account/orders/[id]/page.tsx` — if the order has an invoice, render a "Factuur" card with invoice number, totals, status, a link to `/shop/account/invoices/[id]`, and a "Download PDF" button.
- Create `src/app/shop/(authed)/account/invoices/[id]/page.tsx` — read-only invoice detail with PDF-download link.

**PDF**
- Create `src/components/invoice/InvoicePdf.tsx` — `@react-pdf/renderer` Document component.
- Create `src/lib/renderInvoicePdf.ts` — thin server helper that composes the PDF stream from an `InvoiceRecord` + its order + tenant branding.

**i18n**
- Modify `src/lib/i18n.ts` — add `admin.invoices.*`, `admin.tenant.section.invoicing`, `admin.invoices.*`, `admin.invoicing.form.*`, `admin.invoicing.payments.*`, `admin.invoicing.errors.*`, `shop.invoice.*`, `invoice.pdf.*` (labels on the PDF).

**Package**
- Modify `package.json` — add `@react-pdf/renderer`.

**Docs**
- Modify `CLAUDE.md` — new invoicing module, new endpoints, new admin page, new shop page, TenantContext field, PDF convention.
- Modify `docs/superpowers/specs/2026-04-17-platform-architecture-design.md` — tick `[x] Phase 5 — Invoices` (final task, after merge).

---

## Wave 1 — Pure domain: invoicing module

No DB, no Next, no React. Full TDD. Each helper has a unit test; each validator mirrors the established `validateBrandingPatch` / `validatePriceBookPatch` / `validateEnabledMaterialsPatch` shape.

### Task 1: `TenantInvoicing` + `DEFAULT_ASSYMO_INVOICING` + `validateInvoicingPatch`

**Files:**
- Create: `src/domain/tenant/invoicing.ts`
- Create: `tests/tenant-invoicing.test.ts`
- Modify: `src/domain/tenant/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/tenant-invoicing.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import {
  DEFAULT_ASSYMO_INVOICING,
  validateInvoicingPatch,
} from '@/domain/tenant';

describe('DEFAULT_ASSYMO_INVOICING', () => {
  it('ships a 21% VAT rate and 30-day term', () => {
    expect(DEFAULT_ASSYMO_INVOICING.vatRate).toBe(0.21);
    expect(DEFAULT_ASSYMO_INVOICING.paymentTermDays).toBe(30);
  });
  it('has a blank bankIban sentinel (admin must fill)', () => {
    expect(DEFAULT_ASSYMO_INVOICING.bankIban).toBe('');
    expect(DEFAULT_ASSYMO_INVOICING.bankBic).toBeNull();
  });
});

describe('validateInvoicingPatch', () => {
  it('accepts a complete valid patch', () => {
    const { invoicing, errors } = validateInvoicingPatch({
      vatRate: 0.06,
      paymentTermDays: 45,
      bankIban: 'BE68 5390 0754 7034',
      bankBic: 'BBRUBEBB',
    });
    expect(errors).toEqual([]);
    expect(invoicing).toEqual({
      vatRate: 0.06,
      paymentTermDays: 45,
      bankIban: 'BE68 5390 0754 7034',
      bankBic: 'BBRUBEBB',
    });
  });

  it('accepts a partial patch (only paymentTermDays)', () => {
    const { invoicing, errors } = validateInvoicingPatch({ paymentTermDays: 60 });
    expect(errors).toEqual([]);
    expect(invoicing).toEqual({ paymentTermDays: 60 });
  });

  it('rejects a non-object body', () => {
    const { errors } = validateInvoicingPatch(null);
    expect(errors).toContain('body');
  });

  it('rejects vatRate outside 0-1 inclusive', () => {
    expect(validateInvoicingPatch({ vatRate: 1.5 }).errors).toContain('vatRate');
    expect(validateInvoicingPatch({ vatRate: -0.1 }).errors).toContain('vatRate');
    expect(validateInvoicingPatch({ vatRate: 0 }).errors).toEqual([]);
    expect(validateInvoicingPatch({ vatRate: 1 }).errors).toEqual([]);
  });

  it('rejects non-positive paymentTermDays', () => {
    expect(validateInvoicingPatch({ paymentTermDays: 0 }).errors).toContain('paymentTermDays');
    expect(validateInvoicingPatch({ paymentTermDays: -5 }).errors).toContain('paymentTermDays');
    expect(validateInvoicingPatch({ paymentTermDays: 1.5 }).errors).toContain('paymentTermDays');
  });

  it('rejects empty bankIban when key is present', () => {
    expect(validateInvoicingPatch({ bankIban: '' }).errors).toContain('bankIban');
  });

  it('accepts null bankBic (explicit clear) but not empty string', () => {
    expect(validateInvoicingPatch({ bankBic: null }).errors).toEqual([]);
    expect(validateInvoicingPatch({ bankBic: '' }).errors).toContain('bankBic');
  });
});
```

- [ ] **Step 2: Run the tests — confirm they fail**

Run: `pnpm test -- tests/tenant-invoicing.test.ts`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the module**

Create `src/domain/tenant/invoicing.ts`:

```ts
/** Per-tenant invoicing defaults. Editable through the admin
 *  InvoicingSection; seeded on the assymo tenant with 21% / 30d. */
export interface TenantInvoicing {
  /** VAT rate as a fraction. 0.21 = 21%. Valid range [0, 1]. */
  vatRate: number;
  /** Default due-date offset from issue date. Positive integer days. */
  paymentTermDays: number;
  /** Supplier's bank account for the invoice footer. Admin MUST set
   *  this before issuing the first invoice — the server returns
   *  `supplier_incomplete` (422) otherwise. Empty string = unset. */
  bankIban: string;
  /** Optional BIC; null when the bank doesn't require it. */
  bankBic: string | null;
}

export const DEFAULT_ASSYMO_INVOICING: TenantInvoicing = {
  vatRate: 0.21,
  paymentTermDays: 30,
  bankIban: '',
  bankBic: null,
};

export interface ValidatedInvoicingPatch {
  invoicing: Partial<TenantInvoicing>;
  errors: string[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Validate a partial tenant.invoicing PATCH body. Mirrors the shape of
 *  validateBrandingPatch / validatePriceBookPatch — returns the cleaned
 *  partial + a list of failing field paths. Empty errors = safe to merge. */
export function validateInvoicingPatch(input: unknown): ValidatedInvoicingPatch {
  if (!isObject(input)) return { invoicing: {}, errors: ['body'] };

  const out: Partial<TenantInvoicing> = {};
  const errors: string[] = [];

  if ('vatRate' in input) {
    const v = input.vatRate;
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1) {
      out.vatRate = v;
    } else errors.push('vatRate');
  }
  if ('paymentTermDays' in input) {
    const v = input.paymentTermDays;
    if (typeof v === 'number' && Number.isInteger(v) && v > 0) {
      out.paymentTermDays = v;
    } else errors.push('paymentTermDays');
  }
  if ('bankIban' in input) {
    if (typeof input.bankIban === 'string' && input.bankIban.length > 0) {
      out.bankIban = input.bankIban;
    } else errors.push('bankIban');
  }
  if ('bankBic' in input) {
    const v = input.bankBic;
    if (v === null) out.bankBic = null;
    else if (typeof v === 'string' && v.length > 0) out.bankBic = v;
    else errors.push('bankBic');
  }

  return { invoicing: out, errors };
}
```

- [ ] **Step 4: Re-export from the barrel**

Open `src/domain/tenant/index.ts`. Append to the end (after the existing `export * from './enabledMaterials';`):

```ts
export * from './invoicing';
```

- [ ] **Step 5: Run the tests — confirm they pass**

Run: `pnpm test -- tests/tenant-invoicing.test.ts`

Expected: all cases pass.

- [ ] **Step 6: Typecheck + full sweep**

```bash
pnpm exec tsc --noEmit
pnpm test
```

Expected: green. Test count 218 → ~225.

- [ ] **Step 7: Commit**

```bash
git add src/domain/tenant/invoicing.ts src/domain/tenant/index.ts tests/tenant-invoicing.test.ts
git commit -m "feat(domain/tenant): add TenantInvoicing + validateInvoicingPatch"
```

### Task 2: `formatInvoiceNumber` + tests

**Files:**
- Create: `src/domain/invoicing/numbering.ts`
- Create: `tests/invoicing-numbering.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/invoicing-numbering.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import { formatInvoiceNumber } from '@/domain/invoicing';

describe('formatInvoiceNumber', () => {
  it('zero-pads sequence to four digits', () => {
    expect(formatInvoiceNumber(2026, 1)).toBe('2026-0001');
    expect(formatInvoiceNumber(2026, 42)).toBe('2026-0042');
    expect(formatInvoiceNumber(2026, 9999)).toBe('2026-9999');
  });
  it('allows sequences beyond 9999 without truncation', () => {
    // Extremely unlikely but should be resilient.
    expect(formatInvoiceNumber(2026, 10000)).toBe('2026-10000');
    expect(formatInvoiceNumber(2026, 123456)).toBe('2026-123456');
  });
  it('throws on a negative or non-integer sequence', () => {
    expect(() => formatInvoiceNumber(2026, 0)).toThrow();
    expect(() => formatInvoiceNumber(2026, -1)).toThrow();
    expect(() => formatInvoiceNumber(2026, 1.5)).toThrow();
  });
  it('throws on a non-4-digit year', () => {
    expect(() => formatInvoiceNumber(99, 1)).toThrow();
    expect(() => formatInvoiceNumber(20260, 1)).toThrow();
    expect(() => formatInvoiceNumber(1999, 1)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests — confirm they fail**

Run: `pnpm test -- tests/invoicing-numbering.test.ts`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `src/domain/invoicing/numbering.ts`:

```ts
/** Format a per-tenant-per-year invoice number. Pattern: `YYYY-NNNN`
 *  with 4-digit zero-padding; sequences beyond 9999 are rendered as
 *  their natural-length integer (we never truncate). */
export function formatInvoiceNumber(year: number, seq: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new Error(`Invalid invoice-number year: ${year}`);
  }
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`Invalid invoice-number sequence: ${seq}`);
  }
  return `${year}-${String(seq).padStart(4, '0')}`;
}
```

- [ ] **Step 4: Run the tests, typecheck, commit**

```bash
pnpm test -- tests/invoicing-numbering.test.ts
pnpm exec tsc --noEmit
```

Don't commit yet — Task 3 will add to the same folder and we'll commit the barrel + helpers together after Task 5.

### Task 3: `computeInvoiceAmounts` (VAT math) + tests

**Files:**
- Create: `src/domain/invoicing/vat.ts`
- Create: `tests/invoicing-vat.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/invoicing-vat.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import { computeInvoiceAmounts } from '@/domain/invoicing';

describe('computeInvoiceAmounts', () => {
  it('adds 21% VAT on a round subtotal', () => {
    expect(computeInvoiceAmounts({ subtotalCents: 10000, vatRate: 0.21 }))
      .toEqual({ subtotalCents: 10000, vatCents: 2100, totalCents: 12100 });
  });
  it('rounds half-away-from-zero per Math.round', () => {
    // 12345 * 0.21 = 2592.45 → 2592 (Math.round on 2592.45 = 2592)
    expect(computeInvoiceAmounts({ subtotalCents: 12345, vatRate: 0.21 }))
      .toEqual({ subtotalCents: 12345, vatCents: 2592, totalCents: 14937 });
  });
  it('returns zero VAT when rate is 0', () => {
    expect(computeInvoiceAmounts({ subtotalCents: 10000, vatRate: 0 }))
      .toEqual({ subtotalCents: 10000, vatCents: 0, totalCents: 10000 });
  });
  it('handles the Belgian 6% construction rate', () => {
    expect(computeInvoiceAmounts({ subtotalCents: 10000, vatRate: 0.06 }))
      .toEqual({ subtotalCents: 10000, vatCents: 600, totalCents: 10600 });
  });
  it('handles the Belgian 12% rate', () => {
    expect(computeInvoiceAmounts({ subtotalCents: 10000, vatRate: 0.12 }))
      .toEqual({ subtotalCents: 10000, vatCents: 1200, totalCents: 11200 });
  });
  it('throws on negative subtotal', () => {
    expect(() => computeInvoiceAmounts({ subtotalCents: -1, vatRate: 0.21 })).toThrow();
  });
  it('throws on invalid vatRate', () => {
    expect(() => computeInvoiceAmounts({ subtotalCents: 100, vatRate: -0.1 })).toThrow();
    expect(() => computeInvoiceAmounts({ subtotalCents: 100, vatRate: 1.1 })).toThrow();
    expect(() => computeInvoiceAmounts({ subtotalCents: 100, vatRate: Number.NaN })).toThrow();
  });
});
```

- [ ] **Step 2: Implement**

Create `src/domain/invoicing/vat.ts`:

```ts
export interface InvoiceAmounts {
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
}

/** Compute invoice subtotal / VAT / total from an ex-VAT subtotal + a
 *  fractional rate. Throws on invalid input so the API layer can 422 with
 *  a specific field path rather than producing nonsensical invoices. */
export function computeInvoiceAmounts(input: {
  subtotalCents: number;
  vatRate: number;
}): InvoiceAmounts {
  const { subtotalCents, vatRate } = input;
  if (!Number.isFinite(subtotalCents) || subtotalCents < 0 || !Number.isInteger(subtotalCents)) {
    throw new Error(`Invalid subtotalCents: ${subtotalCents}`);
  }
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 1) {
    throw new Error(`Invalid vatRate: ${vatRate}`);
  }
  const vatCents = Math.round(subtotalCents * vatRate);
  const totalCents = subtotalCents + vatCents;
  return { subtotalCents, vatCents, totalCents };
}
```

- [ ] **Step 3: Run the tests, typecheck**

```bash
pnpm test -- tests/invoicing-vat.test.ts
pnpm exec tsc --noEmit
```

Again, don't commit yet — bundled at Task 5.

### Task 4: `derivePaymentStatus` + tests

**Files:**
- Create: `src/domain/invoicing/paymentStatus.ts`
- Create: `tests/invoicing-paymentStatus.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/invoicing-paymentStatus.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import { derivePaymentStatus } from '@/domain/invoicing';

describe('derivePaymentStatus', () => {
  const total = 10000;
  const payments = (amounts: number[]) =>
    amounts.map((amountCents) => ({ amountCents }));

  it('returns "unpaid" when sum is 0', () => {
    expect(derivePaymentStatus(total, payments([]))).toBe('unpaid');
    expect(derivePaymentStatus(total, payments([0, 0]))).toBe('unpaid');
  });
  it('returns "partial" when 0 < sum < total', () => {
    expect(derivePaymentStatus(total, payments([5000]))).toBe('partial');
    expect(derivePaymentStatus(total, payments([3000, 2000]))).toBe('partial');
  });
  it('returns "paid" when sum equals total', () => {
    expect(derivePaymentStatus(total, payments([10000]))).toBe('paid');
    expect(derivePaymentStatus(total, payments([4000, 6000]))).toBe('paid');
  });
  it('collapses a 1-cent rounding gap into "paid"', () => {
    expect(derivePaymentStatus(total, payments([9999]))).toBe('paid');
  });
  it('returns "overpaid" when sum exceeds total by more than tolerance', () => {
    expect(derivePaymentStatus(total, payments([11000]))).toBe('overpaid');
  });
  it('1-cent overpay stays "paid" (tolerance)', () => {
    expect(derivePaymentStatus(total, payments([10001]))).toBe('paid');
  });
});
```

- [ ] **Step 2: Implement**

Create `src/domain/invoicing/paymentStatus.ts`:

```ts
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overpaid';

const TOLERANCE_CENTS = 1;

/** Pure derivation of an invoice's payment bucket from its total and
 *  a list of payment amounts (cents). `paid` and `overpaid` are
 *  separated by a ±1 cent tolerance to absorb rounding drift. */
export function derivePaymentStatus(
  totalCents: number,
  payments: readonly { amountCents: number }[],
): PaymentStatus {
  const sum = payments.reduce((acc, p) => acc + p.amountCents, 0);
  if (sum <= 0) return 'unpaid';
  if (sum >= totalCents - TOLERANCE_CENTS && sum <= totalCents + TOLERANCE_CENTS) return 'paid';
  if (sum < totalCents) return 'partial';
  return 'overpaid';
}
```

- [ ] **Step 3: Run tests, typecheck**

```bash
pnpm test -- tests/invoicing-paymentStatus.test.ts
pnpm exec tsc --noEmit
```

### Task 5: Types + `buildSupplierSnapshot` + barrel + commit

**Files:**
- Create: `src/domain/invoicing/types.ts`
- Create: `src/domain/invoicing/supplierSnapshot.ts`
- Create: `src/domain/invoicing/index.ts`
- Create: `tests/invoicing-supplierSnapshot.test.ts`

- [ ] **Step 1: Write the types**

Create `src/domain/invoicing/types.ts`:

```ts
import type { Currency } from '@/domain/tenant';
import type { PaymentStatus } from './paymentStatus';

/** Frozen supplier details on the invoice — re-renders years later
 *  even if the tenant's live `invoicing` or `branding.footer` drift. */
export interface InvoiceSupplierSnapshot {
  displayName: string;
  address: string;
  vatNumber: string | null;
  contactEmail: string;
  bankIban: string;
  bankBic: string | null;
  paymentTermDays: number;
}

export type InvoicePaymentMethod = 'manual' | 'mollie' | 'stripe';

/** View type returned by API handlers + consumed by admin/shop UI. */
export interface InvoiceRecord {
  id: string;
  tenantId: string;
  orderId: string;
  number: string;              // "YYYY-NNNN"
  issuedAt: string;            // ISO
  dueAt: string;               // ISO
  customerAddress: string;
  subtotalCents: number;
  vatRate: number;             // 0.21 etc.
  vatCents: number;
  totalCents: number;          // = subtotal + vat
  currency: Currency;
  supplierSnapshot: InvoiceSupplierSnapshot;
  pdfUrl: string | null;       // always null in Phase 5; reserved for blob-cache later
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  amountCents: number;
  currency: Currency;
  method: InvoicePaymentMethod;
  providerRef: string | null;
  paidAt: string;              // ISO
  note: string | null;
  createdAt: string;
}

/** Convenience: invoice + its payments + derived status, the shape
 *  the admin detail page and the PDF renderer both want. */
export interface InvoiceWithPayments {
  invoice: InvoiceRecord;
  payments: PaymentRecord[];
  status: PaymentStatus;
}
```

- [ ] **Step 2: Write the supplierSnapshot tests**

Create `tests/invoicing-supplierSnapshot.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import { buildSupplierSnapshot } from '@/domain/invoicing';
import { DEFAULT_ASSYMO_BRANDING, DEFAULT_ASSYMO_INVOICING } from '@/domain/tenant';

describe('buildSupplierSnapshot', () => {
  it('merges branding footer + invoicing into a flat snapshot', () => {
    const snap = buildSupplierSnapshot({
      displayName: 'Assymo',
      branding: DEFAULT_ASSYMO_BRANDING,
      invoicing: {
        ...DEFAULT_ASSYMO_INVOICING,
        bankIban: 'BE68 5390 0754 7034',
      },
    });
    expect(snap).toEqual({
      displayName: 'Assymo',
      address: DEFAULT_ASSYMO_BRANDING.footer.address,
      vatNumber: DEFAULT_ASSYMO_BRANDING.footer.vatNumber,
      contactEmail: DEFAULT_ASSYMO_BRANDING.footer.contactEmail,
      bankIban: 'BE68 5390 0754 7034',
      bankBic: null,
      paymentTermDays: 30,
    });
  });
  it('is a pure deep-clone (no shared references with inputs)', () => {
    const branding = { ...DEFAULT_ASSYMO_BRANDING };
    const snap = buildSupplierSnapshot({
      displayName: 'Partner',
      branding,
      invoicing: { ...DEFAULT_ASSYMO_INVOICING, bankIban: 'X' },
    });
    expect(snap.address).toBe(branding.footer.address);
    // Mutating the source after snapshotting must not affect the snapshot.
    branding.footer = { ...branding.footer, address: 'MUTATED' };
    expect(snap.address).not.toBe('MUTATED');
  });
});
```

- [ ] **Step 3: Implement `supplierSnapshot.ts`**

Create `src/domain/invoicing/supplierSnapshot.ts`:

```ts
import type { Branding } from '@/domain/tenant';
import type { TenantInvoicing } from '@/domain/tenant';
import type { InvoiceSupplierSnapshot } from './types';

interface Input {
  displayName: string;
  branding: Branding;
  invoicing: TenantInvoicing;
}

/** Freeze the supplier-side invoice fields into a self-contained snapshot.
 *  Safe to store as jsonb and re-render years later. */
export function buildSupplierSnapshot(input: Input): InvoiceSupplierSnapshot {
  return {
    displayName: input.displayName,
    address: input.branding.footer.address,
    vatNumber: input.branding.footer.vatNumber,
    contactEmail: input.branding.footer.contactEmail,
    bankIban: input.invoicing.bankIban,
    bankBic: input.invoicing.bankBic,
    paymentTermDays: input.invoicing.paymentTermDays,
  };
}
```

- [ ] **Step 4: Write the barrel**

Create `src/domain/invoicing/index.ts`:

```ts
export * from './types';
export * from './numbering';
export * from './vat';
export * from './paymentStatus';
export * from './supplierSnapshot';
```

- [ ] **Step 5: Run full sweep + typecheck**

```bash
pnpm test
pnpm exec tsc --noEmit
```

Expected: green. Total test count ~225 + 4 (numbering: 4) + 7 (vat: 7) + 6 (paymentStatus: 6) + 2 (supplierSnapshot: 2) = ~244.

- [ ] **Step 6: Commit the whole Wave-1 batch (Tasks 2–5)**

```bash
git add src/domain/invoicing tests/invoicing-*.test.ts
git commit -m "feat(domain/invoicing): add numbering, VAT math, payment-status derivation, supplier snapshot"
```

### Task 6: `validateIssueInvoiceInput` + `validatePaymentInput`

**Files:**
- Create: `src/domain/invoicing/validators.ts`
- Create: `tests/invoicing-validators.test.ts`
- Modify: `src/domain/invoicing/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/invoicing-validators.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import {
  validateIssueInvoiceInput,
  validatePaymentInput,
} from '@/domain/invoicing';

describe('validateIssueInvoiceInput', () => {
  const goodBody = {
    customerName: 'Klant NV',
    customerAddress: 'Straat 1\n9000 Gent',
    issuedAt: '2026-04-21',
    dueAt: '2026-05-21',
    vatRate: 0.21,
  };

  it('accepts a complete valid body', () => {
    const { value, errors } = validateIssueInvoiceInput(goodBody);
    expect(errors).toEqual([]);
    expect(value).toEqual(goodBody);
  });
  it('rejects a non-object body', () => {
    expect(validateIssueInvoiceInput(null).errors).toContain('body');
  });
  it('rejects missing required fields', () => {
    const { errors } = validateIssueInvoiceInput({});
    for (const k of ['customerName', 'customerAddress', 'issuedAt', 'dueAt', 'vatRate']) {
      expect(errors).toContain(k);
    }
  });
  it('rejects an empty customerAddress', () => {
    expect(validateIssueInvoiceInput({ ...goodBody, customerAddress: '' }).errors)
      .toContain('customerAddress');
  });
  it('rejects a dueAt that is before issuedAt', () => {
    expect(validateIssueInvoiceInput({ ...goodBody, dueAt: '2026-04-01' }).errors)
      .toContain('dueAt');
  });
  it('rejects malformed ISO dates', () => {
    expect(validateIssueInvoiceInput({ ...goodBody, issuedAt: 'not-a-date' }).errors)
      .toContain('issuedAt');
  });
  it('rejects vatRate outside [0, 1]', () => {
    expect(validateIssueInvoiceInput({ ...goodBody, vatRate: 1.1 }).errors)
      .toContain('vatRate');
  });
});

describe('validatePaymentInput', () => {
  const good = {
    amountCents: 10000,
    method: 'manual' as const,
    paidAt: '2026-04-21',
  };
  it('accepts a minimal valid body', () => {
    const { value, errors } = validatePaymentInput(good);
    expect(errors).toEqual([]);
    expect(value).toEqual({ ...good, providerRef: null, note: null });
  });
  it('accepts optional providerRef + note', () => {
    const { value, errors } = validatePaymentInput({
      ...good,
      providerRef: 'BANK-123',
      note: 'Overschrijving ING',
    });
    expect(errors).toEqual([]);
    expect(value?.providerRef).toBe('BANK-123');
    expect(value?.note).toBe('Overschrijving ING');
  });
  it('rejects non-positive amountCents', () => {
    expect(validatePaymentInput({ ...good, amountCents: 0 }).errors).toContain('amountCents');
    expect(validatePaymentInput({ ...good, amountCents: -1 }).errors).toContain('amountCents');
    expect(validatePaymentInput({ ...good, amountCents: 1.5 }).errors).toContain('amountCents');
  });
  it('rejects non-allowed method', () => {
    expect(validatePaymentInput({ ...good, method: 'cash' as never }).errors).toContain('method');
  });
  it('only allows `manual` in Phase 5 (Mollie/Stripe land with Phase 6)', () => {
    expect(validatePaymentInput({ ...good, method: 'mollie' as never }).errors).toContain('method');
  });
  it('rejects malformed paidAt', () => {
    expect(validatePaymentInput({ ...good, paidAt: '2026-99-99' }).errors).toContain('paidAt');
  });
});
```

- [ ] **Step 2: Implement**

Create `src/domain/invoicing/validators.ts`:

```ts
export interface IssueInvoiceInput {
  customerName: string;
  customerAddress: string;
  issuedAt: string; // ISO date (YYYY-MM-DD)
  dueAt: string;    // ISO date
  vatRate: number;
}

export interface PaymentInput {
  amountCents: number;
  method: 'manual';
  paidAt: string;
  providerRef: string | null;
  note: string | null;
}

interface Validated<T> {
  value: T | null;
  errors: string[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isIsoDateString(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(s)) return false;
  const t = Date.parse(s);
  return Number.isFinite(t);
}

export function validateIssueInvoiceInput(input: unknown): Validated<IssueInvoiceInput> {
  if (!isObject(input)) return { value: null, errors: ['body'] };
  const errors: string[] = [];

  const customerName =
    typeof input.customerName === 'string' && input.customerName.trim().length > 0
      ? input.customerName
      : (errors.push('customerName'), '');
  const customerAddress =
    typeof input.customerAddress === 'string' && input.customerAddress.trim().length > 0
      ? input.customerAddress
      : (errors.push('customerAddress'), '');
  const issuedAtOk = isIsoDateString(input.issuedAt);
  const dueAtOk = isIsoDateString(input.dueAt);
  if (!issuedAtOk) errors.push('issuedAt');
  if (!dueAtOk) errors.push('dueAt');
  if (issuedAtOk && dueAtOk && Date.parse(input.dueAt as string) < Date.parse(input.issuedAt as string)) {
    errors.push('dueAt');
  }
  const vatRateOk =
    typeof input.vatRate === 'number' &&
    Number.isFinite(input.vatRate) &&
    input.vatRate >= 0 &&
    input.vatRate <= 1;
  if (!vatRateOk) errors.push('vatRate');

  if (errors.length > 0) return { value: null, errors };

  return {
    value: {
      customerName,
      customerAddress,
      issuedAt: input.issuedAt as string,
      dueAt: input.dueAt as string,
      vatRate: input.vatRate as number,
    },
    errors: [],
  };
}

export function validatePaymentInput(input: unknown): Validated<PaymentInput> {
  if (!isObject(input)) return { value: null, errors: ['body'] };
  const errors: string[] = [];

  const amountOk =
    typeof input.amountCents === 'number' &&
    Number.isInteger(input.amountCents) &&
    input.amountCents > 0;
  if (!amountOk) errors.push('amountCents');

  const methodOk = input.method === 'manual';
  if (!methodOk) errors.push('method');

  const paidAtOk = isIsoDateString(input.paidAt);
  if (!paidAtOk) errors.push('paidAt');

  const providerRef =
    'providerRef' in input
      ? (typeof input.providerRef === 'string' ? input.providerRef : null)
      : null;
  const note =
    'note' in input
      ? (typeof input.note === 'string' ? input.note : null)
      : null;

  if (errors.length > 0) return { value: null, errors };

  return {
    value: {
      amountCents: input.amountCents as number,
      method: 'manual',
      paidAt: input.paidAt as string,
      providerRef,
      note,
    },
    errors: [],
  };
}
```

- [ ] **Step 3: Re-export from the barrel**

Open `src/domain/invoicing/index.ts`. Append at the end:

```ts
export * from './validators';
```

- [ ] **Step 4: Run the tests + typecheck**

```bash
pnpm test -- tests/invoicing-validators.test.ts
pnpm exec tsc --noEmit
pnpm test
```

Expected: green. Tally ~244 + 14 = ~258.

- [ ] **Step 5: Commit**

```bash
git add src/domain/invoicing/validators.ts src/domain/invoicing/index.ts tests/invoicing-validators.test.ts
git commit -m "feat(domain/invoicing): add validateIssueInvoiceInput + validatePaymentInput"
```

### Task 7: Extend `TenantContext` with `invoicing`

**Files:**
- Modify: `src/domain/tenant/types.ts`

- [ ] **Step 1: Add the field**

Open `src/domain/tenant/types.ts`. Replace with:

```ts
import type { PriceBook } from '@/domain/pricing';
import type { Branding } from './branding';
import type { EnabledMaterials } from './enabledMaterials';
import type { TenantInvoicing } from './invoicing';

export type TenantId = string;

export type Locale = 'nl' | 'fr' | 'en';
export type Currency = 'EUR';

export interface TenantContext {
  id: TenantId;
  displayName: string;
  locale: Locale;
  currency: Currency;
  priceBook: PriceBook;
  branding: Branding;
  enabledMaterials: EnabledMaterials;
  /** Per-tenant invoicing defaults: VAT rate, payment-term days, bank
   *  account. Edited through the admin InvoicingSection; seeded on
   *  assymo with 21% / 30d and empty IBAN (admin MUST fill). */
  invoicing: TenantInvoicing;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`

Expected: one error at `src/app/layout.tsx:30` (same load-bearing error pattern as Phase 4.5 Wave 1) where the `TenantRow` is passed as `TenantContext`. The next wave's schema migration clears it. Don't fix consumers now.

- [ ] **Step 3: Don't commit yet** — paired commit in Wave 2's T8 (same pattern as Phase 4.5's T5 + T6 pairing).

---

## Wave 2 — Schema + migration + seed

### Task 8: Add `tenants.invoicing` + `invoices` + `invoice_numbers` + `payments` tables

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/db/migrations/0007_*.sql` (name chosen by the generator)

- [ ] **Step 1: Extend the schema**

Open `src/db/schema.ts`. In the `tenants` table, AFTER the `enabledMaterials` column (line ~29) and BEFORE `createdAt`, add:

```ts
  /** Per-tenant invoicing defaults. See `@/domain/tenant` →
   *  `TenantInvoicing` + `validateInvoicingPatch`. NOT NULL; seeded
   *  with `DEFAULT_ASSYMO_INVOICING`. */
  invoicing: jsonb('invoicing').$type<TenantInvoicing>().notNull(),
```

Add the type import at the top of the file:

```ts
import type { Branding, Currency, Locale, TenantInvoicing } from '@/domain/tenant';
```

(Replace the existing single-line import to include `TenantInvoicing`.)

ALSO add the three new tables AFTER the `orders` table and its `OrderRow` exports. Use the following shapes (full table block):

```ts
import type {
  InvoicePaymentMethod,
  InvoiceSupplierSnapshot,
} from '@/domain/invoicing';

/** Per-tenant per-year invoice sequence counter. One row per tenant
 *  carrying the current tracked year and last-issued sequence. Atomic
 *  upsert on insert (see src/app/api/admin/orders/[id]/invoice/route.ts)
 *  handles first-invoice, same-year increment, and new-year reset. */
export const invoiceNumbers = pgTable('invoice_numbers', {
  tenantId: text('tenant_id')
    .primaryKey()
    .references(() => tenants.id, { onDelete: 'restrict' }),
  year: integer('year').notNull(),
  lastSeq: integer('last_seq').notNull(),
});

/** Issued invoices. 1:1 with an order (orderId UNIQUE).
 *  `supplierSnapshot` and the VAT fields are frozen at issue time and
 *  MUST NOT be mutated afterwards — invoices are legally immutable. */
export const invoices = pgTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .references(() => tenants.id, { onDelete: 'restrict' })
      .notNull(),
    orderId: text('order_id')
      .references(() => orders.id, { onDelete: 'restrict' })
      .notNull(),
    number: text('number').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    customerAddress: text('customer_address').notNull(),
    subtotalCents: integer('subtotal_cents').notNull(),
    vatRate: text('vat_rate').notNull(), // stored as decimal string — see helper below
    vatCents: integer('vat_cents').notNull(),
    totalCents: integer('total_cents').notNull(),
    currency: text('currency').$type<Currency>().notNull(),
    supplierSnapshot: jsonb('supplier_snapshot').$type<InvoiceSupplierSnapshot>().notNull(),
    pdfUrl: text('pdf_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('invoices_order_id_idx').on(t.orderId),
    uniqueIndex('invoices_tenant_number_idx').on(t.tenantId, t.number),
    index('invoices_tenant_id_idx').on(t.tenantId),
  ],
);

/** Payments recorded against an invoice. Sum(amountCents) derives the
 *  payment status (see `@/domain/invoicing` → derivePaymentStatus).
 *  `method` is currently limited to 'manual' at the API layer; the
 *  column+enum are wider so Phase 6 (Mollie / Stripe) lands migration-free. */
export const payments = pgTable(
  'payments',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id')
      .references(() => invoices.id, { onDelete: 'restrict' })
      .notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').$type<Currency>().notNull(),
    method: text('method').$type<InvoicePaymentMethod>().notNull(),
    providerRef: text('provider_ref'),
    paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('payments_invoice_id_idx').on(t.invoiceId)],
);

export type InvoiceRow = typeof invoices.$inferSelect;
export type NewInvoiceRow = typeof invoices.$inferInsert;
export type InvoiceNumberRow = typeof invoiceNumbers.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
export type NewPaymentRow = typeof payments.$inferInsert;
```

Note the `vatRate: text('vat_rate').notNull()` — stored as a decimal string (e.g. `"0.21"`) to preserve exact precision; the API / domain layer converts `string ↔ number` at the boundary.

- [ ] **Step 2: Generate migration**

Run: `pnpm db:generate`

Expected: creates `src/db/migrations/0007_*.sql` containing:
- `ALTER TABLE "tenants" ADD COLUMN "invoicing" jsonb NOT NULL;` — **this will FAIL on Neon because existing tenants (assymo) have no invoicing value**. Drizzle generator will warn. Investigate: either add a default on the column (no — we don't want a misleading default in the DB), OR run the migration as a two-step: (a) `ADD COLUMN "invoicing" jsonb` (nullable), (b) backfill via a separate SQL statement in the same migration file, (c) `ALTER TABLE ALTER COLUMN "invoicing" SET NOT NULL`.

**The generator will not backfill automatically.** If it emits a single `NOT NULL` ADD COLUMN, EDIT the generated SQL file to split into three statements as above, and seed the default inline:

```sql
ALTER TABLE "tenants" ADD COLUMN "invoicing" jsonb;--> statement-breakpoint
UPDATE "tenants" SET "invoicing" = '{"vatRate":0.21,"paymentTermDays":30,"bankIban":"","bankBic":null}'::jsonb WHERE "invoicing" IS NULL;--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "invoicing" SET NOT NULL;
```

This is one of the few cases where hand-editing the generated migration is the right call — Drizzle doesn't support backfills. Document the hand-edit in the commit message. Also expect `CREATE TABLE "invoice_numbers" (...)`, `CREATE TABLE "invoices" (...)`, `CREATE TABLE "payments" (...)`, plus the indexes/constraints. Review the output before applying.

- [ ] **Step 3: Apply the migration**

Run: `pnpm db:migrate`

Expected: all 4 DDL operations + the backfill succeed. Verify the `tenants` row for `assymo` now has `invoicing = {"vatRate":0.21,"paymentTermDays":30,"bankIban":"","bankBic":null}`.

- [ ] **Step 4: Typecheck + tests**

```bash
pnpm exec tsc --noEmit   # the layout.tsx error from Task 7 should now clear
pnpm test                # still ~258 green
```

- [ ] **Step 5: Commit the Wave-1 type change together with the schema change**

```bash
git add src/domain/tenant/types.ts src/db/schema.ts src/db/migrations/0007_*.sql
git commit -m "feat(invoicing): add tenants.invoicing + invoices/invoice_numbers/payments tables

Migration is hand-edited to backfill tenants.invoicing with the assymo
default before SET NOT NULL; Drizzle's generator can't produce backfills
automatically. Also extends TenantContext with the invoicing field."
```

### Task 9: Seed default invoicing on assymo

**Files:**
- Modify: `src/db/seed.ts`

- [ ] **Step 1: Add the default to the insert**

Open `src/db/seed.ts`. Extend the `.values({...})` block:

```ts
    .values({
      id: 'assymo',
      displayName: 'Assymo',
      locale: 'nl',
      currency: 'EUR',
      priceBook: DEFAULT_PRICE_BOOK,
      branding: DEFAULT_ASSYMO_BRANDING,
      invoicing: DEFAULT_ASSYMO_INVOICING,
      // enabledMaterials omitted -> NULL (unrestricted). The assymo tenant
      // is the catalog owner and always sees every registered material.
    })
```

Add the import:

```ts
import { DEFAULT_ASSYMO_INVOICING } from '../domain/tenant/invoicing.ts';
```

Extend the `onConflictDoUpdate` `set` clause to include invoicing:

```ts
    set: {
      displayName: sql`excluded.display_name`,
      locale: sql`excluded.locale`,
      currency: sql`excluded.currency`,
      priceBook: sql`excluded.price_book`,
      branding: sql`excluded.branding`,
      invoicing: sql`excluded.invoicing`,
      updatedAt: sql`now()`,
    },
```

Rationale: re-seeding should overwrite invoicing with the seed value (parity with branding/priceBook) because the seed represents intent, but the admin editor will overwrite it immediately afterwards if the admin has already set IBAN.

- [ ] **Step 2: Re-run + verify**

```bash
pnpm db:seed
```

Expected: `Seeded tenant: assymo (3 hosts)`. Check the row in Neon Studio: `invoicing.vatRate === 0.21`, `invoicing.bankIban === ''`.

- [ ] **Step 3: Commit**

```bash
git add src/db/seed.ts
git commit -m "feat(db/seed): seed DEFAULT_ASSYMO_INVOICING on assymo tenant"
```

---

## Wave 3 — Admin invoicing API

### Task 10: `PATCH /api/admin/tenants/[id]/invoicing`

**Files:**
- Create: `src/app/api/admin/tenants/[id]/invoicing/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/admin/tenants/[id]/invoicing/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { validateInvoicingPatch, type TenantInvoicing } from '@/domain/tenant';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

export const PATCH = withSession(async (session, req, ctx: { params: Promise<{ id: string }> }) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const { id } = await ctx.params;
  requireTenantScope(session, id);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { invoicing, errors } = validateInvoicingPatch(body);
  if (errors.length > 0) {
    return NextResponse.json({ error: 'validation_failed', details: errors }, { status: 422 });
  }
  if (Object.keys(invoicing).length === 0) {
    return NextResponse.json({ error: 'empty_patch' }, { status: 400 });
  }

  const [current] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!current) {
    return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });
  }

  const merged: TenantInvoicing = {
    ...current.invoicing,
    ...invoicing,
  };

  const [updated] = await db
    .update(tenants)
    .set({ invoicing: merged, updatedAt: sql`now()` })
    .where(eq(tenants.id, id))
    .returning();

  return NextResponse.json({ tenant: updated });
});
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm exec tsc --noEmit
git add src/app/api/admin/tenants/\[id\]/invoicing/route.ts
git commit -m "feat(api/admin): add PATCH /api/admin/tenants/[id]/invoicing"
```

### Task 11: `POST /api/admin/orders/[id]/invoice`

**Files:**
- Create: `src/app/api/admin/orders/[id]/invoice/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/admin/orders/[id]/invoice/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '@/db/client';
import { invoices, invoiceNumbers, orders, tenants } from '@/db/schema';
import {
  buildSupplierSnapshot,
  computeInvoiceAmounts,
  formatInvoiceNumber,
  validateIssueInvoiceInput,
} from '@/domain/invoicing';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

export const POST = withSession(async (session, req, ctx: { params: Promise<{ id: string }> }) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const { id: orderId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const { value, errors } = validateIssueInvoiceInput(body);
  if (!value) {
    return NextResponse.json({ error: 'validation_failed', details: errors }, { status: 422 });
  }

  // Resolve order + tenant scope
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
  requireTenantScope(session, order.tenantId);

  if (order.status !== 'accepted') {
    return NextResponse.json({ error: 'order_not_invoiceable', details: { status: order.status } }, { status: 422 });
  }

  // 1:1 constraint: one invoice per order
  const [existing] = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.orderId, orderId)).limit(1);
  if (existing) {
    return NextResponse.json({ error: 'already_invoiced', details: { invoiceId: existing.id } }, { status: 409 });
  }

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, order.tenantId)).limit(1);
  if (!tenant) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });
  if (!tenant.invoicing.bankIban) {
    return NextResponse.json({ error: 'supplier_incomplete', details: ['bankIban'] }, { status: 422 });
  }

  // Compute amounts
  const amounts = computeInvoiceAmounts({
    subtotalCents: order.totalCents,
    vatRate: value.vatRate,
  });

  // Atomic sequence allocation
  const year = new Date(value.issuedAt).getUTCFullYear();
  const [numberRow] = await db.execute(sql`
    INSERT INTO "invoice_numbers" ("tenant_id", "year", "last_seq")
    VALUES (${order.tenantId}, ${year}, 1)
    ON CONFLICT ("tenant_id") DO UPDATE SET
      "year" = ${year},
      "last_seq" = CASE WHEN "invoice_numbers"."year" = ${year}
                        THEN "invoice_numbers"."last_seq" + 1
                        ELSE 1 END
    RETURNING "year", "last_seq";
  `) as unknown as Array<{ year: number; last_seq: number }>;
  const number = formatInvoiceNumber(numberRow.year, numberRow.last_seq);

  // Freeze supplier snapshot
  const supplierSnapshot = buildSupplierSnapshot({
    displayName: tenant.displayName,
    branding: tenant.branding,
    invoicing: tenant.invoicing,
  });

  // Insert the invoice
  const [invoice] = await db
    .insert(invoices)
    .values({
      id: randomUUID(),
      tenantId: order.tenantId,
      orderId: order.id,
      number,
      issuedAt: new Date(value.issuedAt),
      dueAt: new Date(value.dueAt),
      customerAddress: value.customerAddress,
      subtotalCents: amounts.subtotalCents,
      vatRate: String(value.vatRate),
      vatCents: amounts.vatCents,
      totalCents: amounts.totalCents,
      currency: order.currency,
      supplierSnapshot,
      pdfUrl: null,
    })
    .returning();

  return NextResponse.json({ invoice }, { status: 201 });
});
```

Notes on the raw-SQL `db.execute` call: Drizzle's neon-http driver returns `Array<Record<string, unknown>>` from `db.execute`; the cast is pragmatic. If the typing surface is too rough, extract a `allocateInvoiceSeq(tenantId, year)` helper in `src/db/invoiceNumbers.ts` later — but for Phase 5 the inline call is small enough.

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm exec tsc --noEmit
git add src/app/api/admin/orders/\[id\]/invoice/route.ts
git commit -m "feat(api/admin): add POST /api/admin/orders/[id]/invoice (issue)"
```

### Task 12: `GET /api/admin/invoices` + `GET /api/admin/invoices/[id]`

**Files:**
- Create: `src/app/api/admin/invoices/route.ts`
- Create: `src/app/api/admin/invoices/[id]/route.ts`

- [ ] **Step 1: List endpoint**

Create `src/app/api/admin/invoices/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { invoices } from '@/db/schema';
import { requireBusiness } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

export const GET = withSession(async (session) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const role = session.user.role as 'super_admin' | 'tenant_admin';
  const tenantId = session.user.tenantId as string | null;

  const rows = role === 'super_admin'
    ? await db.select().from(invoices).orderBy(desc(invoices.createdAt))
    : await db.select().from(invoices).where(eq(invoices.tenantId, tenantId!)).orderBy(desc(invoices.createdAt));

  return NextResponse.json({ invoices: rows });
});
```

- [ ] **Step 2: Detail endpoint (with payments)**

Create `src/app/api/admin/invoices/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { invoices, payments } from '@/db/schema';
import { derivePaymentStatus } from '@/domain/invoicing';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

export const GET = withSession(async (session, _req, ctx: { params: Promise<{ id: string }> }) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const { id } = await ctx.params;

  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!invoice) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  requireTenantScope(session, invoice.tenantId);

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, id))
    .orderBy(asc(payments.paidAt));

  const status = derivePaymentStatus(invoice.totalCents, paymentRows);
  return NextResponse.json({ invoice, payments: paymentRows, status });
});
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm exec tsc --noEmit
git add src/app/api/admin/invoices/route.ts src/app/api/admin/invoices/\[id\]/route.ts
git commit -m "feat(api/admin): add GET /api/admin/invoices (list) + detail with payments"
```

### Task 13: `POST /api/admin/invoices/[id]/payments`

**Files:**
- Create: `src/app/api/admin/invoices/[id]/payments/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/admin/invoices/[id]/payments/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '@/db/client';
import { invoices, payments } from '@/db/schema';
import { validatePaymentInput } from '@/domain/invoicing';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

export const POST = withSession(async (session, req, ctx: { params: Promise<{ id: string }> }) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const { id: invoiceId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const { value, errors } = validatePaymentInput(body);
  if (!value) {
    return NextResponse.json({ error: 'validation_failed', details: errors }, { status: 422 });
  }

  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!invoice) return NextResponse.json({ error: 'invoice_not_found' }, { status: 404 });
  requireTenantScope(session, invoice.tenantId);

  const [payment] = await db
    .insert(payments)
    .values({
      id: randomUUID(),
      invoiceId,
      amountCents: value.amountCents,
      currency: invoice.currency,
      method: value.method,
      providerRef: value.providerRef,
      paidAt: new Date(value.paidAt),
      note: value.note,
    })
    .returning();

  return NextResponse.json({ payment }, { status: 201 });
});
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm exec tsc --noEmit
git add src/app/api/admin/invoices/\[id\]/payments/route.ts
git commit -m "feat(api/admin): add POST /api/admin/invoices/[id]/payments (manual entry)"
```

---

## Wave 4 — PDF rendering

### Task 14: Install `@react-pdf/renderer` + write `InvoicePdf` component

**Files:**
- Modify: `package.json`
- Create: `src/components/invoice/InvoicePdf.tsx`

- [ ] **Step 1: Install**

```bash
pnpm add @react-pdf/renderer
```

This adds the dependency. `@react-pdf/renderer` is a React library with its own renderer (not react-dom); it ships pre-built fonts and PDF primitives.

- [ ] **Step 2: Write the component**

Create `src/components/invoice/InvoicePdf.tsx`:

```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { InvoiceRecord, PaymentStatus } from '@/domain/invoicing';
import type { OrderRecord } from '@/domain/orders';
import { t } from '@/lib/i18n';

interface Props {
  invoice: InvoiceRecord;
  order: OrderRecord;
  status: PaymentStatus;
}

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  supplierBlock: { width: '50%' },
  metaBlock: { width: '50%', textAlign: 'right' },
  h1: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  customerBlock: { marginBottom: 24 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  muted: { color: '#555' },
  line: { marginBottom: 2 },
  table: { marginTop: 12, marginBottom: 12 },
  tableRow: { flexDirection: 'row', borderBottom: '1 solid #ddd', paddingVertical: 4 },
  tableHeader: { flexDirection: 'row', borderBottom: '1 solid #000', paddingVertical: 4, fontWeight: 'bold' },
  labelCol: { flex: 3 },
  amountCol: { flex: 1, textAlign: 'right' },
  totals: { alignSelf: 'flex-end', width: '40%', marginTop: 8 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalsGrand: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4, borderTop: '1 solid #000', fontWeight: 'bold' },
  footer: { position: 'absolute', bottom: 32, left: 48, right: 48, fontSize: 9, color: '#666', textAlign: 'center' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, fontSize: 9, borderRadius: 4, alignSelf: 'flex-end' },
});

const fmtCents = (cents: number, currency: string) =>
  (cents / 100).toLocaleString('nl-BE', { style: 'currency', currency, minimumFractionDigits: 2 });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('nl-BE');

export function InvoicePdf({ invoice, order, status }: Props) {
  const s = invoice.supplierSnapshot;
  const lineItems = order.quoteSnapshot.items.flatMap((item) => item.lineItems);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.supplierBlock}>
            <Text style={styles.h1}>{s.displayName}</Text>
            <Text style={styles.line}>{s.address}</Text>
            {s.vatNumber && <Text style={styles.line}>BTW: {s.vatNumber}</Text>}
            <Text style={styles.line}>{s.contactEmail}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.h1}>{t('invoice.pdf.title')}</Text>
            <Text style={styles.line}>{t('invoice.pdf.number')}: {invoice.number}</Text>
            <Text style={styles.line}>{t('invoice.pdf.issuedAt')}: {fmtDate(invoice.issuedAt)}</Text>
            <Text style={styles.line}>{t('invoice.pdf.dueAt')}: {fmtDate(invoice.dueAt)}</Text>
            <Text style={{ ...styles.statusPill, color: statusColor(status) }}>
              {t(`invoice.pdf.status.${status}`)}
            </Text>
          </View>
        </View>

        <View style={styles.customerBlock}>
          <Text style={styles.sectionTitle}>{t('invoice.pdf.customer')}</Text>
          <Text style={styles.line}>{order.contactName}</Text>
          {invoice.customerAddress.split('\n').map((line, i) => (
            <Text key={i} style={styles.line}>{line}</Text>
          ))}
          <Text style={{ ...styles.line, ...styles.muted }}>{order.contactEmail}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.labelCol}>{t('invoice.pdf.lineItems.description')}</Text>
            <Text style={styles.amountCol}>{t('invoice.pdf.lineItems.amount')}</Text>
          </View>
          {lineItems.map((li, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.labelCol}>{t(li.labelKey, li.labelParams)}</Text>
              <Text style={styles.amountCol}>{fmtCents(Math.round(li.amount * 100), invoice.currency)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text>{t('invoice.pdf.subtotal')}</Text>
            <Text>{fmtCents(invoice.subtotalCents, invoice.currency)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>{t('invoice.pdf.vat', { rate: (Number(invoice.vatRate) * 100).toFixed(0) })}</Text>
            <Text>{fmtCents(invoice.vatCents, invoice.currency)}</Text>
          </View>
          <View style={styles.totalsGrand}>
            <Text>{t('invoice.pdf.grandTotal')}</Text>
            <Text>{fmtCents(invoice.totalCents, invoice.currency)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          {t('invoice.pdf.paymentInstructions', {
            iban: s.bankIban,
            bic: s.bankBic ?? '-',
            reference: invoice.number,
          })}
        </Text>
      </Page>
    </Document>
  );
}

function statusColor(status: PaymentStatus): string {
  switch (status) {
    case 'paid': return '#16a34a';
    case 'partial': return '#ca8a04';
    case 'overpaid': return '#7c3aed';
    case 'unpaid': return '#dc2626';
  }
}
```

Note: `LineItem.amount` is in euros (see `src/domain/pricing/types.ts`), hence the `Math.round(li.amount * 100)` conversion. The quote snapshot stores subtotal/total in cents but line items in euros; confirm before implementing by reading the `LineItem` type.

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/invoice/InvoicePdf.tsx
git commit -m "feat(invoice): add @react-pdf/renderer + InvoicePdf component"
```

### Task 15: `GET /api/invoices/[id]/pdf`

**Files:**
- Create: `src/lib/renderInvoicePdf.ts`
- Create: `src/app/api/invoices/[id]/pdf/route.ts`

- [ ] **Step 1: Write the renderer helper**

Create `src/lib/renderInvoicePdf.ts`:

```ts
import { renderToStream } from '@react-pdf/renderer';
import { InvoicePdf } from '@/components/invoice/InvoicePdf';
import type { InvoiceRecord, PaymentStatus } from '@/domain/invoicing';
import type { OrderRecord } from '@/domain/orders';

/** Render an invoice as a Node Readable stream of application/pdf bytes.
 *  Callers are responsible for piping the stream into the Response body. */
export async function renderInvoicePdfStream(args: {
  invoice: InvoiceRecord;
  order: OrderRecord;
  status: PaymentStatus;
}): Promise<NodeJS.ReadableStream> {
  return renderToStream(<InvoicePdf {...args} />);
}
```

- [ ] **Step 2: Write the route**

Create `src/app/api/invoices/[id]/pdf/route.ts`:

```ts
import { asc, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { invoices, orders, payments } from '@/db/schema';
import { derivePaymentStatus, type InvoiceRecord, type PaymentStatus } from '@/domain/invoicing';
import type { OrderRecord } from '@/domain/orders';
import type { Role } from '@/lib/auth-guards';
import { renderInvoicePdfStream } from '@/lib/renderInvoicePdf';

/** Stream the invoice PDF. Auth branches:
 *  - business tenant-scoped (super_admin any, tenant_admin own)
 *  - client own-order only
 *  - 404 on failure (no discrimination between "no invoice" / "not yours"). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response(null, { status: 401 });

  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!invoice) return new Response(null, { status: 404 });

  const [order] = await db.select().from(orders).where(eq(orders.id, invoice.orderId)).limit(1);
  if (!order) return new Response(null, { status: 404 });

  const userType = session.user.userType as 'business' | 'client' | null;
  if (userType === 'business') {
    const role = session.user.role as Role;
    const sessionTenantId = session.user.tenantId as string | null;
    if (role !== 'super_admin' && sessionTenantId !== invoice.tenantId) {
      return new Response(null, { status: 404 });
    }
  } else if (userType === 'client') {
    if (order.customerId !== session.user.id) {
      return new Response(null, { status: 404 });
    }
  } else {
    return new Response(null, { status: 403 });
  }

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, id))
    .orderBy(asc(payments.paidAt));
  const status: PaymentStatus = derivePaymentStatus(invoice.totalCents, paymentRows);

  const stream = await renderInvoicePdfStream({
    invoice: invoice as unknown as InvoiceRecord,   // DB Date → ISO conversion done by the PDF component's date helpers
    order: order as unknown as OrderRecord,
    status,
  });

  return new Response(stream as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.number}.pdf"`,
    },
  });
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm exec tsc --noEmit
git add src/lib/renderInvoicePdf.ts src/app/api/invoices/\[id\]/pdf/route.ts
git commit -m "feat(api): add GET /api/invoices/[id]/pdf (streams react-pdf output)"
```

---

## Wave 5 — Admin UI

### Task 16: i18n block for admin invoicing + PDF labels

**Files:**
- Modify: `src/lib/i18n.ts`
- Modify: `tests/i18n.test.ts`

- [ ] **Step 1: Append i18n keys**

Open `src/lib/i18n.ts`. After the last existing key (`'admin.registry.noTenant': …` or `'admin.registry.sharedSlugHint': …` — use the last line before the closing `};`), insert the block:

```ts
  // Admin — sidebar + invoices
  'admin.nav.invoices': 'Facturen',
  // Admin — tenant section heading
  'admin.tenant.section.invoicing': 'Facturatie',
  // Admin — invoicing form (tenant defaults)
  'admin.invoicing.form.vatRate': 'BTW-tarief',
  'admin.invoicing.form.paymentTermDays': 'Betaaltermijn (dagen)',
  'admin.invoicing.form.bankIban': 'IBAN',
  'admin.invoicing.form.bankBic': 'BIC',
  'admin.invoicing.form.save': 'Opslaan',
  // Admin — invoices list
  'admin.invoices.title': 'Facturen',
  'admin.invoices.empty': 'Nog geen facturen.',
  'admin.invoices.col.number': 'Nummer',
  'admin.invoices.col.customer': 'Klant',
  'admin.invoices.col.issuedAt': 'Opgemaakt',
  'admin.invoices.col.dueAt': 'Vervaldatum',
  'admin.invoices.col.total': 'Totaal',
  'admin.invoices.col.status': 'Status',
  // Admin — invoice detail
  'admin.invoice.detail.supplier': 'Leverancier',
  'admin.invoice.detail.customer': 'Klant',
  'admin.invoice.detail.dates': 'Datums',
  'admin.invoice.detail.amounts': 'Bedragen',
  'admin.invoice.detail.payments': 'Betalingen',
  'admin.invoice.detail.noPayments': 'Nog geen betalingen.',
  'admin.invoice.detail.downloadPdf': 'PDF downloaden',
  // Admin — issue-invoice dialog
  'admin.issueInvoice.trigger': 'Factuur opmaken',
  'admin.issueInvoice.title': 'Factuur opmaken',
  'admin.issueInvoice.customerName': 'Naam klant',
  'admin.issueInvoice.customerAddress': 'Adres klant',
  'admin.issueInvoice.issuedAt': 'Factuurdatum',
  'admin.issueInvoice.dueAt': 'Vervaldatum',
  'admin.issueInvoice.vatRate': 'BTW-tarief',
  'admin.issueInvoice.submit': 'Opmaken',
  'admin.issueInvoice.error.supplier_incomplete': 'Vul eerst je leveranciersgegevens in (IBAN) bij Tenant instellingen.',
  'admin.issueInvoice.error.order_not_invoiceable': 'De bestelling moet eerst aanvaard zijn (status: aanvaard).',
  'admin.issueInvoice.error.already_invoiced': 'Er bestaat al een factuur voor deze bestelling.',
  // Admin — record-payment dialog
  'admin.recordPayment.trigger': 'Betaling registreren',
  'admin.recordPayment.title': 'Betaling registreren',
  'admin.recordPayment.amount': 'Bedrag (€)',
  'admin.recordPayment.paidAt': 'Betaald op',
  'admin.recordPayment.providerRef': 'Bankreferentie (optioneel)',
  'admin.recordPayment.note': 'Nota (optioneel)',
  'admin.recordPayment.submit': 'Registreren',
  // Admin — payment status
  'payment.status.unpaid': 'Onbetaald',
  'payment.status.partial': 'Deels betaald',
  'payment.status.paid': 'Betaald',
  'payment.status.overpaid': 'Teveel betaald',
  // Shop — invoice
  'shop.invoice.title': 'Factuur {number}',
  'shop.invoice.backLink': '← Terug naar bestelling',
  'shop.invoice.downloadPdf': 'PDF downloaden',
  'shop.invoice.section.supplier': 'Leverancier',
  'shop.invoice.section.amounts': 'Bedragen',
  'shop.invoice.section.payments': 'Betalingen',
  'shop.order.invoice.title': 'Factuur',
  'shop.order.invoice.none': 'Nog geen factuur opgemaakt.',
  // PDF labels
  'invoice.pdf.title': 'FACTUUR',
  'invoice.pdf.number': 'Factuurnummer',
  'invoice.pdf.issuedAt': 'Factuurdatum',
  'invoice.pdf.dueAt': 'Vervaldatum',
  'invoice.pdf.customer': 'Aan',
  'invoice.pdf.lineItems.description': 'Omschrijving',
  'invoice.pdf.lineItems.amount': 'Bedrag',
  'invoice.pdf.subtotal': 'Subtotaal',
  'invoice.pdf.vat': 'BTW ({rate}%)',
  'invoice.pdf.grandTotal': 'Totaal incl. BTW',
  'invoice.pdf.paymentInstructions': 'Gelieve te betalen op IBAN {iban} (BIC {bic}) onder vermelding van {reference}.',
  'invoice.pdf.status.unpaid': 'Onbetaald',
  'invoice.pdf.status.partial': 'Deels betaald',
  'invoice.pdf.status.paid': 'Betaald',
  'invoice.pdf.status.overpaid': 'Teveel betaald',
```

- [ ] **Step 2: Add an i18n smoke test case**

Append inside `tests/i18n.test.ts`'s existing `describe('t()', …)` block (before the closing `});`):

```ts
  it('exposes admin.invoices + invoice.pdf keys used by Phase 5', () => {
    expect(t('admin.nav.invoices')).toBe('Facturen');
    expect(t('admin.invoicing.form.bankIban')).toBe('IBAN');
    expect(t('invoice.pdf.vat', { rate: '21' })).toContain('21%');
    expect(t('payment.status.paid')).toBe('Betaald');
  });
```

- [ ] **Step 3: Run + commit**

```bash
pnpm test -- tests/i18n.test.ts
git add src/lib/i18n.ts tests/i18n.test.ts
git commit -m "feat(i18n): add admin.invoices + shop.invoice + invoice.pdf keys for Phase 5"
```

### Task 17: `InvoicingSection` + mount on tenant detail page

**Files:**
- Create: `src/components/admin/InvoicingSection.tsx`
- Modify: `src/app/admin/(authed)/tenants/[id]/page.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/admin/InvoicingSection.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TenantInvoicing } from '@/domain/tenant';
import { t } from '@/lib/i18n';

interface Props { tenantId: string; initialInvoicing: TenantInvoicing }

export function InvoicingSection({ tenantId, initialInvoicing }: Props) {
  const [v, setV] = useState(initialInvoicing);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function set<K extends keyof TenantInvoicing>(k: K, val: TenantInvoicing[K]) {
    setV((prev) => ({ ...prev, [k]: val }));
  }

  async function save() {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/admin/tenants/${tenantId}/invoicing`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(v),
    });
    setBusy(false);
    if (res.ok) setMsg(t('admin.tenant.saved'));
    else {
      const data = await res.json().catch(() => ({}));
      setMsg(t('admin.tenant.saveError', { error: data.error ?? res.status }));
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>{t('admin.tenant.section.invoicing')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('admin.invoicing.form.vatRate')}>
            <Input
              type="number"
              step="0.01"
              min={0}
              max={1}
              value={v.vatRate}
              onChange={(e) => set('vatRate', Number(e.target.value))}
            />
          </Field>
          <Field label={t('admin.invoicing.form.paymentTermDays')}>
            <Input
              type="number"
              step={1}
              min={1}
              value={v.paymentTermDays}
              onChange={(e) => set('paymentTermDays', Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label={t('admin.invoicing.form.bankIban')}>
          <Input value={v.bankIban} onChange={(e) => set('bankIban', e.target.value)} />
        </Field>
        <Field label={t('admin.invoicing.form.bankBic')}>
          <Input
            value={v.bankBic ?? ''}
            onChange={(e) => set('bankBic', e.target.value === '' ? null : e.target.value)}
          />
        </Field>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={busy}>{t('admin.invoicing.form.save')}</Button>
          {msg && <span className="text-sm text-neutral-600">{msg}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Mount on the tenant detail page**

Open `src/app/admin/(authed)/tenants/[id]/page.tsx`. Add an import:

```ts
import { InvoicingSection } from '@/components/admin/InvoicingSection';
```

In the JSX, right AFTER `<MaterialsSection tenantId={tenant.id} initialEnabledMaterials={tenant.enabledMaterials} />` and before the closing `</div>`, add:

```tsx
      <InvoicingSection tenantId={tenant.id} initialInvoicing={tenant.invoicing} />
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm exec tsc --noEmit
git add src/components/admin/InvoicingSection.tsx src/app/admin/\(authed\)/tenants/\[id\]/page.tsx
git commit -m "feat(admin): add InvoicingSection + mount on /admin/tenants/[id]"
```

### Task 18: `/admin/invoices` list page

**Files:**
- Create: `src/components/admin/InvoicesTable.tsx`
- Create: `src/app/admin/(authed)/invoices/page.tsx`

- [ ] **Step 1: Write the table**

Create `src/components/admin/InvoicesTable.tsx`:

```tsx
'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { t } from '@/lib/i18n';

interface Row {
  id: string;
  number: string;
  issuedAt: string;
  dueAt: string;
  totalCents: number;
  currency: string;
  customerAddress: string;
}

function fmtCents(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('nl-BE', { style: 'currency', currency, minimumFractionDigits: 2 });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-BE', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function InvoicesTable() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    fetch('/api/admin/invoices').then(async (r) => {
      if (r.ok) { const { invoices } = await r.json(); setRows(invoices); }
      else setRows([]);
    });
  }, []);
  if (rows === null) return <p className="text-sm text-muted-foreground">…</p>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t('admin.invoices.empty')}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.invoices.col.number')}</TableHead>
          <TableHead>{t('admin.invoices.col.issuedAt')}</TableHead>
          <TableHead>{t('admin.invoices.col.dueAt')}</TableHead>
          <TableHead className="text-right">{t('admin.invoices.col.total')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-mono text-xs">
              <Link href={`/admin/invoices/${row.id}`} className="hover:underline">{row.number}</Link>
            </TableCell>
            <TableCell>{fmtDate(row.issuedAt)}</TableCell>
            <TableCell>{fmtDate(row.dueAt)}</TableCell>
            <TableCell className="text-right">{fmtCents(row.totalCents, row.currency)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Write the page**

Create `src/app/admin/(authed)/invoices/page.tsx`:

```tsx
import { InvoicesTable } from '@/components/admin/InvoicesTable';

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <InvoicesTable />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/InvoicesTable.tsx src/app/admin/\(authed\)/invoices/page.tsx
git commit -m "feat(admin): add /admin/invoices list page"
```

### Task 19: `/admin/invoices/[id]` detail page + payments list

**Files:**
- Create: `src/components/admin/InvoicePaymentsList.tsx`
- Create: `src/app/admin/(authed)/invoices/[id]/page.tsx`

- [ ] **Step 1: Write the payments list (client-side, re-fetches on new payment)**

Create `src/components/admin/InvoicePaymentsList.tsx`:

```tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { t } from '@/lib/i18n';
import type { PaymentRecord, PaymentStatus } from '@/domain/invoicing';

interface Props {
  invoiceId: string;
  totalCents: number;
  currency: string;
}

function fmtCents(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('nl-BE', { style: 'currency', currency, minimumFractionDigits: 2 });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-BE');
}

export function InvoicePaymentsList({ invoiceId, totalCents, currency }: Props) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [status, setStatus] = useState<PaymentStatus>('unpaid');

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/invoices/${invoiceId}`);
    if (!res.ok) return;
    const data = await res.json();
    setPayments(data.payments);
    setStatus(data.status);
  }, [invoiceId]);

  useEffect(() => { load(); }, [load]);

  // Listen for a window-level event fired by RecordPaymentDialog so the list refreshes.
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('payment-recorded', handler);
    return () => window.removeEventListener('payment-recorded', handler);
  }, [load]);

  const sum = payments.reduce((acc, p) => acc + p.amountCents, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{fmtCents(sum, currency)} / {fmtCents(totalCents, currency)}</span>
        <span className="font-medium">{t(`payment.status.${status}`)}</span>
      </div>
      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('admin.invoice.detail.noPayments')}</p>
      ) : (
        <ul className="divide-y">
          {payments.map((p) => (
            <li key={p.id} className="py-2 flex items-start justify-between text-sm">
              <div>
                <div>{fmtDate(p.paidAt)}</div>
                {p.providerRef && <div className="text-xs text-muted-foreground">{p.providerRef}</div>}
                {p.note && <div className="text-xs text-muted-foreground">{p.note}</div>}
              </div>
              <div className="font-mono">{fmtCents(p.amountCents, p.currency)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the detail page (server component that fetches via Drizzle)**

Create `src/app/admin/(authed)/invoices/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { invoices, orders } from '@/db/schema';
import { auth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTitle } from '@/components/admin/PageTitle';
import { InvoicePaymentsList } from '@/components/admin/InvoicePaymentsList';
import { RecordPaymentDialog } from '@/components/admin/RecordPaymentDialog';
import { t } from '@/lib/i18n';
import type { Role } from '@/lib/auth-guards';

interface Props { params: Promise<{ id: string }> }

function fmtCents(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('nl-BE', { style: 'currency', currency, minimumFractionDigits: 2 });
}
function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('nl-BE');
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const role = session.user.role as Role;
  const sessionTenantId = session.user.tenantId as string | null;

  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!invoice) notFound();
  if (role !== 'super_admin' && sessionTenantId !== invoice.tenantId) notFound();

  const [order] = await db.select().from(orders).where(eq(orders.id, invoice.orderId)).limit(1);

  const s = invoice.supplierSnapshot;
  return (
    <div className="space-y-6 max-w-4xl">
      <PageTitle title={invoice.number} />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold">{invoice.number}</div>
          <div className="text-sm text-muted-foreground">
            {t('admin.invoice.detail.dates')}: {fmtDate(invoice.issuedAt)} → {fmtDate(invoice.dueAt)}
          </div>
        </div>
        <a
          href={`/api/invoices/${invoice.id}/pdf`}
          className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          target="_blank"
        >
          {t('admin.invoice.detail.downloadPdf')}
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>{t('admin.invoice.detail.supplier')}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="font-medium">{s.displayName}</div>
            <div>{s.address}</div>
            {s.vatNumber && <div>BTW: {s.vatNumber}</div>}
            <div className="text-muted-foreground">{s.bankIban}{s.bankBic ? ` · ${s.bankBic}` : ''}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t('admin.invoice.detail.customer')}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1 whitespace-pre-wrap">
            {order && <div className="font-medium">{order.contactName}</div>}
            {invoice.customerAddress}
            {order && <div className="text-muted-foreground">{order.contactEmail}</div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t('admin.invoice.detail.amounts')}</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <div className="flex justify-between"><span>{t('invoice.pdf.subtotal')}</span><span>{fmtCents(invoice.subtotalCents, invoice.currency)}</span></div>
          <div className="flex justify-between"><span>{t('invoice.pdf.vat', { rate: (Number(invoice.vatRate) * 100).toFixed(0) })}</span><span>{fmtCents(invoice.vatCents, invoice.currency)}</span></div>
          <div className="flex justify-between pt-1 border-t font-semibold"><span>{t('invoice.pdf.grandTotal')}</span><span>{fmtCents(invoice.totalCents, invoice.currency)}</span></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t('admin.invoice.detail.payments')}</span>
            <RecordPaymentDialog invoiceId={invoice.id} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InvoicePaymentsList invoiceId={invoice.id} totalCents={invoice.totalCents} currency={invoice.currency} />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/InvoicePaymentsList.tsx src/app/admin/\(authed\)/invoices/\[id\]/page.tsx
git commit -m "feat(admin): add /admin/invoices/[id] detail page + payments list"
```

### Task 20: `IssueInvoiceDialog` on `/admin/orders/[id]`

**Files:**
- Create: `src/components/admin/IssueInvoiceDialog.tsx`
- Modify: `src/app/admin/(authed)/orders/[id]/page.tsx`

- [ ] **Step 1: Write the dialog**

Create `src/components/admin/IssueInvoiceDialog.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { t } from '@/lib/i18n';

interface Props {
  orderId: string;
  defaultCustomerName: string;
  defaultVatRate: number;
  defaultPaymentTermDays: number;
}

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => {
  const d = new Date(iso); d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function IssueInvoiceDialog({ orderId, defaultCustomerName, defaultVatRate, defaultPaymentTermDays }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState(defaultCustomerName);
  const [customerAddress, setCustomerAddress] = useState('');
  const [issuedAt, setIssuedAt] = useState(today());
  const [dueAt, setDueAt] = useState(addDays(today(), defaultPaymentTermDays));
  const [vatRate, setVatRate] = useState(defaultVatRate);

  async function submit() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/admin/orders/${orderId}/invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName, customerAddress, issuedAt, dueAt, vatRate }),
    });
    setBusy(false);
    if (res.ok) {
      const { invoice } = await res.json();
      setOpen(false);
      router.push(`/admin/invoices/${invoice.id}`);
      return;
    }
    const data = await res.json().catch(() => ({}));
    const code = data.error as string | undefined;
    if (code && t(`admin.issueInvoice.error.${code}`) !== `admin.issueInvoice.error.${code}`) {
      setError(t(`admin.issueInvoice.error.${code}`));
    } else {
      setError(t('admin.tenant.saveError', { error: code ?? res.status }));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t('admin.issueInvoice.trigger')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('admin.issueInvoice.title')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Field label={t('admin.issueInvoice.customerName')}>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </Field>
          <Field label={t('admin.issueInvoice.customerAddress')}>
            <Textarea rows={3} value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('admin.issueInvoice.issuedAt')}>
              <Input type="date" value={issuedAt} onChange={(e) => { setIssuedAt(e.target.value); setDueAt(addDays(e.target.value, defaultPaymentTermDays)); }} />
            </Field>
            <Field label={t('admin.issueInvoice.dueAt')}>
              <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </Field>
          </div>
          <Field label={t('admin.issueInvoice.vatRate')}>
            <Input type="number" step="0.01" min={0} max={1} value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>{t('admin.issueInvoice.submit')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
```

- [ ] **Step 2: Render on the order detail page**

Open `src/app/admin/(authed)/orders/[id]/page.tsx`. You need to:
1. After fetching the order, ALSO fetch whether an invoice exists (`SELECT id, number FROM invoices WHERE order_id = $1`) and the tenant's `invoicing` defaults.
2. If `!invoice && order.status === 'accepted'` — render `<IssueInvoiceDialog …/>`.
3. If `invoice` — render a small "Factuur {number}" link to `/admin/invoices/{id}`.

Concrete edits:

```tsx
import { IssueInvoiceDialog } from '@/components/admin/IssueInvoiceDialog';
import { invoices, tenants } from '@/db/schema';
// …

// After fetching the order:
const [invoice] = await db.select({ id: invoices.id, number: invoices.number })
  .from(invoices).where(eq(invoices.orderId, order.id)).limit(1);
const [tenantRow] = await db.select().from(tenants).where(eq(tenants.id, order.tenantId)).limit(1);

// In the JSX, add a new card or section:
{invoice ? (
  <Card>
    <CardHeader><CardTitle>{t('admin.invoice.detail.downloadPdf')}</CardTitle></CardHeader>
    <CardContent>
      <Link href={`/admin/invoices/${invoice.id}`} className="underline">{invoice.number}</Link>
    </CardContent>
  </Card>
) : order.status === 'accepted' && tenantRow && (
  <IssueInvoiceDialog
    orderId={order.id}
    defaultCustomerName={order.contactName}
    defaultVatRate={tenantRow.invoicing.vatRate}
    defaultPaymentTermDays={tenantRow.invoicing.paymentTermDays}
  />
)}
```

Adjust imports (`Card`, `CardHeader`, `CardTitle`, `CardContent`, `Link`, `t`) to match what the existing page already imports.

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm exec tsc --noEmit
git add src/components/admin/IssueInvoiceDialog.tsx src/app/admin/\(authed\)/orders/\[id\]/page.tsx
git commit -m "feat(admin): IssueInvoiceDialog on /admin/orders/[id]"
```

### Task 21: `RecordPaymentDialog`

**Files:**
- Create: `src/components/admin/RecordPaymentDialog.tsx`

- [ ] **Step 1: Write the dialog**

Create `src/components/admin/RecordPaymentDialog.tsx`:

```tsx
'use client';
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { t } from '@/lib/i18n';

interface Props { invoiceId: string }

export function RecordPaymentDialog({ invoiceId }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountEur, setAmountEur] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [providerRef, setProviderRef] = useState('');
  const [note, setNote] = useState('');

  async function submit() {
    setBusy(true); setError(null);
    const amountCents = Math.round(Number(amountEur) * 100);
    const res = await fetch(`/api/admin/invoices/${invoiceId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountCents,
        method: 'manual',
        paidAt,
        providerRef: providerRef || null,
        note: note || null,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      window.dispatchEvent(new Event('payment-recorded'));
      setAmountEur(''); setProviderRef(''); setNote('');
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(t('admin.tenant.saveError', { error: data.error ?? res.status }));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">{t('admin.recordPayment.trigger')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('admin.recordPayment.title')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Field label={t('admin.recordPayment.amount')}>
            <Input type="number" step="0.01" min={0} value={amountEur} onChange={(e) => setAmountEur(e.target.value)} />
          </Field>
          <Field label={t('admin.recordPayment.paidAt')}>
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </Field>
          <Field label={t('admin.recordPayment.providerRef')}>
            <Input value={providerRef} onChange={(e) => setProviderRef(e.target.value)} />
          </Field>
          <Field label={t('admin.recordPayment.note')}>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy || !amountEur}>{t('admin.recordPayment.submit')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/RecordPaymentDialog.tsx
git commit -m "feat(admin): RecordPaymentDialog for manual bank-transfer entries"
```

### Task 22: Sidebar + breadcrumbs for `/admin/invoices`

**Files:**
- Modify: `src/components/admin/Sidebar.tsx`
- Modify: `src/components/admin/breadcrumbs.ts`

- [ ] **Step 1: Add the nav item**

Open `src/components/admin/Sidebar.tsx`. Add `Receipt` to the `lucide-react` import block. Add the entry to `ITEMS` (visible to both super_admin and tenant_admin; tenant-scope filtering happens in the API):

```ts
  { href: '/admin/invoices', labelKey: 'admin.nav.invoices', icon: Receipt, visible: () => true },
```

Place it AFTER the `/admin/orders` entry for a logical sidebar order (Dashboard → Orders → Invoices → Clients → Tenants → Users → Registry).

- [ ] **Step 2: Add breadcrumb**

Open `src/components/admin/breadcrumbs.ts`. Extend `STATIC_LABELS`:

```ts
  '/admin/invoices': 'admin.nav.invoices',
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm exec tsc --noEmit
git add src/components/admin/Sidebar.tsx src/components/admin/breadcrumbs.ts
git commit -m "feat(admin): Invoices sidebar item + breadcrumb"
```

---

## Wave 6 — Shop (client) UI

### Task 23: `GET /api/shop/invoices/[id]`

**Files:**
- Create: `src/app/api/shop/invoices/[id]/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/shop/invoices/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { invoices, orders, payments } from '@/db/schema';
import { derivePaymentStatus } from '@/domain/invoicing';
import { requireClient } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

export const GET = withSession(async (session, _req, ctx: { params: Promise<{ id: string }> }) => {
  requireClient(session);
  const { id } = await ctx.params;

  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!invoice) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const [order] = await db.select().from(orders).where(eq(orders.id, invoice.orderId)).limit(1);
  if (!order || order.customerId !== session.user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const paymentRows = await db.select().from(payments).where(eq(payments.invoiceId, id)).orderBy(asc(payments.paidAt));
  const status = derivePaymentStatus(invoice.totalCents, paymentRows);

  return NextResponse.json({ invoice, order, payments: paymentRows, status });
});
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm exec tsc --noEmit
git add src/app/api/shop/invoices/\[id\]/route.ts
git commit -m "feat(api/shop): add GET /api/shop/invoices/[id] — ownership-scoped"
```

### Task 24: `/shop/account/invoices/[id]` page

**Files:**
- Create: `src/app/shop/(authed)/account/invoices/[id]/page.tsx`

- [ ] **Step 1: Write the page**

Create `src/app/shop/(authed)/account/invoices/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { invoices, orders, payments } from '@/db/schema';
import { auth } from '@/lib/auth';
import { derivePaymentStatus } from '@/domain/invoicing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { t } from '@/lib/i18n';

interface Props { params: Promise<{ id: string }> }

function fmtCents(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('nl-BE', { style: 'currency', currency, minimumFractionDigits: 2 });
}
function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('nl-BE', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default async function ShopInvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  const session = (await auth.api.getSession({ headers: await headers() }))!;

  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!invoice) notFound();
  const [order] = await db.select().from(orders)
    .where(and(eq(orders.id, invoice.orderId), eq(orders.customerId, session.user.id)))
    .limit(1);
  if (!order) notFound();

  const paymentRows = await db.select().from(payments).where(eq(payments.invoiceId, id)).orderBy(asc(payments.paidAt));
  const status = derivePaymentStatus(invoice.totalCents, paymentRows);

  const s = invoice.supplierSnapshot;
  return (
    <div className="space-y-6">
      <Link href={`/shop/account/orders/${order.id}`} className="text-sm text-muted-foreground hover:text-foreground">{t('shop.invoice.backLink')}</Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('shop.invoice.title', { number: invoice.number })}</h1>
        <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" className="inline-flex rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90">{t('shop.invoice.downloadPdf')}</a>
      </div>

      <Card>
        <CardHeader><CardTitle>{t('shop.invoice.section.supplier')}</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <div className="font-medium">{s.displayName}</div>
          <div className="whitespace-pre-wrap">{s.address}</div>
          {s.vatNumber && <div>BTW: {s.vatNumber}</div>}
          <div className="text-muted-foreground">{s.bankIban}{s.bankBic ? ` · ${s.bankBic}` : ''}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('shop.invoice.section.amounts')}</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <div className="flex justify-between"><span>{t('invoice.pdf.subtotal')}</span><span>{fmtCents(invoice.subtotalCents, invoice.currency)}</span></div>
          <div className="flex justify-between"><span>{t('invoice.pdf.vat', { rate: (Number(invoice.vatRate) * 100).toFixed(0) })}</span><span>{fmtCents(invoice.vatCents, invoice.currency)}</span></div>
          <div className="flex justify-between pt-1 border-t font-semibold"><span>{t('invoice.pdf.grandTotal')}</span><span>{fmtCents(invoice.totalCents, invoice.currency)}</span></div>
          <div className="pt-2 flex justify-between text-muted-foreground"><span>{t('invoice.pdf.issuedAt')}: {fmtDate(invoice.issuedAt)} · {t('invoice.pdf.dueAt')}: {fmtDate(invoice.dueAt)}</span><span>{t(`payment.status.${status}`)}</span></div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/shop/\(authed\)/account/invoices/\[id\]/page.tsx
git commit -m "feat(shop): add /shop/account/invoices/[id] page"
```

### Task 25: Augment `/shop/account/orders/[id]` with Factuur section

**Files:**
- Modify: `src/app/shop/(authed)/account/orders/[id]/page.tsx`

- [ ] **Step 1: Add invoice lookup + render**

Open the page. After the order is fetched, add:

```ts
import { invoices, payments as paymentsTable } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { derivePaymentStatus } from '@/domain/invoicing';

// … after the existing order fetch …
const [invoice] = await db.select().from(invoices).where(eq(invoices.orderId, row.id)).limit(1);
let invoiceStatus: ReturnType<typeof derivePaymentStatus> = 'unpaid';
if (invoice) {
  const paymentRows = await db.select().from(paymentsTable).where(eq(paymentsTable.invoiceId, invoice.id)).orderBy(asc(paymentsTable.paidAt));
  invoiceStatus = derivePaymentStatus(invoice.totalCents, paymentRows);
}
```

Pass `invoice` + `invoiceStatus` as props to the existing `<ClientOrderDetail>` component. Extend that component (also in this task) to render a "Factuur" card when `invoice` is non-null, linking to `/shop/account/invoices/{id}` and showing status + PDF download. When `invoice` is null and `row.status === 'accepted'`, render the "Nog geen factuur opgemaakt." empty state.

Because `ClientOrderDetail.tsx` already exists from Phase 4, adjust its props interface to optionally accept `invoice?: { id: string; number: string; totalCents: number } | null` + `invoiceStatus?: PaymentStatus`.

Concrete JSX addition inside `ClientOrderDetail` (right before the existing "nextSteps" paragraph):

```tsx
<Card>
  <CardHeader><CardTitle>{t('shop.order.invoice.title')}</CardTitle></CardHeader>
  <CardContent className="text-sm">
    {props.invoice ? (
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{props.invoice.number}</div>
          <div className="text-muted-foreground">{t(`payment.status.${props.invoiceStatus ?? 'unpaid'}`)}</div>
        </div>
        <div className="flex gap-2">
          <Link href={`/shop/account/invoices/${props.invoice.id}`} className="rounded-md border px-3 py-1 hover:bg-muted">{t('shop.invoice.title', { number: '' }).trim()}</Link>
          <a href={`/api/invoices/${props.invoice.id}/pdf`} target="_blank" className="rounded-md bg-foreground text-background px-3 py-1 hover:opacity-90">{t('shop.invoice.downloadPdf')}</a>
        </div>
      </div>
    ) : (
      <p className="text-muted-foreground italic">{t('shop.order.invoice.none')}</p>
    )}
  </CardContent>
</Card>
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm exec tsc --noEmit
git add src/app/shop/\(authed\)/account/orders/\[id\]/page.tsx src/components/shop/ClientOrderDetail.tsx
git commit -m "feat(shop): surface invoice status + PDF link on order detail"
```

---

## Wave 7 — Verify, document, ship

### Task 26: Full test + build sweep

**Files:** none (verification only)

- [ ] **Step 1: Tests**

Run: `pnpm test`

Expected: all green. Tally Phase 4.5 baseline (218) + Wave 1 new tests (+7 tenant-invoicing + 4 numbering + 7 vat + 6 paymentStatus + 2 supplierSnapshot + 14 validators + 1 i18n = 41) = roughly 259 passing.

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`

Expected: no new errors.

- [ ] **Step 3: Build**

Run: `pnpm build`

Expected: clean. New routes visible in build output:
- `/admin/invoices`, `/admin/invoices/[id]`
- `/shop/account/invoices/[id]`
- `/api/admin/tenants/[id]/invoicing`
- `/api/admin/orders/[id]/invoice`
- `/api/admin/invoices`, `/api/admin/invoices/[id]`, `/api/admin/invoices/[id]/payments`
- `/api/shop/invoices/[id]`
- `/api/invoices/[id]/pdf`

- [ ] **Step 4: Lint sanity**

Run: `pnpm lint`

Expected: no net-new errors vs `main`. Pre-existing warnings are out of scope.

- [ ] **Step 5: Manual dev-server smoke test**

Run: `pnpm dev`. Golden path:

1. Sign in as `super_admin` (assymo). Navigate to `/admin/tenants/assymo`. InvoicingSection now renders at the bottom of the page. Fill IBAN (e.g. `BE68 5390 0754 7034`), BIC optional. Save. Expect "Opgeslagen" message.
2. Create a new order from the configurator (`/`) → fill the contact dialog → submit. Note the order id.
3. Back in `/admin/orders`, find the new order. Advance its status: `submitted → quoted → accepted`.
4. On the accepted order's detail, click "Factuur opmaken". Fill customer address, confirm dates + 21% VAT. Submit. Redirect to `/admin/invoices/<newId>`.
5. Click "PDF downloaden" — a PDF opens in a new tab. Verify:
   - Invoice number is `YYYY-0001` (first invoice for the tenant).
   - Amounts: subtotal = order.totalCents, VAT = 21% of subtotal, grand total = subtotal + VAT.
   - Customer address + contact name render correctly.
   - Supplier block shows IBAN.
6. Click "Betaling registreren". Enter the full grand total in euros. Submit. Expect status to flip from "Onbetaald" to "Betaald".
7. Sign out. Log in as the client (follow the magic link from the order email in the dev terminal). Land on `/shop/account/orders/<id>`. Confirm the new "Factuur" card shows the invoice number, "Betaald" status, and a "Download PDF" button. Click "Factuur verwijzing" → lands on `/shop/account/invoices/<id>`. PDF downloads.
8. Negative tests:
   - Re-issue attempt on the same order → 409 `already_invoiced`.
   - Issue attempt on a `submitted` order → 422 `order_not_invoiceable`.
   - Clear the tenant's IBAN in the InvoicingSection, try to issue on a different accepted order → 422 `supplier_incomplete`.
   - Year-rollover: manually change the system clock or construct an issue request with `issuedAt: "2027-01-01"` → next invoice number is `2027-0001`, not `2026-0002`.

If any of the above fail, STOP and fix before moving on.

### Task 27: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Domain module**

Under Architecture → `src/domain/`, add after the `tenant/` bullet:

```markdown
- `invoicing/` — pure numbering (`formatInvoiceNumber`), VAT math (`computeInvoiceAmounts`), payment-status derivation (`derivePaymentStatus`), supplier-snapshot builder, and patch validators (`validateIssueInvoiceInput`, `validatePaymentInput`). All framework-free; consumed by the admin API + PDF renderer.
```

Also extend the `tenant/` bullet to mention `invoicing` + `validateInvoicingPatch`:

```markdown
- `tenant/` — `TenantContext` with `priceBook` + `branding` + `enabledMaterials` + `invoicing` (VAT rate, payment term, IBAN/BIC); host-based resolver; `brandingToCssVars` + `cssVarsToInlineBlock` for the branded shell; `validateBrandingPatch`, `validateEnabledMaterialsPatch`, `validateInvoicingPatch` for admin PATCH validation.
```

- [ ] **Step 2: Schema**

Under `src/db/` → `schema.ts`, extend the `tenants` description:

```markdown
  holds the seeded per-brand context (`priceBook`, `branding`, `invoicing` as jsonb,
  `enabledMaterials` as a nullable text[] material allow-list);
```

Add paragraphs for the new tables (mirror the `orders` one):

```markdown
  `invoices` rows freeze the priced invoice at issue time: `number` is per-tenant-per-year
  (`YYYY-NNNN`), `supplierSnapshot` captures the tenant's invoicing + footer details at
  issue time, amounts (`subtotalCents`, `vatRate`, `vatCents`, `totalCents`) + VAT rate
  are immutable afterwards. `customerAddress` is captured at issue time via the admin
  IssueInvoiceDialog. `orderId` is UNIQUE (1:1 with an order). `invoice_numbers` holds
  one row per tenant tracking the current `year` + `last_seq`; atomic UPSERT on issue
  handles the first-ever, same-year, and new-year reset cases in a single round-trip.
  `payments` rows carry manual bank-transfer entries (Phase 5) and future provider
  webhooks (Phase 6). Payment status is DERIVED from sum(payments) vs invoice.totalCents —
  there is no status column on the invoice.
```

- [ ] **Step 3: New admin API endpoints**

Under `src/app/api/admin/*`, append to the endpoint list:

```markdown
  - `PATCH /api/admin/tenants/[id]/invoicing` — super_admin any,
    tenant_admin own; validates against `validateInvoicingPatch`; partial
    merge over the stored jsonb.
  - `POST /api/admin/orders/[id]/invoice` — super_admin any, tenant_admin
    own; issues the invoice. Requires `order.status === 'accepted'` AND
    no existing invoice AND `tenant.invoicing.bankIban` set. Atomically
    allocates the next per-tenant-per-year number via the `invoice_numbers`
    upsert.
  - `GET /api/admin/invoices` — list own scope newest-first (super_admin
    sees all tenants).
  - `GET /api/admin/invoices/[id]` — detail with `payments[]` + derived
    `status`.
  - `POST /api/admin/invoices/[id]/payments` — record a manual payment.
    Method enum already admits `mollie|stripe` for Phase 6; Phase 5 rejects
    anything except `manual` at validation time.
```

- [ ] **Step 4: New shop API endpoint**

Under `src/app/api/shop/*`, append:

```markdown
  - `GET /api/shop/invoices/[id]` — client-only, scoped to the order's
    `customerId === session.user.id`. Returns 404 for both "not found"
    and "not yours".
```

- [ ] **Step 5: New dual-audience PDF route**

Add a new top-level bullet after `/api/shop/*`:

```markdown
- `src/app/api/invoices/[id]/pdf/` — `GET` streams `application/pdf`.
  Session-scoped: business-side requires `super_admin` OR `tenant_admin`
  with matching `invoice.tenantId`; client-side requires
  `order.customerId === session.user.id`. 404 on any scope mismatch.
  Rendered on-demand via `@react-pdf/renderer` and
  `src/lib/renderInvoicePdf.ts`; not cached.
```

- [ ] **Step 6: Admin UI shell note**

Under "Routes" → `src/app/admin/`, extend the trailing paragraph to mention `/admin/invoices`:

```markdown
The authed tree now also ships `/admin/invoices` (list + detail) and
`/admin/registry` (tenant_admin only — super_admin edits per-tenant via
the Materials + Invoicing sections on `/admin/tenants/[id]`).
```

- [ ] **Step 7: Shop UI note**

Under `src/app/shop/`, extend the Pages block:

```markdown
  - `/shop/account/invoices/[id]` — invoice detail (supplier snapshot
    + amounts + derived status + "PDF downloaden" link). Ownership-scoped
    at server render.
```

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): add invoicing module + /admin/invoices + PDF route (Phase 5)"
```

### Task 28: Tick `[x] Phase 5` in the spec

**Files:**
- Modify: `docs/superpowers/specs/2026-04-17-platform-architecture-design.md`

- [ ] **Step 1: Flip the checkbox**

The Progress section currently reads:

```markdown
- [ ] Phase 5 — Invoices
```

At plan-kickoff, replace with the linked-and-unticked version:

```markdown
- [ ] Phase 5 — Invoices — [plan](../plans/2026-04-21-phase-5-invoices.md)
```

(This step happens AT KICKOFF, not at merge — per the saved `feedback_plan_linking.md` auto-memory: the plan + spec link land on `main` BEFORE the feature branch forks.)

At merge, just tick the box:

```markdown
- [x] Phase 5 — Invoices — [plan](../plans/2026-04-21-phase-5-invoices.md)
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-17-platform-architecture-design.md
git commit -m "docs(spec): tick [x] Phase 5 — Invoices"
```

### Task 29: Merge

- [ ] **Step 1: Merge strategy (follow Phase 4 + 4.5 precedent)**

User has indicated "no PR, just merge on main" for the past two phases. If the same preference holds:

```bash
git checkout main
git merge --no-ff phase-5-invoices -m "Merge branch 'phase-5-invoices' into main"
```

If any conflict appears on the spec file (likely: main already has the plan-link commit cherry-picked from the phase branch), resolve by taking the ticked version.

Post-merge sanity check:

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

Then clean up:

```bash
git worktree remove .worktrees/phase-5-invoices
git branch -d phase-5-invoices
```

---

## Self-Review Notes (run BEFORE handing off)

- **Spec coverage:** Every Phase 5 bullet in the architecture spec maps to at least one task:
  - `invoices` + `invoice_numbers` + `payments` tables → T8.
  - `src/domain/invoicing/` (numbering, status derivation, PDF data shape) → T1–T6.
  - `POST /api/admin/orders/[id]/invoice` → T11.
  - `GET /api/admin/invoices`, `POST /api/admin/invoices/[id]/payments` → T12, T13.
  - PDF generation decision (react-pdf vs print-to-pdf) → design decision #6 + T14.
  - `/admin/invoices/*` + `/shop/account/invoices/[id]` → T18–T19, T24.
  - Route map additions (admin/shop API trees) → T10 (tenant invoicing PATCH — new but fits the existing "tenant-scoped admin PATCH" pattern), T23 (shop invoice GET), T15 (shared PDF route).
- **Out-of-scope:** Phase 6 (online payments via Mollie), credit notes, bulk email, tenant-branded PDF themes, `/shop/account/invoices` list, per-tenant PDF templates — all deferred per spec.
- **Type consistency:** `InvoiceRecord`, `PaymentRecord`, `PaymentStatus`, `InvoiceSupplierSnapshot`, `InvoicePaymentMethod`, `TenantInvoicing` are defined once and re-exported via barrels. DB rows (`InvoiceRow`, `PaymentRow`) inherit from Drizzle's `$inferSelect` and structurally match the view types modulo `Date ↔ ISO string` at the JSON boundary. The PDF route cast (`invoice as unknown as InvoiceRecord`) is the one acknowledged rough edge; a `serialiseInvoice(row)` helper can come later if it bloats.
- **Framework boundaries:** `src/domain/invoicing/*` imports zero framework code. `src/lib/renderInvoicePdf.ts` is the single Node-only bridge to `@react-pdf/renderer`. The PDF React component (`src/components/invoice/InvoicePdf.tsx`) is React, but the "React" is react-pdf's not react-dom's — doesn't ship to the browser.
- **Auth:** All admin endpoints use `requireBusiness(['super_admin','tenant_admin'])` + `requireTenantScope` (mirrors Phase 2 + Phase 4.5). The shop endpoint uses `requireClient` + ownership on the order's customerId. The PDF route uniquely handles BOTH audiences — explicit branching in the route handler (T15) is clearer than trying to introduce a new shared guard.
- **Immutability:** Invoices are never updated after issue; the closest thing to an "edit" would be creating a separate credit-note record (deferred). `supplierSnapshot` + the VAT fields are frozen at issue time; order.quoteSnapshot is already frozen by Phase 2. The only DB writes against an invoice after issue come through the `payments` table — never into the invoice row itself.
- **Concurrency:** `invoice_numbers` ON CONFLICT upsert is atomic at the DB level. Two concurrent issue requests on the same tenant get serialized by Postgres's row-level lock — both succeed with different sequence numbers. No application-level lock needed.
- **Migration risk:** Task 8 is the highest-risk change — a `NOT NULL` column add on `tenants` with a required backfill. The migration file is hand-edited to three SQL statements (ADD nullable, UPDATE backfill, SET NOT NULL). Task 8 Step 2 documents this clearly and the implementer is told to review the generator's output before applying. Neon's HTTP driver will run these sequentially.
- **PDF risk:** `@react-pdf/renderer` has a small (<1 MB) runtime + pre-bundled fonts; cold-start impact ~100 ms. If the build surfaces any edge-runtime incompatibility, the PDF route can pin `export const runtime = 'nodejs';` (mention in follow-up if needed — default route runtime already is nodejs for Next 16 App Router).
- **Customer address UX caveat:** Collecting the address at issue time (design decision #4) keeps Phase 5 tight, but creates admin friction (IC has to retype / copy-paste the address when issuing). If this becomes painful, a follow-up adds `user.defaultAddress` on claim + prefills the dialog. Noted here, not enacted.
