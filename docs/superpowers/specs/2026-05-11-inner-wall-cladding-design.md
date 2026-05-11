# Inner wall cladding — design

## Problem

A wall in the configurator currently has a single material (`WallConfig.materialId`,
inherited from the building's `primaryMaterialId` when undefined). Real walls have
two visible sides — an outer cladding facing outdoors and an inner cladding facing
indoors — and tenants want to sell that distinction. The goal is an optional
second material per wall, priceable through the existing per-tenant catalog and
selectable through the 2D plattegrond.

## Scope

In scope: walls of the `overkapping`, `berging`, and `muur` building kinds (the
three kinds whose `BUILDING_KIND_META.sections` includes `'walls'`).

Out of scope:

- `poort` (gate) — has no `walls` section.
- Door panel inner side. Doors keep a single `doorMaterialId` regardless of
  inner cladding.
- Per-face insulation modelling.
- A separate `'wall-inner'` material category, or any tenant-level surcharge for
  enabling inner cladding. Inner cladding re-uses the existing `'wall'` category
  and its `pricing.wall.perSqm`.

## Data model

### `WallConfig` (`src/domain/building/types.ts`)

Add one optional field:

```ts
export interface WallConfig {
  // …existing fields
  materialId?: string;              // outer cladding (unchanged)
  materialIdInner?: string | null;  // null / undefined → no inner cladding
}
```

Semantics mirror the existing `materialId`:

- `undefined` → no inner cladding present on this wall.
- `null` → reserved alias for "not set"; treated identically to `undefined` by
  resolvers. (Some persisted scenes round-trip through JSON and may surface
  `null`; tolerate both.)
- A string → must reference an existing non-archived material in the tenant's
  `'wall'` category catalog. There is no inherit-from-building fallback for the
  inner side; inner is per-wall only.

### `SelectedElement` (`src/domain/building/types.ts`)

Face selection rides on the existing wall selection:

```ts
export type SelectedElement =
  | { type: 'wall'; id: WallId; buildingId: string; face?: 'outer' | 'inner' }
  | { type: 'roof' }
  | null;
```

`face` defaults to `'outer'` when absent. Selection produced by the 3D canvas
and the legacy plattegrond click path never sets `face` (existing
behaviour). Only the plattegrond's per-face hit targets set it explicitly.

### `ProductSlot` + `ProductDefaults` (`src/domain/catalog/types.ts`)

Product defaults are slot-based, not per-side. Add one new slot:

```ts
export type ProductSlot =
  | 'wallCladding'
  | 'wallCladdingInner'  // NEW
  | 'roofCovering'
  | 'roofTrim'
  | 'floor'
  | 'door';

export const PRODUCT_SLOT_TO_CATEGORY: Record<ProductSlot, MaterialCategory> = {
  wallCladding: 'wall',
  wallCladdingInner: 'wall',  // NEW — same catalog category
  // …rest unchanged
};
```

`PRODUCT_SLOTS` gets the new entry. `defaults.materials.wallCladdingInner?:
string` is the per-product knob; when set, `applyProductDefaults` writes that
material id to `materialIdInner` on every wall of the spawned building (matches
how `wallCladding` already hydrates `materialId` on every wall via the
building's `primaryMaterialId`). Existing products carry no value → behaviour
unchanged.

`allowedMaterialsBySlot.wallCladdingInner` is supported automatically by the
existing slot-keyed allow-list machinery.

## Pricing

`src/domain/pricing/calculate.ts::wallLineItem`: when `materialIdInner` resolves
to a real material id, emit a **second** line item for that wall:

```
wall.<side>          area = wallNetArea           materialCost = area * outerPrice
wall.<side>.inner    area = wallNetArea (same)    materialCost = area * innerPrice
```

Both line items share the same `wallNetArea` — openings cut through the full
wall sandwich, so the inner net area equals the outer net area. The inner line
item carries `extrasCost = 0` (doors / windows are already priced on the outer
line). The wall's outer line stays exactly as today; the inner line is
additive, so existing scenes with no inner cladding produce an identical quote.

A new helper lives next to the outer one:

```ts
// src/domain/materials/resolve.ts
export function getEffectiveInnerWallMaterial(
  wallCfg: WallConfig,
  building: BuildingEntity,
  buildings?: BuildingEntity[],
): string | null;
```

Returns the wall's `materialIdInner` when set (string), otherwise `null`. No
fallback to building primary or to the outer material — the caller uses `null`
as the signal to skip the inner line item.

### Order snapshot

Orders freeze `quoteSnapshot.items[].lineItems[]`. Since the inner line item is
generated like any other line item, snapshots automatically include it without
schema changes. Stored orders predating this work continue to render correctly
(no extra line items).

## Validation

`src/domain/config/validate.ts`:

- For each wall, when `materialIdInner` is a string, look it up in the tenant's
  `'wall'` catalog (non-archived only). Reject with stable error code
  `wall_inner_material_not_found` on miss.
- Allow `undefined` and `null` unconditionally.
- The same check applies to product defaults via
  `validateProductCreate` / `validateProductPatch` — invalid material in
  `defaults.materials.wallCladdingInner` rejects with the same
  category-mismatch / not-found error codes the existing
  `defaults.materials.wallCladding` slot uses.

## 2D plattegrond — face selection

This is the only surface where face selection happens.

### Rendering

`src/components/schematic/SchematicWalls.tsx::SolidWall` already renders a wall
as either a single rectangle (no openings) or a series of segment rectangles
(with cutouts subtracted). The split lands in this same function:

- When `wallCfg.materialIdInner` is unset → keep today's rendering: one
  rectangle (or segments) of full thickness `WALL_THICKNESS`, painted with
  the outer material colour.
- When set → for each wall segment, render **two** parallel strips along the
  wall's thickness axis:
  - **Outer strip** — half-thickness on the wall's outward edge (away from
    the building's interior, per the existing `inward` convention in
    `getWallGeometries`). Filled with the outer material colour.
  - **Inner strip** — half-thickness on the inward edge. Filled with the
    inner material colour.
  - A thin separator stroke between the two strips so the split is visible.

Strip geometry derives from the existing `WallGeom.inward` direction — no new
geometry helper required, just a per-strip offset by `WALL_THICKNESS / 4` on
the inward axis from the wall midline. Openings cut through both strips
identically (same segment list applied per strip).

### Hit targets

Each strip gets its own `<rect>` with a click handler:

- Click on outer strip → `selectBuilding(buildingId)` + selection becomes
  `{ type: 'wall', id, buildingId, face: 'outer' }`.
- Click on inner strip → same with `face: 'inner'`.
- When inner cladding is OFF, the single full-thickness rectangle behaves as
  today (`face` left unset → defaults to `'outer'` in consumers).

`SchematicWalls` already accepts an `onWallClick` prop. Extend its signature:

```ts
onWallClick?: (wallId: WallId, buildingId: string, face?: 'outer' | 'inner') => void;
```

`SchematicView` threads through to its existing selection dispatch.

### Selection highlight

`SolidWall` currently highlights the entire wall when `selectedElement.type ===
'wall'` matches. With the split, highlight only the selected face's strip
(both strips render but only the matching one tints blue). When inner is off,
highlighting works exactly as today.

### Muur primitive

`muur` is rendered through the same `SchematicWalls` path on its single wall.
"Outer" vs "inner" follows the same `inward` convention used by the existing
geometry (perpendicular to the wall's long axis; the outer-facing direction is
the side opposite `inward`). Naming is a convention — there's no functional
asymmetry between the two sides on a free-standing wall.

## 3D canvas

`src/components/canvas/Wall.tsx`:

- When `materialIdInner` is unset → render as today: one box, one material.
- When set → render two thin slabs along the wall's thickness with a small
  visible gap (≈2 cm, representing the wall cavity). Outer slab uses the
  outer material; inner slab uses the inner material. Both slabs share the
  same opening-cutout geometry (door/window holes punch through both).

The 3D view does not drive face selection. Selection dispatch from the 3D
canvas leaves `face` at its current value when the click stays on the same
wall, and resets to `'outer'` when switching to a different wall (the same
shape the legacy plattegrond click path produces). The panel therefore stays
on whichever face the user chose in the plattegrond as long as the same wall
remains selected.

## Wall properties panel

`src/components/ui/SurfaceProperties.tsx`:

- When inner cladding is OFF for the selected wall:
  - Show the existing outer material picker (unchanged).
  - Below it, a single button `"+ Binnenbekleding toevoegen"`. Clicking
    seeds `materialIdInner` with the tenant's primary wall material
    (`building.primaryMaterialId` if it sits in the `'wall'` category;
    otherwise the first available wall material).
- When inner cladding is ON:
  - Show two pickers stacked: "Buitenbekleding" (outer) and "Binnenbekleding"
    (inner).
  - The picker matching `selectedElement.face` gets visual focus (existing
    selected-look). Clicking the unfocused header switches face — and updates
    `selectedElement.face` so the plattegrond highlight follows.
  - A "Verwijderen" link on the inner picker clears the field
    (`materialIdInner: undefined`), and resets `selectedElement.face` to
    `'outer'`.

The outer picker continues to drive `materialId`. The inner picker drives
`materialIdInner`. Both pickers are populated by `useTenantCatalogs({ wall })`
— same catalog, same per-product allow-list filtering.

## i18n

New keys in `src/lib/i18n.ts`:

- `wall.front.inner`, `wall.back.inner`, `wall.left.inner`, `wall.right.inner`
  — inner line item labels.
- `wallProperties.outer` — "Buitenbekleding" header.
- `wallProperties.inner` — "Binnenbekleding" header.
- `wallProperties.addInner` — "+ Binnenbekleding toevoegen" button.
- `wallProperties.removeInner` — "Verwijderen" action.

## Migration

No `configVersion` bump required: `materialIdInner` is optional, so legacy
scenes deserialize unchanged. `migrateConfig` does not need to touch existing
walls.

The hash-based dedup in `POST /api/configs` automatically separates scenes that
do and don't carry inner cladding because the canonicalized JSON differs.

## Mutations

`src/domain/config/mutations.ts`: extend `updateBuildingWall` callers as needed
— no new pure mutation needed since the existing path already merges a partial
`WallConfig`. The UI calls `updateBuildingWall(buildingId, wallId, { materialIdInner: … })`.

A small convenience helper `removeInnerCladding(buildingId, wallId)` is not
required; the UI clears via `updateBuildingWall(..., { materialIdInner: undefined })`.

## Tests

New / updated `tests/`:

- `pricing-wall-inner.test.ts`:
  - Wall with no inner cladding → one wall line item per side (current).
  - Wall with inner cladding → two line items per side; inner area == outer
    area; total = outer + inner.
  - Inner line item carries `extrasCost = 0` (door / window costs stay on
    outer).
- `materials-effective-inner.test.ts`:
  - `getEffectiveInnerWallMaterial` returns `null` when not set; the
    material id when set; null on the `null` sentinel.
- `validate-wall-inner.test.ts`:
  - Unknown inner material → `wall_inner_material_not_found`.
  - Archived inner material → `wall_inner_material_not_found`.
  - Valid inner material → passes.
- `catalog-product-wall-inner.test.ts`:
  - `validateProductCreate` rejects a product whose
    `defaults.materials.wallCladdingInner` references a non-wall or archived
    material (mirrors existing `wallCladding` validation).
  - `applyProductDefaults` hydrates `materialIdInner` on every wall when
    `materials.wallCladdingInner` is set.
  - `allowedMaterialsBySlot.wallCladdingInner` allow-list narrows the inner
    picker as expected.
- `configStore` / migration spec: round-trip a legacy config without
  `materialIdInner` — fields stay undefined; quote total unchanged.

## File touch-list

Domain (framework-free):

- `src/domain/building/types.ts` — add `materialIdInner`, extend `SelectedElement`.
- `src/domain/materials/resolve.ts` — add `getEffectiveInnerWallMaterial`.
- `src/domain/pricing/calculate.ts` — emit inner line item in `wallLineItem`.
- `src/domain/config/validate.ts` — validate `materialIdInner`.
- `src/domain/catalog/types.ts` — extend `WallDefaults` with `materialIdInner`.
- `src/domain/catalog/applyDefaults.ts` — hydrate `materialIdInner`.
- `src/domain/catalog/validate.ts` — validate `materialIdInner` in product defaults.

UI:

- `src/components/schematic/SchematicWalls.tsx` — two-strip rendering, per-face hit targets, per-face highlight.
- `src/components/schematic/SchematicView.tsx` — thread `face` through `onWallClick` to selection dispatch.
- `src/components/ui/SurfaceProperties.tsx` — inner picker + add/remove affordances + face header switching.
- `src/components/canvas/Wall.tsx` — two-slab rendering when inner is set.

i18n / glue:

- `src/lib/i18n.ts` — new keys.

Tests: as listed above, all under `tests/`.

## Risks & mitigations

- **Plattegrond clutter.** Two strips per wall + separator could feel busy on
  small overkappings. Mitigation: render the split only when inner cladding is
  set; otherwise the wall looks exactly as today.
- **Click target shrinks.** Each strip is half-thickness, so on a 0.15 m wall
  each strip is 0.075 m wide in world coords. At default zoom that's still
  larger than the existing pointer dead-zone, but worth verifying on touch
  devices. Mitigation: keep the existing `pointerEvents` setup; if needed,
  bump the hit padding via a transparent overlay.
- **Order-history drift.** Orders snapshot the priced line items at submit
  time, so adding the inner line item later doesn't retroactively change
  historical totals. No mitigation needed — confirmed by the
  `buildQuoteSnapshot` behaviour.
