# Assymo Configurator

Interactive 3D configurator for Assymo garden structures — overkapping (open carport), berging (closed shed), paal (standalone pole), and muur (standalone wall). Produces a live 3D view + 2D floor plan, computes a price quote, and encodes the scene into a shareable base58 code. Being prepared for a white-label rollout with upcoming API, admin, and webshop surfaces.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19
- React Three Fiber + drei + postprocessing (3D canvas)
- Zustand + zundo (state + undo/redo)
- Tailwind v4, shadcn, radix-ui, lucide-react
- Neon Postgres + Drizzle ORM + `@neondatabase/serverless` (HTTP driver)
- Better Auth (email+password + magic link via Resend); users carry `userType: 'business' | 'client'`, with `/api/admin/*` requiring `userType=business`
- Vite+ (test runner only — does NOT replace Next's bundler)

## Package Manager

pnpm. Not npm, not yarn. `package-lock.json` is not tracked.

## Commands

- `pnpm dev` — Next dev server
- `pnpm build` — production build
- `pnpm test` — run the Vitest suite once via Vite+
- `pnpm test:watch` — watch mode
- `pnpm lint` — ESLint (Next's config)
- `pnpm db:generate` — generate a new migration from `src/db/schema.ts`
- `pnpm db:migrate` — apply pending migrations to Neon (uses unpooled URL)
- `pnpm db:push` — dev-only: push schema without a migration file
- `pnpm db:studio` — open Drizzle Studio against Neon
- `pnpm db:seed` — idempotent seed for the `assymo` tenant; also seeds `materials` rows and (when `BLOB_READ_WRITE_TOKEN` is set) uploads texture files to Vercel Blob

## Architecture

Three layers, strictly separated:

### `src/domain/` — framework-free

Pure TypeScript. No React, no three.js, no zustand. Safe to import from API routes, admin pages, and the future webshop without pulling a browser runtime.

- `building/` — entity types (`BuildingEntity`, `WallConfig`, `RoofConfig`, `SnapConnection`), geometric constants, snap detection, opening geometry helpers
- `config/` — the canonical `ConfigData` contract + versioning (`CONFIG_VERSION`), base58 codec, `migrateConfig` for legacy input, pure `mutations.ts` (used by stores and future API), `validateConfig` returning stable error codes
- `pricing/` — `PriceBook` (per-tenant scalar dials) + `calculateTotalQuote`; line items are structured `{ labelKey, labelParams }` so UIs format labels at render time
- `orders/` — pure order types (`OrderStatus`, `OrderQuoteSnapshot`, `OrderConfigSnapshot`, `OrderRecord`), state machine (`ALLOWED_TRANSITIONS`, `validateOrderTransition`, `allowedNextStatuses`), and `buildQuoteSnapshot` / `buildConfigSnapshot` for freezing the priced quote + ConfigData at submit time
- `catalog/` — per-tenant material + product catalog types + validators (`MaterialRow`, `ProductRow`, `validateMaterialCreate/Patch`, `validateProductCreate/Patch`, `applyProductDefaults`, `filterMaterialsForProduct`, `clampDimensions`, slug helpers). Products are starter kits built on `overkapping` / `berging`; `paal` + `muur` stay engine primitives. Consumed by admin + shop API routes, the configurator hydration logic, and `TenantContext.catalog.{materials, products}`.
- `materials/` — per-category view types (`WallCatalogEntry` etc.), row→view converters (`buildWallCatalog` …), `getAtom`, `getAtomColor`, `getEffectiveWallMaterial`, `getEffectiveDoorMaterial`. All helpers take `MaterialRow[]` — framework-free, zero global state. Hardcoded material registry removed in Phase 5.5.1; DB-backed catalog is the single source of truth.
- `tenant/` — `TenantContext` with `priceBook` + `branding` + `invoicing` + `catalog: { materials: MaterialRow[], products: ProductRow[] }`; host-based resolver; `brandingToCssVars` + `cssVarsToInlineBlock` for the branded shell; `validateBrandingPatch`, `validateInvoicingPatch` for admin PATCH validation. Phase 4.5's `enabledMaterials` allow-list was absorbed by row ownership in the `materials` table.
- `invoicing/` — pure numbering (`formatInvoiceNumber`), VAT math (`computeInvoiceAmounts`), payment-status derivation (`derivePaymentStatus`), supplier-snapshot builder, and patch validators (`validateIssueInvoiceInput`, `validatePaymentInput`). All framework-free; consumed by the admin API + PDF renderer.

### `src/lib/` — browser-coupled

React contexts, three.js textures, client-only hooks, i18n. Keep framework-coupled code here, not in `domain/`.

### `src/store/`

- `useConfigStore` — persisted `ConfigData` only (buildings, connections, roof, defaultHeight) wrapped in `temporal` (undo/redo). Actions delegate to `@/domain/config/mutations.ts`.
- `useUIStore` — ephemeral UI (view mode, sidebar tab/collapsed, selection, drag state, camera target, quality tier). Not undoable, not persisted.
- `selectors.ts` — cross-store hooks (`useSelectedBuilding`, etc.)

### `src/db/`

- `schema.ts` — Drizzle table definitions for domain tables. `schema.ts` gained a `materials` table (per-tenant catalog rows; unique on `(tenant_id, category, slug)`; soft-delete via `archived_at`). `tenants.enabled_materials` was dropped — row ownership replaces allow-listing. Also gained a `products` table in Phase 5.5.2 — per-tenant starter kits with `kind` (`overkapping | berging`), `defaults` + `constraints` jsonb, hero image, base price, sort order, soft-delete via `archived_at`, unique on `(tenant_id, slug)`. `tenants`
  holds the seeded per-brand context (`priceBook`, `branding`, `invoicing` as jsonb); `configs`
  holds saved scenes with their base58 `code` and the canonical
  `ConfigData` in `data`; `tenant_hosts` maps request hosts to tenants
  (hostname PK, tenantId FK with cascade delete). `orders` rows freeze
  the priced quote (`quoteSnapshot`) and the ConfigData (`configSnapshot`)
  at submit time so each order is re-renderable years later regardless
  of price-book or migration drift; `customerId` is nullable until the
  client claims their magic-link account, and `configId` cascades to
  NULL if the source config row is later GC'd.
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
- `resolveTenant.ts` — DB-backed tenant resolver. `resolveTenantByHost`
  tries exact host, bare host (no port), and the leftmost subdomain
  label against `tenant_hosts`. Wrapped in React `cache()` so the
  root layout + any API routes in the same request share one query.
  Also exports `getTenantMaterials(tenantId)` + `getTenantProducts(tenantId)` (both cached) and `materialDbRowToDomain(row)` + `productDbRowToDomain(row)`; the root layout passes both lists into `TenantProvider` as `catalog.{materials, products}`.
- `auth-schema.ts` — generated by Better Auth's CLI. Re-run
  `npx @better-auth/cli generate --config src/lib/auth.ts --output src/db/auth-schema.ts`
  after changing `src/lib/auth.ts` (additionalFields, plugins). Holds
  `user`, `session`, `account`, `verification`. User has a nullable
  `tenantId` and a `role` of `super_admin | tenant_admin`.
- `client.ts` — Drizzle client wired to Neon HTTP. Merges both schemas
  so a single `db` instance covers everything. Imported by route
  handlers; not used in RSC layouts (tenant layout resolver stays in
  the in-memory `@/domain/tenant` registry for now).
- `migrations/` — committed SQL. Never edit a migration by hand after
  it's applied in any environment; write a follow-up migration instead.
- `seed.ts` — idempotent upsert of the `assymo` tenant from `DEFAULT_PRICE_BOOK`, its host aliases, and every entry in `seedData.ts` as a `materials` row. When `BLOB_READ_WRITE_TOKEN` is present it uploads texture files from `public/textures/` via `@vercel/blob` and stores the returned URLs on each row; missing token = textures left null with a warning. Also seeds two example products for the assymo tenant (Standaard Overkapping 4×3, Standaard Berging 3×3) on first run; subsequent runs are idempotent.
- `seedData.ts` — one-time migration bridge carrying the pre-Phase-5.5.1 atoms + per-object catalogs as a static `SeedMaterialInput[]`. Consumed only by `seed.ts`. Slated for deletion once every environment has seeded (5.5.3 cleanup).

### Routes

- `/` renders a tenant-branded landing page with a product grid + "Bouw van nul" tile (falls through to `/configurator` when the tenant has zero products). `/configurator` renders the 3D configurator; `/configurator?product=<slug>` hydrates one building from the product's defaults on first mount. The route group `src/app/(configurator)/` now lives under `/configurator`.
- `src/app/api/configs/` — `POST` (save a share code) + `GET [code]`
  (fetch decoded config + priced quote). Both resolve the tenant via
  `src/lib/apiTenant.ts`, which combines the host-based resolver with
  the `tenants` DB row.
- `src/app/api/auth/[...all]/` — Better Auth catch-all handler.
  Client helpers in `src/lib/auth-client.ts`; server config in
  `src/lib/auth.ts`. In dev, magic links log to the server console
  when `RESEND_API_KEY` is empty; set the key to actually send.
- `src/app/api/admin/*` — authenticated admin API. All routes go
  through `withSession` from `@/lib/auth-session` and check role via
  `requireRole` / tenant scope via `requireTenantScope` (both in
  `@/lib/auth-guards`, which is framework-free and tested alone).
  Current endpoints:
  - `GET  /api/admin/tenants/current` — any authenticated session
  - `GET /api/admin/tenants` — super_admin only; list all tenants
  - `GET /api/admin/tenants/[id]` — super_admin only; fetch single tenant
  - `POST /api/admin/tenants` — super_admin only; creates the tenant
    row + any supplied host mappings in one request
  - `GET/POST /api/admin/tenants/[id]/hosts` — super_admin any,
    tenant_admin own; list and add host mappings
  - `DELETE /api/admin/tenants/[id]/hosts/[hostname]` — super_admin any,
    tenant_admin own; remove a host mapping
  - `PATCH /api/admin/tenants/[id]/price-book` — super_admin any,
    tenant_admin own; validates against `validatePriceBookPatch` and
    merges over the stored jsonb
  - `PATCH /api/admin/tenants/[id]/branding` — super_admin any,
    tenant_admin own; update tenant branding (displayName, colors, logo)
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
  - `GET /api/admin/users` — list business users in scope
  - `POST /api/admin/users` — super_admin can create any user in any
    tenant at any role; tenant_admin is pinned to its own tenant and
    can't grant super_admin. Creates the row with `emailVerified=true`
    and best-effort fires a magic link.
  - `GET /api/admin/orders` — super_admin all, tenant_admin own;
    list orders newest-first
  - `GET /api/admin/orders/[id]` — scoped detail (joined with customer)
  - `PATCH /api/admin/orders/[id]/status` — validated transition via
    `validateOrderTransition` from `@/domain/orders`
  - `GET /api/admin/clients` — list `userType='client'` users in scope
  - `GET /api/admin/clients/[id]` — client detail + their orders
  - `GET|POST /api/admin/materials` + `GET|PATCH|DELETE /api/admin/materials/[id]` + `POST /api/admin/materials/[id]/restore` — per-tenant material CRUD; soft-delete preserves historical orders. `super_admin` may scope via `?tenantId=` query.
  - `POST /api/admin/uploads/textures` — Vercel Blob signed-upload endpoint; `@vercel/blob/client.handleUpload`; upload paths namespaced `textures/<tenantId>/…`.
  - `GET|POST /api/admin/products` + `GET|PATCH|DELETE /api/admin/products/[id]` + `POST /api/admin/products/[id]/restore` + `PATCH /api/admin/products/reorder` — per-tenant product CRUD + bulk reorder. super_admin may scope via `?tenantId=`.
  - `POST /api/admin/uploads/images` — Vercel Blob signed-upload endpoint for hero images; paths namespaced `images/<tenantId>/…`.
- `src/app/api/shop/*` — public + client-facing API.
  - `POST /api/shop/orders` — public, host-scoped. Takes
    `{ code, contact: { email, name, phone?, notes? } }`, snapshots the
    priced quote via `buildQuoteSnapshot`, auto-creates (or reuses) a
    `client` user keyed by email, and fires Better Auth's magic link
    with `callbackURL=/shop/account/orders/<id>`. The `sendMagicLink`
    callback in `src/lib/auth.ts` branches on that prefix and
    dispatches the order-confirmation template
    (`src/lib/orderConfirmationEmail.ts`) so the magic link rides
    inside the order email. The configurator's "In winkelmandje"
    dialog (see "Configurator submit flow" below) calls this endpoint
    as the second leg of a two-POST chain: `POST /api/configs` first,
    then `POST /api/shop/orders` with the returned code.
  - `GET /api/shop/orders` — client-only (`requireClient`), returns
    the caller's own orders newest-first.
  - `GET /api/shop/orders/[id]` — client-only, strictly scoped to
    `customerId === session.user.id`. Returns 404 for both "not
    found" and "not yours" to avoid leaking existence of another
    client's order.
  - `GET /api/shop/invoices/[id]` — client-only, scoped to the order's
    `customerId === session.user.id`. Returns 404 for both "not found"
    and "not yours".
  - `GET /api/shop/products` — unauthenticated, host-scoped list of non-archived products (feeds the `/` landing grid).
  - `GET /api/shop/products/[slug]` — unauthenticated detail-by-slug (for deep-linking into the configurator).
- `src/app/api/invoices/[id]/pdf/` — `GET` streams `application/pdf`.
  Session-scoped: business-side requires `super_admin` OR `tenant_admin`
  with matching `invoice.tenantId`; client-side requires
  `order.customerId === session.user.id`. 404 on any scope mismatch.
  Rendered on-demand via `@react-pdf/renderer` and
  `src/lib/renderInvoicePdf.tsx`; not cached.
- `src/app/admin/` — business management UI. Split into a `(authed)` route
  group (session-guarded shell, all real pages live here) and a sibling
  `sign-in/` (no guard so the magic-link form can render). The `(authed)`
  layout wraps in `AdminHeaderProvider` + `SidebarProvider`, renders the
  sidebar, header, content, and a bottom-mounted `<Toaster />`. The
  authed tree now also ships `/admin/invoices` (list + detail) and
  `/admin/catalog/materials` — list + create + edit pages using stock shadcn Table + Form. Texture uploads via `@vercel/blob/client.upload` → `/api/admin/uploads/textures`.
  - `/admin/catalog/products` — list (dnd-kit sortable), create, edit. Forms include dimensions + per-slot defaults + per-slot allow-list multi-selects + hero-image upload.
- `src/app/shop/` — client account tree. Mirrors admin's split: a
  sibling `sign-in/` (unauthenticated-only guard that bounces already-
  signed-in users) and an `(authed)` group with a session guard that
  redirects business users to `/admin`. The `(authed)` layout wraps in
  `<BrandedShell variant="shop">` + a `<Toaster />`. Pages:
  - `/shop/sign-in` — magic-link form, `callbackURL=/shop/account`.
  - `/shop/account` — client's own orders list.
  - `/shop/account/orders/[id]` — single order detail (quote snapshot
    + status + contact + notes), ownership-scoped at server render.
  - `/shop/account/invoices/[id]` — invoice detail (supplier snapshot
    + amounts + derived status + "PDF downloaden" link). Ownership-scoped
    at server render.
- `src/app/layout.tsx` resolves the tenant from the `host` header
  against the in-memory registry and wraps in `<TenantProvider>`

## Admin UI patterns

- **Shadcn primitives in their NATIVE form.** Never restyle button/dialog/
  sidebar/etc. Add new primitives via `pnpm dlx shadcn@latest add [name]`.
  Animations come from `tw-animate-css` (imported in `globals.css`).
- **Drag reorder:** `@dnd-kit/core` + `@dnd-kit/sortable` (+ `@dnd-kit/utilities`) are sanctioned non-shadcn deps used only for drag-reorder of table rows (e.g. `/admin/catalog/products`). Import via the standard shadcn `Table` primitives wrapped in `DndContext` + `SortableContext`.
- **Sidebar:** `src/components/admin/Sidebar.tsx` uses the shadcn `Sidebar`
  primitive with `collapsible="offcanvas"` + `<SidebarRail />`. Footer is
  the user avatar + dropdown (sign-out lives there). Nav items take a
  lucide icon and `tooltip` so they show labels when collapsed.
- **Header:** `src/components/admin/Header.tsx` is sticky (`top-0 z-10`)
  and renders `SidebarTrigger` + breadcrumb + an actions slot.
- **Header context:** `src/components/admin/AdminHeaderContext.tsx`
  provides `useAdminHeaderTitle(title)` and `useAdminHeaderActions(node)`.
  Two tiny client wrappers (`PageTitle`, `PageHeaderActions`) let server
  pages register into the header without becoming client components.
- **Breadcrumbs:** `src/components/admin/breadcrumbs.ts` holds a
  `STATIC_LABELS` route → i18n-key map. Static pages get their crumb
  automatically — DO NOT call `<PageTitle>` on them. Dynamic `[id]` pages
  register the leaf via `<PageTitle title={…} />`; the resolver chains
  the parent crumb (linked) automatically.
- **Adding a new admin page:** add the route to `STATIC_LABELS` (or rely
  on auto-chain for `[id]` pages), add a sidebar nav item, write the page
  inside `src/app/admin/(authed)/…`. Page-level CTAs go into the header
  via `<PageHeaderActions>…</PageHeaderActions>`.

## Configurator submit flow

The sidebar's "In winkelmandje" CTA (in `src/components/ui/ObjectsTab.tsx`
→ `SidebarFooter`) opens `OrderSubmitDialog`. The dialog collects
name / email / phone / notes via react-hook-form + a zod schema from
`@/domain/orders/contactForm` (messages are i18n **keys** so the schema
stays framework-free and testable).

On submit, `useSubmitOrder` (in `src/components/ui/useSubmitOrder.ts`)
chains two POSTs:

1. `POST /api/configs` with the current `encodeState()` code — persists
   the scene (idempotent per tenant+code).
2. `POST /api/shop/orders` with `{ code, contact }` — the server
   snapshots the priced quote, auto-creates (or reuses) the `client`
   user, and fires the magic-link email.

On 201, the dialog swaps to a confirmation view showing the order ID,
estimated total, and "we reach out within 1 werkdag" copy. Server
error codes (`validation_failed`, `config_not_found`, `config_invalid`,
`email_in_use_by_business`, `unknown_tenant`, `invalid_code`) plus the
client-synthesised `network` / `unknown` sentinels are mapped to
Dutch banner copy via `mapShopOrdersErrorCode` (also in
`@/domain/orders/contactForm`); `validation_failed` details are
surfaced as inline field errors.

The dialog owns the "disabled until there's at least one building"
rule via `useConfigStore(s => s.buildings.length)`. No cart
persistence — closing the dialog discards the form state. The shipped
shadcn `FormMessage` renders `error.message` verbatim, so the dialog
uses a local `TranslatedFormMessage` wrapper that runs the i18n key
through `t()`.

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

## White-label / multi-tenant

Anything that varies per brand lives on `TenantContext` — never in module-scope constants. Currently one tenant (`assymo`, seeded in `src/domain/tenant/tenants.ts`); the lookup table handles both subdomain and custom-domain mapping. When adding a feature:

- Price numbers → `priceBook` on `TenantContext`
- Material availability → `catalog.materials: MaterialRow[]` on `TenantContext`; configurator pickers read via `useTenantCatalogs()` (in `src/lib/`), which memoises per-category catalogs built from the DB-backed row list. Phase 4.5's allow-list (`enabledMaterials`) removed — row ownership in the `materials` table is the single gate.
- UI copy → i18n overlay via tenant later; for now `src/lib/i18n.ts` is the source

## Conventions

- **UI copy is Dutch** (`nl`). Keep it Dutch. Domain terminology is also Dutch (`overkapping`, `berging`, `paal`, `muur`) — don't translate.
- **i18n**: `t(key, params?)` from `@/lib/i18n`. Keys live in one big `nl` map. No inline Dutch strings in components.
- **Pricing labels**: return structured `{ labelKey, labelParams }` from pricing/validation — never pre-formatted strings. Caller runs `t()`.
- **Store splits**: config data goes in `useConfigStore`; everything transient goes in `useUIStore`. If you find yourself reaching across stores, use `src/store/selectors.ts`.
- **Testing**: tests live in `tests/` at repo root (centralised). Import from `'vite-plus/test'`. Every domain module has a spec; new domain functions should get at least a smoke test.
- **`crypto.randomUUID()`** is used for building IDs (client) and decoded window IDs — keep Node 20+ assumptions.
- **DB is source of truth** for tenants, hosts, and priceBooks. Every tenant lookup (layout, API routes, admin API) goes through `resolveTenantByHost` / `getTenantById` in `@/db/resolveTenant`. The `@/domain/tenant` folder keeps only pure host-normalization helpers and the `DEFAULT_TENANT_ID` constant — no hardcoded host map.
- **Global-unique emails across tenants.** A user belongs to exactly one tenant (`user.tenantId`). super_admins can carry `tenantId=null`.
- **Auth guards are split**: `@/lib/auth-guards` stays pure (no auth/DB imports, testable stand-alone). `@/lib/auth-session` holds the runtime-coupled `requireSession` / `withSession`.
- **Order state machine** lives in `@/domain/orders/transitions.ts`.
  Allowed transitions: `submitted → quoted | cancelled`,
  `quoted → accepted | cancelled`, `accepted → cancelled`,
  `draft → submitted | cancelled` (reserved). `cancelled` is terminal.
  All transitions go through `validateOrderTransition`; the admin
  status dropdown sources its options from `allowedNextStatuses` so
  the UI cannot offer a transition the API would reject.

## Before committing

- `pnpm test` must pass (161+ tests)
- `pnpm build` must pass
- `pnpm exec tsc --noEmit` must pass
- Lint is noisy with pre-existing warnings — net-new errors only are a blocker

## What NOT to do

- Don't import React, three, zustand, or Next into `src/domain/` — breaks server-side reuse
- Don't hardcode prices, brand names, or customer copy outside `TenantContext` / i18n
- Don't use `npm install` — use `pnpm`
- Don't replace Next's build with Vite — Vite+ is for tests only; Next owns dev/build via Turbopack
- Don't create new documentation files unless the user asks for them
