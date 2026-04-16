# Assymo Configurator

Interactive 3D configurator for Assymo garden structures — overkapping (open carport), berging (closed shed), paal (standalone pole), and muur (standalone wall). Produces a live 3D view + 2D floor plan, computes a price quote, and encodes the scene into a shareable base58 code. Being prepared for a white-label rollout with upcoming API, admin, and webshop surfaces.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19
- React Three Fiber + drei + postprocessing (3D canvas)
- Zustand + zundo (state + undo/redo)
- Tailwind v4, shadcn, radix-ui, lucide-react
- Vite+ (test runner only — does NOT replace Next's bundler)

## Package Manager

pnpm. Not npm, not yarn. `package-lock.json` is not tracked.

## Commands

- `pnpm dev` — Next dev server
- `pnpm build` — production build
- `pnpm test` — run the Vitest suite once via Vite+
- `pnpm test:watch` — watch mode
- `pnpm lint` — ESLint (Next's config)

## Architecture

Three layers, strictly separated:

### `src/domain/` — framework-free

Pure TypeScript. No React, no three.js, no zustand. Safe to import from API routes, admin pages, and the future webshop without pulling a browser runtime.

- `building/` — entity types (`BuildingEntity`, `WallConfig`, `RoofConfig`, `SnapConnection`), geometric constants, snap detection, opening geometry helpers
- `config/` — the canonical `ConfigData` contract + versioning (`CONFIG_VERSION`), base58 codec, `migrateConfig` for legacy input, pure `mutations.ts` (used by stores and future API), `validateConfig` returning stable error codes
- `pricing/` — `PriceBook` (per-tenant scalar dials) + `calculateTotalQuote`; line items are structured `{ labelKey, labelParams }` so UIs format labels at render time
- `materials/` — `MATERIALS_REGISTRY` + per-object catalogs (wall/roof/floor/door) + attachment-chain resolution helpers
- `tenant/` — `TenantContext` with `priceBook`; host-based resolver

### `src/lib/` — browser-coupled

React contexts, three.js textures, client-only hooks, i18n. Keep framework-coupled code here, not in `domain/`.

### `src/store/`

- `useConfigStore` — persisted `ConfigData` only (buildings, connections, roof, defaultHeight) wrapped in `temporal` (undo/redo). Actions delegate to `@/domain/config/mutations.ts`.
- `useUIStore` — ephemeral UI (view mode, sidebar tab/collapsed, selection, drag state, camera target, quality tier). Not undoable, not persisted.
- `selectors.ts` — cross-store hooks (`useSelectedBuilding`, etc.)

### Routes

- `src/app/(configurator)/` — current app
- Reserved top-level route segments for `api/`, `admin/`, `shop/`
- `src/app/layout.tsx` resolves the tenant from the `host` header and wraps in `<TenantProvider>`

## White-label / multi-tenant

Anything that varies per brand lives on `TenantContext` — never in module-scope constants. Currently one tenant (`assymo`, seeded in `src/domain/tenant/tenants.ts`); the lookup table handles both subdomain and custom-domain mapping. When adding a feature:

- Price numbers → `priceBook` on `TenantContext`
- Material availability → future `materialCatalog` on `TenantContext` (not yet wired — global registry for now)
- UI copy → i18n overlay via tenant later; for now `src/lib/i18n.ts` is the source

## Conventions

- **UI copy is Dutch** (`nl`). Keep it Dutch. Domain terminology is also Dutch (`overkapping`, `berging`, `paal`, `muur`) — don't translate.
- **i18n**: `t(key, params?)` from `@/lib/i18n`. Keys live in one big `nl` map. No inline Dutch strings in components.
- **Pricing labels**: return structured `{ labelKey, labelParams }` from pricing/validation — never pre-formatted strings. Caller runs `t()`.
- **Store splits**: config data goes in `useConfigStore`; everything transient goes in `useUIStore`. If you find yourself reaching across stores, use `src/store/selectors.ts`.
- **Testing**: tests live in `tests/` at repo root (centralised). Import from `'vite-plus/test'`. Every domain module has a spec; new domain functions should get at least a smoke test.
- **`crypto.randomUUID()`** is used for building IDs (client) and decoded window IDs — keep Node 20+ assumptions.

## Before committing

- `pnpm test` must pass (113+ tests)
- `pnpm build` must pass
- `pnpm exec tsc --noEmit` must pass
- Lint is noisy with pre-existing warnings — net-new errors only are a blocker

## What NOT to do

- Don't import React, three, zustand, or Next into `src/domain/` — breaks server-side reuse
- Don't hardcode prices, brand names, or customer copy outside `TenantContext` / i18n
- Don't use `npm install` — use `pnpm`
- Don't replace Next's build with Vite — Vite+ is for tests only; Next owns dev/build via Turbopack
- Don't create new documentation files unless the user asks for them
