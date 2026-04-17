# Roadmap

Living plan for the configurator → admin → webshop rollout. Updated as phases complete; archived sections trimmed.

## Current state (2026-04-17)

- `src/domain/` — pure config/pricing/validation/codec layer, 133 Vitest tests
- Neon + Drizzle persistence (`tenants`, `configs`, `tenant_hosts`, Better Auth tables)
- Better Auth (email+password + magic link via Resend); first super_admin bootstrapped
- Admin API complete: `GET /api/admin/tenants/current`, `POST /api/admin/tenants`, `PATCH /api/admin/tenants/[id]/price-book`, `POST /api/admin/users`
- Host-based tenant resolution (DB-backed via `tenant_hosts`)

See `CLAUDE.md` for architecture details and conventions.

## Phase 1 — Admin UI (next)

Consume the admin API end-to-end.

- `src/app/admin/` route group
  - `/admin/sign-in` — magic-link form using `signIn.magicLink` from `@/lib/auth-client`
  - `/admin/layout.tsx` — session guard (redirect unauthenticated → sign-in; 403 page for role=staff); sidebar + header
- Pages:
  - `/admin` — dashboard (session user, tenant summary)
  - `/admin/price-book` — form that PATCHes `/api/admin/tenants/[id]/price-book`, with live-preview of a sample quote
  - `/admin/users` — list of users in current tenant + "invite user" modal → POST `/api/admin/users`
  - `/admin/tenants` (super_admin only) — list + "create tenant" form → POST `/api/admin/tenants`
- Unblocks every downstream phase — real humans drive the APIs we just built

## Phase 2 — Orders layer

First persistent artifact produced by customers.

- Schema: `orders` table
  - `id, tenantId, configId, customerId (nullable until Phase 5), status, totalCents, currency, quoteSnapshot (jsonb), contactEmail, contactName, notes, createdAt, updatedAt, submittedAt`
  - State enum: `draft | submitted | quoted | accepted | awaiting_payment | paid | cancelled`
- Domain: `src/domain/orders/` with pure state-transition rules + `validateOrderTransition(from, to)` returning the same `ValidationError[]` shape we use elsewhere
- API: `POST /api/orders` (public, host-scoped), `GET /api/admin/orders`, `PATCH /api/admin/orders/[id]/status`
- Admin UI: `/admin/orders` list + `/admin/orders/[id]` detail (config preview, status transitions)

## Phase 3 — Configurator "submit" flow

Wires the end-user path.

- "Vraag een offerte aan" button in the configurator sidebar (next to existing share-code dialog)
- Modal captures minimum contact details: name, email, phone, optional note
- Submits `{ code, contact }` to `POST /api/orders`; server computes quote snapshot server-side
- Confirmation screen: order ID + "we'll reach out within X" copy
- Order appears in `/admin/orders` immediately

## Phase 4 — Webshop shell

Customer-facing surface.

- `src/app/shop/` route group with tenant-branded shell
- Embeds the existing configurator component (no duplication)
- Shares the Phase 3 order-submit flow
- Host resolution already routes the tenant — `partner.configurator.be` gets partner's branding, price book, and material catalog (once Phase 4.5 lands)
- **Phase 4.5** (small, inside Phase 4): per-tenant material catalog filtering. Today every tenant sees every material; add `tenant_materials (tenantId, materialSlug, enabled)` or a simple `tenants.enabledMaterials: text[]` column and teach the admin UI to toggle.

## Phase 5 — Customer auth + account

Separate auth space from admin.

- Customer is a distinct concept from `user` — most likely a second Better Auth instance mounted at `/api/shop-auth/[...all]`, with its own `customer` table
- Alternatively: a `userType: 'admin' | 'customer'` discriminator on the existing `user` table and role-based routing
- `/shop/sign-in` — magic link only
- `/shop/account` — list own orders, see quotes, download PDFs
- Orders gain a non-null `customerId` once the submitter is authenticated

## Phase 6 — Payment

When the business is ready.

- Provider choice: **Mollie** (BE/NL-native, easy SEPA) or **Stripe** (broader)
- `awaiting_payment → paid` transition via provider webhook
- Customer account page gets a "Pay now" button
- Admin sees payment status per order
- Test mode first; production keys only after invoice/VAT flow is validated

## Cross-cutting nice-to-haves

Pick up as they become painful.

- **Branded email templates** for magic links (per tenant; today all magic links say "Assymo")
- **Admin endpoint to manage `tenant_hosts`** so onboarding a partner doesn't need a developer
- **Rate-limit `/api/auth/sign-in/magic-link`** (abuse prevention — someone spamming other people's inboxes)
- **Integration tests for admin API** — needs a test DB (Neon branch per run, or Postgres in a container)
- **Audit log table** — `admin_events (actorId, action, targetType, targetId, diff, at)` for tenant-admin accountability
- **Tenant soft-delete** instead of `cascade` — once real customers exist, deleting a tenant should soft-archive so orders don't vanish

## Completed milestones

- **M0 — Domain extraction** (done) — pure `src/domain/` layer with 133 tests
- **M1 — Persistence + auth foundation** (done) — Neon, Drizzle, Better Auth, admin API
