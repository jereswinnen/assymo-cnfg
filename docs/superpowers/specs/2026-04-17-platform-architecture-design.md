# Platform Architecture — Admin, Webshop, Orders, Invoices

**Status:** approved 2026-04-17
**Supersedes:** the original `ROADMAP.md` phase plan (Phases 1–6)

## Goal

A simple, lean, modular foundation for the white-label rollout. Three audiences, two surfaces:

- **Configurator** (`/`) — buyers (B2C clients of Assymo or of a tenant) design a building and add it to their cart.
- **Admin** (`/admin`) — business users (Assymo super_admin + tenant_admin) manage tenants, registry, orders, and invoices for their scope.
- **Webshop / client account** (`/shop/account`) — clients confirm orders, view their orders, see invoices and payment status.

Tenants get an admin that mirrors Assymo's, scoped to their own data.

## Architectural decisions

### Auth model — single Better Auth instance with `userType` discriminator

One auth setup, one session shape. Users carry `userType: 'business' | 'client'`. Business users also carry a `role: 'super_admin' | 'tenant_admin'`. We can split into two Better Auth instances later if a concrete reason emerges (SSO for tenants, regulatory wall, etc.) — that's a one-migration refactor.

### Roles — drop `staff` for now

Schema ships with `super_admin | tenant_admin | client`. `staff` was speculative; adding a role later is a one-migration change. Permission checks stay narrow.

### URL shape — split trees

- `/admin/*` is the business management surface (super_admin + tenant_admin).
- `/shop/*` is the client account area (client userType only).
- `/` is the tenant-branded webshop home — the configurator inside a per-tenant chrome.

This matches the audience split. Same Better Auth instance underneath; different guards on each tree.

### Tenant detection — already built

`src/db/resolveTenant.ts` resolves `tenant_hosts` from the `Host` header (exact → bare host → leftmost subdomain → fallback to `assymo`). The root layout wraps everything in `<TenantProvider>`. New tenants are onboarded by creating a `tenants` row + adding `tenant_hosts` rows + populating `branding`.

### Tenant branding — inline on `tenants`, no separate table

Add a `branding` jsonb column to `tenants` with `displayName`, `logoUrl`, `primaryColor`, `accentColor`, `footer`. The root layout reads it from `TenantContext` and renders header/footer + injects CSS vars. The configurator canvas itself stays unbranded — only the wrapper varies.

### Client account creation — auto-create on order submit

The order modal collects name/email/phone. Backend creates a `client` user (`emailVerified=false`) and links it to the order. The order-confirmation email contains a magic link to claim the account at `/shop/account`. Zero friction; first order = sign-up.

### Invoices — separate table, 1:1 with orders, sequential per-tenant numbering

Belgian/Dutch VAT requires gapless invoice numbering per legal entity. Coupling that to order IDs (which can have gaps from cancellations) is fragile. Separate `invoices` table also lets us re-issue/correct without touching the order. The `invoice_numbers(tenantId)` table holds an atomic counter.

### Payments — `payments` table, N:1 to invoice, status derived

No `paid|partial|unpaid` column on the invoice — derive from `sum(payments) vs invoice.totalCents`. Supports manual entries today (bank transfer) and provider webhooks later (Mollie/Stripe) with no schema change.

### Cart — single-item now, multi-item-shaped data model

The CTA in the configurator is **"In winkelmandje"** (e-commerce vocabulary), but the flow is single-item: configure one building → add to cart → submit creates one order. The order's `quoteSnapshot` jsonb is shaped to accommodate multi-item later (an array of items), and a future `order_items` 1:N table is non-breaking. No cart UI, no cart persistence in scope today.

## Modules

Each module is a slice: `src/domain/<name>/` (pure) + `src/db/schema/<name>.ts` (tables) + `src/app/api/.../<name>/` (routes). Modules talk through public contracts (exported types and a small set of functions); they never reach into another module's internals.

| Module | Owns | Status |
|---|---|---|
| `tenant` | tenants, hosts, price book, branding, material catalog | mostly built |
| `auth` | Better Auth + userType/role/scope guards | mostly built; adds `userType` |
| `orders` | order lifecycle, state machine, quote snapshot | new (Phase 2) |
| `invoices` | invoices, numbering, payments | new (Phase 5) |
| `configurator` | 3D app, share-code codec, "in winkelmandje" hook | built; adds submit action |
| `webshop` | tenant-branded shell, client account pages | new (Phase 4) |
| `admin` | business management UI shell | new (Phase 1) |

## Data model

New / changed tables. Only fields needed today; YAGNI everything else.

