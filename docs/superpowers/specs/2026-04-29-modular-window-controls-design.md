# Modular Window Controls — Design

**Status:** Draft for review
**Date:** 2026-04-29
**Scope:** Phase-style feature spec — single implementation cycle.

## Summary

Add a modular controls layer to wall openings, starting with windows. V1 ships
two controls:

- **Segments** — auto-from-width vertical dividers (the "muntins" pattern),
  user-overridable per instance, with optional per-divider pricing.
- **Schuifraam** — a per-product flag that re-renders the window as a sliding
  unit (panes overlapping on the X axis) and exposes an open/close button in
  the configurator that animates the panes.

The same plumbing extends to doors later without redesign — every decision in
this spec is driven by "this must hold when doors plug in".

## Goals / non-goals

**Goals**

- Treat windows as a structured opening with a small, declared set of controls.
- Match the existing "auto-derive + per-instance override" pattern (poles).
- Keep controls supplier-product-driven (the admin tags a product as
  "has-segments" / "is-schuifraam"), not tenant-wide.
- Make adding a future shared auto-derived control a single registry entry.
- Animation parity with doors for schuifraam open/close.

**Non-goals**

- Door controls (out of scope; the design ensures the seams hold).
- Naked-window (no supplier product) controls — locked behind a supplier
  product in V1; can be lifted to priceBook later.
- Horizontal segment dividers — V1 is vertical-only; horizontal arrives later
  as a sibling registry entry.
- Migrating existing scenes — confirmed not needed.
- Storing schuifraam open/closed state in the scene — open/close is purely
  ephemeral UI, no persistence.

## Key decisions (recorded from brainstorm)

1. **Where the data lives.** Defaults live on the supplier product; per-instance
   override lives on `WallWindow`. Naked windows fall back to "no controls" in
   V1.
2. **Pricing.** Visual-first; supplier product MAY declare per-divider surcharge
   and/or flat schuifraam surcharge. Both optional.
3. **Registry shape.** Hybrid — generic `OPENING_AUTO_CONTROLS` registry only
   for auto-derive-from-dimension controls (today: `segments`); typed fields
   on `WindowMeta` / `DoorMeta` for everything else (today: `schuifraam`).
4. **Schuifraam scope.** Defined on the supplier product (real products differ
   in hardware/price); per-instance open/close is ephemeral UI state, not
   stored in the scene.

## Architecture

Three layers, mirroring `BUILDING_KIND_META` + supplier products + scene state:

1. **Code-level registry** (`src/domain/openings/controls.ts`, new) — declares
   the family of auto-derived controls. Each entry: `id`, `applicableKinds`
   (`'window' | 'door'`), the dimension axis it derives from (`'width' | 'height'`),
   value type, auto-derivation function. Today's only entry: `segments`.
2. **Per-supplier-product config** on `WindowMeta` (and later `DoorMeta`) — the
   admin sets which controls are enabled, thresholds, optional pricing, plus
   typed fields like `schuifraam`.
3. **Per-instance override** on `WallWindow` — user choice of segment count
   (or auto). Schuifraam open/close lives in `useUIStore` (ephemeral, not
   persisted, not undoable).

A single pure resolver returns the flat view used by 3D, sidebar, and pricing:

```ts
// src/domain/openings/resolve.ts
export interface ResolvedWindowControls {
  segments: { count: number; surchargeCentsPerDivider: number };
  schuifraam: { enabled: boolean; surchargeCents: number };
}

export function resolveWindowControls(
  window: WallWindow,
  product: SupplierProductRow | null,
): ResolvedWindowControls;
```

Returns the empty/default view when no product (or product has none of the
controls enabled). Always pure, never reads stores.

## Data model

### `src/domain/supplier/types.ts` — `WindowMeta` extension

```ts
export interface WindowMeta {
  // ...existing fields (glazingType, uValue, frameMaterial, openable, leadTimeDays)
  segments?: {
    enabled: boolean;
    autoThresholdMm: number;            // first divider appears when widthMm >= threshold
    perAdditionalThresholdMm?: number;  // optional: every +X mm adds another (else: 1 divider only)
    maxCount?: number;                  // hard cap; absent = unbounded
    surchargeCentsPerDivider?: number;  // optional pricing hook
  };
  schuifraam?: {
    enabled: boolean;
    surchargeCents?: number;            // optional flat surcharge applied when product picked
  };
}
```

Both new fields optional. Storage is jsonb (`supplier_products.meta`) — no DB
migration needed. Validation extends `validateWindowMeta` with new error codes
(`segments_invalid`, `schuifraam_invalid`).

### `src/domain/building/types.ts` — `WallWindow` extension

