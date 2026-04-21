# Phase 4 — Webshop Shell + Client Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the client-facing surface: tenant-branded chrome wrapping the configurator on `/`, a `/shop/sign-in` magic-link form, and a session-guarded `/shop/account/*` area where clients see their own orders and a single order's detail (quote snapshot + status). This closes the "magic link lands on 404 in dev" loop from Phase 2.

**Architecture:** A new `src/domain/tenant/cssVars.ts` (pure) translates a `Branding` object into CSS custom properties. A new `src/components/shop/BrandedShell.tsx` injects those vars into `<html>` via an inline `<style>` tag and renders a tenant `<ShopHeader>` + page content + `<ShopFooter>`. The same shell wraps both `/` (configurator) and the entire `/shop/*` tree. Two new shop-side endpoints (`GET /api/shop/orders`, `GET /api/shop/orders/[id]`) reuse the existing `withSession` + `requireClient` guards and enforce `customerId === session.user.id` ownership. A `/shop/(authed)/layout.tsx` mirrors the admin `(authed)` pattern: session check + userType redirect + Toaster slot.

**Tech Stack:** Next 16 (App Router) + React 19, Drizzle (Neon HTTP), Better Auth (magic-link through Resend), Tailwind v4, shadcn (new-york), Vitest (`vite-plus/test`).

**Spec:** `docs/superpowers/specs/2026-04-17-platform-architecture-design.md` — Phase 4 section + Route map + Auth guards table (`View orders | client | own only`, `View own invoices | client | own only`).

**Reference (read-only):** The admin `(authed)` tree at `src/app/admin/(authed)/` and the admin sign-in at `src/app/admin/sign-in/`. Mirror their layout + guard patterns verbatim; don't copy visual details — this is a different audience with a tenant-branded chrome.

---

## File map

Files this plan creates or modifies (grouped by responsibility):

**Domain (pure, no framework imports)**
- Modify `src/domain/tenant/types.ts` — add `branding: Branding` field to `TenantContext` so the in-app object carries what the DB row already holds.
- Create `src/domain/tenant/cssVars.ts` — `brandingToCssVars(branding)` → `Record<string, string>` plus `cssVarsToInlineBlock(vars)` → `string` that renders a `:root { --brand-primary: #...; }` block for injection.
- Modify `src/domain/tenant/index.ts` — re-export `./cssVars`.
- Create `tests/tenant-cssVars.test.ts` — accept + normalize + edge-case matrix.

**Shell components (browser-coupled)**
- Create `src/components/shop/BrandedShell.tsx` — default-exported `<BrandedShell>` server component that reads the tenant from `<TenantProvider>` via a server-only helper, injects CSS vars, renders `<ShopHeader>` + children + `<ShopFooter>`.
- Create `src/components/shop/ShopHeader.tsx` — logo + displayName + right-slotted auth nav (sign-in link when anonymous, account dropdown when signed in).
- Create `src/components/shop/ShopFooter.tsx` — contact email + address + VAT number (hide line when null).
- Create `src/components/shop/ClientOrdersTable.tsx` — client-side fetch of `GET /api/shop/orders`, minimal table with code, status pill, total, submittedAt, link to detail.
- Create `src/components/shop/ClientOrderDetail.tsx` — server component that accepts a fetched `OrderRecord` and renders the quote snapshot + contact card. Reuses `OrderStatusBadge` and `OrderQuoteTable` from `src/components/admin/`.

**Shop API**
- Create `src/app/api/shop/orders/[id]/route.ts` — `GET` single order (own only, else 404).
- Modify `src/app/api/shop/orders/route.ts` — add `GET` handler alongside the existing `POST`. List the caller's own orders, newest-first.

**Shop routes**
- Create `src/app/shop/sign-in/layout.tsx` — mirrors `src/app/admin/sign-in/layout.tsx`; bounces already-signed-in **clients** to `/shop/account`, business users to `/admin`.
- Create `src/app/shop/sign-in/page.tsx` — magic-link form, `callbackURL=/shop/account`.
- Create `src/app/shop/(authed)/layout.tsx` — session guard + userType check (redirect `business` → `/admin`, null → `/shop/sign-in`), wraps the tree in `<BrandedShell>` + a bottom `<Toaster />`.
- Create `src/app/shop/(authed)/account/page.tsx` — renders `<ClientOrdersTable />`.
- Create `src/app/shop/(authed)/account/orders/[id]/page.tsx` — server-side fetch of the order (via its own route or a shared helper), renders `<ClientOrderDetail />`.

**Configurator root — branded shell integration**
- Modify `src/app/layout.tsx` — include `branding` in the TenantContext handed to the provider (the DB row already carries it — surface it).
- Modify `src/app/(configurator)/page.tsx` — wrap the existing root flex container in `<BrandedShell variant="configurator">` so the header/footer surround the canvas. The configurator variant uses a slim header (no auth dropdown visible while anonymous) and hides the footer so the canvas owns the viewport.
- Modify `src/app/globals.css` — document the `--brand-primary` / `--brand-accent` CSS vars at the top of the file (comment only; no declarations, the shell injects them at runtime).

**i18n**
- Modify `src/lib/i18n.ts` — add `shop.*` block (sign-in, account, order detail, empty states, errors) following the pattern established by `admin.*`.

**Docs**
- Modify `CLAUDE.md` — add `/shop/*` + shop API blocks under "Routes"; add a "Branded shell" subsection describing how `brandingToCssVars` + `<BrandedShell>` work and that the configurator canvas stays unbranded internally.
- Modify `docs/superpowers/specs/2026-04-17-platform-architecture-design.md` — tick `[x] Phase 4 — Webshop shell + client account` in the Progress section (final task, after merge).

---

## Wave 1 — Domain helpers + i18n

No DB, no Next, no React. TDD for the CSS-var helper; mechanical insert for i18n. Everything in `src/domain/tenant/` remains safe to import from API routes, admin pages, and the webshop without pulling a browser runtime.

### Task 1: Add `branding` to `TenantContext`

**Files:**
- Modify: `src/domain/tenant/types.ts`

- [ ] **Step 1: Add the field**

Open `src/domain/tenant/types.ts`. At the top of the file, add the import and extend the interface. Replace the current file contents with:

