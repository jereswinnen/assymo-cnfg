# Wall middenlaag (insulation + timber frame) — design

## Problem

Walls today are a two-cladding sandwich (`materialId` outer + optional
`materialIdInner`). Real walls have a structural / insulating middle layer
between the cladding skins — either a solid insulation panel (rockwool, PIR,
…) or a timber frame (SLS battens, h.o.h. spacing). Tenants want to sell
both kinds, pick them through the existing admin catalog, and have the
middenlaag be visible in the 3D configurator (especially when no inner
cladding is set, exposing the cavity / frame from inside).

## Scope

In scope: walls of `overkapping`, `berging`, and `muur` (the kinds whose
`BUILDING_KIND_META.sections` includes `'walls'`).

Out of scope:

- `poort` (gate) — no `walls`.
- Per-tenant override of layer proportions (constants, not admin-tunable).
- R-value / U-value calculation on insulation.
- Window/door reveals showing the exposed cavity around openings (the wall
  segment cuts straight through; reveals are not modelled).
- **Wall thickness varying with the chosen middenlaag.** The boss noted SLS
  battens range from 35mm to 89mm and the wall should ideally grow with the
  framing. Doing this properly requires threading a per-wall thickness
  through snap math, schematic geometry, roof positioning, and opening
  cutouts (≥5 consumer files, 13 sites today). For v1 we keep
  `WALL_THICKNESS = 0.15m` fixed and store the actual SLS depth as data on
  the material row (driving pricing + the admin display). A follow-up
  iteration can swap the constant for a per-wall derivation.

## Data model

### `WallConfig` (`src/domain/building/types.ts`)

Add one optional field, mirroring `materialIdInner`:

```ts
export interface WallConfig {
  // …existing fields
  materialId?: string;              // outer cladding
  materialIdInner?: string | null;  // inner cladding
  materialIdMiddenlaag?: string | null;  // NEW — references a 'middenlaag' material row
  // …
}
```

Semantics:
- `undefined` / `null` → no middenlaag on this wall (default).
- A string → must reference a non-archived material row whose `categories`
  includes `'middenlaag'`.
- No inherit-from-building fallback. Per-wall only.

### `MaterialCategory` (`src/domain/catalog/types.ts`)

Add `'middenlaag'` to the union and to `MATERIAL_CATEGORIES`:

```ts
export type MaterialCategory =
  | 'wall'
  | 'roof-cover'
  | 'roof-trim'
  | 'floor'
  | 'door'
  | 'gate'
  | 'middenlaag';
```

### `MaterialPricing` — middenlaag slot

All middenlaag-specific data (kind discriminator + dimensions + per-unit
price) lives inside the existing `pricing` jsonb under a single
`middenlaag` slot. No new DB column / migration required — the existing
`pricing jsonb` already carries arbitrary per-category shapes
(`wall.perSqm`, `floor.perSqm`, …).

```ts
export type MiddenlaagKind = 'panel' | 'frame';

export type MiddenlaagPricing =
  | {
      kind: 'panel';
      /** Stored thickness (mm). Drives admin display + the future
       *  "growing walls" iteration. Does NOT drive visual wall thickness
       *  in v1. */
      thicknessMm: number;
      perSqm: number;
    }
  | {
      kind: 'frame';
      /** SLS beam depth (mm). Boss-specified range: 35–89mm. Stored for
       *  admin display + the future "growing walls" iteration. Does NOT
       *  drive visual wall thickness in v1. */
      thicknessMm: number;
      /** Beam width (mm), parallel to the wall plane. Typical SLS: 38–45mm. */
      beamWidthMm: number;
      /** Hart-op-hart beam spacing (mm). Typical: 400–600mm. */
      beamSpacingMm: number;
      perBeam: number;
    };

export interface MaterialPricing {
  // …existing
  middenlaag?: MiddenlaagPricing;
}
```

Validator (`validateMaterialCreate` / `validateMaterialPatch`) enforces:

- `categories` includes `'middenlaag'` ⇔ `pricing.middenlaag` is present.
- `pricing.middenlaag.kind === 'panel'` → `thicknessMm` + `perSqm` required
  and finite > 0; `beamWidthMm` / `beamSpacingMm` / `perBeam` absent.
- `pricing.middenlaag.kind === 'frame'` → `thicknessMm` + `beamWidthMm` +
  `beamSpacingMm` + `perBeam` required and finite > 0; `perSqm` absent.