```ts
export interface WallWindow {
  // ...existing fields (id, position, width, height, sillHeight, supplierProductId)
  /** User override for segment count. `undefined` → auto-derive from width.
   *  `0` → explicitly no segments. Ignored when the resolved supplier product
   *  has no `segments.enabled`. */
  segmentCountOverride?: number;
}
```

One new optional field. Persisted in `ConfigData` (already covers `WallWindow`
shape). Frozen into `configSnapshot` at order submit by definition. No
schuifraam state stored on the scene.

### `useUIStore` — ephemeral animation state

```ts
// addition
windowAnimations: Record<string /*windowId*/, { open: boolean }>;
toggleWindowOpen(id: string): void;
```

Not persisted, not undoable. Cleared when the window is removed.

## Auto-derivation algorithm

```ts
function deriveSegmentCount(widthMm: number, cfg: WindowMeta['segments']): number {
  if (!cfg?.enabled) return 0;
  if (widthMm < cfg.autoThresholdMm) return 0;
  if (!cfg.perAdditionalThresholdMm) {
    return cfg.maxCount != null ? Math.min(1, cfg.maxCount) : 1;
  }
  const raw = 1 + Math.floor(
    (widthMm - cfg.autoThresholdMm) / cfg.perAdditionalThresholdMm,
  );
  return cfg.maxCount != null ? Math.min(raw, cfg.maxCount) : raw;
}
```

Resolution then applies override:

```ts
const auto = deriveSegmentCount(window.width * 1000, meta.segments);
const count = window.segmentCountOverride ?? auto;
// Override is allowed to be 0 (user disables segments). When the product
// has no `segments.enabled`, the override is ignored — count is always 0.
```

## Admin UI

`SupplierProductForm.tsx` (window-kind branch) gains a **Controls** card with
two collapsible subforms — pattern matches existing `GateMetaOption` subforms:

- **Segments** — `Enabled` toggle. When on:
  - `Auto-threshold (mm)` — required, positive integer.
  - `Per-additional-threshold (mm)` — optional, positive integer.
  - `Max count` — optional, positive integer ≥ 1.
  - `Per-divider surcharge (€)` — optional, integer cents in form;
    rendered as €.
- **Schuifraam** — `Enabled` toggle. When on:
  - `Surcharge (€)` — optional, integer cents in form.

Validation: `validateWindowMeta` is extended in
`src/domain/supplier/_validation.ts`. New error codes added to
`SUPPLIER_ERROR_CODES`:

```ts
segmentsInvalid: 'segments_invalid',
schuifraamInvalid: 'schuifraam_invalid',
```

Validators reject negative numbers, `maxCount < 1`, `enabled: true` without
`autoThresholdMm`, etc. Same error-shape conventions as today.

No new shadcn primitives. Existing form layout patterns reused.

## Configurator sidebar

The window editor (`WindowEditor.tsx` or equivalent) gains a **Controls**
section, rendered only when:

- The window has a non-null `supplierProductId`, AND
- The resolved product is non-archived, AND
- At least one control is enabled in the product's `meta`.

Inside:

- **If `meta.segments?.enabled`** — a number stepper labelled "Segmenten":
  - Buttons / segmented control with options: `Auto`, `0`, `1`, `2`, …
    up to `meta.segments.maxCount` (or a sane default like 8).
  - When `Auto`, the live derived count is displayed as a hint
    (e.g. "Auto · 2 segmenten").
  - Selecting `Auto` sets `segmentCountOverride = undefined` via
    `useConfigStore` mutation. Other selections set the integer.
- **If `meta.schuifraam?.enabled`** — an "Open / Sluit" toggle button:
  - Reads `useUIStore.windowAnimations[id].open`.
  - Clicking calls `toggleWindowOpen(id)`.

Naked windows show no Controls section in V1.

i18n keys added to `src/lib/i18n.ts`:

- `controls.section.title` → "Bedieningen"
- `controls.segments.label` → "Segmenten"
- `controls.segments.auto` → "Auto"
- `controls.segments.autoHint` → "Auto · {{count}} segmenten"
- `controls.schuifraam.openLabel` → "Open"
- `controls.schuifraam.closeLabel` → "Sluit"

## 3D rendering

`WallWindowMesh` (whichever component renders a `WallWindow` today) consumes
the resolved view from `resolveWindowControls`:

