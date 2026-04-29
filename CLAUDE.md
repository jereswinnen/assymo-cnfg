# Assymo Configurator

Interactive 3D configurator for Assymo garden structures — overkapping (open carport), berging (closed shed), paal (standalone pole), and muur (standalone wall). Produces a live 3D view + 2D floor plan, computes a price quote, and assigns each saved scene a short share code (nanoid, 10 chars) for sharing. Being prepared for a white-label rollout with upcoming API, admin, and webshop surfaces.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19
- React Three Fiber + drei + postprocessing (3D canvas)
- Zustand + zundo (state + undo/redo)
- Tailwind v4, shadcn, radix-ui, lucide-react
- Neon Postgres + Drizzle ORM + `@neondatabase/serverless` (HTTP driver)
- Better Auth (email+password + magic link via Resend); users carry `kind: 'super_admin' | 'tenant_admin' | 'client'`; `/api/admin/*` requires `kind` in `['super_admin', 'tenant_admin']`; `/api/shop/*` requires `kind='client'`
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

- `building/` — entity types (`BuildingEntity`, `WallConfig`, `RoofConfig`, `SnapConnection`), geometric constants, snap detection, opening geometry helpers. `BuildingType` is `'overkapping' | 'berging' | 'paal' | 'muur' | 'poort'`; per-type metadata (footprint mode, allowed connections, tray copy) lives in the `BUILDING_KIND_META` registry in `kinds.ts` — extend the registry to add a new primitive, never branch on `type` in component code.
- `config/` — the canonical `ConfigData` contract + versioning (`CONFIG_VERSION`), `canonicalizeConfig` + SHA-256 `contentHash` for per-tenant dedup on save, `migrateConfig` for legacy input, pure `mutations.ts` (used by stores and future API), `validateConfig` returning stable error codes
- `pricing/` — `PriceBook` (per-tenant scalar dials) + `calculateTotalQuote`; line items are structured `{ labelKey, labelParams }` so UIs format labels at render time
- `orders/` — pure order types (`OrderStatus`, `OrderQuoteSnapshot`, `OrderConfigSnapshot`, `OrderRecord`), state machine (`ALLOWED_TRANSITIONS`, `validateOrderTransition`, `allowedNextStatuses`), and `buildQuoteSnapshot` / `buildConfigSnapshot` for freezing the priced quote + ConfigData at submit time
- `catalog/` — per-tenant material + product catalog types + validators (`MaterialRow`, `ProductRow`, `validateMaterialCreate/Patch`, `validateProductCreate/Patch`, `applyProductDefaults`, `filterMaterialsForProduct`, `clampDimensions`, slug helpers). `MaterialCategory` is `'wall' | 'roof-cover' | 'roof-trim' | 'floor' | 'door' | 'gate'`; the `'gate'` category was added in Phase 5.8.1 for the `poort` primitive (pricing shape: `gate.perSqm` in EUROS). `ProductKind` is `'overkapping' | 'berging' | 'poort'`; poort products carry `defaults.poort` + `constraints.poort` jsonb subobjects (parts/widths/heights/swing/motor/material-slug envelope) that hydrate a single gate primitive. `paal` + `muur` stay engine primitives without product wrappers. Consumed by admin + shop API routes, the configurator hydration logic, and `TenantContext.catalog.{materials, products}`.
- `materials/` — per-category view types (`WallCatalogEntry` etc.), row→view converters (`buildWallCatalog` …), `getAtom`, `getAtomColor`, `getEffectiveWallMaterial`, `getEffectiveDoorMaterial`. All helpers take `MaterialRow[]` — framework-free, zero global state. Hardcoded material registry removed in Phase 5.5.1; DB-backed catalog is the single source of truth.
- `tenant/` — `TenantContext` with `priceBook` + `branding` + `invoicing` + `catalog: { materials: MaterialRow[], products: ProductRow[] }` + `supplierCatalog: { suppliers: SupplierRow[], products: SupplierProductRow[] }`; host-based resolver; `brandingToCssVars` + `cssVarsToInlineBlock` for the branded shell; `validateBrandingPatch`, `validateInvoicingPatch` for admin PATCH validation. Phase 4.5's `enabledMaterials` allow-list was absorbed by row ownership in the `materials` table.
- `invoicing/` — pure numbering (`formatInvoiceNumber`), VAT math (`computeInvoiceAmounts`), payment-status derivation (`derivePaymentStatus`), supplier-snapshot builder, and patch validators (`validateIssueInvoiceInput`, `validatePaymentInput`). Also exports `VAT_RATES` (canonical Belgian set `[0, 0.06, 0.12, 0.21]`) — consumed by both the tenant invoicing form and the issue-invoice dialog's VAT picker. All framework-free.
- `supplier/` — per-tenant supplier catalog. Types (`SupplierRow`, `SupplierProductRow`), validators (`validateSupplierCreate/Patch`, `validateSupplierProductCreate/Patch`, `validateDoorMeta`, `validateWindowMeta`, `validateGateMeta`), quote line-item helpers, snapshot builder, and geometry placement validator (`validateSupplierPlacements`). `SupplierProductRow.kind` is `'door' | 'window' | 'gate'` — extensible to more kinds (shutter/skylight/etc.) by adding an enum value + meta validator, no schema migration needed. Phase 5.8.3 added the `'gate'` kind with `GateMeta` (parts/motorized tri-state/swingDirections/defaultDimensions/maxDimensions/glazing + `availableColors`/`availableLocks`/`availableHandles` option arrays). Gate placement uses a separate poort-buildings branch in `validateSupplierPlacements`: the placed gate's footprint must fit `meta.maxDimensions` (codes `gate_too_tall` / `gate_too_wide`).