```ts
import type { PriceBook } from '@/domain/pricing';
import type { Branding } from './branding';

/** Tenant-scoped configuration injected into every domain function that
 *  depends on brand, locale, or catalog decisions. Anything that varies
 *  per brand belongs here, not in module-scope constants. */
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
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`

Expected: clean. `TenantRow` (which is `typeof tenants.$inferSelect`) already has `branding: Branding`, and `src/app/layout.tsx` passes a `TenantRow` where a `TenantContext` is expected — adding the field makes the expected-vs-actual shapes align instead of drifting further. No existing consumer destructures `branding` yet, so nothing else should complain.

If a consumer does break (unlikely), fix it by reading `branding` from the provider or by casting `branding: DEFAULT_ASSYMO_BRANDING` in a test fixture.

- [ ] **Step 3: Full test sweep**

Run: `pnpm test`

Expected: all 184 tests still pass. No test references `TenantContext` directly enough to need an update — the seed fixtures come from the DB row, which already has `branding`.

- [ ] **Step 4: Commit**

```bash
git add src/domain/tenant/types.ts
git commit -m "feat(domain/tenant): add branding to TenantContext"
```

### Task 2: Add `shop.*` i18n keys

**Files:**
- Modify: `src/lib/i18n.ts`

- [ ] **Step 1: Insert the block**

Open `src/lib/i18n.ts` and find the trailing `'configurator.submit.success.close': 'Sluiten',` line. After that line (still inside the `nl` object) insert the new block. Keep the trailing comma on every entry including the last.

```ts
  // Shop — sign-in
  'shop.signIn.title': 'Inloggen bij je account',
  'shop.signIn.lead':
    'Vul je e-mailadres in — we sturen je een link om in te loggen.',
  'shop.signIn.email': 'E-mailadres',
  'shop.signIn.submit': 'Stuur inloglink',
  'shop.signIn.sent':
    'Check je inbox — we hebben je een inloglink gestuurd.',
  'shop.signIn.error': 'Inloggen mislukt. Probeer het opnieuw.',
  'shop.signIn.backToConfigurator': 'Terug naar de configurator',
  // Shop — shell / navigation
  'shop.nav.account': 'Mijn account',
  'shop.nav.orders': 'Mijn bestellingen',
  'shop.nav.signOut': 'Uitloggen',
  'shop.nav.signIn': 'Inloggen',
  // Shop — footer
  'shop.footer.contact': 'Contact',
  'shop.footer.vat': 'BTW',
  // Shop — account / orders list
  'shop.account.title': 'Mijn bestellingen',
  'shop.account.empty':
    'Je hebt nog geen bestellingen. Ga terug naar de configurator om je eerste aanvraag te plaatsen.',
  'shop.account.backToConfigurator': 'Naar de configurator',
  'shop.account.col.id': 'Referentie',
  'shop.account.col.status': 'Status',
  'shop.account.col.total': 'Totaal',
  'shop.account.col.submittedAt': 'Ingediend',
  // Shop — order detail
  'shop.order.title': 'Bestelling {id}',
  'shop.order.backLink': '← Terug naar mijn bestellingen',
  'shop.order.section.status': 'Status',
  'shop.order.section.quote': 'Offerte',
  'shop.order.section.contact': 'Contactgegevens',
  'shop.order.section.notes': 'Opmerking',
  'shop.order.submittedAt': 'Ingediend op {date}',
  'shop.order.noNotes': 'Geen opmerking opgegeven.',
  'shop.order.nextSteps':
    'We nemen binnen één werkdag contact met je op. Zodra we je offerte bevestigen, zie je de status hier wijzigen naar "Offerte verstuurd".',
  // Shop — fetch errors
  'shop.error.loading': 'Kon je bestellingen niet laden. Vernieuw de pagina.',
```

- [ ] **Step 2: Smoke test**

Append to `tests/i18n.test.ts` inside the existing `describe('t()', () => { ... })` block (before the closing `});`):

```ts
  it('exposes shop.* keys used by the webshop shell', () => {
    expect(t('shop.signIn.title')).toBe('Inloggen bij je account');
    expect(t('shop.account.title')).toBe('Mijn bestellingen');
    expect(t('shop.order.title', { id: 'abc' })).toBe('Bestelling abc');
    expect(t('shop.order.submittedAt', { date: '2026-04-21' })).toContain(
      '2026-04-21',
    );
  });
```

Run: `pnpm test -- tests/i18n.test.ts`

Expected: all cases pass (previous 6 + this new one = 7).

- [ ] **Step 3: Commit**

```bash
git add src/lib/i18n.ts tests/i18n.test.ts
git commit -m "feat(i18n): add shop.* keys for Phase 4"
```

### Task 3: Write the `cssVars` test

**Files:**
- Create: `tests/tenant-cssVars.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/tenant-cssVars.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import {
  brandingToCssVars,
  cssVarsToInlineBlock,
} from '@/domain/tenant/cssVars';
import { DEFAULT_ASSYMO_BRANDING } from '@/domain/tenant';

describe('brandingToCssVars', () => {
  it('emits --brand-primary + --brand-accent from branding colors', () => {
    const vars = brandingToCssVars(DEFAULT_ASSYMO_BRANDING);
    expect(vars['--brand-primary']).toBe('#1f2937');
    expect(vars['--brand-accent']).toBe('#0ea5e9');
  });

  it('returns only brand colour vars (no displayName, logoUrl, or footer)', () => {
    const vars = brandingToCssVars(DEFAULT_ASSYMO_BRANDING);
    expect(Object.keys(vars).sort()).toEqual([
      '--brand-accent',
      '--brand-primary',
    ]);
  });

  it('preserves hex casing verbatim — no normalisation', () => {
    const vars = brandingToCssVars({
      ...DEFAULT_ASSYMO_BRANDING,
      primaryColor: '#AaBbCc',
      accentColor: '#11aaFF',
    });
    expect(vars['--brand-primary']).toBe('#AaBbCc');
    expect(vars['--brand-accent']).toBe('#11aaFF');
  });
});

describe('cssVarsToInlineBlock', () => {
  it('renders a :root block from a var map', () => {
    const block = cssVarsToInlineBlock({
      '--brand-primary': '#111',
      '--brand-accent': '#222',
    });
    expect(block).toBe(':root{--brand-primary:#111;--brand-accent:#222;}');
  });

  it('returns an empty :root block for an empty map', () => {
    expect(cssVarsToInlineBlock({})).toBe(':root{}');
  });

  it('does NOT escape characters — callers must pass trusted input', () => {
    // We never accept user-uploaded CSS; branding values are written
    // by admins and validated by validateBrandingPatch upstream.
    // This test pins the non-escape behaviour so a well-meaning future
    // contributor doesn't introduce half-escaping that breaks valid hex.
    const block = cssVarsToInlineBlock({ '--x': '#FFF' });
    expect(block).toContain('#FFF');
  });
});
```

