# Dakbak controls — design

**Date:** 2026-05-05
**Scope:** Add two scene-level controls to the configurator — `fasciaHeight` and `fasciaOverhang` — together with per-product defaults/constraints, per-material pricing, admin UI, order/PDF/invoice display, and a fix for an existing wall-vs-fascia texture-alignment bug surfaced during this work.
**Out of scope:** Pitched-roof eaves/rakes (sliders are hidden when `roof.type === 'pitched'`); schematic floor-plan rendering of the overhang.

## Context

A "dakbak" is the fascia ring around the roof of an `overkapping` or `berging`. Today it's hardcoded:

- `FASCIA_HEIGHT = 0.36` m (`src/components/canvas/Roof.tsx:86`)
- Fascia sits flush with wall edges (no overhang). Connected sides suppress the fascia.
- `roof-trim` materials carry no pricing entry — fascia is effectively free.

The roof is scene-level (`ConfigData.roof: RoofConfig`), not per-building. Two new scalar controls fit this naturally and stay uniform across connected buildings without any new propagation logic.

## Behavioral requirements

1. **Scene-level uniformity.** One `fasciaHeight` and one `fasciaOverhang` for the entire scene; every building's roof reads the same value. (Free — roof is already scene-level.)
2. **Connected sides remain flush.** A connected edge has no fascia (today's behavior) and no overhang. Overhang only extends on non-connected sides.
3. **Pricing impact.**
   - Fascia material cost: `perimeter(non-connected) × fasciaHeight × roof-trim.perSqm`.
   - Overhang grows the roof footprint on non-connected sides → existing `roof-cover` per-m² pricing automatically scales.
4. **Per-product control (optional).** A product can specify defaults (`defaults.dakbak.*`) and narrow the global range (`constraints.dakbak.*`). A locked value is expressed as `min === max`.
5. **Visibility.** Sliders shown in the configurator. Floor-plan view ignores them. Quote line items, order/invoice templates, and PDF show the values.
6. **Backward compatible.** Existing scenes load with `fasciaHeight = 0.36`, `fasciaOverhang = 0` → visually + price-wise identical to today.

## Architecture overview

| Layer | Change |
|---|---|
| Domain types | `RoofConfig` += `fasciaHeight` + `fasciaOverhang` (required, with defaults). New constants in `building/constants.ts`. |
| Domain catalog | `MaterialPricing['roof-trim']?: { perSqm }`. `ProductDefaults.dakbak?` and `ProductConstraints.dakbak?`. New helper `dakbakRange(product)`. |
| Domain config | `migrateConfig` backfills missing fields (no version bump). `validateConfig` adds 2 new error codes. |
| Domain pricing | New `effectiveRoofFootprint` helper extends roof dims by overhang on non-connected sides. New `fasciaLineItem` per building. |
| Rendering | `Roof.tsx` switches to footprint-based geometry driven by `roof.fasciaHeight` + `roof.fasciaOverhang`. Pitched-roof path leaves both as no-ops. |
| Textures | `useWallTexture` accepts optional `offsetX` (meters); `FasciaBoardMesh` passes `-extLeft` / `-trimBack` to align fascia texture seams with the wall underneath (fixes pre-existing shift). |
| UI (configurator) | Two `Slider` rows in `RoofConfigSection.tsx`, gated on `roof.type === 'flat'`; effective range from `dakbakRange(product)`. |
| UI (admin) | "Dakbak" form section on the product editor (only when `kind in ['overkapping', 'berging']`). |
| Display | Order/invoice/PDF templates render dakbak values in the existing "Dak" specs row; the new fascia line item rides through `quoteSnapshot.items[].lineItems`. |
| Tests | `migrate.test.ts`, `validate.test.ts`, `mutations.test.ts`, `pricing.test.ts`, `product.test.ts`, `material.test.ts`. |

## Detailed design

### 1. Domain shape

**`src/domain/building/types.ts`:**

```ts
export interface RoofConfig {
  type: RoofType;
  pitch: number;
  coveringId: RoofCoveringId;
  trimMaterialId: string;
  insulation: boolean;
  insulationThickness: number;
  hasSkylight: boolean;
  fasciaHeight: number;    // meters; default 0.36
  fasciaOverhang: number;  // meters; default 0
}
```

**`src/domain/building/constants.ts`:**

```ts
export const DEFAULT_FASCIA_HEIGHT = 0.36;
export const MIN_FASCIA_HEIGHT = 0.10;
export const MAX_FASCIA_HEIGHT = 0.60;

export const DEFAULT_FASCIA_OVERHANG = 0;
export const MIN_FASCIA_OVERHANG = 0;
export const MAX_FASCIA_OVERHANG = 0.80;
```

**`src/domain/config/migrate.ts`:**

- `LegacyConfig.roof` widened to mark `fasciaHeight` and `fasciaOverhang` optional.
- `migrateConfig` returns `roof: { ...raw.roof, fasciaHeight: raw.roof.fasciaHeight ?? DEFAULT_FASCIA_HEIGHT, fasciaOverhang: raw.roof.fasciaOverhang ?? DEFAULT_FASCIA_OVERHANG }`.
- **No `CONFIG_VERSION` bump.** The forgiving-migrate pattern handles it.

**`src/domain/config/validate.ts`:**

```ts
| 'fascia_height_out_of_range'
| 'fascia_overhang_out_of_range'
```

`validateRoof` checks against `MIN_*` / `MAX_*` constants. Product-scoped narrowing is enforced at the UI/hydration layer, not in domain validate.

**`src/domain/config/mutations.ts`:**

- Default scene roof in the existing initialization path picks up `fasciaHeight: DEFAULT_FASCIA_HEIGHT, fasciaOverhang: DEFAULT_FASCIA_OVERHANG`.
- `applyProductDefaults` flow: when a product defines `defaults.dakbak.fasciaHeight` or `fasciaOverhang`, the first-building hydration path in `mutations.ts` (where `productDefaults.roof` is consulted today) extends `cfg.roof` with those values.

### 2. Catalog extensions

**`src/domain/catalog/types.ts`:**

```ts
export interface RoofTrimPricing { perSqm: number }

export interface MaterialPricing {
  // …existing slots…
  'roof-trim'?: RoofTrimPricing;
}

export interface ProductDefaults {
  // …existing fields…
  dakbak?: {
    fasciaHeight?: number;
    fasciaOverhang?: number;
  };
}

export interface ProductConstraints {
  // …existing fields…
  dakbak?: {
    fasciaHeightMin?: number;
    fasciaHeightMax?: number;
    fasciaOverhangMin?: number;
    fasciaOverhangMax?: number;
  };
}
```

**`src/domain/catalog/material.ts`:**

- Per-category gate accepts `'roof-trim'` and passes through `{ perSqm: number }` (must be ≥ 0).
- The existing comment "roof-trim — it has no pricing" is removed.

**`src/domain/catalog/product.ts`:**

- `validateProductCreate/Patch` validate `defaults.dakbak` + `constraints.dakbak`:
  - Each provided bound sits inside the global range (`MIN_*` … `MAX_*`).
  - `min ≤ max` (equality permitted = locked).
  - Provided defaults sit inside the product's narrowed range.
- New pure helper:

  ```ts
  export function dakbakRange(
    product: ProductRow | null,
  ): {
    height:   { min: number; max: number };
    overhang: { min: number; max: number };
  };
  ```

  Returns the intersection of the global constants and the product's narrowing. Used by the configurator slider UI and (for clamping) `applyProductDefaults`.

- `applyProductDefaults` extends its return type with optional `roof.fasciaHeight` / `roof.fasciaOverhang` so `mutations.ts` picks them up the same way it consumes `roof.coveringId`.

### 3. Pricing

**`src/domain/pricing/calculate.ts`:**

New helper:

```ts
function effectiveRoofFootprint(
  building: BuildingEntity,
  roof: RoofConfig,
  connectedSides: { front: boolean; back: boolean; left: boolean; right: boolean },
): { width: number; depth: number } {
  const o = roof.fasciaOverhang;
  const w = building.dimensions.width
    + (connectedSides.left  ? 0 : o)
    + (connectedSides.right ? 0 : o);
  const d = building.dimensions.depth
    + (connectedSides.front ? 0 : o)
    + (connectedSides.back  ? 0 : o);
  return { width: w, depth: d };
}
```

`roofLineItem` consumes the effective footprint when calling `roofTotalArea`. No changes to `findPrice` or to insulation math; the larger `area` flows through naturally.

New per-building line item:

```ts
function fasciaLineItem(
  building: BuildingEntity,
  roof: RoofConfig,
  connectedSides: Sides,
  materials: MaterialRow[],
): LineItem | null {
  const fp = effectiveRoofFootprint(building, roof, connectedSides);
  const perim = perimeterOfNonConnectedSides(fp, connectedSides);
  const area  = perim * roof.fasciaHeight;
  const trim  = materials.find(m => m.id === roof.trimMaterialId);
  const perSqm = trim?.pricing['roof-trim']?.perSqm ?? 0;
  if (area === 0 || perSqm === 0) return null;
  return {
    labelKey: 'pricing.lineItems.fascia',
    labelParams: { area, height: roof.fasciaHeight, overhang: roof.fasciaOverhang },
    materialId: roof.trimMaterialId,
    quantity: area,
    unit: 'm2',
    materialCost: area * perSqm,
    extrasCost: 0,
    total: area * perSqm,
  };
}
```

`calculateBuildingQuote` appends this line right after `roofLineItem`. Connected-only buildings produce a null line (no fascia, no cost).

`perimeterOfNonConnectedSides` uses the effective footprint extents from `effectiveRoofFootprint`:

- `front` perimeter contribution = `connectedSides.front ? 0 : effectiveWidth`.
- `back`  = `connectedSides.back  ? 0 : effectiveWidth`.
- `left`  = `connectedSides.left  ? 0 : effectiveDepth`.
- `right` = `connectedSides.right ? 0 : effectiveDepth`.

(This counts each fascia along its own footprint length; corner mitre overlap is a constant geometry detail and is not double-counted in pricing.)

### 4. Rendering — `src/components/canvas/Roof.tsx`

Replace the `FASCIA_HEIGHT` constant with `roof.fasciaHeight`. `FASCIA_THICKNESS = WALL_THICKNESS` stays.

Compute the effective footprint once:

```ts
const oh = roof.fasciaOverhang;
const minX = -hw - (hasLeft  ? 0 : oh);
const maxX =  hw + (hasRight ? 0 : oh);
const minZ = -hd - (hasBack  ? 0 : oh);
const maxZ =  hd + (hasFront ? 0 : oh);
```

Each fascia board lies along the corresponding footprint edge. Lengths span corner-to-corner of the effective footprint; corner mitres use the existing `FASCIA_THICKNESS / 2` overlap when both adjacent sides have fascia.

EPDM membrane:

- Spans the effective footprint inset by `FASCIA_THICKNESS / 2` on sides that have a fascia (today's `epdmInset…`), zero on connected sides.
- `epdmY = (height + roof.fasciaHeight) - EPDM_THICKNESS / 2 - 0.02`.

Pitched-roof path: the existing `PitchedRoof` / non-flat branch ignores both new fields. A future iteration can layer eaves/rakes.

### 5. Texture UV-offset fix — `src/lib/textures.ts` + `Roof.tsx`

`useWallTexture` accepts an optional fourth argument:

```ts
export function useWallTexture(
  materialId: string,
  wallWidth: number,
  wallHeight: number,
  offsetX = 0,
): PBRTextures | null
```

In the `repeat` `useEffect`, also set `texture.offset.x = offsetX / tileSize[0]` for `map`, `normalMap`, and `roughnessMap`. `offsetX = 0` keeps the wall callers identical.

`FasciaBoardMesh` passes `offsetX: -extLeft` (front/back boards) or `offsetX: -trimBack` (left/right boards). When the adjacent side has no fascia (`extLeft === 0`), behavior matches today.

This eliminates the ~7.5 cm horizontal seam between the wall and the fascia when both share the same material.

### 6. Configurator UI — `src/components/ui/RoofConfigSection.tsx`

Two new rows, rendered only when `roof.type === 'flat'`:

```tsx
const range = dakbakRange(sourceProduct);

<SectionLabel>{t('roof.fasciaHeight')}</SectionLabel>
{range.height.min === range.height.max ? (
  <p className="text-sm text-muted-foreground">
    {t('roof.fasciaLocked', { value: cm(range.height.min) })}
  </p>
) : (
  <Slider
    min={range.height.min}
    max={range.height.max}
    step={0.01}
    value={[roof.fasciaHeight]}
    onValueChange={([v]) => updateRoof({ fasciaHeight: v })}
  />
)}
```

Same pattern for `fasciaOverhang`. The "kit-restricted" hint reuses the existing `configurator.picker.kitRestricted` key when `sourceProduct.constraints.dakbak` is present.

New i18n keys (`src/lib/i18n.ts`):

- `roof.fasciaHeight`
- `roof.fasciaOverhang`
- `roof.fasciaLocked`
- `pricing.lineItems.fascia`

### 7. Admin product editor

Form section "Dakbak" inside `/admin/(authed)/catalog/products/[id]` (and create), only when `kind ∈ ['overkapping', 'berging']`. Fields:

- Default fasciaHeight (cm, optional)
- Default fasciaOverhang (cm, optional)
- Min/Max fasciaHeight (cm, optional pair)
- Min/Max fasciaOverhang (cm, optional pair)
- Help: "Laat leeg om de globale grenzen te gebruiken (10–60 cm hoogte, 0–80 cm oversteek)."

Form values map to `defaults.dakbak` and `constraints.dakbak`. Submit goes through the existing `POST/PATCH /api/admin/products/[id]` routes; the route handler delegates to `validateProductCreate/Patch`, which is extended in Section 2.

The form's client-side zod schema mirrors the domain validator (global bounds + `min ≤ max`) so users see inline errors before submit.

### 8. Order / invoice / PDF display

The new fascia line item rides through `quoteSnapshot.items[].lineItems`, so the configurator quote sidebar, `/admin/(authed)/orders/[id]`, `/shop/(authed)/account/orders/[id]`, and `renderInvoicePdf.tsx` show it for free.

The "Dak" specs row on order/invoice templates gains two values: fasciaHeight (cm) and fasciaOverhang (cm). Sourced from `configSnapshot.roof`. Surfaces:

- `src/app/admin/(authed)/orders/[id]/page.tsx`
- `src/app/shop/(authed)/account/orders/[id]/page.tsx`
- `src/lib/renderInvoicePdf.tsx`
- `src/lib/orderConfirmationEmail.ts` (if it currently lists roof specs)

(During planning, grep for the current specs renderer to enumerate exactly. Display-only edits — no API or snapshot changes.)

### 9. Tests

| File | Cases |
|---|---|
| `tests/migrate.test.ts` | Legacy roof without `fasciaHeight`/`fasciaOverhang` backfills to defaults. Existing scene → identical canonical form except for the two new fields. |
| `tests/validate.test.ts` | `fasciaHeight` outside `[MIN, MAX]` → `fascia_height_out_of_range`; same for overhang. In-range passes. |
| `tests/mutations.test.ts` | `updateRoof({ fasciaHeight: x })` preserves other fields and runs through the temporal/undo wrap. Product hydration with `defaults.dakbak.*` pins scene roof to those values. |
| `tests/pricing.test.ts` | Fully connected roof → no fascia line, no overhang area increase. Increasing `fasciaHeight` grows fascia line linearly. Increasing `fasciaOverhang` grows cover/insulation areas linearly on non-connected sides. Trim material with no `roof-trim.perSqm` → no fascia line. |
| `tests/product.test.ts` | `validateProductCreate/Patch` rejects out-of-global-range bounds and `min > max`. `dakbakRange(null)` returns global. `dakbakRange(narrowProduct)` returns the intersection. Locked case `min === max` allowed. |
| `tests/material.test.ts` | `roof-trim` pricing slot accepted; round-trips through validators; `perSqm < 0` rejected. |

No new integration tests; existing E2E flows unchanged.

## Open questions

None — all behavioral questions resolved during brainstorming.

## Risks & mitigations

- **Pricing surprise.** Tenants with existing scenes see no price change because `roof-trim.perSqm` is unset by default and `fasciaOverhang` defaults to 0. Tenants must opt in by editing trim materials in the catalog.
- **Pitched-roof omission.** Sliders are hidden on pitched roofs to prevent silent no-ops. Documented in the configurator copy if needed.
- **Schematic accuracy.** Floor plan deliberately shows wall outline only (per product owner). PDF/order specs row carries the numeric values so the overhang isn't lost downstream.

## Implementation order (rough sequencing)

1. Domain types + constants + migrate + validate + mutations.
2. Catalog extensions (`MaterialPricing['roof-trim']`, `ProductDefaults/Constraints.dakbak`, `dakbakRange`, validators).
3. Pricing helpers + `fasciaLineItem`.
4. Rendering update + texture-offset fix.
5. Configurator slider UI + i18n keys.
6. Admin product editor section.
7. Order/PDF/invoice display additions.
8. Tests added incrementally per layer (TDD where it fits).

The detailed plan with task breakdown will follow in `writing-plans`.