```
users (existing — additions)
  + userType: 'business' | 'client'    -- new column, default 'business'
  + tenantId stays nullable             -- super_admin null; client always non-null

tenants (existing — additions)
  + branding jsonb                      -- { displayName, logoUrl, primaryColor, accentColor, footer }

orders                                  -- new
  id, tenantId, configId (nullable),
  code (base58 share-code snapshot reference),
  customerId (nullable until claim),
  contactEmail, contactName, contactPhone, notes,
  status: 'draft'|'submitted'|'quoted'|'accepted'|'cancelled',
  totalCents, currency,
  quoteSnapshot jsonb,                  -- frozen line items + price book at submit
  configSnapshot jsonb,                 -- frozen ConfigData
  createdAt, updatedAt, submittedAt

invoices                                -- new
  id, tenantId, orderId (unique),
  number text,                          -- per-tenant sequential, e.g. "2026-0001"
  issuedAt, dueAt,
  totalCents, vatCents, currency,
  pdfUrl (nullable until generated),
  createdAt

invoice_numbers                         -- new — per-tenant counter
  tenantId (PK), year, lastSeq

payments                                -- new
  id, invoiceId, amountCents, currency,
  method: 'manual'|'mollie'|'stripe'|...,
  providerRef (nullable),
  paidAt, note,
  createdAt
```

Order status drops `awaiting_payment` and `paid`. Payment state is derived from `payments` against the invoice; the order never tracks payment directly. `quoteSnapshot` and `configSnapshot` are immutable post-submit so invoices can re-render years later even if the price book changes.

## Route map

```
/                          configurator inside tenant-branded shell
                           (Assymo branding on canonical host;
                            partner branding on partner hosts)

/api/configs/*             existing — save/load share codes
/api/auth/[...all]         existing — Better Auth, both userTypes

/admin                     business shell — super_admin + tenant_admin
  /sign-in                 magic-link form
  /                        dashboard
  /tenants                 super_admin only — list/create
  /tenants/[id]            super_admin only — edit, hosts, branding, price book
  /price-book              tenant_admin — own tenant's price book
  /registry                tenant_admin — material catalog toggles (Phase 4.5)
  /users                   list business users in scope, invite
  /clients                 list client users in scope, drill-in
  /clients/[id]            client detail + their orders + invoices
  /orders                  list orders in scope
  /orders/[id]             detail, status transitions, generate invoice
  /invoices                list invoices in scope
  /invoices/[id]           detail, payments, PDF link

/api/admin/*               business API (tenant-scoped via session)
  tenants, tenants/[id],
  tenants/[id]/price-book, tenants/[id]/hosts, tenants/[id]/branding,
  users, users/[id],
  clients, clients/[id],
  orders, orders/[id], orders/[id]/status, orders/[id]/invoice,
  invoices, invoices/[id], invoices/[id]/payments

/shop/sign-in              client magic-link
/shop/account              client's own orders list
/shop/account/orders/[id]  order + invoice + payment status
/shop/account/invoices/[id] invoice detail + PDF

/api/shop/*                client-facing API (client userType)
  orders (POST submit, GET own list),
  orders/[id], invoices/[id]
```

## Auth guards (role × scope)

| Capability | super_admin | tenant_admin | client |
|---|---|---|---|
| Manage tenants (create/edit/hosts/branding) | all | own only | — |
| Manage price book | all | own | — |
| Manage material catalog | all | own | — |
| Invite/manage business users | all tenants | own tenant | — |
| View clients | all | own tenant | self only |
| View orders | all | own tenant | own only |
| Transition order status | all | own tenant | — |
| Generate invoice / record payment | all | own tenant | — |
| Submit order from configurator | — | — | yes (or guest auto-create) |
| View own invoices + PDF | all | own tenant | own only |

Two reusable guards layered on top of `withSession` (live in `@/lib/auth-guards`, pure):

- `requireBusiness(role[])` — userType=`business` AND role in list
- `requireClient()` — userType=`client`
- Both compose with `requireTenantScope(tenantId)`, which super_admin bypasses.

Endpoints:
- `/api/admin/*` → `requireBusiness([...])` + scope check
- `/api/shop/*` → `requireClient()` + per-resource ownership check

## i18n convention

All new modules MUST add their UI strings to `src/lib/i18n.ts` and consume them via `t(key, params?)`. No inline Dutch strings in components. This is already a project convention (`CLAUDE.md`); calling it out explicitly because the new admin/webshop surfaces will roughly double the string surface area.

## Phase plan

Each phase ends in something deployable.

### Phase 1 — Admin foundation

- Migration: add `userType` column; default existing users to `business`.
- Migration: add `branding` jsonb to `tenants`; seed Assymo defaults.
- Update `auth.ts` `additionalFields` (add `userType`; drop `staff` from role enum).
- Regenerate `src/db/auth-schema.ts`.
- Update `auth-guards`: drop `staff`, add `UserType`, `requireBusiness`, `requireClient`.
- Refactor existing admin endpoints to use `requireBusiness`.
- Missing list endpoints: `GET /api/admin/users`, `GET /api/admin/tenants`, `GET /api/admin/tenants/[id]`.
- `tenant_hosts` admin endpoints (`GET/POST /api/admin/tenants/[id]/hosts`, `DELETE /api/admin/tenants/[id]/hosts/[hostname]`).
- `tenant_branding` admin endpoint (`PATCH /api/admin/tenants/[id]/branding`).
- Scaffold shadcn primitives (button, input, form, dialog, card, table, dropdown-menu, sonner).
- `/admin` shell with role-aware sidebar + header (session display + sign-out).
- Pages: `/admin/sign-in`, `/admin` (dashboard), `/admin/tenants` (super_admin), `/admin/tenants/[id]` (details + hosts + branding + price book), `/admin/users` (list + invite).
- i18n keys for the entire admin surface.
- Update `CLAUDE.md` to reflect new role model + `userType`.