Mismatches use the existing `pricing_category_mismatch` error code. The
validator already drops other-category pricing entries when the
corresponding category isn't in `categories`; middenlaag follows the same
rule.

### `ProductSlot` (`src/domain/catalog/types.ts`)

Add `'wallMiddenlaag'` mapped to category `'middenlaag'`. Hydrates on spawn
the same way `wallCladdingInner` does (writes `materialIdMiddenlaag` to
every wall on the new building).

## Pricing

`src/domain/materials/resolve.ts` gains a sibling helper:

```ts
export function getEffectiveMiddenlaagMaterial(wall: WallConfig): string | null;
```

`src/domain/pricing/calculate.ts::wallLineItem`: when
`materialIdMiddenlaag` resolves to a real material id, emit a third line
item per wall. Two paths depending on `material.pricing.middenlaag.kind`:

- **panel**: same `wallNetArea` as the outer line (openings already
  subtracted). `materialCost = area × pricing.middenlaag.perSqm`. Label
  `wall.<side>.middenlaag`.
- **frame**: count of vertical posts =
  `Math.ceil((wallLength × 1000) / pricing.middenlaag.beamSpacingMm) + 1`.
  Cap to ≥ 2 (corners always get a post). `materialCost = beamCount ×
  pricing.middenlaag.perBeam`. Label `wall.<side>.middenlaag.frame`,
  labelParams: `{ count }`.

Both contribute `extrasCost = 0`. Existing outer / inner line items stay
exactly as they are — the middenlaag line is purely additive, so existing
scenes' quotes are byte-identical.

### Order snapshot

`buildQuoteSnapshot` freezes `lineItems[]` verbatim, so middenlaag lines
automatically flow into stored orders without schema changes. Pre-feature
orders continue to render correctly (no extra line items in their snapshot).

## Validation

`src/domain/config/validate.ts`:

- For each wall, when `materialIdMiddenlaag` is a string, look it up in the
  tenant's `'middenlaag'` catalog (non-archived only). Reject with
  `unknown_material` (existing code) at path `walls.<side>.materialIdMiddenlaag`.
- Allow `undefined` / `null` unconditionally.
- Same path-only disambiguation pattern the inner-cladding validator uses.

`validateProductCreate` / `validateProductPatch` auto-cover the new slot via
the existing `PRODUCT_SLOTS` iteration + `PRODUCT_SLOT_TO_CATEGORY` map.

## 3D rendering

`src/components/canvas/Wall.tsx` extends the existing 1- or 2-slab render
to 1, 2, or 3 slabs:

```
no middenlaag, no inner    → 1 full-thickness slab (today)
no middenlaag, inner set   → 2 half-thickness slabs (today)
middenlaag, no inner       → 2 slabs: outer cladding + middenlaag-filling-the-rest
middenlaag + inner         → 3 slabs: outer cladding + middenlaag + inner cladding
```

### Layer proportions

Defined as constants in `src/domain/building/constants.ts`:

```ts
export const WALL_LAYER_PROPORTIONS = {
  outerCladding: 0.20,
  middenlaag:    0.60,
  innerCladding: 0.20,
} as const;
```

With `WALL_THICKNESS = 0.15m` this maps to 30mm + 90mm + 30mm — close to a
realistic outer-cladding + 89mm SLS + inner-cladding sandwich. Slab depths
for the various states:

- Middenlaag + inner: `outer = 0.20 × T`, `middle = 0.60 × T`, `inner = 0.20 × T`.
- Middenlaag, no inner: `outer = 0.20 × T`, `middle = 0.80 × T` (fills inner's share).
- Inner, no middenlaag: existing 50/50 split.
- Neither: existing single slab.

### Panel kind

Solid mesh, same shape as the outer / inner slabs. Uses the material row's
color / texture. Same opening cutouts (door / window holes pass through
all layers via the same shared half-thickness `createWallWithOpeningsGeo`
extrusion).

### Frame kind

Replaces the middle slab with a SET of vertical post meshes:

- Post count: same formula as pricing — `Math.ceil((wallLength × 1000) / beamSpacingMm) + 1`.
- Post position along the wall length: evenly distributed (`postIndex × spacing`
  with the two end posts at `±wallLength / 2`).
- Post dimensions: `beamWidthMm / 1000` along wall length × `wallHeight`
  vertical × `0.60 × WALL_THICKNESS` thick.
- Material: the row's color / texture (typically wood).
- Posts SKIP positions that overlap a door / window cutout (a post that
  lands inside the opening is dropped; the engine doesn't lay a new post
  next to the opening — fine for v1, matches a reasonable carpentry
  approximation).
- Gaps between posts are empty. When no inner cladding is set, looking at
  the wall from inside the building shows the posts in the foreground and
  the outer cladding's interior surface behind them — the exposed-frame
  look.

## 2D plattegrond

`src/components/schematic/SchematicWalls.tsx` extends the existing
two-strip render to up-to-three strips when middenlaag is set:

```
no middenlaag                       → as today (1 strip when no inner, 2 strips when inner)
middenlaag, no inner                → 2 strips: outer + middenlaag-color (fills inner's share)
middenlaag + inner                  → 3 strips: outer + middenlaag-color + inner
```

Strips share the existing per-segment cutout list (openings cut through all
three identically). Frame-kind walls colour the middle strip with the row's
material color — no per-beam marks in v1 (would clutter the plan; "frame"
identity is conveyed by the wall-properties label, not the plan strip).

No per-strip click handlers — same as today after the face-selection
removal.

## Wall properties panel

`src/components/ui/SurfaceProperties.tsx` gets a "Middenlaag" section between
"Buitenbekleding" and "Binnenbekleding":

- When `materialIdMiddenlaag == null`: a single `+ Middenlaag toevoegen`
  button. Clicking seeds with the first available middenlaag material (or
  no-ops if the tenant has none).
- When set: a `MaterialSelect` filtered to the middenlaag catalog +
  "Verwijderen" link that clears the field. A small caption underneath
  summarises the row's kind-specific spec:
  - Panel: `"Rockwool — 100 mm"` (slug name + thickness).
  - Frame: `"Vurenhout SLS — 38×89 mm h.o.h. 600 mm"` (slug name + beam
    width × depth + spacing).
- Inner-cladding section logic unchanged.

## Admin material catalog

`src/components/admin/catalog/MaterialForm.tsx` grows a conditional
"Middenlaag" panel shown when `categories` includes `'middenlaag'`:

- Kind dropdown: `Paneel` / `Frame`.
- **If panel**:
  - Thickness (mm) — number input.
  - Prijs per m² — number input.
- **If frame**:
  - Beam depth (mm) — number input, range hint "Typisch 35–89 mm (SLS)".
  - Beam width (mm) — number input, range hint "Typisch 38–45 mm".
  - H.o.h. spacing (mm) — number input, range hint "Typisch 400–600 mm".
  - Prijs per balk — number input.

Switching kind clears the other kind's subobject so the persisted row stays
discriminator-consistent.

The form's existing pricing section gets a kind-aware "Middenlaag" pricing
row that mirrors the per-slot pricing inputs the form already uses for
`wall.perSqm` / `floor.perSqm` / etc. — single perSqm OR perBeam, depending
on kind.

## i18n keys

New `nl` keys in `src/lib/i18n.ts`:

- `wall.front.middenlaag` → "Middenlaag voorgevel"
- `wall.back.middenlaag` → "Middenlaag achtergevel"
- `wall.left.middenlaag` → "Middenlaag linkergevel"
- `wall.right.middenlaag` → "Middenlaag rechtergevel"
- `wall.front.middenlaag.frame` → "Houten frame voorgevel" (etc. for back/left/right)
- `wallProperties.middenlaag` → "Middenlaag"
- `wallProperties.addMiddenlaag` → "+ Middenlaag toevoegen"
- `wallProperties.removeMiddenlaag` → "Verwijderen"
- `wallProperties.middenlaagPanelSpec` → "{name} — {thickness} mm"
- `wallProperties.middenlaagFrameSpec` → "{name} — {width}×{depth} mm h.o.h. {spacing} mm"
- `admin.material.middenlaagKind` → "Type"
- `admin.material.middenlaagKind.panel` → "Paneel"
- `admin.material.middenlaagKind.frame` → "Frame"
- `admin.material.beamDepthMm` → "Diepte (mm)"
- `admin.material.beamWidthMm` → "Breedte balk (mm)"
- `admin.material.beamSpacingMm` → "H.o.h. (mm)"
- `admin.material.perBeam` → "Prijs per balk"

## Migration

No `configVersion` bump. `materialIdMiddenlaag` is optional → legacy scenes
deserialise unchanged. `migrateConfig` doesn't touch existing walls. The
hash-based dedup separates scenes that do and don't carry middenlaag
because the canonicalized JSON differs (same mechanism as inner cladding).

Database: no migration. All middenlaag-specific data sits inside the
existing `pricing` jsonb column under a `middenlaag` slot, alongside the
other per-category pricing shapes the column already holds. Old rows with
no middenlaag-related fields stay valid (validators only check the slot
when `categories` includes `'middenlaag'`).

## Seed (`src/db/seed.ts`)

Add idempotent (`skip-if-exists` by `(tenant_id, category, slug)`) demo
rows for the `assymo` tenant:

- `rockwool-100`: `pricing.middenlaag = { kind: 'panel', thicknessMm: 100, perSqm: 12 }`.
- `pir-80`: `pricing.middenlaag = { kind: 'panel', thicknessMm: 80, perSqm: 18 }`.
- `sls-38x89-hoh600`: `pricing.middenlaag = { kind: 'frame', thicknessMm: 89, beamWidthMm: 38, beamSpacingMm: 600, perBeam: 15 }`.

Picker is non-empty out of the box; sales reps can immediately demo.

## Tests

Domain (framework-free):

- `tests/pricing-wall-middenlaag.test.ts`:
  - Panel middenlaag → third line with materialCost = area × perSqm.
  - Frame middenlaag, 3m wall, 600mm spacing → beamCount = 6 (= ceil(3000/600)+1), materialCost = 6 × perBeam.
  - No middenlaag → same line count as today.
- `tests/materials-effective-middenlaag.test.ts`:
  - Returns null when not set; the slug when set.
- `tests/validate-wall-middenlaag.test.ts`:
  - Unknown / archived slug → `unknown_material` at `walls.<side>.materialIdMiddenlaag`.
- `tests/catalog-material-middenlaag.test.ts`:
  - Validator rejects a row whose `categories` includes `'middenlaag'`
    but `pricing.middenlaag` is absent.
  - Validator rejects a `kind: 'panel'` pricing entry that also carries
    `beamSpacingMm` (frame field).
  - Validator rejects a `kind: 'frame'` pricing entry that also carries
    `perSqm` (panel field).
  - Validator drops `pricing.middenlaag` when `categories` doesn't include
    `'middenlaag'` (mirrors the existing per-category drop rule).
- `tests/catalog-product-wall-middenlaag.test.ts`:
  - `applyProductDefaults` hydrates `materialIdMiddenlaag` from
    `mats.wallMiddenlaag` onto every wall.

## File touch-list

Domain:
- `src/domain/building/types.ts`
- `src/domain/catalog/types.ts`
- `src/domain/catalog/material.ts` (validators)
- `src/domain/catalog/product.ts` (slot + applyProductDefaults)
- `src/domain/config/validate.ts`
- `src/domain/config/mutations.ts` (addBuilding hydration)
- `src/domain/materials/resolve.ts`
- `src/domain/pricing/calculate.ts`

UI:
- `src/components/canvas/Wall.tsx` — three-slab render + frame post meshes.
- `src/components/schematic/SchematicWalls.tsx` — three-strip plattegrond.
- `src/components/ui/SurfaceProperties.tsx` — Middenlaag section.
- `src/components/admin/catalog/MaterialForm.tsx` — kind-aware middenlaag form.

Glue:
- `src/lib/i18n.ts`
- `src/db/seed.ts`

Tests: as listed above.

## Risks & mitigations

- **Visual ≠ stored thickness.** A 35mm SLS frame and an 89mm SLS frame
  look identical in v1 (both render at `0.60 × WALL_THICKNESS`). Mitigation:
  surface the actual mm in the wall-properties caption ("38×89 h.o.h. 600")
  so the user knows what they're buying even though the canvas can't show
  it. The follow-up "growing walls" iteration removes this gap entirely.
- **Beams obscured by door / window openings.** When a door takes up the
  full wall height in a 3m wall with 600mm spacing, several theoretical
  beam positions fall inside the opening. We drop those beams from the 3D
  render but keep the price (the beams still exist next to the opening in
  reality — admin can argue this is over-engineering; v1 accepts the
  pricing as authoritative). Future iteration could shift the beams.
- **Existing seeded material rows** carry no middenlaag-related fields.
  Validators must tolerate `middenlaagKind === undefined` on rows whose
  `categories` doesn't include `'middenlaag'` (this is the natural state)
  and only enforce the discriminator when category is present. Covered by
  the validator tests above.