- **count === 0** — single pane (today's behavior, unchanged).
- **count > 0, schuifraam disabled** — `count + 1` panel meshes equally
  divided across the window's width, each separated by a vertical mullion mesh
  (frame material). Mullion thickness = a domain constant (e.g. `0.04` m to
  match existing window-frame thickness; pulled from existing constants if
  available).
- **count > 0, schuifraam enabled** — same `count + 1` panels but adjacent
  panels overlap by ~30 mm along X. The first panel is "fixed"; the others
  slide. When `windowAnimations[id].open === true`, animate sliding panels
  along +X (or −X, picked by which side has clearance) by their panel width
  minus overlap. Animation uses the same approach the door-swing uses today
  (`useFrame` lerp or react-spring — match the existing pattern).

Vertical-only in V1. Horizontal divider support is future work (sibling
registry entry, derives from height).

## Pricing

`pricing/calculate.ts` extends the existing window line-item branch.

When a window's resolved view has:

- `segments.count > 0` AND `segments.surchargeCentsPerDivider > 0`:
  add `surchargeCentsPerDivider × count` to the line, as a sub-item with
  `{ labelKey: 'quote.window.segmentSurcharge', labelParams: { count } }`.
- `schuifraam.enabled` AND `schuifraam.surchargeCents > 0`:
  add the flat surcharge as a sub-item with
  `{ labelKey: 'quote.window.schuifraamSurcharge' }`.

Both absorbed into the same window line — quote-layout shape is unchanged.

`quoteSnapshot` already freezes the full supplier product row; adding new
`meta` fields means historical orders re-render correctly without further
changes. The frozen `configSnapshot` already covers `WallWindow.segmentCountOverride`
since `WallWindow` is part of `ConfigData`.

## Validation at order submit

`buildQuoteSnapshot` and the `/api/shop/orders` validators don't need new
checks — `segmentCountOverride` is unbounded by API (clamped at render/quote
time against `maxCount`). If a future product changes `maxCount` after the
scene is saved, the quote at submit still computes against the current meta
because the priced quote runs at submit time.

## Testing

- `tests/domain/openings/controls.spec.ts`
  - `deriveSegmentCount`: width below threshold → 0; at threshold → 1; with
    `perAdditionalThresholdMm`, every +X yields +1; `maxCount` caps; absent
    config → 0.
  - `resolveWindowControls`: override wins over auto; `0` override disables
    when product enables; ignored when product disables; null product
    returns empty view.
- `tests/domain/supplier/_validation.spec.ts`
  - `validateWindowMeta`: new fields — rejects `enabled: true` without
    threshold, negative values, `maxCount < 1`. Accepts omitted optionals.
- `tests/domain/pricing/calculate.spec.ts`
  - Extends existing window line-item case: per-divider surcharge applied,
    flat schuifraam surcharge applied, omitted when meta absent.
- No 3D / animation tests (consistent with current convention).

Existing test count (413+) grows by ~12-15 cases. All run under
`pnpm test` via Vite+.

## File-level change list

**Domain (framework-free, tests required):**

- `src/domain/openings/controls.ts` (new) — `OPENING_AUTO_CONTROLS` registry,
  `deriveSegmentCount`.
- `src/domain/openings/resolve.ts` (new) — `resolveWindowControls`.
- `src/domain/openings/index.ts` (new) — re-exports.
- `src/domain/supplier/types.ts` — `WindowMeta` extension; new error codes.
- `src/domain/supplier/_validation.ts` — `validateWindowMeta` extension.
- `src/domain/building/types.ts` — `WallWindow.segmentCountOverride`.
- `src/domain/pricing/calculate.ts` — window line-item branch additions.

**Browser-coupled:**

- `src/store/useUIStore.ts` — `windowAnimations` slice + `toggleWindowOpen`.
- `src/store/useConfigStore.ts` — mutation: `setWindowSegmentOverride(buildingId, wallId, windowId, count | null)`.
- `src/lib/i18n.ts` — new keys.

**UI:**

- `src/components/admin/forms/SupplierProductForm.tsx` (window branch) —
  Controls card with Segments + Schuifraam subforms.
- `src/components/ui/WindowConfig.tsx` — Controls section in the sidebar editor.
- `src/components/canvas/WindowMesh.tsx` — segment + schuifraam render path;
  X-axis slide animation hook.

## Door extension path (out of scope, design-only check)

When doors get controls:

- `DoorMeta` gains its own typed fields (`leafDirection`, etc.).
- `WallConfig` gains per-instance overrides analogous to `segmentCountOverride`.
- The same `OPENING_AUTO_CONTROLS` registry serves any control whose
  `applicableKinds` includes `'door'` (segments would just work).
- The `SupplierProductForm` door branch picks up its Controls card following
  the window branch's pattern.

Nothing in this spec needs to change to support that.

## Open items (none blocking — flagged for review)

- Mullion thickness constant — should match existing window-frame mesh; will
  reuse a constant if one exists, otherwise add one to
  `src/domain/building/constants.ts`.
- Schuifraam slide direction — defaulting to "open toward the side with the
  most wall clearance" feels right; if the existing door logic is simpler
  (always +X), match that and simplify.

## Out of scope

- Doors getting controls (different spec).
- Horizontal segment dividers (sibling registry entry, future).
- Naked-window controls (priceBook lift, future).
- Multi-axis segments (vertical + horizontal grid). Future spec if/when
  product line demands it.