**Deferred to later phases** (data model not yet present):
- `/admin/clients` (and `GET /api/admin/clients`) → Phase 2 (lands with first client users).
- `/admin/registry` → Phase 4.5 (lands with material catalog).
- `/admin/orders`, `/admin/invoices` → Phases 2 and 5.

### Phase 2 — Orders

- `orders` table + `src/domain/orders/` (state machine, transitions, `validateOrderTransition`).
- `POST /api/shop/orders` (public; auto-creates `client` user from contact info).
- `GET /api/admin/orders`, `GET /api/admin/orders/[id]`, `PATCH /api/admin/orders/[id]/status`.
- `/admin/orders` list + `/admin/orders/[id]` detail.
- Order-confirmation email with magic link inside (claim account → `/shop/account`).

### Phase 3 — Configurator submit

- "In winkelmandje" CTA in configurator sidebar (next to share-code dialog).
- Modal captures contact details (name, email, phone, optional note).
- Submits `{ code, contact }` to `POST /api/shop/orders`; server computes quote snapshot.
- Confirmation screen with order ID and "we'll reach out" copy.

### Phase 4 — Webshop shell + client account

- Tenant-branded layout on `/` (header/footer/CSS vars from `branding`).
- `/shop/sign-in` (client magic-link), `/shop/account/*` (orders + invoices read-only).
- **Phase 4.5** — material catalog filtering. `tenants.enabledMaterials text[]` (or `tenant_materials` if a richer model is needed) + admin toggle UI.

### Phase 5 — Invoices

- `invoices` + `invoice_numbers` + `payments` tables.
- `src/domain/invoices/` — pure: numbering, status derivation, PDF data shape.
- `POST /api/admin/orders/[id]/invoice` (manual generate).
- `GET /api/admin/invoices`, `POST /api/admin/invoices/[id]/payments` (manual payment entry — today's bank-transfer flow).
- PDF generation — react-pdf or print-to-pdf; decide in phase research.
- `/admin/invoices/*` + `/shop/account/invoices/[id]` (PDF download).

### Phase 6 — Online payments (deferred)

Today, clients pay by manual bank transfer; Phase 5 covers that via `payments.method='manual'`. Phase 6 lands when the business is ready for online payments. The `payments` table and `method` column are already shaped to absorb a provider with no schema change.

- Provider: Mollie (BE/NL-native, easy SEPA) — final choice deferred to phase research.
- Webhook creates `payments` row with `method='mollie'`, `providerRef=<mollie id>`; invoice status re-derives automatically.
- "Betaal nu" button on `/shop/account/orders/[id]` for unpaid/partial invoices.
- Test mode first; production keys only after invoice flow is validated against real bank-transfer orders.

### Cross-cutting (unchanged from ROADMAP.md)

Pick up as they become painful.

- Branded email templates per tenant for magic links + order confirmations.
- Rate-limit `/api/auth/sign-in/magic-link`.
- Integration tests for admin + shop API (Neon branch per run).
- Audit log table — `admin_events(actorId, action, targetType, targetId, diff, at)`.
- Tenant soft-delete instead of cascade.

## Out of scope

Explicit non-goals to keep this lean:

- Multi-item cart (deferred; data model accommodates without breaking change).
- `staff` role and per-permission ACLs (one-migration add later).
- Splitting into two Better Auth instances (deferred until concrete need).
- Online payments (Phase 6, business-ready dependent).
- Per-tenant custom email templates (in cross-cutting, not blocking).
- Marketing/landing pages on `/shop/` (no `/shop` storefront — `/` is the storefront).

## Progress

Tick a box when the phase is merged to `main` and deployed. Each phase has its own implementation plan in `docs/superpowers/plans/` once it's the active phase.

- [x] Phase 1 — Admin foundation — [plan](../plans/2026-04-17-phase-1-admin-foundation.md)
- [x] Phase 2 — Orders — [plan](../plans/2026-04-17-phase-2-orders.md)
- [x] Phase 3 — Configurator submit — [plan](../plans/2026-04-21-phase-3-configurator-submit.md)
- [ ] Phase 4 — Webshop shell + client account — [plan](../plans/2026-04-21-phase-4-webshop-shell.md)
  - [ ] Phase 4.5 — Material catalog filtering
- [ ] Phase 5 — Invoices
- [ ] Phase 6 — Online payments (deferred until business-ready)