- [ ] **Step 2: Run the tests — confirm they fail**

Run: `pnpm test -- tests/tenant-cssVars.test.ts`

Expected: FAIL — `cssVars` module does not exist.

### Task 4: Implement `cssVars.ts`

**Files:**
- Create: `src/domain/tenant/cssVars.ts`
- Modify: `src/domain/tenant/index.ts`

- [ ] **Step 1: Write the module**

Create `src/domain/tenant/cssVars.ts`:

```ts
import type { Branding } from './branding';

/** Extract tenant brand colours as CSS custom properties. Consumed by
 *  `<BrandedShell>` which injects the return value into an inline
 *  `<style>` tag on the server. Pure; safe to import from anywhere. */
export function brandingToCssVars(branding: Branding): Record<string, string> {
  return {
    '--brand-primary': branding.primaryColor,
    '--brand-accent': branding.accentColor,
  };
}

/** Render a CSS var map as a :root declaration block. The caller is
 *  expected to pass only trusted, validated input (branding values are
 *  admin-written and pass through `validateBrandingPatch`); we do not
 *  escape CSS tokens here. */
export function cssVarsToInlineBlock(vars: Record<string, string>): string {
  const body = Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join('');
  return `:root{${body}}`;
}
```

- [ ] **Step 2: Re-export from the barrel**

Open `src/domain/tenant/index.ts`. Find the existing re-exports (`export * from './branding';` and similar). Append:

```ts
export * from './cssVars';
```

- [ ] **Step 3: Run the tests — confirm they pass**

Run: `pnpm test -- tests/tenant-cssVars.test.ts`

Expected: all 6 tests pass.

- [ ] **Step 4: Full sweep + typecheck**

```bash
pnpm test
pnpm exec tsc --noEmit
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/domain/tenant/cssVars.ts src/domain/tenant/index.ts tests/tenant-cssVars.test.ts
git commit -m "feat(domain/tenant): add brandingToCssVars + cssVarsToInlineBlock helpers"
```

---

## Wave 2 — Shop API GET endpoints

Two tiny endpoints + their tests, before any UI is wired. Keeps the network surface testable in isolation.

### Task 5: `GET /api/shop/orders` (list own orders)

**Files:**
- Modify: `src/app/api/shop/orders/route.ts`

- [ ] **Step 1: Add the `GET` handler alongside the existing `POST`**

Open `src/app/api/shop/orders/route.ts`. The file currently exports only `POST`. Add a `GET` export at the TOP of the file (just after the existing import block), preserving all existing imports. Replace the existing `import { auth } from '@/lib/auth';` line with:

```ts
import { auth } from '@/lib/auth';
import { desc, and } from 'drizzle-orm';
import { requireClient } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';
```

Then add the handler. Insert BEFORE the existing `export async function POST(req: NextRequest) {` line:

```ts
/** List the signed-in client's own orders, newest-first. Tenant scope
 *  is implicit: a client user belongs to exactly one tenant, and we
 *  filter by their `customerId`, so cross-tenant leakage is impossible. */
export const GET = withSession(async (session) => {
  requireClient(session);
  const clientId = session.user.id;

  const rows = await db
    .select({
      id: orders.id,
      code: orders.code,
      status: orders.status,
      totalCents: orders.totalCents,
      currency: orders.currency,
      submittedAt: orders.submittedAt,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.customerId, clientId))
    .orderBy(desc(orders.createdAt));

  return NextResponse.json({ orders: rows });
});
```

Note: the existing file already imports `eq` from drizzle-orm — no new import needed there. It also already imports `db` and `orders`. The `and` import above isn't strictly needed for the GET but keeps the block consistent with how the admin route handles filtering; if your linter complains about `and` being unused, drop it. Keep `desc`, `requireClient`, `withSession`.

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/shop/orders/route.ts
git commit -m "feat(api/shop): add GET /api/shop/orders — client's own orders list"
```

### Task 6: `GET /api/shop/orders/[id]` (own detail)

**Files:**
- Create: `src/app/api/shop/orders/[id]/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/shop/orders/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { requireClient } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

interface Ctx { params: Promise<{ id: string }> }

/** Fetch a single order by id, strictly scoped to the caller's own
 *  `customerId`. Returns 404 for both "not found" and "not yours" —
 *  don't leak the existence of another client's order. */
export const GET = withSession(async (session, _req, { params }: Ctx) => {
  requireClient(session);
  const { id } = await params;

  const [row] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.customerId, session.user.id)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ order: row });
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/shop/orders/[id]/route.ts
git commit -m "feat(api/shop): add GET /api/shop/orders/[id] — client's own order detail"
```

---

## Wave 3 — Shell components

Pure presentation + one server helper. Build the chrome once, use it everywhere.

### Task 7: Build `ShopHeader`

**Files:**
- Create: `src/components/shop/ShopHeader.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/shop/ShopHeader.tsx`:

```tsx
import Link from 'next/link';
import Image from 'next/image';
import type { Branding } from '@/domain/tenant';
import { t } from '@/lib/i18n';

interface Props {
  branding: Branding;
  /** When null, the "sign in" link is shown. When set, the account
   *  dropdown trigger is shown. */
  signedIn: { name: string | null; email: string } | null;
  /** Slim variant for the configurator — drops the auth slot entirely
   *  so the canvas owns the viewport. */
  variant?: 'shop' | 'configurator';
}