### `src/lib/` — browser-coupled

React contexts, three.js textures, client-only hooks, i18n. Keep framework-coupled code here, not in `domain/`.

### `src/store/`

- `useConfigStore` — persisted `ConfigData` only (buildings, connections, roof, defaultHeight) wrapped in `temporal` (undo/redo). Actions delegate to `@/domain/config/mutations.ts`.
- `useUIStore` — ephemeral UI (view mode, sidebar tab/collapsed, selection, drag state, camera target, quality tier). Not undoable, not persisted.
- `selectors.ts` — cross-store hooks (`useSelectedBuilding`, etc.)

### `src/db/`

- `schema.ts` — Drizzle table definitions for domain tables. `schema.ts` gained a `materials` table (per-tenant catalog rows; unique on `(tenant_id, category, slug)`; soft-delete via `archived_at`). `tenants.enabled_materials` was dropped — row ownership replaces allow-listing. Also gained a `products` table in Phase 5.5.2 — per-tenant starter kits with `kind` (`overkapping | berging`), `defaults` + `constraints` jsonb, hero image, base price, sort order, soft-delete via `archived_at`, unique on `(tenant_id, slug)`. Phase 5.7 added `suppliers` (per-tenant supplier envelope, unique on `(tenant_id, slug)`, soft-delete) and `supplier_products` (polymorphic leaves — unique on `(tenant_id, kind, sku)`, `kind`='door'|'window', `meta` jsonb kind-specific, FK supplier_id RESTRICT — can't delete a supplier while products reference it). `tenants`
  holds the seeded per-brand context (`priceBook`, `branding`, `invoicing` as jsonb); `configs`
  holds saved scenes with their server-minted short `code` (nanoid from a base58 alphabet), a `content_hash` used to dedupe identical scenes per tenant, and the canonical `ConfigData` in `data`; `tenant_hosts` maps request hosts to tenants
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
  `tenantId` and a single `kind: 'super_admin' | 'tenant_admin' | 'client'` column.
  A DB CHECK constraint enforces `super_admin → tenant_id IS NULL`, while
  `tenant_admin` and `client` require `tenant_id IS NOT NULL`.
- `client.ts` — Drizzle client wired to Neon HTTP. Merges both schemas
  so a single `db` instance covers everything. Imported by route
  handlers; not used in RSC layouts (tenant layout resolver stays in
  the in-memory `@/domain/tenant` registry for now).
- `migrations/` — committed SQL. Never edit a migration by hand after
  it's applied in any environment; write a follow-up migration instead.
- `seed.ts` — idempotent first-run setup for the `assymo` tenant: inserts the tenant row with an Assymo-tuned priceBook (`DEFAULT_PRICE_BOOK` plus `poort` overrides — `motorSurcharge: 850`, `slidingSurcharge: 450`, `perLeafBase: 125`, EUROS) + hosts + branding + invoicing on first run only. Once the tenant row exists, re-runs leave it untouched — `priceBook`, `branding`, `invoicing`, `displayName` are admin-UI-owned. Other entities (gate materials `staal-antraciet`/`hout-verticaal`/`aluminium-horizontaal`, the three example products `standaard-overkapping-4x3` / `standaard-berging-3x3` / `standaard-poort-3m-enkel`, the demo supplier + its products) use skip-if-exists by `(tenant_id, slug)` / `(tenant_id, kind, sku)`, so missing rows get added on subsequent runs without touching anything else. Wall/roof/floor/door catalogs were seeded during Phase 5.5.1.

### Routes

- `/` renders a tenant-branded landing page with a product grid + "Bouw van nul" tile (falls through to `/configurator` when the tenant has zero products). `/configurator` renders the 3D configurator; `/configurator?product=<slug>` hydrates one building from the product's defaults on first mount. The route group `src/app/(configurator)/` now lives under `/configurator`.
- `src/app/api/configs/` — `POST` (save a `ConfigData`, mint `nanoid(10)` short code, dedupe by content hash per tenant) + `GET [code]` (fetch stored `ConfigData` migrated-on-read + priced quote). Both resolve the tenant via
  `src/lib/apiTenant.ts`, which combines the host-based resolver with
  the `tenants` DB row.
- `src/app/api/auth/[...all]/` — Better Auth catch-all handler.
  Client helpers in `src/lib/auth-client.ts`; server config in
  `src/lib/auth.ts`. In dev, magic links log to the server console
  when `RESEND_API_KEY` is empty; set the key to actually send.
- `src/app/api/admin/*` — authenticated admin API. All routes go
  through `withSession` from `@/lib/auth-session` and check kind via
  `requireBusiness(session, kinds)` / tenant scope via `requireTenantScope` (both in
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
  - `GET /api/admin/clients` — list `kind='client'` users in scope
  - `GET /api/admin/clients/[id]` — client detail + their orders
  - `GET|POST /api/admin/materials` + `GET|PATCH|DELETE /api/admin/materials/[id]` + `POST /api/admin/materials/[id]/restore` — per-tenant material CRUD; soft-delete preserves historical orders. `super_admin` may scope via `?tenantId=` query.
  - `POST /api/admin/uploads/textures` — Vercel Blob signed-upload endpoint; `@vercel/blob/client.handleUpload`; upload paths namespaced `textures/<tenantId>/…`.
  - `GET|POST /api/admin/products` + `GET|PATCH|DELETE /api/admin/products/[id]` + `POST /api/admin/products/[id]/restore` + `PATCH /api/admin/products/reorder` — per-tenant product CRUD + bulk reorder. super_admin may scope via `?tenantId=`.
  - `POST /api/admin/uploads/images` — Vercel Blob signed-upload endpoint for hero images; paths namespaced `images/<tenantId>/…`.
  - `GET|POST /api/admin/suppliers` + `GET|PATCH|DELETE /api/admin/suppliers/[id]` + `POST /api/admin/suppliers/[id]/restore` — tenant-scoped supplier CRUD.
  - `GET|POST /api/admin/suppliers/[id]/products` + `PATCH /api/admin/suppliers/[id]/products/reorder` — supplier's products list + bulk reorder.
  - `GET|PATCH|DELETE /api/admin/supplier-products/[pid]` + `POST /api/admin/supplier-products/[pid]/restore` — individual product operations. PATCH enforces `kind` immutability.
  - `POST /api/admin/uploads/supplier-images` — Blob signed upload; path namespaced `supplier/<tenantId>/…`.
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
  - `GET /api/shop/supplier-products?kind=door|window|gate` — public, host-scoped list of active (non-archived) supplier products. Excludes products whose supplier is archived.
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
- **Drag reorder:** `@dnd-kit/core` + `@dnd-kit/sortable` (+ `@dnd-kit/utilities`) are sanctioned non-shadcn deps used only for drag-reorder of table rows (e.g. `/admin/catalog/products`, `/admin/catalog/suppliers/[id]/products`). Import via the standard shadcn `Table` primitives wrapped in `DndContext` + `SortableContext`.
- **Catalog route group:** `/admin/catalog/` includes `/suppliers/...` — supplier list, create, edit, with a nested supplier-products table (dnd-kit reorder, per-supplier). `SupplierForm.tsx` handles contact + logo; `SupplierProductForm.tsx` handles kind-specific meta fields.
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
- **Tenant scope on admin pages:** super_admin's `user.tenantId` is NULL
  (enforced by the CHECK constraint). Admin pages that need a default
  scope call `resolveAdminTenantScope(session)` from `@/lib/adminScope`,
  which falls back to `DEFAULT_TENANT_ID` when the session has none —
  stopgap until a proper scope switcher lands. Catalog forms
  (Material/Product/Supplier) pass `tenantId` in the POST body so the
  server doesn't fall back to the (NULL) session tenant.
- **Color picker:** `src/components/admin/ColorPickerField.tsx` wraps
  a shadcn `Popover` with a 2×5 preset grid, a native
  `<input type="color">` swatch, and a hex text input. Used by
  `BrandingSection` for primaryColor + accentColor.
- **Logo upload:** `HeroImageUploadField` has a `previewFit` prop
  (`'cover'` default; `'contain'` for logos). `BrandingSection` uses
  `'contain'`. SVG is accepted on `/api/admin/uploads/images` (logos +
  hero images render through `<img>` in secure mode; Blob URLs live
  on a separate origin). `/textures` + `/supplier-images` stay
  raster-only since three.js materials can't render vector.
- **Blob upload routes:** super_admin may upload to any tenant's
  namespace (they edit across tenants); tenant_admin is pinned to
  their own. None of the routes declare `onUploadCompleted` — doing so
  forces Vercel to register a public webhook URL, which fails on
  localhost.

## Configurator submit flow

The sidebar's "In winkelmandje" CTA (in `src/components/ui/ObjectsTab.tsx`
→ `SidebarFooter`) opens `OrderSubmitDialog`. The dialog collects
name / email / phone / notes via react-hook-form + a zod schema from
`@/domain/orders/contactForm` (messages are i18n **keys** so the schema
stays framework-free and testable).

On submit, `useSubmitOrder` (in `src/components/ui/useSubmitOrder.ts`)
chains two POSTs:

1. `POST /api/configs` with the current `ConfigData` — server mints a short code (`nanoid(10)`) and dedupes by content hash; same scene → same short code per tenant.
2. `POST /api/shop/orders` with `{ code, contact }` — the server
   snapshots the priced quote, auto-creates (or reuses) the `client`
   user, and fires the magic-link email.

Supplier refs + geometry validated at submit: non-existent or archived
`doorSupplierProductId` / window `supplierProductId` / gate
`gateConfig.supplierProductId` reject with 422
(`supplier_product_not_found` / `supplier_product_archived`); oversized
opening placements reject as `supplier_placement_too_tall` /
`supplier_placement_too_wide`; oversized gate footprints reject as
`gate_placement_too_tall` / `gate_placement_too_wide`. Orders freeze
the full supplier product row inside
`quoteSnapshot.items[].lineItems[i].supplierProduct` so historical
orders are stable against catalog drift (kind-agnostic — covers gate
SKUs whose pricing source is `kind: 'supplierProduct'`).

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
varies. The shop surface (`/`, `/shop/*`) consumes
`var(--brand-primary)` on primary CTAs (landing-grid card button,
shop sign-in submit, "In winkelmandje" trigger, "PDF downloaden",
"Factuur bekijken") and on key link hovers (header sign-in, footer
contact email, back-to-account, row links). When adding new
branded surfaces use Tailwind arbitrary-value syntax:
`bg-[var(--brand-primary)] text-white hover:opacity-90`.

The `ShopHeader` logo-vs-displayName rule: when `branding.logoUrl`
is set, render only the logo (`alt={displayName}` for a11y) — don't
show the text sibling, because logos almost always embed the brand
name already. Sign-out lives in `ShopHeaderUserMenu.tsx` — a shadcn
`DropdownMenu` triggered by the signed-in user's email.

## White-label / multi-tenant

Anything that varies per brand lives on `TenantContext` — never in module-scope constants. Currently one tenant (`assymo`, seeded in `src/domain/tenant/tenants.ts`); the lookup table handles both subdomain and custom-domain mapping. When adding a feature:

- Price numbers → `priceBook` on `TenantContext`
- Material availability → `catalog.materials: MaterialRow[]` on `TenantContext`; configurator pickers read via `useTenantCatalogs()` (in `src/lib/`), which memoises per-category catalogs built from the DB-backed row list. Phase 4.5's allow-list (`enabledMaterials`) removed — row ownership in the `materials` table is the single gate.
- Engine primitives are tray-gated by catalog presence: the `poort` (gate) tray button only renders when the tenant has at least one `categories: ['gate']` material. Phase 5.8.1 added `poort` (registry-driven via `BUILDING_KIND_META`; configurable parts/swing/material/motor; pricing dials on `priceBook.poort` in EUROS, per-m² material cost on `MaterialPricing.gate.perSqm`).
- UI copy → i18n overlay via tenant later; for now `src/lib/i18n.ts` is the source

## Conventions

- **UI copy is Dutch** (`nl`). Keep it Dutch. Domain terminology is also Dutch (`overkapping`, `berging`, `paal`, `muur`) — don't translate.
- **i18n**: `t(key, params?)` from `@/lib/i18n`. Keys live in one big `nl` map. No inline Dutch strings in components.
- **Pricing labels**: return structured `{ labelKey, labelParams }` from pricing/validation — never pre-formatted strings. Caller runs `t()`.
- **Store splits**: config data goes in `useConfigStore`; everything transient goes in `useUIStore`. If you find yourself reaching across stores, use `src/store/selectors.ts`.
- **Testing**: tests live in `tests/` at repo root (centralised). Import from `'vite-plus/test'`. Every domain module has a spec; new domain functions should get at least a smoke test.
- **`crypto.randomUUID()`** is used for building IDs (client) and decoded window IDs — keep Node 20+ assumptions.
- **DB is source of truth** for tenants, hosts, and priceBooks. Every tenant lookup (layout, API routes, admin API) goes through `resolveTenantByHost` / `getTenantById` in `@/db/resolveTenant`. The `@/domain/tenant` folder keeps only pure host-normalization helpers and the `DEFAULT_TENANT_ID` constant — no hardcoded host map.
- **Global-unique emails across tenants.** A user belongs to exactly one tenant (`user.tenantId`). super_admin rows MUST have `tenantId=null`; `tenant_admin` and `client` MUST have a non-null `tenantId`. Enforced at the DB layer by the `user_kind_tenant_check` CHECK constraint.
- **Auth guards are split**: `@/lib/auth-guards` stays pure (no auth/DB imports, testable stand-alone). `@/lib/auth-session` holds the runtime-coupled `requireSession` / `withSession`. Guards: `requireBusiness(session, kinds: BusinessKind[])`, `requireClient(session)`, `requireTenantScope(session, tenantId)`. `UserKind = 'super_admin' | 'tenant_admin' | 'client'`; `BusinessKind = 'super_admin' | 'tenant_admin'`.
- **No silent-empty collection defaults.** Domain functions that accept
  tenant-scoped collections (materials, supplierProducts, priceBook
  entries, etc.) MUST require those args — never `param: T[] = []`
  or `param?: T[]`. A forgotten catalog input otherwise produces a
  silently-wrong-but-plausible result (e.g. quotes where every
  supplier product becomes "Ontbrekend product"). Tests can't catch
  that because they look correct from the callee's perspective.
  Force callers to pass the data; the compiler is the test. Same
  rule applies to identifiers the UI must always have at render time
  (e.g. `shareCode` on PDF export) — no `?:` with a `—` fallback.
- **Order state machine** lives in `@/domain/orders/transitions.ts`.
  Allowed transitions: `submitted → quoted | cancelled`,
  `quoted → accepted | cancelled`, `accepted → cancelled`,
  `draft → submitted | cancelled` (reserved). `cancelled` is terminal.
  All transitions go through `validateOrderTransition`; the admin
  status dropdown sources its options from `allowedNextStatuses` so
  the UI cannot offer a transition the API would reject.

## Before committing

- `pnpm test` must pass (413+ tests)
- `pnpm build` must pass
- `pnpm exec tsc --noEmit` must pass
- Lint is noisy with pre-existing warnings — net-new errors only are a blocker

## What NOT to do

- Don't import React, three, zustand, or Next into `src/domain/` — breaks server-side reuse
- Don't hardcode prices, brand names, or customer copy outside `TenantContext` / i18n
- Don't use `npm install` — use `pnpm`
- Don't replace Next's build with Vite — Vite+ is for tests only; Next owns dev/build via Turbopack
- Don't create new documentation files unless the user asks for them