export function ShopHeader({ branding, signedIn, variant = 'shop' }: Props) {
  return (
    <header
      className="h-14 shrink-0 border-b border-black/10 bg-background flex items-center justify-between px-4"
      style={{ borderColor: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)' }}
    >
      <Link
        href={variant === 'configurator' ? '/' : '/shop/account'}
        className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity"
      >
        {branding.logoUrl && (
          <Image
            src={branding.logoUrl}
            alt={branding.displayName}
            width={28}
            height={28}
            className="h-7 w-auto"
          />
        )}
        <span className="text-foreground">{branding.displayName}</span>
      </Link>

      {variant === 'shop' && (
        <div className="flex items-center gap-3 text-sm">
          {signedIn ? (
            <Link
              href="/shop/account"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {signedIn.email}
            </Link>
          ) : (
            <Link
              href="/shop/sign-in"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('shop.nav.signIn')}
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/shop/ShopHeader.tsx
git commit -m "feat(shop): add ShopHeader with tenant logo + auth slot"
```

### Task 8: Build `ShopFooter`

**Files:**
- Create: `src/components/shop/ShopFooter.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/shop/ShopFooter.tsx`:

```tsx
import type { Branding } from '@/domain/tenant';
import { t } from '@/lib/i18n';

interface Props { branding: Branding }

export function ShopFooter({ branding }: Props) {
  const { footer, displayName } = branding;
  const year = new Date().getFullYear();
  return (
    <footer className="shrink-0 border-t border-black/10 bg-muted/20 px-4 py-6 text-xs text-muted-foreground">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="font-medium text-foreground">{displayName}</div>
          <div>{footer.address}</div>
          {footer.vatNumber && (
            <div>{t('shop.footer.vat')}: {footer.vatNumber}</div>
          )}
        </div>
        <div className="sm:text-right">
          <div>{t('shop.footer.contact')}:</div>
          <a
            href={`mailto:${footer.contactEmail}`}
            className="text-foreground hover:underline"
          >
            {footer.contactEmail}
          </a>
          <div className="mt-1 text-muted-foreground/60">
            © {year} {displayName}
          </div>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm exec tsc --noEmit
git add src/components/shop/ShopFooter.tsx
git commit -m "feat(shop): add ShopFooter with tenant contact + VAT"
```

### Task 9: Build `BrandedShell`

**Files:**
- Create: `src/components/shop/BrandedShell.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/shop/BrandedShell.tsx`:

```tsx
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { resolveTenantByHostOrDefault } from '@/db/resolveTenant';
import {
  brandingToCssVars,
  cssVarsToInlineBlock,
  DEFAULT_ASSYMO_BRANDING,
} from '@/domain/tenant';
import { ShopHeader } from './ShopHeader';
import { ShopFooter } from './ShopFooter';

interface Props {
  /** "shop" renders header + footer around children; "configurator"
   *  renders the slim header only and lets children own the rest of
   *  the viewport (the canvas needs `h-dvh`). */
  variant?: 'shop' | 'configurator';
  children: React.ReactNode;
}

/** Server-only shell that reads the tenant branding + session and
 *  injects brand CSS vars. Used by `/shop/*` routes and by the
 *  configurator root. */
export async function BrandedShell({ variant = 'shop', children }: Props) {
  const hostHeader = (await headers()).get('host');
  const tenantRow = await resolveTenantByHostOrDefault(hostHeader);
  const branding = tenantRow?.branding ?? DEFAULT_ASSYMO_BRANDING;

  const session = await auth.api.getSession({ headers: await headers() });
  const signedIn =
    session?.user?.userType === 'client'
      ? { name: session.user.name ?? null, email: session.user.email }
      : null;

  const cssBlock = cssVarsToInlineBlock(brandingToCssVars(branding));

  if (variant === 'configurator') {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: cssBlock }} />
        <div className="flex flex-col h-dvh">
          <ShopHeader branding={branding} signedIn={signedIn} variant="configurator" />
          <main className="flex-1 relative min-h-0">{children}</main>
        </div>
      </>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssBlock }} />
      <div className="flex flex-col min-h-dvh">
        <ShopHeader branding={branding} signedIn={signedIn} variant="shop" />
        <main className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto">
          {children}
        </main>
        <ShopFooter branding={branding} />
      </div>
    </>
  );
}
```

Note: the plan's original design considered the `<style>` injection to be the only CSS-var source; this keeps the DOM structure free of inline `style` attributes and lets any descendant use `var(--brand-primary)` through Tailwind arbitrary values (`bg-[var(--brand-primary)]`). `dangerouslySetInnerHTML` here is safe because `cssBlock` is built from already-validated hex colours (admin-controlled, `validateBrandingPatch` enforces `HEX_RE`).

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/shop/BrandedShell.tsx
git commit -m "feat(shop): add BrandedShell server component with CSS-var injection"
```

---

## Wave 4 — Sign-in + authed layout

### Task 10: `/shop/sign-in/layout.tsx`

**Files:**
- Create: `src/app/shop/sign-in/layout.tsx`

- [ ] **Step 1: Write the layout**

Create `src/app/shop/sign-in/layout.tsx`:

```tsx
// Sign-in lives outside the (authed) group, so the session-guard layout
// doesn't apply here. Already-signed-in clients bounce to /shop/account;
// business users bounce to /admin (they shouldn't be on /shop at all).
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { BrandedShell } from '@/components/shop/BrandedShell';

export default async function ShopSignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.userType === 'client') redirect('/shop/account');
  if (session?.user?.userType === 'business') redirect('/admin');

  return (
    <BrandedShell variant="shop">
      <div className="flex items-center justify-center min-h-[60vh]">
        {children}
      </div>
    </BrandedShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/shop/sign-in/layout.tsx
git commit -m "feat(shop): add sign-in layout with anonymous-only guard"
```

### Task 11: `/shop/sign-in/page.tsx`

**Files:**
- Create: `src/app/shop/sign-in/page.tsx`

- [ ] **Step 1: Write the page**

Create `src/app/shop/sign-in/page.tsx`:

```tsx
'use client';
import Link from 'next/link';
import { useState } from 'react';
import { signIn } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { t } from '@/lib/i18n';

export default function ShopSignInPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sent' | 'error'>('idle');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setState('idle');
    try {
      await signIn.magicLink({ email, callbackURL: '/shop/account' });
      setState('sent');
    } catch {
      setState('error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('shop.signIn.title')}</CardTitle>
        <CardDescription>{t('shop.signIn.lead')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('shop.signIn.email')}</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {t('shop.signIn.submit')}
          </Button>
          {state === 'sent' && (
            <p className="text-sm text-green-600">{t('shop.signIn.sent')}</p>
          )}
          {state === 'error' && (
            <p className="text-sm text-destructive">{t('shop.signIn.error')}</p>
          )}
          <div className="pt-2 text-center">
            <Link
              href="/"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('shop.signIn.backToConfigurator')}
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/shop/sign-in/page.tsx
git commit -m "feat(shop): add sign-in page (magic-link, callbackURL=/shop/account)"
```

### Task 12: `/shop/(authed)/layout.tsx`

**Files:**
- Create: `src/app/shop/(authed)/layout.tsx`

- [ ] **Step 1: Write the layout**

Create `src/app/shop/(authed)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { BrandedShell } from '@/components/shop/BrandedShell';
import { Toaster } from '@/components/ui/sonner';
import type { UserType } from '@/lib/auth-guards';

export default async function ShopAuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect('/shop/sign-in');
  const userType = session.user.userType as UserType | null;
  if (userType === 'business') redirect('/admin');
  if (userType !== 'client') redirect('/shop/sign-in');

  return (
    <BrandedShell variant="shop">
      {children}
      <Toaster />
    </BrandedShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/shop/\(authed\)/layout.tsx
git commit -m "feat(shop): add (authed) layout with client-userType guard"
```

---

## Wave 5 — Account page + orders list

### Task 13: Build `ClientOrdersTable`

**Files:**
- Create: `src/components/shop/ClientOrdersTable.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/shop/ClientOrdersTable.tsx`:

```tsx
'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OrderStatusBadge } from '@/components/admin/OrderStatusBadge';
import { t } from '@/lib/i18n';
import type { OrderStatus } from '@/domain/orders';

interface Row {
  id: string;
  code: string;
  status: OrderStatus;
  totalCents: number;
  currency: string;
  submittedAt: string | null;
  createdAt: string;
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
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function ClientOrdersTable() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/shop/orders').then(async (r) => {
      if (r.ok) {
        const { orders } = await r.json();
        setRows(orders);
      } else {
        setError(true);
      }
    }).catch(() => setError(true));
  }, []);

  if (error) {
    return <p className="text-sm text-destructive">{t('shop.error.loading')}</p>;
  }
  if (rows === null) {
    return <p className="text-sm text-muted-foreground">…</p>;
  }
  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('shop.account.empty')}
        </p>
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium hover:underline"
        >
          {t('shop.account.backToConfigurator')}
        </Link>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('shop.account.col.id')}</TableHead>
          <TableHead>{t('shop.account.col.status')}</TableHead>
          <TableHead className="text-right">
            {t('shop.account.col.total')}
          </TableHead>
          <TableHead>{t('shop.account.col.submittedAt')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-mono text-xs">
              <Link
                href={`/shop/account/orders/${row.id}`}
                className="hover:underline"
              >
                {row.id.slice(0, 8)}
              </Link>
            </TableCell>
            <TableCell>
              <OrderStatusBadge status={row.status} />
            </TableCell>
            <TableCell className="text-right">
              {formatCents(row.totalCents, row.currency)}
            </TableCell>
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
git add src/components/shop/ClientOrdersTable.tsx
git commit -m "feat(shop): add ClientOrdersTable fetching own orders list"
```

### Task 14: `/shop/(authed)/account/page.tsx`

**Files:**
- Create: `src/app/shop/(authed)/account/page.tsx`

- [ ] **Step 1: Write the page**

Create `src/app/shop/(authed)/account/page.tsx`:

```tsx
import { ClientOrdersTable } from '@/components/shop/ClientOrdersTable';
import { t } from '@/lib/i18n';

export default function ShopAccountPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('shop.account.title')}</h1>
      <ClientOrdersTable />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/shop/\(authed\)/account/page.tsx
git commit -m "feat(shop): add /shop/account page rendering ClientOrdersTable"
```

---

## Wave 6 — Order detail page

### Task 15: Build `ClientOrderDetail`

**Files:**
- Create: `src/components/shop/ClientOrderDetail.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/shop/ClientOrderDetail.tsx`:

```tsx
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { OrderStatusBadge } from '@/components/admin/OrderStatusBadge';
import { OrderQuoteTable } from '@/components/admin/OrderQuoteTable';
import { t } from '@/lib/i18n';
import type {
  OrderQuoteSnapshot,
  OrderStatus,
} from '@/domain/orders';

interface Props {
  order: {
    id: string;
    status: OrderStatus;
    contactName: string;
    contactEmail: string;
    contactPhone: string | null;
    notes: string | null;
    quoteSnapshot: OrderQuoteSnapshot;
    submittedAt: string | null;
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('nl-BE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function ClientOrderDetail({ order }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/shop/account"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('shop.order.backLink')}
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">
            {t('shop.order.title', { id: order.id.slice(0, 8) })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('shop.order.submittedAt', {
              date: formatDate(order.submittedAt),
            })}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('shop.order.section.quote')}</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderQuoteTable snapshot={order.quoteSnapshot} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('shop.order.section.contact')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>{order.contactName}</div>
          <div>
            <a
              href={`mailto:${order.contactEmail}`}
              className="text-foreground hover:underline"
            >
              {order.contactEmail}
            </a>
          </div>
          {order.contactPhone && <div>{order.contactPhone}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('shop.order.section.notes')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm whitespace-pre-wrap">
          {order.notes ?? (
            <span className="text-muted-foreground italic">
              {t('shop.order.noNotes')}
            </span>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">{t('shop.order.nextSteps')}</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shop/ClientOrderDetail.tsx
git commit -m "feat(shop): add ClientOrderDetail server component"
```

### Task 16: `/shop/(authed)/account/orders/[id]/page.tsx`

**Files:**
- Create: `src/app/shop/(authed)/account/orders/[id]/page.tsx`

- [ ] **Step 1: Write the page**

Create `src/app/shop/(authed)/account/orders/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { auth } from '@/lib/auth';
import { ClientOrderDetail } from '@/components/shop/ClientOrderDetail';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ShopOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) notFound();

  const [row] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.customerId, session.user.id)))
    .limit(1);

  if (!row) notFound();

  return (
    <ClientOrderDetail
      order={{
        id: row.id,
        status: row.status,
        contactName: row.contactName,
        contactEmail: row.contactEmail,
        contactPhone: row.contactPhone,
        notes: row.notes,
        quoteSnapshot: row.quoteSnapshot,
        submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
      }}
    />
  );
}
```

Rationale for fetching inline instead of going through `GET /api/shop/orders/[id]`: this is a server component inside the session-guarded layout; hitting our own HTTP endpoint from a server component is an extra round-trip with no benefit. The API endpoint remains useful for future client-side refetching.

- [ ] **Step 2: Commit**

```bash
git add src/app/shop/\(authed\)/account/orders/\[id\]/page.tsx
git commit -m "feat(shop): add /shop/account/orders/[id] page with ownership-scoped fetch"
```

---

## Wave 7 — Configurator branded shell integration

### Task 17: Wrap the configurator root in `<BrandedShell variant="configurator">`

**Files:**
- Modify: `src/app/(configurator)/page.tsx`

- [ ] **Step 1: Refactor the page**

The configurator's `page.tsx` currently returns a client-rendered tree with `<div className="relative h-dvh flex">…</div>`. We need to wrap it in the branded shell while preserving the full-viewport canvas behaviour. The shell's `configurator` variant already uses `h-dvh` on its outer container and renders `<main className="flex-1 relative min-h-0">{children}</main>` so the canvas `relative` container still fills the remaining space.

Because `BrandedShell` is async (reads headers + DB), we need a small server-component file wrapping the existing client page. Rename / refactor:

1. Change `src/app/(configurator)/page.tsx` to a server component that renders `<BrandedShell variant="configurator"><ConfiguratorClient /></BrandedShell>`.
2. Move the existing client UI into a NEW file `src/components/canvas/ConfiguratorClient.tsx` (so the client boundary is explicit).

Step-by-step:

First, create `src/components/canvas/ConfiguratorClient.tsx` with the body of the existing client page (minus the top-level `'use client'` page wrapper — we'll add it in the new file):

```tsx
'use client';

import dynamic from 'next/dynamic';
import Sidebar from '@/components/ui/ConfiguratorSidebar';
import SchematicView from '@/components/schematic/SchematicView';
import { useUIStore } from '@/store/useUIStore';
import { t } from '@/lib/i18n';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useGPUQuality } from '@/hooks/useGPUQuality';

const BuildingScene = dynamic(
  () => import('@/components/canvas/BuildingScene'),
  { ssr: false },
);

function ViewToggle() {
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const selectedElement = useUIStore((s) => s.selectedElement);
  const selectElement = useUIStore((s) => s.selectElement);
  const isElevationMode = selectedElement?.type === 'wall';

  return (
    <div className="flex items-center gap-2">
      {isElevationMode && (
        <div className="bg-background/80 backdrop-blur-xl rounded-xl shadow-md ring-1 ring-black/[0.08] p-1">
          <button
            onClick={() => selectElement(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-foreground/60 hover:text-foreground/80 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="8" x2="4" y2="8" />
              <polyline points="8 4 4 8 8 12" />
            </svg>
            {t('view.backToFloorplan')}
          </button>
        </div>
      )}
      <div className="flex gap-1 bg-background/80 backdrop-blur-xl rounded-xl shadow-md ring-1 ring-black/[0.08] p-1">
        <button
          onClick={() => { if (isElevationMode) selectElement(null); setViewMode('plan'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            viewMode === 'plan' && !isElevationMode
              ? 'bg-foreground text-background shadow-sm'
              : 'text-foreground/60 hover:text-foreground/80'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="1" width="14" height="14" rx="1" />
            <line x1="6" y1="1" x2="6" y2="15" />
            <line x1="6" y1="8" x2="15" y2="8" />
          </svg>
          2D
        </button>
        <button
          onClick={() => { if (isElevationMode) selectElement(null); setViewMode('split'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            viewMode === 'split'
              ? 'bg-foreground text-background shadow-sm'
              : 'text-foreground/60 hover:text-foreground/80'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="1" width="14" height="14" rx="1" />
            <line x1="8" y1="1" x2="8" y2="15" />
          </svg>
          Split
        </button>
        <button
          onClick={() => { if (isElevationMode) selectElement(null); setViewMode('3d'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            viewMode === '3d'
              ? 'bg-foreground text-background shadow-sm'
              : 'text-foreground/60 hover:text-foreground/80'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1L14.5 4.75V11.25L8 15L1.5 11.25V4.75L8 1Z" />
            <path d="M8 15V8" />
            <path d="M14.5 4.75L8 8L1.5 4.75" />
          </svg>
          3D
        </button>
      </div>
    </div>
  );
}

export default function ConfiguratorClient() {
  useUndoRedo();
  useGPUQuality();
  const viewMode = useUIStore((s) => s.viewMode);

  // Note the switch from `h-dvh flex` to `h-full flex` — the branded
  // shell's <main> provides the remaining-viewport sizing. Using h-dvh
  // here would double-count the header and cause vertical overflow.
  return (
    <div className="relative h-full flex">
      {viewMode === 'split' ? (
        <>
          <div className="w-1/2 relative border-r border-black/10">
            <div className="absolute inset-0 bg-white">
              <SchematicView />
            </div>
            <div className="absolute top-3 left-3 z-20">
              <ViewToggle />
            </div>
          </div>
          <div className="flex-1 relative">
            <div className="absolute inset-0">
              <BuildingScene />
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 relative">
          {viewMode === '3d' && (
            <div className="absolute inset-0">
              <BuildingScene />
            </div>
          )}
          {viewMode === 'plan' && (
            <div className="absolute inset-0 bg-white">
              <SchematicView />
            </div>
          )}
          <div className="absolute top-3 left-3 z-20">
            <ViewToggle />
          </div>
        </div>
      )}
      <Sidebar />
    </div>
  );
}
```

Then REPLACE `src/app/(configurator)/page.tsx` with a server component:

```tsx
import { BrandedShell } from '@/components/shop/BrandedShell';
import ConfiguratorClient from '@/components/canvas/ConfiguratorClient';

export default function Home() {
  return (
    <BrandedShell variant="configurator">
      <ConfiguratorClient />
    </BrandedShell>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`

Expected: clean.

- [ ] **Step 3: Dev-server smoke test — canvas still fills the viewport**

Run: `pnpm dev`

Open `http://localhost:3000/`. Verify:

1. A header bar with the Assymo logo + displayName appears at the top. Height ~56 px (the `h-14` class).
2. Below the header, the canvas + sidebar occupy the entire remaining viewport down to the bottom edge — no footer visible in `configurator` variant.
3. Switching between 2D / Split / 3D still works without vertical overflow or visible scrollbars.
4. Dragging an object still works (drag from sidebar → canvas).
5. Browser devtools: the `<html>` should show an injected `<style>:root{--brand-primary:#1f2937;--brand-accent:#0ea5e9;}</style>` in the head (or at the top of `<body>`).

If the canvas overflows, or the header overlaps the canvas, the most likely cause is the `h-dvh` vs `h-full` change in `ConfiguratorClient.tsx`. Revisit Step 1.

Stop the dev server with `Ctrl-C` once the golden path works.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(configurator\)/page.tsx src/components/canvas/ConfiguratorClient.tsx
git commit -m "feat(configurator): wrap root in BrandedShell (tenant header, CSS vars)"
```

### Task 18: Document the CSS vars in globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add a documentation comment at the top of the file**

Open `src/app/globals.css`. Find the first `@import` or `@theme` line. Insert the following comment block ABOVE it:

```css
/* Tenant brand CSS variables (--brand-primary, --brand-accent) are
 * injected at request time by <BrandedShell> from the resolved tenant's
 * `branding` jsonb. They are NOT declared here — BrandedShell writes an
 * inline :root block ahead of children. Consumers use them via
 * Tailwind arbitrary values, e.g. `text-[var(--brand-primary)]`. */
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "docs(globals.css): note where brand CSS vars come from"
```

---

## Wave 8 — Verify, document, ship

### Task 19: Full test + build sweep

**Files:** none (verification only)

- [ ] **Step 1: Tests**

Run: `pnpm test`

Expected: all green, including the new `tenant-cssVars.test.ts` (+6 cases) and the new `shop.*` i18n case. Tally should be Phase-3 baseline (184) + 7 new = 191+.

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`

Expected: no new errors.

- [ ] **Step 3: Build**

Run: `pnpm build`

Expected: clean. New routes: `/shop/sign-in`, `/shop/account`, `/shop/account/orders/[id]`, `/api/shop/orders` (now GET+POST), `/api/shop/orders/[id]`. All 17 existing routes still build.

- [ ] **Step 4: Lint sanity**

Run: `pnpm lint`

Expected: no NET-new errors versus `main`. Pre-existing warnings are out of scope.

If any of these fail, fix the failure here — do NOT proceed to docs.

- [ ] **Step 5: End-to-end smoke test**

Pre-flight: Phase 3 merged already, orders table populated with at least one test order.

```bash
pnpm dev
```

Open `http://localhost:3000/`. Perform the Phase 2–4 chain end-to-end:

1. **Configurator:** drag an object onto the canvas, click "In winkelmandje", fill the form with a NEW email (not already in the `user` table), submit.
2. **Magic link:** copy the link from the dev terminal (it should point at `http://localhost:3000/shop/account/orders/<orderId>` because that's the callbackURL Phase 2 sets).
3. **Land on `/shop/account/orders/<orderId>`:** the page should render the branded shell header, order ID, status badge "Ingediend", quote snapshot table, contact card, notes, and the "next steps" copy.
4. **Click "← Terug naar mijn bestellingen":** you should land on `/shop/account` with exactly one row in the orders table.
5. **Click the row's ID:** back to detail.
6. **Sign out** (via the header dropdown when implemented — Phase 4 keeps it minimal; sign-out is via the Better Auth client or clearing cookies). Alternative: open a new private window.
7. **Visit `/shop/account` anonymously:** bounces to `/shop/sign-in`.
8. **Submit the sign-in form with the same email:** check dev terminal for a generic sign-in magic link; follow it; land back on `/shop/account`.
9. **As a business user (different browser),** visit `/shop/sign-in` → bounces to `/admin`. Visit `/shop/account` → bounces to `/admin`.

If any of 1–9 fail, fix before moving on. Do not proceed to docs if the golden path is broken.

Stop the dev server with `Ctrl-C`.

### Task 20: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Extend the `src/app/api/shop/*` block with the new GET endpoints**

In the existing `src/app/api/shop/*` bullet, append under the `POST /api/shop/orders` description:

```markdown
  - `GET /api/shop/orders` — client-only (`requireClient`), returns
    the caller's own orders newest-first.
  - `GET /api/shop/orders/[id]` — client-only, strictly scoped to
    `customerId === session.user.id`. Returns 404 for both "not
    found" and "not yours" to avoid leaking existence of another
    client's order.
```

- [ ] **Step 2: Add a new "Routes — shop tree" subsection**

Directly below the existing `src/app/admin/` bullet and above the "Reserved top-level route segments for `shop/`…" line, add:

```markdown
- `src/app/shop/` — client account tree. Mirrors admin's split: a
  sibling `sign-in/` (unauthenticated-only guard that bounces already-
  signed-in users) and an `(authed)` group with a session guard that
  redirects business users to `/admin`. The `(authed)` layout wraps in
  `<BrandedShell variant="shop">` + a `<Toaster />`. Pages:
  - `/shop/sign-in` — magic-link form, `callbackURL=/shop/account`.
  - `/shop/account` — client's own orders list.
  - `/shop/account/orders/[id]` — single order detail (quote snapshot
    + status + contact + notes), ownership-scoped at server render.
```

Delete the `- Reserved top-level route segments for `shop/`, more `api/*`` bullet — the tree is no longer reserved.

- [ ] **Step 3: Add a "Branded shell" subsection**

Immediately after the "Configurator submit flow" subsection, insert:

```markdown
## Branded shell

Every public-facing route (`/`, `/shop/*`) renders inside
`<BrandedShell>` (in `src/components/shop/BrandedShell.tsx`). The shell:

1. Resolves the tenant from the `Host` header via
   `resolveTenantByHostOrDefault` (same path as the root layout).
2. Resolves the current session so the header can render an
   account/sign-in link.
3. Converts `branding.primaryColor` + `branding.accentColor` to a
   `:root { --brand-primary: …; --brand-accent: …; }` block via
   `brandingToCssVars` + `cssVarsToInlineBlock` (pure, in
   `@/domain/tenant/cssVars`) and injects it via
   `dangerouslySetInnerHTML`. Safe because branding colours pass
   through `validateBrandingPatch` before being stored.
4. Renders `<ShopHeader>` + `{children}` + `<ShopFooter>` (the
   `configurator` variant drops the footer so the canvas owns the
   viewport).

The configurator canvas itself stays unbranded — only the wrapper
varies. Tenant-specific accents (future) should use
`bg-[var(--brand-primary)]` / `text-[var(--brand-accent)]` so admins
can recolour without touching component code.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): add /shop tree + branded shell docs (Phase 4)"
```

### Task 21: Tick `[x] Phase 4` in the spec

**Files:**
- Modify: `docs/superpowers/specs/2026-04-17-platform-architecture-design.md`

This is the LAST task — only tick the box once everything is merged. If the merge happens later, do this step in the same PR so docs and code stay in lockstep.

- [ ] **Step 1: Update the Progress section**

In the `## Progress` block at the bottom of the spec, change:

```markdown
- [ ] Phase 4 — Webshop shell + client account
  - [ ] Phase 4.5 — Material catalog filtering
```

to:

```markdown
- [x] Phase 4 — Webshop shell + client account — [plan](../plans/2026-04-21-phase-4-webshop-shell.md)
  - [ ] Phase 4.5 — Material catalog filtering
```

Keep the Phase 4.5 child box unticked — it is a separate future plan.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-17-platform-architecture-design.md
git commit -m "docs(spec): tick [x] Phase 4 — Webshop shell + client account"
```

### Task 22: Merge

- [ ] **Step 1: Push the branch (or prepare the local merge)**

```bash
git push -u origin phase-4-webshop-shell
```

- [ ] **Step 2: Open a PR (or merge locally matching Phase 2/3 pattern)**

```bash
gh pr create --title "Phase 4 — Webshop shell + client account" --body "$(cat <<'EOF'
## Summary
- New pure `src/domain/tenant/cssVars.ts` — `brandingToCssVars` + `cssVarsToInlineBlock`, fully unit-tested.
- `TenantContext` now carries the `branding` the DB row already provided.
- New `<BrandedShell>` server component wraps every public-facing route (configurator + /shop) with tenant logo header, CSS-var injection, and (shop variant) a contact/VAT footer.
- New `/shop` tree: `/shop/sign-in` (magic-link), `/shop/account` (own orders list), `/shop/account/orders/[id]` (order detail with quote snapshot + contact).
- New shop API: `GET /api/shop/orders` + `GET /api/shop/orders/[id]`, both `requireClient` + ownership-scoped.
- Dutch i18n block `shop.*` covering sign-in, account, and order detail copy.
- `CLAUDE.md` documents the /shop tree + the branded-shell architecture.

Closes Phase 4 of `docs/superpowers/specs/2026-04-17-platform-architecture-design.md`. Phase 4.5 (material catalog) is a separate future plan.

## Test plan
- [ ] `pnpm test` — green (Phase 3 baseline + new cssVars + shop i18n cases).
- [ ] `pnpm exec tsc --noEmit` — clean.
- [ ] `pnpm build` — clean.
- [ ] Golden path: configurator submit → follow magic link → land on /shop/account/orders/<id> → see order detail with tenant branding.
- [ ] /shop/account lists the new order; detail round-trip works.
- [ ] Anonymous visit to /shop/account bounces to /shop/sign-in; business user visit bounces to /admin.
- [ ] Configurator canvas still fills the viewport (no scrollbars) below the tenant header.
EOF
)"
```

Merge once green.

---

## Self-Review Notes (run BEFORE handing off)

- **Spec coverage:** Every Phase 4 deliverable in the spec maps to at least one task. Tenant-branded layout on `/` → T17 (+T1 for the context field). `/shop/sign-in` → T10 + T11. `/shop/account` + orders list → T13 + T14. `/shop/account/orders/[id]` → T15 + T16. Supporting infra: CSS vars (T3 + T4), shell components (T7 + T8 + T9), shop API (T5 + T6), i18n (T2), docs (T20), spec progress (T21). Phase 4.5 (material catalog) is explicitly deferred per the spec.
- **Scope guardrails:** No invoice surface (Phase 5 — the order detail shows quote snapshot + status only, never a payment status). No cart persistence. No custom per-tenant email templates. No material catalog UI.
- **Type consistency:** `Branding` (existing) is used by `TenantContext` (T1), `ShopHeader` (T7), `ShopFooter` (T8), `BrandedShell` (T9), and `brandingToCssVars` (T4). `OrderStatus` comes from `@/domain/orders` and is shared by `ClientOrdersTable` (T13) and `ClientOrderDetail` (T15). The shop `OrderRecord` view is inlined locally in T15's props interface because the client surface only needs a subset of fields (`customerId`/`tenantId`/`code` are irrelevant for the detail page).
- **No placeholders:** every code-bearing step shows complete code. Step 3 of Task 5 concedes a minor "if linter flags `and` as unused, drop it" — this is a concrete instruction with a fallback, not a placeholder.
- **Framework boundaries:** `src/domain/tenant/cssVars.ts` has zero framework imports. Branding validation + normalisation stays in `@/domain/tenant/branding` (pre-existing). The shell + header + footer are server components; only `ClientOrdersTable` is marked `'use client'` because it needs `useEffect` + fetch.
- **Auth guard reuse:** all three Shop endpoints go through `withSession` + `requireClient` (unchanged from their Phase 1 signatures). The ownership check is a plain `and(eq(orders.customerId, session.user.id), eq(orders.id, id))` instead of a new helper — YAGNI; extract a helper only when a third endpoint needs the same pattern.
- **Risk surface — Wave 7 is the riskiest change:** splitting the configurator page and swapping `h-dvh` for `h-full` inside the client. Task 17 Step 3 includes an explicit manual smoke-test step that verifies canvas behaviour before allowing Wave 7 to commit.
