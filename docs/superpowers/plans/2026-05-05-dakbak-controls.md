# Dakbak Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scene-level `fasciaHeight` and `fasciaOverhang` controls to the configurator with optional per-product narrowing/locking, per-material `roof-trim` pricing, and a fix for the wall-vs-fascia texture seam shift.

**Architecture:** Both controls live as scalars on `RoofConfig` (already scene-level — uniformity across connected buildings is automatic). Per-product control plugs in through new optional `defaults.dakbak` + `constraints.dakbak` subobjects on `ProductRow`. Pricing flows through a new `MaterialPricing['roof-trim']` slot; the existing `roof-cover` pricing absorbs overhang area growth via a new `effectiveRoofFootprint` helper. Rendering switches from "extend-from-wall-edge" geometry to footprint-based geometry.

**Tech Stack:** TypeScript, React 19, react-three-fiber + drei, Zustand + zundo, shadcn `Slider`, Vitest (`vite-plus/test`), Drizzle (no schema migration — `tenants.priceBook` and `products.defaults`/`constraints` are jsonb).

**Backward compatibility:** Existing scenes load with `fasciaHeight = 0.36`, `fasciaOverhang = 0` → visually + price-wise identical to today. Existing tenants have no `roof-trim.perSqm` set → fascia stays free until they price their trim materials.

**Spec:** `docs/superpowers/specs/2026-05-05-dakbak-controls-design.md`

---

## File map

### Created
- *(none — all extensions land in existing files)*

### Modified
- **Domain — building**
  - `src/domain/building/constants.ts` — new fascia min/max/default constants
  - `src/domain/building/types.ts` — `RoofConfig` += `fasciaHeight` + `fasciaOverhang`
- **Domain — config**
  - `src/domain/config/migrate.ts` — `LegacyConfig.roof` widened, backfill in `migrateConfig`
  - `src/domain/config/mutations.ts` — `makeInitialConfig` defaults, `addBuilding` product roof hydration
  - `src/domain/config/validate.ts` — two new error codes, `validateRoof` bounds checks
- **Domain — catalog**
  - `src/domain/catalog/types.ts` — `RoofTrimPricing`, `MaterialPricing['roof-trim']`, `ProductDefaults.dakbak`, `ProductConstraints.dakbak`
  - `src/domain/catalog/material.ts` — `validatePricing` accepts `roof-trim`
  - `src/domain/catalog/product.ts` — validators for `defaults.dakbak` + `constraints.dakbak`, new `dakbakRange()` helper, `applyProductDefaults` extension, `ProductBuildingDefaults.roof` widened
- **Domain — pricing**
  - `src/domain/pricing/calculate.ts` — `effectiveRoofFootprint`, `fasciaLineItem`, `calculateBuildingQuote` + `calculateTotalQuote` accept `connections`
- **Domain — orders**
  - `src/domain/orders/snapshot.ts` — pass `connections` to `calculateTotalQuote`
- **Library**
  - `src/lib/textures.ts` — `useWallTexture` accepts optional `offsetX`
  - `src/lib/i18n.ts` — new keys
- **Components**
  - `src/components/canvas/Roof.tsx` — footprint-based geometry, drive by props, fascia texture offset
  - `src/components/ui/RoofConfigSection.tsx` — two new sliders, locked-display fallback
  - `src/components/ui/QuoteSummary.tsx` — pass `connections`
  - `src/components/schematic/exportFloorPlan.ts` — pass `connections`
- **API routes**
  - `src/app/api/configs/[code]/route.ts` — pass `connections`
- **Admin product form**
  - `src/app/admin/(authed)/catalog/products/[id]/ProductForm.tsx` (or whatever the existing form file is — to be located in Task 17) — "Dakbak" form section
- **Test fixtures + tests**
  - `tests/fixtures.ts` — `DEFAULT_FIXTURE_ROOF` includes new fields
  - `tests/migrate.test.ts`, `tests/mutations.test.ts`, `tests/configStore.test.ts`, `tests/pricing.test.ts`, `tests/catalog-product-validate.test.ts`, `tests/catalog-applyDefaults.test.ts`, `tests/catalog-material-validate.test.ts` — new cases

---

## Task 1 — Constants

**Files:**
- Modify: `src/domain/building/constants.ts`

- [ ] **Step 1: Add the constants**

Append to `src/domain/building/constants.ts`:

```ts
// Dakbak (fascia ring) bounds — meters.
export const DEFAULT_FASCIA_HEIGHT = 0.36;
export const MIN_FASCIA_HEIGHT = 0.10;
export const MAX_FASCIA_HEIGHT = 0.60;

export const DEFAULT_FASCIA_OVERHANG = 0;
export const MIN_FASCIA_OVERHANG = 0;
export const MAX_FASCIA_OVERHANG = 0.80;
```

- [ ] **Step 2: Re-export from `@/domain/building`**

Verify `src/domain/building/index.ts` re-exports everything from `./constants` (it should — confirm with `grep "constants" src/domain/building/index.ts`). No edit needed if already wildcard-exporting.

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (constants are not yet referenced anywhere; no type errors).

- [ ] **Step 4: Commit**

```bash
git add src/domain/building/constants.ts
git commit -m "feat(domain): add fascia height + overhang constants"
```

---

## Task 2 — Extend `RoofConfig` shape

This will break compilation everywhere `RoofConfig` is constructed until Tasks 3–6 catch up. That's expected — TypeScript is acting as our test.

**Files:**
- Modify: `src/domain/building/types.ts`

- [ ] **Step 1: Add the two fields to `RoofConfig`**

In `src/domain/building/types.ts` around line 81:

```ts
export interface RoofConfig {
  type: RoofType;
  pitch: number;
  coveringId: RoofCoveringId;
  trimMaterialId: string;
  insulation: boolean;
  insulationThickness: number; // mm
  hasSkylight: boolean;
  /** Fascia (dakbak) board height — meters. Default 0.36. Applied only on
   *  flat roofs; pitched-roof rendering ignores it. */
  fasciaHeight: number;
  /** Outward extension of the roof past the wall on non-connected sides —
   *  meters. 0 = flush. Connected sides always stay flush. Pitched-roof
   *  rendering ignores it. */
  fasciaOverhang: number;
}
```

- [ ] **Step 2: Run typecheck — expect cascade of failures**

Run: `pnpm exec tsc --noEmit`
Expected: FAIL with multiple "Property 'fasciaHeight' is missing in type" errors at every `RoofConfig` literal (mutations, fixtures, tests).

The next tasks fix each call site.

- [ ] **Step 3: Commit (broken state — fixed in next tasks)**

```bash
git add src/domain/building/types.ts
git commit -m "feat(domain): add fasciaHeight + fasciaOverhang to RoofConfig

Subsequent tasks update construction sites + migrate."
```

---

## Task 3 — Update `makeInitialConfig`

**Files:**
- Modify: `src/domain/config/mutations.ts`

- [ ] **Step 1: Update the literal in `makeInitialConfig`**

In `src/domain/config/mutations.ts` around line 119:

```ts
import { ... existing imports ...,
  DEFAULT_FASCIA_HEIGHT,
  DEFAULT_FASCIA_OVERHANG,
} from '@/domain/building';

// ...

export function makeInitialConfig(): ConfigData {
  return {
    version: CONFIG_VERSION,
    buildings: [],
    connections: [],
    roof: {
      type: 'flat',
      pitch: 0,
      coveringId: 'epdm',
      trimMaterialId: 'wood',
      insulation: true,
      insulationThickness: 150,
      hasSkylight: false,
      fasciaHeight: DEFAULT_FASCIA_HEIGHT,
      fasciaOverhang: DEFAULT_FASCIA_OVERHANG,
    },
    defaultHeight: INITIAL_DEFAULT_HEIGHT,
  };
}
```

- [ ] **Step 2: Run typecheck — fewer errors but still some**

Run: `pnpm exec tsc --noEmit`
Expected: FAIL only in test fixtures + migrate (still to do).

- [ ] **Step 3: Commit**

```bash
git add src/domain/config/mutations.ts
git commit -m "feat(config): seed default fascia values in makeInitialConfig"
```

---

## Task 4 — Migration backfill

**Files:**
- Modify: `src/domain/config/migrate.ts`
- Modify: `tests/migrate.test.ts`

- [ ] **Step 1: Write a failing test that legacy roof gets defaults backfilled**

Append to `tests/migrate.test.ts` inside the `describe('migrateConfig', …)` block:

```ts
  it('backfills fasciaHeight and fasciaOverhang to defaults when missing', () => {
    const out = migrateConfig({
      buildings: [legacyBuilding],
      connections: [],
      // Cast: simulate legacy DB row that pre-dates these fields.
      roof: { ...BASE_ROOF } as never,
    });
    expect(out.roof.fasciaHeight).toBe(0.36);
    expect(out.roof.fasciaOverhang).toBe(0);
  });

  it('preserves fasciaHeight and fasciaOverhang when already present', () => {
    const out = migrateConfig({
      buildings: [legacyBuilding],
      connections: [],
      roof: { ...BASE_ROOF, fasciaHeight: 0.5, fasciaOverhang: 0.3 },
    });
    expect(out.roof.fasciaHeight).toBe(0.5);
    expect(out.roof.fasciaOverhang).toBe(0.3);
  });
```

- [ ] **Step 2: Run test — fails (and likely test suite has compile errors)**

Run: `pnpm test --run tests/migrate.test.ts`
Expected: compile error or assertion failure.

- [ ] **Step 3: Update `LegacyConfig` and `migrateConfig`**

Edit `src/domain/config/migrate.ts`:

```ts
import type {
  BuildingEntity,
  Orientation,
  RoofConfig,
  SnapConnection,
} from '@/domain/building';
import {
  DEFAULT_PRIMARY_MATERIAL,
  DEFAULT_FASCIA_HEIGHT,
  DEFAULT_FASCIA_OVERHANG,
} from '@/domain/building';
import type { ConfigData } from './types';
import { CONFIG_VERSION } from './types';

export type LegacyBuilding =
  Omit<BuildingEntity, 'primaryMaterialId' | 'orientation' | 'heightOverride'>
  & Partial<Pick<BuildingEntity, 'primaryMaterialId' | 'orientation' | 'heightOverride'>>;

/** Roof shape as it may arrive from older codes — fields added by later
 *  schema revisions are optional and get backfilled. */
export type LegacyRoof =
  Omit<RoofConfig, 'fasciaHeight' | 'fasciaOverhang'>
  & Partial<Pick<RoofConfig, 'fasciaHeight' | 'fasciaOverhang'>>;

export interface LegacyConfig {
  version?: number;
  buildings: LegacyBuilding[];
  connections: SnapConnection[];
  roof: LegacyRoof;
  defaultHeight?: number;
}

export function migrateBuilding(b: LegacyBuilding): BuildingEntity {
  return {
    ...b,
    primaryMaterialId: b.primaryMaterialId ?? DEFAULT_PRIMARY_MATERIAL,
    orientation: b.orientation ?? ('horizontal' satisfies Orientation),
    heightOverride: b.heightOverride ?? null,
  };
}

function migrateRoof(roof: LegacyRoof): RoofConfig {
  return {
    ...roof,
    fasciaHeight: roof.fasciaHeight ?? DEFAULT_FASCIA_HEIGHT,
    fasciaOverhang: roof.fasciaOverhang ?? DEFAULT_FASCIA_OVERHANG,
  };
}

export function migrateConfig(raw: LegacyConfig): ConfigData {
  const buildings = raw.buildings.map(migrateBuilding);
  const structural = buildings.find((b) => b.type !== 'paal' && b.type !== 'muur' && b.type !== 'poort');
  const defaultHeight = raw.defaultHeight ?? structural?.dimensions.height ?? 3;

  return {
    version: CONFIG_VERSION,
    buildings,
    connections: raw.connections,
    roof: migrateRoof(raw.roof),
    defaultHeight,
  };
}
```

- [ ] **Step 4: Run the migrate test — passes**

Run: `pnpm test --run tests/migrate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/config/migrate.ts tests/migrate.test.ts
git commit -m "feat(config): migrate legacy roof to backfill fascia fields"
```

---

## Task 5 — Update test fixtures

**Files:**
- Modify: `tests/fixtures.ts`

- [ ] **Step 1: Update `DEFAULT_FIXTURE_ROOF`**

In `tests/fixtures.ts`:

```ts
const DEFAULT_FIXTURE_ROOF: RoofConfig = {
  type: 'flat',
  pitch: 0,
  coveringId: 'epdm',
  trimMaterialId: 'wood',
  insulation: true,
  insulationThickness: 150,
  hasSkylight: false,
  fasciaHeight: 0.36,
  fasciaOverhang: 0,
};
```

- [ ] **Step 2: Run typecheck across the whole project**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (or only catalog/pricing/UI errors that come from later tasks; no surprises in the migrate/config/test paths).

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`
Expected: PASS for migrate, configStore, mutations, pricing, etc. — anything that uses `makeRoof()` or `makeConfig()` now compiles.

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures.ts
git commit -m "test: include fascia defaults in fixture roof"
```

---

## Task 6 — Validate roof bounds

**Files:**
- Modify: `src/domain/config/validate.ts`
- Modify: `tests/validate.test.ts` (or wherever `validateConfig` is tested — locate before writing)

- [ ] **Step 1: Locate the existing validate test**

Run: `grep -rn 'validateConfig\|validateRoof\|pitch_out_of_range' tests/`
Note the file path. (Likely `tests/validate.test.ts` or embedded in another file — use what's there. If no dedicated file exists, create `tests/validate.test.ts`.)

- [ ] **Step 2: Write failing tests**

Add to the validate test file:

```ts
import { validateConfig } from '@/domain/config';
import { makeConfig, makeRoof } from './fixtures';

describe('validateRoof — fascia bounds', () => {
  it('rejects fasciaHeight below MIN', () => {
    const cfg = makeConfig({ roof: makeRoof({ fasciaHeight: 0.05 }) });
    const errors = validateConfig(cfg);
    expect(errors.some(e => e.code === 'fascia_height_out_of_range')).toBe(true);
  });

  it('rejects fasciaHeight above MAX', () => {
    const cfg = makeConfig({ roof: makeRoof({ fasciaHeight: 0.7 }) });
    const errors = validateConfig(cfg);
    expect(errors.some(e => e.code === 'fascia_height_out_of_range')).toBe(true);
  });

  it('rejects fasciaOverhang below MIN', () => {
    const cfg = makeConfig({ roof: makeRoof({ fasciaOverhang: -0.1 }) });
    const errors = validateConfig(cfg);
    expect(errors.some(e => e.code === 'fascia_overhang_out_of_range')).toBe(true);
  });

  it('rejects fasciaOverhang above MAX', () => {
    const cfg = makeConfig({ roof: makeRoof({ fasciaOverhang: 1.0 }) });
    const errors = validateConfig(cfg);
    expect(errors.some(e => e.code === 'fascia_overhang_out_of_range')).toBe(true);
  });

  it('accepts in-range values', () => {
    const cfg = makeConfig({ roof: makeRoof({ fasciaHeight: 0.4, fasciaOverhang: 0.3 }) });
    const errors = validateConfig(cfg);
    expect(errors.filter(e => e.code === 'fascia_height_out_of_range' || e.code === 'fascia_overhang_out_of_range')).toEqual([]);
  });
});
```

- [ ] **Step 3: Run — expect failures**

Run: `pnpm test --run <validate test file>`
Expected: FAIL — `'fascia_height_out_of_range'` is not yet a `ValidationCode`.

- [ ] **Step 4: Add codes + bounds to the validator**

In `src/domain/config/validate.ts`:

```ts
import { ... existing ...,
  MIN_FASCIA_HEIGHT,
  MAX_FASCIA_HEIGHT,
  MIN_FASCIA_OVERHANG,
  MAX_FASCIA_OVERHANG,
} from '@/domain/building';

export type ValidationCode =
  | 'out_of_range'
  | 'unknown_material'
  | 'door_too_wide'
  | 'opening_out_of_bounds'
  | 'opening_overlap'
  | 'window_too_small'
  | 'connection_missing_building'
  | 'duplicate_building_id'
  | 'no_structural_building'
  | 'pitch_out_of_range'
  | 'insulation_out_of_range'
  | 'fascia_height_out_of_range'
  | 'fascia_overhang_out_of_range';
```

In `validateRoof`, after the existing insulation check:

```ts
if (roof.fasciaHeight < MIN_FASCIA_HEIGHT || roof.fasciaHeight > MAX_FASCIA_HEIGHT) {
  errors.push({
    path: 'roof.fasciaHeight',
    code: 'fascia_height_out_of_range',
    message: `Fascia height ${roof.fasciaHeight}m outside [${MIN_FASCIA_HEIGHT}, ${MAX_FASCIA_HEIGHT}]`,
  });
}
if (roof.fasciaOverhang < MIN_FASCIA_OVERHANG || roof.fasciaOverhang > MAX_FASCIA_OVERHANG) {
  errors.push({
    path: 'roof.fasciaOverhang',
    code: 'fascia_overhang_out_of_range',
    message: `Fascia overhang ${roof.fasciaOverhang}m outside [${MIN_FASCIA_OVERHANG}, ${MAX_FASCIA_OVERHANG}]`,
  });
}
```

- [ ] **Step 5: Run — passes**

Run: `pnpm test --run <validate test file>`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/config/validate.ts tests/validate.test.ts
git commit -m "feat(config): validate fasciaHeight + fasciaOverhang bounds"
```

---

## Task 7 — `MaterialPricing['roof-trim']` slot

**Files:**
- Modify: `src/domain/catalog/types.ts`
- Modify: `src/domain/catalog/material.ts`
- Modify: `tests/catalog-material-validate.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/catalog-material-validate.test.ts`:

```ts
describe('validateMaterialCreate — roof-trim pricing', () => {
  it('accepts roof-trim with perSqm pricing', () => {
    const result = validateMaterialCreate({
      categories: ['roof-trim'],
      slug: 'aluminium-trim',
      name: 'Aluminium dakbaktrim',
      color: '#888888',
      pricing: { 'roof-trim': { perSqm: 25 } },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pricing['roof-trim']).toEqual({ perSqm: 25 });
    }
  });

  it('accepts roof-trim without pricing (free fascia, backwards-compat)', () => {
    const result = validateMaterialCreate({
      categories: ['roof-trim'],
      slug: 'gratis-trim',
      name: 'Gratis trim',
      color: '#888888',
      pricing: {},
    });
    expect(result.ok).toBe(true);
  });

  it('rejects negative perSqm on roof-trim', () => {
    const result = validateMaterialCreate({
      categories: ['roof-trim'],
      slug: 'bad-trim',
      name: 'Bad trim',
      color: '#888888',
      pricing: { 'roof-trim': { perSqm: -5 } },
    });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm test --run tests/catalog-material-validate.test.ts`
Expected: FAIL.

- [ ] **Step 3: Extend `MaterialPricing` type**

In `src/domain/catalog/types.ts` around line 44:

```ts
export interface RoofTrimPricing { perSqm: number }

export interface MaterialPricing {
  wall?: WallPricing;
  'roof-cover'?: RoofCoverPricing;
  'roof-trim'?: RoofTrimPricing;
  floor?: FloorPricing;
  door?: DoorPricing;
  gate?: GatePricing;
}
```

- [ ] **Step 4: Update `validatePricing` in `material.ts`**

In `src/domain/catalog/material.ts`, in `validatePricing` (around line 99):

Remove the explicit `roof-trim` rejection block:

```ts
// DELETE this block (was at line 118):
if (key === 'roof-trim') {
  errors.push({ field: `pricing.${key}`, code: 'pricing_invalid' });
  return undefined;
}
```

Keep the `roof-trim` skip in the "every category must have pricing" loop (around line 147) — it should remain because `roof-trim` pricing is *optional*, not required. Update the comment to match:

```ts
// Every pricing-bearing category in `categories` must have an entry —
// except roof-trim, which has optional pricing (empty → free fascia).
for (const c of categories) {
  if (c === 'roof-trim') continue;
  if (!(c in out)) {
    errors.push({ field: `pricing.${c}`, code: 'pricing_invalid' });
    return undefined;
  }
}
```

The generic `wall / roof-cover / floor / gate / roof-trim` `{ perSqm }` validation block already handles `roof-trim` correctly once the explicit rejection is gone (they all share the `{ perSqm: number }` shape).

- [ ] **Step 5: Update the function-level comment**

Change the comment above `validatePricing` (around line 95):

```ts
/** Validate the `pricing` map against the categories the material claims.
 *  A material only prices the categories it's sold under. `roof-trim`
 *  pricing is optional — empty/missing means the fascia uses no
 *  per-m² cost. */
```

- [ ] **Step 6: Run — passes**

Run: `pnpm test --run tests/catalog-material-validate.test.ts`
Expected: PASS.

- [ ] **Step 7: Run full test suite**

Run: `pnpm test`
Expected: PASS — no regression in other catalog tests.

- [ ] **Step 8: Commit**

```bash
git add src/domain/catalog/types.ts src/domain/catalog/material.ts tests/catalog-material-validate.test.ts
git commit -m "feat(catalog): allow roof-trim materials to carry perSqm pricing"
```

---

## Task 8 — `ProductDefaults.dakbak` and `ProductConstraints.dakbak` types

**Files:**
- Modify: `src/domain/catalog/types.ts`

- [ ] **Step 1: Add the new subobjects**

In `src/domain/catalog/types.ts`, in `ProductDefaults` (around line 184) — after the existing `poort?:` block, add:

```ts
  /** Optional scene-roof scalars hydrated when the first product-sourced
   *  building of `kind ∈ ['overkapping', 'berging']` is added. Each field
   *  is independent: provide one without the other. Ignored on
   *  `kind === 'poort'`. Values in meters; clamped to the global range
   *  (and any `constraints.dakbak.*` narrowing) at hydration time. */
  dakbak?: {
    fasciaHeight?: number;
    fasciaOverhang?: number;
  };
```

In `ProductConstraints` (around line 211) — after the existing `poort?:` block, add:

```ts
  /** Optional narrowing of the global fascia-height / fascia-overhang
   *  ranges. Empty/missing = "no narrowing". `min === max` = "locked".
   *  All bounds in meters. Each provided bound must sit inside the
   *  global range; `min ≤ max` enforced by the validator. */
  dakbak?: {
    fasciaHeightMin?: number;
    fasciaHeightMax?: number;
    fasciaOverhangMin?: number;
    fasciaOverhangMax?: number;
  };
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS — these are pure type additions.

- [ ] **Step 3: Commit**

```bash
git add src/domain/catalog/types.ts
git commit -m "feat(catalog): add dakbak subobject to product defaults + constraints"
```

---

## Task 9 — Validate `defaults.dakbak` and `constraints.dakbak`

**Files:**
- Modify: `src/domain/catalog/product.ts`
- Modify: `tests/catalog-product-validate.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/catalog-product-validate.test.ts`:

```ts
describe('validateProductCreate — dakbak', () => {
  const baseProduct = {
    kind: 'overkapping' as const,
    slug: 'p1',
    name: 'P1',
    description: null,
    heroImage: null,
    defaults: {},
    constraints: {},
    basePriceCents: 0,
    sortOrder: 0,
  };

  it('accepts in-range defaults and constraints', () => {
    const r = validateProductCreate({
      ...baseProduct,
      defaults: { dakbak: { fasciaHeight: 0.4, fasciaOverhang: 0.2 } },
      constraints: { dakbak: { fasciaHeightMin: 0.3, fasciaHeightMax: 0.5, fasciaOverhangMin: 0.1, fasciaOverhangMax: 0.3 } },
    });
    expect(r.ok).toBe(true);
  });

  it('rejects fasciaHeightMin below global MIN', () => {
    const r = validateProductCreate({
      ...baseProduct,
      constraints: { dakbak: { fasciaHeightMin: 0.05 } },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects fasciaHeightMax above global MAX', () => {
    const r = validateProductCreate({
      ...baseProduct,
      constraints: { dakbak: { fasciaHeightMax: 0.9 } },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects min > max', () => {
    const r = validateProductCreate({
      ...baseProduct,
      constraints: { dakbak: { fasciaHeightMin: 0.5, fasciaHeightMax: 0.3 } },
    });
    expect(r.ok).toBe(false);
  });

  it('accepts min === max (locked)', () => {
    const r = validateProductCreate({
      ...baseProduct,
      constraints: { dakbak: { fasciaHeightMin: 0.4, fasciaHeightMax: 0.4 } },
      defaults:    { dakbak: { fasciaHeight: 0.4 } },
    });
    expect(r.ok).toBe(true);
  });

  it('rejects default outside the product-narrowed range', () => {
    const r = validateProductCreate({
      ...baseProduct,
      defaults:    { dakbak: { fasciaHeight: 0.55 } },
      constraints: { dakbak: { fasciaHeightMin: 0.3, fasciaHeightMax: 0.5 } },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects fasciaOverhang default below global MIN', () => {
    const r = validateProductCreate({
      ...baseProduct,
      defaults: { dakbak: { fasciaOverhang: -0.05 } },
    });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm test --run tests/catalog-product-validate.test.ts`
Expected: FAIL.

- [ ] **Step 3: Locate existing dakbak-shaped validator**

Inspect `src/domain/catalog/product.ts` — find how the existing `poort?` defaults + constraints are validated. The dakbak validator follows the same pattern (a small helper that reads optional keys, accumulates field errors, returns the typed-out subobject or undefined).

- [ ] **Step 4: Add the validator helpers**

In `src/domain/catalog/product.ts` (top of file, near other `import` blocks), import the constants:

```ts
import {
  MIN_FASCIA_HEIGHT,
  MAX_FASCIA_HEIGHT,
  MIN_FASCIA_OVERHANG,
  MAX_FASCIA_OVERHANG,
} from '@/domain/building';
```

Add a pair of helpers (place them near the existing `poort` validator helpers in the same file):

```ts
function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function validateDakbakConstraints(
  raw: unknown,
  errors: ValidationFieldError[],
): ProductConstraints['dakbak'] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object') {
    errors.push({ field: 'constraints.dakbak', code: 'constraints_invalid' });
    return undefined;
  }
  const r = raw as Record<string, unknown>;
  const out: NonNullable<ProductConstraints['dakbak']> = {};
  const checkBound = (key: 'fasciaHeightMin' | 'fasciaHeightMax' | 'fasciaOverhangMin' | 'fasciaOverhangMax', min: number, max: number) => {
    if (!(key in r)) return;
    const v = r[key];
    if (!isFiniteNumber(v) || v < min || v > max) {
      errors.push({ field: `constraints.dakbak.${key}`, code: 'constraints_invalid' });
      return;
    }
    out[key] = v;
  };
  checkBound('fasciaHeightMin',   MIN_FASCIA_HEIGHT,   MAX_FASCIA_HEIGHT);
  checkBound('fasciaHeightMax',   MIN_FASCIA_HEIGHT,   MAX_FASCIA_HEIGHT);
  checkBound('fasciaOverhangMin', MIN_FASCIA_OVERHANG, MAX_FASCIA_OVERHANG);
  checkBound('fasciaOverhangMax', MIN_FASCIA_OVERHANG, MAX_FASCIA_OVERHANG);

  if (out.fasciaHeightMin !== undefined && out.fasciaHeightMax !== undefined && out.fasciaHeightMin > out.fasciaHeightMax) {
    errors.push({ field: 'constraints.dakbak.fasciaHeightMin', code: 'constraints_invalid' });
  }
  if (out.fasciaOverhangMin !== undefined && out.fasciaOverhangMax !== undefined && out.fasciaOverhangMin > out.fasciaOverhangMax) {
    errors.push({ field: 'constraints.dakbak.fasciaOverhangMin', code: 'constraints_invalid' });
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function validateDakbakDefaults(
  raw: unknown,
  constraints: ProductConstraints['dakbak'] | undefined,
  errors: ValidationFieldError[],
): ProductDefaults['dakbak'] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object') {
    errors.push({ field: 'defaults.dakbak', code: 'defaults_invalid' });
    return undefined;
  }
  const r = raw as Record<string, unknown>;
  const out: NonNullable<ProductDefaults['dakbak']> = {};

  if ('fasciaHeight' in r) {
    const v = r.fasciaHeight;
    const lo = constraints?.fasciaHeightMin ?? MIN_FASCIA_HEIGHT;
    const hi = constraints?.fasciaHeightMax ?? MAX_FASCIA_HEIGHT;
    if (!isFiniteNumber(v) || v < lo || v > hi) {
      errors.push({ field: 'defaults.dakbak.fasciaHeight', code: 'defaults_invalid' });
    } else {
      out.fasciaHeight = v;
    }
  }
  if ('fasciaOverhang' in r) {
    const v = r.fasciaOverhang;
    const lo = constraints?.fasciaOverhangMin ?? MIN_FASCIA_OVERHANG;
    const hi = constraints?.fasciaOverhangMax ?? MAX_FASCIA_OVERHANG;
    if (!isFiniteNumber(v) || v < lo || v > hi) {
      errors.push({ field: 'defaults.dakbak.fasciaOverhang', code: 'defaults_invalid' });
    } else {
      out.fasciaOverhang = v;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
```

(Reuse the actual `ValidationFieldError` codes already defined in this file — `constraints_invalid` and `defaults_invalid` should match the existing convention. If different code names are used in the file, substitute them.)

- [ ] **Step 5: Wire helpers into `validateProductCreate` and `validateProductPatch`**

In both validators, after the existing `poort` handling and before assembling the result:

```ts
const dakbakConstraintsOut = validateDakbakConstraints(input.constraints?.dakbak, errors);
const dakbakDefaultsOut    = validateDakbakDefaults(input.defaults?.dakbak, dakbakConstraintsOut, errors);

// Assign to the output objects:
if (dakbakConstraintsOut) constraintsOut.dakbak = dakbakConstraintsOut;
if (dakbakDefaultsOut)    defaultsOut.dakbak    = dakbakDefaultsOut;
```

(Adapt to the actual variable names already used in the validators — read the file first to match.)

- [ ] **Step 6: Run — passes**

Run: `pnpm test --run tests/catalog-product-validate.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/catalog/product.ts tests/catalog-product-validate.test.ts
git commit -m "feat(catalog): validate product dakbak defaults + constraints"
```

---

## Task 10 — `dakbakRange()` helper

**Files:**
- Modify: `src/domain/catalog/product.ts`
- Modify: `tests/catalog-product-validate.test.ts` (or new `tests/catalog-dakbakRange.test.ts`)

- [ ] **Step 1: Write failing tests**

Add a new describe block:

```ts
import { dakbakRange } from '@/domain/catalog';
import type { ProductRow } from '@/domain/catalog';

const productRow = (constraints: Partial<ProductRow['constraints']>): ProductRow => ({
  id: 'p', tenantId: 't', kind: 'overkapping', slug: 's', name: 'n',
  description: null, heroImage: null,
  defaults: {},
  constraints: constraints as ProductRow['constraints'],
  basePriceCents: 0, sortOrder: 0,
  archivedAt: null, createdAt: '', updatedAt: '',
});

describe('dakbakRange', () => {
  it('returns global range for null product', () => {
    expect(dakbakRange(null)).toEqual({
      height:   { min: 0.10, max: 0.60 },
      overhang: { min: 0,    max: 0.80 },
    });
  });

  it('returns global range for product with no dakbak constraints', () => {
    expect(dakbakRange(productRow({}))).toEqual({
      height:   { min: 0.10, max: 0.60 },
      overhang: { min: 0,    max: 0.80 },
    });
  });

  it('intersects with product constraints when present', () => {
    const r = dakbakRange(productRow({
      dakbak: { fasciaHeightMin: 0.30, fasciaHeightMax: 0.50, fasciaOverhangMin: 0.10, fasciaOverhangMax: 0.40 },
    }));
    expect(r).toEqual({
      height:   { min: 0.30, max: 0.50 },
      overhang: { min: 0.10, max: 0.40 },
    });
  });

  it('respects partial narrowing — only the provided bound moves', () => {
    const r = dakbakRange(productRow({
      dakbak: { fasciaHeightMin: 0.40 },
    }));
    expect(r).toEqual({
      height:   { min: 0.40, max: 0.60 },
      overhang: { min: 0,    max: 0.80 },
    });
  });

  it('returns equal min and max when product locks the value', () => {
    const r = dakbakRange(productRow({
      dakbak: { fasciaHeightMin: 0.45, fasciaHeightMax: 0.45 },
    }));
    expect(r.height).toEqual({ min: 0.45, max: 0.45 });
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm test --run tests/catalog-product-validate.test.ts`
Expected: FAIL — `dakbakRange` not exported.

- [ ] **Step 3: Add `dakbakRange` to `src/domain/catalog/product.ts`**

```ts
import {
  // …already-imported constants…
  MIN_FASCIA_HEIGHT,
  MAX_FASCIA_HEIGHT,
  MIN_FASCIA_OVERHANG,
  MAX_FASCIA_OVERHANG,
} from '@/domain/building';

/** Effective dakbak range = global constants narrowed by the product
 *  (when present). Used by the configurator slider UI to bound the
 *  control and by the admin product form's client-side validation. */
export function dakbakRange(
  product: ProductRow | null,
): {
  height:   { min: number; max: number };
  overhang: { min: number; max: number };
} {
  const c = product?.constraints.dakbak;
  return {
    height: {
      min: c?.fasciaHeightMin ?? MIN_FASCIA_HEIGHT,
      max: c?.fasciaHeightMax ?? MAX_FASCIA_HEIGHT,
    },
    overhang: {
      min: c?.fasciaOverhangMin ?? MIN_FASCIA_OVERHANG,
      max: c?.fasciaOverhangMax ?? MAX_FASCIA_OVERHANG,
    },
  };
}
```

- [ ] **Step 4: Re-export from the catalog barrel**

Verify `src/domain/catalog/index.ts` re-exports `dakbakRange`. If using a `export * from './product'`, no edit needed; otherwise add.

- [ ] **Step 5: Run — passes**

Run: `pnpm test --run tests/catalog-product-validate.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/catalog/product.ts tests/catalog-product-validate.test.ts src/domain/catalog/index.ts
git commit -m "feat(catalog): dakbakRange() pure helper for slider bounds"
```

---

## Task 11 — `applyProductDefaults` surfaces dakbak

**Files:**
- Modify: `src/domain/catalog/product.ts`
- Modify: `tests/catalog-applyDefaults.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/catalog-applyDefaults.test.ts`:

```ts
describe('applyProductDefaults — dakbak', () => {
  it('surfaces fasciaHeight + fasciaOverhang under roof when set', () => {
    const out = applyProductDefaults(productRow({
      kind: 'overkapping',
      defaults: { dakbak: { fasciaHeight: 0.4, fasciaOverhang: 0.2 } },
    }));
    expect(out.roof?.fasciaHeight).toBe(0.4);
    expect(out.roof?.fasciaOverhang).toBe(0.2);
  });

  it('omits roof.fasciaHeight when only one of the two is set', () => {
    const out = applyProductDefaults(productRow({
      kind: 'berging',
      defaults: { dakbak: { fasciaOverhang: 0.3 } },
    }));
    expect(out.roof?.fasciaHeight).toBeUndefined();
    expect(out.roof?.fasciaOverhang).toBe(0.3);
  });

  it('does not surface dakbak for poort products', () => {
    const out = applyProductDefaults(productRow({
      kind: 'poort',
      defaults: { dakbak: { fasciaHeight: 0.4 } } as never,
    }));
    expect(out.roof).toBeUndefined();
  });
});
```

(Use the existing `productRow` helper in that test file or copy from above. Match its signature.)

- [ ] **Step 2: Run — expect failures**

Run: `pnpm test --run tests/catalog-applyDefaults.test.ts`
Expected: FAIL.

- [ ] **Step 3: Extend `ProductBuildingDefaults.roof`**

In `src/domain/catalog/product.ts` around line 567:

```ts
export interface ProductBuildingDefaults {
  // …existing fields…
  roof?: {
    coveringId?: string;
    trimMaterialId?: string;
    fasciaHeight?: number;
    fasciaOverhang?: number;
  };
  // …
}
```

- [ ] **Step 4: Surface dakbak in `applyProductDefaults`**

In `applyProductDefaults`, in the non-poort branch (after the existing `mats`/roof block, around line 632):

```ts
  const db = product.defaults.dakbak;
  if (db && (db.fasciaHeight !== undefined || db.fasciaOverhang !== undefined)) {
    out.roof = out.roof ?? {};
    if (db.fasciaHeight   !== undefined) out.roof.fasciaHeight   = db.fasciaHeight;
    if (db.fasciaOverhang !== undefined) out.roof.fasciaOverhang = db.fasciaOverhang;
  }
  return out;
```

- [ ] **Step 5: Run — passes**

Run: `pnpm test --run tests/catalog-applyDefaults.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/catalog/product.ts tests/catalog-applyDefaults.test.ts
git commit -m "feat(catalog): surface dakbak defaults in ProductBuildingDefaults"
```

---

## Task 12 — `addBuilding` hydrates scene roof with product dakbak

**Files:**
- Modify: `src/domain/config/mutations.ts`
- Modify: `tests/mutations.test.ts`

- [ ] **Step 1: Write failing test**

Append to `tests/mutations.test.ts`:

```ts
describe('addBuilding — product dakbak hydration', () => {
  it('applies fasciaHeight and fasciaOverhang from product on first building', () => {
    const cfg = makeInitialConfig();
    const productDefaults: ProductBuildingDefaults = {
      sourceProductId: 'pp',
      type: 'overkapping',
      dimensions: { width: 4, depth: 3 },
      roof: { fasciaHeight: 0.5, fasciaOverhang: 0.4 },
    };
    const { cfg: next } = addBuilding(cfg, 'overkapping', [0, 0], productDefaults);
    expect(next.roof.fasciaHeight).toBe(0.5);
    expect(next.roof.fasciaOverhang).toBe(0.4);
  });

  it('does not overwrite fasciaHeight on subsequent product builds', () => {
    let cfg = makeInitialConfig();
    cfg = addBuilding(cfg, 'overkapping', [0, 0], {
      sourceProductId: 'a', type: 'overkapping', dimensions: {},
      roof: { fasciaHeight: 0.5 },
    }).cfg;
    cfg = addBuilding(cfg, 'berging', [10, 0], {
      sourceProductId: 'b', type: 'berging', dimensions: {},
      roof: { fasciaHeight: 0.3 },
    }).cfg;
    expect(cfg.roof.fasciaHeight).toBe(0.5);
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm test --run tests/mutations.test.ts`
Expected: FAIL.

- [ ] **Step 3: Extend the roof hydration in `addBuilding`**

In `src/domain/config/mutations.ts` around line 213, replace the existing block:

```ts
  // Roof is scene-level. Only apply product roof defaults on the first building.
  if (productDefaults?.roof && cfg.buildings.length === 0) {
    nextCfg.roof = {
      ...cfg.roof,
      ...(productDefaults.roof.coveringId
        ? { coveringId: productDefaults.roof.coveringId as typeof cfg.roof.coveringId }
        : {}),
      ...(productDefaults.roof.trimMaterialId
        ? { trimMaterialId: productDefaults.roof.trimMaterialId }
        : {}),
      ...(productDefaults.roof.fasciaHeight !== undefined
        ? { fasciaHeight: productDefaults.roof.fasciaHeight }
        : {}),
      ...(productDefaults.roof.fasciaOverhang !== undefined
        ? { fasciaOverhang: productDefaults.roof.fasciaOverhang }
        : {}),
    };
  }
```

- [ ] **Step 4: Run — passes**

Run: `pnpm test --run tests/mutations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/config/mutations.ts tests/mutations.test.ts
git commit -m "feat(config): apply product dakbak defaults to scene roof"
```

---

## Task 13 — Pricing: `effectiveRoofFootprint` + thread `connections`

This task changes the public signature of `calculateBuildingQuote` and `calculateTotalQuote` (adds a required `connections` parameter). All callers updated in this task.

**Files:**
- Modify: `src/domain/pricing/calculate.ts`
- Modify: `src/domain/orders/snapshot.ts`
- Modify: `src/components/ui/QuoteSummary.tsx`
- Modify: `src/components/schematic/exportFloorPlan.ts`
- Modify: `src/app/api/configs/[code]/route.ts`
- Modify: `tests/pricing.test.ts`

- [ ] **Step 1: Write failing test for footprint expansion**

Append to `tests/pricing.test.ts`:

```ts
import type { SnapConnection } from '@/domain/building';

describe('roof pricing — overhang footprint', () => {
  it('grows roof area linearly with overhang on isolated buildings', () => {
    const baseRoof = makeRoof({ fasciaOverhang: 0 });
    const fatRoof  = makeRoof({ fasciaOverhang: 0.5 });
    const cfg0 = makeConfig({ roof: baseRoof });
    const cfg1 = makeConfig({ roof: fatRoof });

    const q0 = calculateTotalQuote(cfg0.buildings, cfg0.roof, [], DEFAULT_PRICE_BOOK, FIXTURE_MATERIALS, [], cfg0.defaultHeight);
    const q1 = calculateTotalQuote(cfg1.buildings, cfg1.roof, [], DEFAULT_PRICE_BOOK, FIXTURE_MATERIALS, [], cfg1.defaultHeight);

    const roofItem0 = q0.lineItems.find(i => i.labelKey === 'quote.roof');
    const roofItem1 = q1.lineItems.find(i => i.labelKey === 'quote.roof');
    expect(roofItem0!.area).toBe(4 * 4);     // 16
    expect(roofItem1!.area).toBe(5 * 5);     // 25 (each side +0.5)
  });

  it('does not grow roof footprint on connected sides', () => {
    const cfg = makeConfig({
      buildings: [
        makeBuilding({ id: 'a', type: 'overkapping', dimensions: { width: 4, depth: 4, height: 2.6 }, position: [0, 0],
          walls: { front: BLANK_WALL, back: BLANK_WALL, left: BLANK_WALL, right: BLANK_WALL } }),
        makeBuilding({ id: 'b', type: 'overkapping', dimensions: { width: 4, depth: 4, height: 2.6 }, position: [4, 0],
          walls: { front: BLANK_WALL, back: BLANK_WALL, left: BLANK_WALL, right: BLANK_WALL } }),
      ],
      connections: [
        { buildingAId: 'a', sideA: 'right', buildingBId: 'b', sideB: 'left' } as SnapConnection,
      ],
      roof: makeRoof({ fasciaOverhang: 0.5 }),
    });
    const q = calculateTotalQuote(cfg.buildings, cfg.roof, cfg.connections, DEFAULT_PRICE_BOOK, FIXTURE_MATERIALS, [], cfg.defaultHeight);
    const roofItems = q.lineItems.filter(i => i.labelKey === 'quote.roof');
    // Each building has overhang on 3 sides only (right of A and left of B are connected).
    // Building A: width = 4 + 0.5 (left) + 0 (right) = 4.5; depth = 4 + 0.5 + 0.5 = 5 → 22.5
    // Building B: width = 4 + 0 + 0.5 = 4.5; depth = 5 → 22.5
    expect(roofItems[0].area).toBeCloseTo(22.5, 5);
    expect(roofItems[1].area).toBeCloseTo(22.5, 5);
  });
});
```

(`BLANK_WALL` is already defined at the top of `pricing.test.ts`.)

- [ ] **Step 2: Run — expect compile errors and assertion failures**

Run: `pnpm test --run tests/pricing.test.ts`
Expected: FAIL — signature mismatch on `calculateTotalQuote`.

- [ ] **Step 3: Add `effectiveRoofFootprint` and update signatures**

In `src/domain/pricing/calculate.ts`:

```ts
import type {
  BuildingEntity,
  RoofConfig,
  SnapConnection,
  WallId,
} from '@/domain/building';

interface ConnectedSides {
  front: boolean; back: boolean; left: boolean; right: boolean;
}

function buildingConnectedSides(
  buildingId: string,
  connections: readonly SnapConnection[],
): ConnectedSides {
  const sides: ConnectedSides = { front: false, back: false, left: false, right: false };
  for (const c of connections) {
    if (c.buildingAId === buildingId) sides[c.sideA as keyof ConnectedSides] = true;
    if (c.buildingBId === buildingId) sides[c.sideB as keyof ConnectedSides] = true;
  }
  return sides;
}

/** Roof footprint extended outward by `fasciaOverhang` on non-connected
 *  sides only. Connected sides stay flush — no overhang there. */
export function effectiveRoofFootprint(
  building: BuildingEntity,
  roof: RoofConfig,
  connectedSides: ConnectedSides,
): { width: number; depth: number } {
  const o = roof.fasciaOverhang;
  return {
    width: building.dimensions.width
      + (connectedSides.left  ? 0 : o)
      + (connectedSides.right ? 0 : o),
    depth: building.dimensions.depth
      + (connectedSides.front ? 0 : o)
      + (connectedSides.back  ? 0 : o),
  };
}
```

Update `roofLineItem` to use the effective footprint:

```ts
function roofLineItem(
  building: BuildingEntity,
  roof: RoofConfig,
  connectedSides: ConnectedSides,
  priceBook: PriceBook,
  roofCoverCatalog: readonly { atomId: string; pricePerSqm: number }[],
): LineItem {
  const { width, depth } = effectiveRoofFootprint(building, roof, connectedSides);
  const area = roofTotalArea(width, depth, roof.pitch, roof.type);
  const materialCost = area * findPrice(roofCoverCatalog, roof.coveringId);
  const insulationCost = roof.insulation
    ? area * roof.insulationThickness * priceBook.insulationPerSqmPerMm
    : 0;
  let extrasCost = 0;
  if (roof.hasSkylight) extrasCost += priceBook.skylightFee;

  return {
    labelKey: 'quote.roof',
    area,
    materialCost,
    insulationCost,
    extrasCost,
    total: materialCost + insulationCost + extrasCost,
  };
}
```

Update `calculateBuildingQuote` and `calculateTotalQuote` signatures (insert `connections` after `roof`):

```ts
export function calculateBuildingQuote(
  building: BuildingEntity,
  roof: RoofConfig,
  connections: readonly SnapConnection[],
  defaultHeight: number,
  priceBook: PriceBook,
  materials: MaterialRow[],
  supplierProducts: SupplierProductRow[],
  buildings?: BuildingEntity[],
): { lineItems: LineItem[]; total: number } {
  // …
  const connectedSides = buildingConnectedSides(building.id, connections);
  // …
  lineItems.push(roofLineItem(building, roof, connectedSides, priceBook, roofCoverCatalog));
  // …
}

export function calculateTotalQuote(
  buildings: BuildingEntity[],
  roof: RoofConfig,
  connections: readonly SnapConnection[],
  priceBook: PriceBook,
  materials: MaterialRow[],
  supplierProducts: SupplierProductRow[],
  defaultHeight = 3,
): { lineItems: LineItem[]; total: number } {
  const lineItems: LineItem[] = [];
  for (const building of buildings) {
    const { lineItems: items } = calculateBuildingQuote(
      building, roof, connections, defaultHeight, priceBook, materials, supplierProducts, buildings,
    );
    lineItems.push(...items);
  }
  const total = lineItems.reduce((s, i) => s + i.total, 0);
  return { lineItems, total };
}
```

- [ ] **Step 4: Update all four callers**

`src/domain/orders/snapshot.ts:37` — pass `connections` (already has `cfg.connections` in scope):

```ts
const { lineItems, total } = calculateTotalQuote(
  cfg.buildings, cfg.roof, cfg.connections, priceBook, materials, supplierProducts, cfg.defaultHeight,
);
```

`src/components/ui/QuoteSummary.tsx:13` — pull `connections` from the store:

```ts
const buildings = useConfigStore((s) => s.buildings);
const roof = useConfigStore((s) => s.roof);
const connections = useConfigStore((s) => s.connections);
const defaultHeight = useConfigStore((s) => s.defaultHeight);
// …
const { lineItems, total } = calculateTotalQuote(
  buildings, roof, connections, tenant.priceBook, tenant.catalog.materials,
  tenant.supplierCatalog.products, defaultHeight,
);
```

`src/components/schematic/exportFloorPlan.ts:124` — read connections from the same source the function already uses (likely a `cfg`/`config` argument; if the function only takes individual fields, add `connections` to its signature and update the caller).

`src/app/api/configs/[code]/route.ts:47` — pass `migrated.connections`:

```ts
const { lineItems, total } = calculateTotalQuote(
  migrated.buildings, migrated.roof, migrated.connections,
  tenant.priceBook, tenant.catalog.materials, tenant.supplierCatalog.products, migrated.defaultHeight,
);
```

- [ ] **Step 5: Run — passes**

Run: `pnpm test --run tests/pricing.test.ts`
Expected: PASS.

- [ ] **Step 6: Run full suite + typecheck**

Run: `pnpm test && pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/pricing/calculate.ts src/domain/orders/snapshot.ts \
        src/components/ui/QuoteSummary.tsx src/components/schematic/exportFloorPlan.ts \
        src/app/api/configs/[code]/route.ts tests/pricing.test.ts
git commit -m "feat(pricing): grow roof area with overhang on non-connected sides

calculateBuildingQuote and calculateTotalQuote now take a connections
array so per-building roof footprint can extend only on free edges."
```

---

## Task 14 — Pricing: `fasciaLineItem`

**Files:**
- Modify: `src/domain/pricing/calculate.ts`
- Modify: `tests/pricing.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/pricing.test.ts`:

```ts
describe('fasciaLineItem', () => {
  const trimRow = (perSqm: number | undefined): MaterialRow => row({
    categories: ['roof-trim'],
    slug: 'wood',  // matches default fixture roof.trimMaterialId
    pricing: perSqm !== undefined ? { 'roof-trim': { perSqm } } : {},
  });

  // Reuse FIXTURE_MATERIALS and ADD a trim row (replace the wood wall row's
  // categories to also include 'roof-trim'? Easier: append a separate slug.
  // For these tests we override roof.trimMaterialId to a dedicated trim slug.)
  const matsWithTrim = (perSqm: number | undefined) => [
    ...FIXTURE_MATERIALS,
    row({
      categories: ['roof-trim'],
      slug: 'alu-trim',
      pricing: perSqm !== undefined ? { 'roof-trim': { perSqm } } : {},
    }),
  ];

  it('emits no fascia line when trim has no roof-trim pricing', () => {
    const cfg = makeConfig({ roof: makeRoof({ trimMaterialId: 'alu-trim' }) });
    const q = calculateTotalQuote(cfg.buildings, cfg.roof, cfg.connections,
      DEFAULT_PRICE_BOOK, matsWithTrim(undefined), [], cfg.defaultHeight);
    expect(q.lineItems.find(i => i.labelKey === 'pricing.lineItems.fascia')).toBeUndefined();
  });

  it('emits a fascia line equal to perimeter * fasciaHeight * perSqm', () => {
    const cfg = makeConfig({ roof: makeRoof({ trimMaterialId: 'alu-trim', fasciaHeight: 0.4, fasciaOverhang: 0 }) });
    // 4×4 building, isolated → perimeter = 4*4 = 16, area = 16 * 0.4 = 6.4, cost = 6.4 * 25 = 160
    const q = calculateTotalQuote(cfg.buildings, cfg.roof, cfg.connections,
      DEFAULT_PRICE_BOOK, matsWithTrim(25), [], cfg.defaultHeight);
    const f = q.lineItems.find(i => i.labelKey === 'pricing.lineItems.fascia');
    expect(f).toBeDefined();
    expect(f!.area).toBeCloseTo(6.4, 5);
    expect(f!.total).toBeCloseTo(160, 5);
  });

  it('emits no fascia line on a fully-connected isolated building', () => {
    // Edge case: a single building with all 4 sides marked connected (degenerate).
    const cfg = makeConfig({
      buildings: [
        makeBuilding({ id: 'a', type: 'overkapping',
          dimensions: { width: 4, depth: 4, height: 2.6 }, position: [0, 0],
          walls: { front: BLANK_WALL, back: BLANK_WALL, left: BLANK_WALL, right: BLANK_WALL } }),
        makeBuilding({ id: 'b', type: 'overkapping', dimensions: { width: 4, depth: 4, height: 2.6 }, position: [4, 0],
          walls: { front: BLANK_WALL, back: BLANK_WALL, left: BLANK_WALL, right: BLANK_WALL } }),
      ],
      connections: [
        { buildingAId: 'a', sideA: 'right', buildingBId: 'b', sideB: 'left' } as SnapConnection,
      ],
      roof: makeRoof({ trimMaterialId: 'alu-trim', fasciaHeight: 0.4 }),
    });
    const q = calculateTotalQuote(cfg.buildings, cfg.roof, cfg.connections,
      DEFAULT_PRICE_BOOK, matsWithTrim(25), [], cfg.defaultHeight);
    const fascias = q.lineItems.filter(i => i.labelKey === 'pricing.lineItems.fascia');
    expect(fascias.length).toBe(2);
    // Each building has 3 free sides (front, back, plus one of left/right):
    //   building a: free = front (4) + back (4) + left (4) = 12 → area = 4.8 → 120
    //   building b: free = front (4) + back (4) + right (4) = 12 → 120
    expect(fascias[0].total).toBeCloseTo(120, 5);
    expect(fascias[1].total).toBeCloseTo(120, 5);
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm test --run tests/pricing.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `fasciaLineItem`**

In `src/domain/pricing/calculate.ts`:

```ts
function fasciaLineItem(
  building: BuildingEntity,
  roof: RoofConfig,
  connectedSides: ConnectedSides,
  materials: MaterialRow[],
): LineItem | null {
  const fp = effectiveRoofFootprint(building, roof, connectedSides);
  const perimeter =
    (connectedSides.front ? 0 : fp.width) +
    (connectedSides.back  ? 0 : fp.width) +
    (connectedSides.left  ? 0 : fp.depth) +
    (connectedSides.right ? 0 : fp.depth);
  if (perimeter === 0) return null;

  const area = perimeter * roof.fasciaHeight;
  const trim = materials.find((m) => m.slug === roof.trimMaterialId);
  const perSqm = trim?.pricing['roof-trim']?.perSqm ?? 0;
  if (perSqm === 0) return null;

  const total = area * perSqm;
  return {
    labelKey: 'pricing.lineItems.fascia',
    labelParams: {
      area: Number(area.toFixed(2)),
      height: roof.fasciaHeight,
      overhang: roof.fasciaOverhang,
    },
    area,
    materialCost: total,
    insulationCost: 0,
    extrasCost: 0,
    total,
  };
}
```

In `calculateBuildingQuote`, after the `roofLineItem` push (around line 373):

```ts
lineItems.push(roofLineItem(building, roof, connectedSides, priceBook, roofCoverCatalog));

const fascia = fasciaLineItem(building, roof, connectedSides, materials);
if (fascia) lineItems.push(fascia);
```

(Note: the trim material in `FIXTURE_MATERIALS` is keyed off `slug`. Inspect how other line items resolve trim materials — if they use `id`, mirror that. The lookup must match the `roof.trimMaterialId` value, which `RoofConfig.trimMaterialId` says is a slug today. Confirm with `grep "trimMaterialId" src/domain` before finalizing.)

- [ ] **Step 4: Run — passes**

Run: `pnpm test --run tests/pricing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/pricing/calculate.ts tests/pricing.test.ts
git commit -m "feat(pricing): add fascia line item from roof-trim per-sqm pricing"
```

---

## Task 15 — `useWallTexture` accepts `offsetX`

**Files:**
- Modify: `src/lib/textures.ts`

This is a non-breaking signature change (new optional param). No test — `useWallTexture` is a hook tied to React Three Fiber and three.js; verification is visual in Task 16.

- [ ] **Step 1: Add the parameter and apply it**

In `src/lib/textures.ts:32`:

```ts
export function useWallTexture(
  materialId: string,
  wallWidth: number,
  wallHeight: number,
  offsetX = 0,
): PBRTextures | null {
  const { catalog: { materials } } = useTenant();
  const atom = getAtom(materials, materialId, 'wall');
  const paths = atom?.textures ?? null;
  const tileSize = atom?.tileSize ?? null;

  const textures = useMemo(() => {
    if (!paths) return null;
    return {
      map: loadTexture(paths.color, true).clone(),
      normalMap: loadTexture(paths.normal, false).clone(),
      roughnessMap: loadTexture(paths.roughness, false).clone(),
    };
  }, [paths]);

  useEffect(() => {
    if (textures && tileSize) {
      const rx = wallWidth / tileSize[0];
      const ry = wallHeight / tileSize[1];
      const ox = offsetX / tileSize[0];
      textures.map.repeat.set(rx, ry);
      textures.normalMap.repeat.set(rx, ry);
      textures.roughnessMap.repeat.set(rx, ry);
      textures.map.offset.set(ox, 0);
      textures.normalMap.offset.set(ox, 0);
      textures.roughnessMap.offset.set(ox, 0);
    }
  }, [textures, tileSize, wallWidth, wallHeight, offsetX]);

  // disposal effect unchanged
  useEffect(() => {
    if (!textures) return;
    return () => {
      textures.map.dispose();
      textures.normalMap.dispose();
      textures.roughnessMap.dispose();
    };
  }, [textures]);

  return textures;
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/textures.ts
git commit -m "feat(textures): allow wall texture U-offset for fascia alignment"
```

---

## Task 16 — `Roof.tsx` footprint-based geometry + texture offset fix

**Files:**
- Modify: `src/components/canvas/Roof.tsx`

This is the biggest single edit but contained to one file. No automated test — verification is visual.

- [ ] **Step 1: Replace `FlatRoof` body with footprint-based geometry**

In `src/components/canvas/Roof.tsx`, locate `FlatRoof` (around line 112) and replace from the `connectedSides`-derived booleans down through `fasciaBoards` with:

```ts
function FlatRoof({ width, depth, height, connectedSides, trimMaterialId, materialProps, meshRef, pointerHandlers }: FlatRoofProps) {
  const roof = useConfigStore((s) => s.roof);
  const hd = depth / 2;
  const hw = width / 2;

  const hasFront = !connectedSides.has('front');
  const hasBack  = !connectedSides.has('back');
  const hasLeft  = !connectedSides.has('left');
  const hasRight = !connectedSides.has('right');

  const oh = roof.fasciaOverhang;
  // Effective footprint extents — extends outward by `oh` on non-connected sides only.
  const minX = -hw - (hasLeft  ? oh : 0);
  const maxX =  hw + (hasRight ? oh : 0);
  const minZ = -hd - (hasBack  ? oh : 0);
  const maxZ =  hd + (hasFront ? oh : 0);

  const fasciaBottomY = height;
  const fasciaTopY    = fasciaBottomY + roof.fasciaHeight;
  const fasciaCenterY = fasciaBottomY + roof.fasciaHeight / 2;

  const innerInset    = FASCIA_THICKNESS / 2;     // 0.075
  const cornerOverlap = FASCIA_THICKNESS / 2;     // 0.075

  // EPDM membrane spans the effective footprint, inset on sides that have fascia.
  const epdmInsetFront = hasFront ? innerInset : 0;
  const epdmInsetBack  = hasBack  ? innerInset : 0;
  const epdmInsetLeft  = hasLeft  ? innerInset : 0;
  const epdmInsetRight = hasRight ? innerInset : 0;
  const epdmWidth  = Math.max(0.01, (maxX - minX) - epdmInsetLeft - epdmInsetRight);
  const epdmDepth  = Math.max(0.01, (maxZ - minZ) - epdmInsetFront - epdmInsetBack);
  const epdmCenterX = (minX + maxX) / 2 + (epdmInsetLeft - epdmInsetRight) / 2;
  const epdmCenterZ = (minZ + maxZ) / 2 + (epdmInsetBack - epdmInsetFront) / 2;
  const epdmY = fasciaTopY - EPDM_THICKNESS / 2 - 0.02;

  // Each fascia board lies along the corresponding edge of the effective
  // footprint. Front/back boards span the full width and extend over corners
  // by `cornerOverlap` on adjacent fascia sides; left/right boards fit between.
  const fasciaBoards = useMemo<FasciaBoard[]>(() => {
    const boards: FasciaBoard[] = [];
    const fpWidth = maxX - minX;
    const fpDepth = maxZ - minZ;
    const fpCenterX = (minX + maxX) / 2;
    const fpCenterZ = (minZ + maxZ) / 2;

    if (hasFront) {
      const extLeft  = hasLeft  ? cornerOverlap : 0;
      const extRight = hasRight ? cornerOverlap : 0;
      const len = fpWidth + extLeft + extRight;
      const centerX = fpCenterX + (extRight - extLeft) / 2;
      boards.push({
        pos: [centerX, fasciaCenterY, maxZ],
        size: [len, roof.fasciaHeight, FASCIA_THICKNESS],
        length: len,
        offsetX: -extLeft,
      });
    }
    if (hasBack) {
      const extLeft  = hasLeft  ? cornerOverlap : 0;
      const extRight = hasRight ? cornerOverlap : 0;
      const len = fpWidth + extLeft + extRight;
      const centerX = fpCenterX + (extRight - extLeft) / 2;
      boards.push({
        pos: [centerX, fasciaCenterY, minZ],
        size: [len, roof.fasciaHeight, FASCIA_THICKNESS],
        length: len,
        offsetX: -extLeft,
      });
    }
    if (hasLeft) {
      const trimBack  = hasBack  ? cornerOverlap : 0;
      const trimFront = hasFront ? cornerOverlap : 0;
      const len = Math.max(0.01, fpDepth - trimBack - trimFront);
      const centerZ = fpCenterZ + (trimBack - trimFront) / 2;
      boards.push({
        pos: [minX, fasciaCenterY, centerZ],
        size: [FASCIA_THICKNESS, roof.fasciaHeight, len],
        length: len,
        offsetX: -trimBack,
      });
    }
    if (hasRight) {
      const trimBack  = hasBack  ? cornerOverlap : 0;
      const trimFront = hasFront ? cornerOverlap : 0;
      const len = Math.max(0.01, fpDepth - trimBack - trimFront);
      const centerZ = fpCenterZ + (trimBack - trimFront) / 2;
      boards.push({
        pos: [maxX, fasciaCenterY, centerZ],
        size: [FASCIA_THICKNESS, roof.fasciaHeight, len],
        length: len,
        offsetX: -trimBack,
      });
    }
    return boards;
  }, [
    minX, maxX, minZ, maxZ,
    fasciaCenterY, roof.fasciaHeight,
    hasFront, hasBack, hasLeft, hasRight, cornerOverlap,
  ]);

  return (
    <group>
      <mesh
        ref={meshRef}
        position={[epdmCenterX, epdmY, epdmCenterZ]}
        castShadow
        {...pointerHandlers}
      >
        <boxGeometry args={[epdmWidth, EPDM_THICKNESS, epdmDepth]} />
        <meshStandardMaterial key={materialProps.map ? 'textured' : 'flat'} {...materialProps} />
      </mesh>

      {fasciaBoards.map((b, i) => (
        <FasciaBoardMesh key={i} board={b} materialId={trimMaterialId} fasciaHeight={roof.fasciaHeight} />
      ))}
    </group>
  );
}
```

- [ ] **Step 2: Update `FasciaBoard` shape and `FasciaBoardMesh`**

Add `offsetX` to the `FasciaBoard` interface (around line ~95):

```ts
interface FasciaBoard {
  pos: [number, number, number];
  size: [number, number, number];
  length: number;
  /** Wall-aligning U-offset (meters). Cancels the corner-overlap shift so
   *  the fascia texture seam aligns with the wall texture beneath. */
  offsetX: number;
}
```

Update `FasciaBoardMesh` to receive `fasciaHeight` and pass `offsetX` to the texture:

```ts
function FasciaBoardMesh({
  board,
  materialId,
  fasciaHeight,
}: {
  board: FasciaBoard;
  materialId: string;
  fasciaHeight: number;
}) {
  const { catalog: { materials } } = useTenant();
  const texture = useWallTexture(materialId, board.length, fasciaHeight, board.offsetX);
  const isGlass = materialId === 'glass';
  const tint = FASCIA_TEXTURE_TINT[materialId] ?? '#ffffff';

  return (
    <mesh position={board.pos} castShadow receiveShadow>
      <boxGeometry args={board.size} />
      <meshStandardMaterial
        key={texture ? 'textured' : 'flat'}
        color={texture ? tint : getAtomColor(materials, materialId, 'wall')}
        map={texture?.map ?? undefined}
        normalMap={texture?.normalMap ?? undefined}
        roughnessMap={texture?.roughnessMap ?? undefined}
        metalness={isGlass ? 0.1 : 0.1}
        roughness={texture?.roughnessMap ? 1 : 0.7}
        transparent={isGlass}
        opacity={isGlass ? 0.4 : 1}
        envMapIntensity={isGlass ? 1.5 : 0.4}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-4}
      />
    </mesh>
  );
}
```

- [ ] **Step 3: Remove the now-unused `FASCIA_HEIGHT` constant**

Delete the standalone `FASCIA_HEIGHT = 0.36` constant near the top of the file (it's been replaced by `roof.fasciaHeight`).

- [ ] **Step 4: Visual verification**

Run: `pnpm dev`
Open `http://localhost:3000/configurator` in the browser.

Verify:
- [ ] Default scene (fasciaOverhang = 0, fasciaHeight = 0.36): visually identical to pre-change.
- [ ] Same wood material on walls + fascia: no horizontal seam shift at the wall/fascia junction.
- [ ] Manually setting `fasciaHeight = 0.5` in the store (browser console: `useConfigStore.getState().updateRoof({ fasciaHeight: 0.5 })`): fascia grows taller; texture tiles increase.
- [ ] Setting `fasciaOverhang = 0.4`: roof + EPDM extend outward 40 cm on all sides of an isolated building; fascia ring follows.
- [ ] Two connected buildings with `fasciaOverhang = 0.3`: connected edge stays flush, free edges extend.

- [ ] **Step 5: Run typecheck + tests**

Run: `pnpm exec tsc --noEmit && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/canvas/Roof.tsx
git commit -m "feat(canvas): drive fascia geometry from RoofConfig + fix texture seam

Footprint-based geometry honors fasciaOverhang on non-connected sides
and pulls fasciaHeight from the store. Each fascia board passes a
U-offset to useWallTexture so its texture aligns with the wall below."
```

---

## Task 17 — Configurator slider UI

**Files:**
- Modify: `src/components/ui/RoofConfigSection.tsx`
- Modify: `src/lib/i18n.ts`

- [ ] **Step 1: Add i18n keys**

In `src/lib/i18n.ts`, add (place them next to the existing `roof.*` keys around line ~120):

```ts
  "roof.fasciaHeight": "Dakbakhoogte",
  "roof.fasciaOverhang": "Dakbak oversteek",
  "roof.fasciaLocked": "Vastgezet op {value}",
  "roof.fasciaPitchedNotice": "Dakbakopties zijn alleen beschikbaar voor platte daken.",
  "pricing.lineItems.fascia": "Dakbak ({height} m × {area} m²)",
```

- [ ] **Step 2: Add a `Slider` shadcn primitive (if not already present)**

Check if `src/components/ui/slider.tsx` exists. If not:

```bash
pnpm dlx shadcn@latest add slider
```

- [ ] **Step 3: Replace `RoofConfigSection`**

Edit `src/components/ui/RoofConfigSection.tsx`:

```tsx
'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { useTenantCatalogs } from '@/lib/useTenantCatalogs';
import { t } from '@/lib/i18n';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import SectionLabel from '@/components/ui/SectionLabel';
import MaterialSelect from '@/components/ui/MaterialSelect';
import { dakbakRange } from '@/domain/catalog';
import type { RoofCoveringId } from '@/domain/building';

function cm(meters: number): string {
  return `${Math.round(meters * 100)} cm`;
}

export default function RoofConfigSection() {
  const roof = useConfigStore((s) => s.roof);
  const updateRoof = useConfigStore((s) => s.updateRoof);
  const buildings = useConfigStore((s) => s.buildings);
  const productBuilding = buildings.find((b) => b.sourceProductId);
  const { roofTrim, roofCover, sourceProduct } = useTenantCatalogs(
    {
      roofTrim: roof.trimMaterialId,
      roofCover: roof.coveringId,
    },
    productBuilding?.sourceProductId,
  );

  const range = dakbakRange(sourceProduct ?? null);
  const heightLocked   = range.height.min === range.height.max;
  const overhangLocked = range.overhang.min === range.overhang.max;
  const isFlat = roof.type === 'flat';

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <SectionLabel>{t('roof.covering')}</SectionLabel>
        <MaterialSelect
          catalog={roofCover}
          value={roof.coveringId}
          onChange={(atomId) => updateRoof({ coveringId: atomId as RoofCoveringId })}
          category="roof-cover"
          showPrice
          ariaLabel={t('roof.covering')}
        />
        {sourceProduct?.constraints.allowedMaterialsBySlot?.roofCovering?.length ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t('configurator.picker.kitRestricted')}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <SectionLabel>{t('roof.trimColor')}</SectionLabel>
        <MaterialSelect
          catalog={roofTrim}
          value={roof.trimMaterialId}
          onChange={(atomId) => updateRoof({ trimMaterialId: atomId })}
          category="roof-trim"
          ariaLabel={t('roof.trimColor')}
        />
        {sourceProduct?.constraints.allowedMaterialsBySlot?.roofTrim?.length ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t('configurator.picker.kitRestricted')}
          </p>
        ) : null}
      </div>

      {isFlat && (
        <>
          <div className="space-y-2">
            <SectionLabel>{t('roof.fasciaHeight')}</SectionLabel>
            {heightLocked ? (
              <p className="text-sm text-muted-foreground">
                {t('roof.fasciaLocked', { value: cm(range.height.min) })}
              </p>
            ) : (
              <>
                <Slider
                  min={range.height.min}
                  max={range.height.max}
                  step={0.01}
                  value={[roof.fasciaHeight]}
                  onValueChange={([v]) => updateRoof({ fasciaHeight: v })}
                />
                <p className="text-xs text-muted-foreground">{cm(roof.fasciaHeight)}</p>
              </>
            )}
            {sourceProduct?.constraints.dakbak ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('configurator.picker.kitRestricted')}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <SectionLabel>{t('roof.fasciaOverhang')}</SectionLabel>
            {overhangLocked ? (
              <p className="text-sm text-muted-foreground">
                {t('roof.fasciaLocked', { value: cm(range.overhang.min) })}
              </p>
            ) : (
              <>
                <Slider
                  min={range.overhang.min}
                  max={range.overhang.max}
                  step={0.01}
                  value={[roof.fasciaOverhang]}
                  onValueChange={([v]) => updateRoof({ fasciaOverhang: v })}
                />
                <p className="text-xs text-muted-foreground">{cm(roof.fasciaOverhang)}</p>
              </>
            )}
          </div>
        </>
      )}

      {!isFlat && (
        <p className="text-xs text-muted-foreground">{t('roof.fasciaPitchedNotice')}</p>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="roof-skylight"
          checked={roof.hasSkylight}
          onCheckedChange={(checked) => updateRoof({ hasSkylight: !!checked })}
        />
        <Label htmlFor="roof-skylight" className="cursor-pointer font-medium">
          {t('roof.skylight')}
        </Label>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Visual verification**

Run: `pnpm dev`
Open the configurator. Open the Configure tab → Dak section.

Verify:
- [ ] Two new sliders appear under the trim color picker.
- [ ] Sliding height changes the fascia height in 3D.
- [ ] Sliding overhang extends the roof outward.
- [ ] Undo/redo works on both sliders (zundo wraps `updateRoof`).
- [ ] Switching roof type to pitched (if reachable from the UI) hides the sliders and shows the notice.

- [ ] **Step 5: Run typecheck + lint + tests**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: PASS (no net-new lint errors).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/RoofConfigSection.tsx src/lib/i18n.ts src/components/ui/slider.tsx
git commit -m "feat(configurator): dakbak height + overhang sliders"
```

---

## Task 18 — Admin product form: Dakbak section

**Files:**
- Locate the existing product form file (likely `src/app/admin/(authed)/catalog/products/_components/ProductForm.tsx` or similar — find with `grep -rn 'ProductForm\|defaults.materials\|allowedMaterialsBySlot' src/app/admin`).
- Modify: that form file
- Modify: `src/lib/i18n.ts`

- [ ] **Step 1: Locate the form**

Run: `grep -rn 'ProductForm\|defaults\.poort' src/app/admin/\(authed\)/catalog/products`
Note the file path. The form file already handles per-kind sections (e.g. `poort` defaults block conditional on `kind === 'poort'`).

- [ ] **Step 2: Add i18n keys**

Append to `src/lib/i18n.ts`:

```ts
  "admin.products.dakbak.section":            "Dakbak",
  "admin.products.dakbak.help":               "Laat leeg om de globale grenzen te gebruiken (10–60 cm hoogte, 0–80 cm oversteek).",
  "admin.products.dakbak.fasciaHeight":       "Standaard dakbakhoogte (cm)",
  "admin.products.dakbak.fasciaOverhang":     "Standaard oversteek (cm)",
  "admin.products.dakbak.fasciaHeightMin":    "Min. hoogte (cm)",
  "admin.products.dakbak.fasciaHeightMax":    "Max. hoogte (cm)",
  "admin.products.dakbak.fasciaOverhangMin":  "Min. oversteek (cm)",
  "admin.products.dakbak.fasciaOverhangMax":  "Max. oversteek (cm)",
```

- [ ] **Step 3: Add the Dakbak section to the form**

In the form file, alongside the existing `poort` conditional block, add (gated on `kind ∈ ['overkapping', 'berging']`):

```tsx
{(values.kind === 'overkapping' || values.kind === 'berging') && (
  <fieldset className="space-y-4 border rounded-md p-4">
    <legend className="px-2 text-sm font-medium">{t('admin.products.dakbak.section')}</legend>
    <p className="text-xs text-muted-foreground">{t('admin.products.dakbak.help')}</p>

    <div className="grid grid-cols-2 gap-4">
      {/* Defaults */}
      <FormField
        control={form.control}
        name="defaults.dakbak.fasciaHeight"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('admin.products.dakbak.fasciaHeight')}</FormLabel>
            <FormControl>
              <Input type="number" min={10} max={60} step={1}
                value={field.value === undefined ? '' : Math.round(field.value * 100)}
                onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value) / 100)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="defaults.dakbak.fasciaOverhang"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('admin.products.dakbak.fasciaOverhang')}</FormLabel>
            <FormControl>
              <Input type="number" min={0} max={80} step={1}
                value={field.value === undefined ? '' : Math.round(field.value * 100)}
                onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value) / 100)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Constraints */}
      <FormField
        control={form.control}
        name="constraints.dakbak.fasciaHeightMin"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('admin.products.dakbak.fasciaHeightMin')}</FormLabel>
            <FormControl>
              <Input type="number" min={10} max={60} step={1}
                value={field.value === undefined ? '' : Math.round(field.value * 100)}
                onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value) / 100)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="constraints.dakbak.fasciaHeightMax"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('admin.products.dakbak.fasciaHeightMax')}</FormLabel>
            <FormControl>
              <Input type="number" min={10} max={60} step={1}
                value={field.value === undefined ? '' : Math.round(field.value * 100)}
                onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value) / 100)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="constraints.dakbak.fasciaOverhangMin"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('admin.products.dakbak.fasciaOverhangMin')}</FormLabel>
            <FormControl>
              <Input type="number" min={0} max={80} step={1}
                value={field.value === undefined ? '' : Math.round(field.value * 100)}
                onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value) / 100)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="constraints.dakbak.fasciaOverhangMax"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('admin.products.dakbak.fasciaOverhangMax')}</FormLabel>
            <FormControl>
              <Input type="number" min={0} max={80} step={1}
                value={field.value === undefined ? '' : Math.round(field.value * 100)}
                onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value) / 100)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  </fieldset>
)}
```

The form's zod schema (likely in the same file or a sibling `schema.ts`) needs matching optional fields. Mirror the existing `poort` zod block:

```ts
defaults: z.object({
  // …existing keys…
  dakbak: z.object({
    fasciaHeight:   z.number().min(0.10).max(0.60).optional(),
    fasciaOverhang: z.number().min(0).max(0.80).optional(),
  }).optional(),
}).optional(),

constraints: z.object({
  // …existing keys…
  dakbak: z.object({
    fasciaHeightMin:   z.number().min(0.10).max(0.60).optional(),
    fasciaHeightMax:   z.number().min(0.10).max(0.60).optional(),
    fasciaOverhangMin: z.number().min(0).max(0.80).optional(),
    fasciaOverhangMax: z.number().min(0).max(0.80).optional(),
  })
    .refine(d => !d.fasciaHeightMin   || !d.fasciaHeightMax   || d.fasciaHeightMin   <= d.fasciaHeightMax,   { message: 'min must be ≤ max', path: ['fasciaHeightMin'] })
    .refine(d => !d.fasciaOverhangMin || !d.fasciaOverhangMax || d.fasciaOverhangMin <= d.fasciaOverhangMax, { message: 'min must be ≤ max', path: ['fasciaOverhangMin'] })
    .optional(),
}).optional(),
```

- [ ] **Step 4: Visual verification**

Run: `pnpm dev`
Open `http://localhost:3000/admin/catalog/products/<some-overkapping-or-berging-product>`.

Verify:
- [ ] "Dakbak" fieldset renders only for overkapping + berging.
- [ ] All six inputs accept cm values.
- [ ] Submitting empty values produces no validation error.
- [ ] Submitting `fasciaHeightMin: 50, fasciaHeightMax: 30` triggers an inline error.
- [ ] Submitting valid values persists; reload shows them populated.

- [ ] **Step 5: Run typecheck + lint + tests**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/<path-to-product-form>.tsx src/lib/i18n.ts
git commit -m "feat(admin): product form Dakbak section for overkapping + berging"
```

---

## Task 19 — Final verification

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: PASS — including all new tests across migrate, validate, mutations, pricing, catalog-product-validate, catalog-applyDefaults, catalog-material-validate.

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: PASS — Next 16 production build completes.

- [ ] **Step 4: Lint (informational only)**

Run: `pnpm lint`
Expected: no net-new errors. Existing warnings stay.

- [ ] **Step 5: Manual smoke**

Open `pnpm dev`. Sanity-check end-to-end:

- [ ] Configurator default scene renders identically to pre-change.
- [ ] Sliders move; 3D updates; quote sidebar shows the new "Dakbak (…)" line item once a tenant has `roof-trim.perSqm` priced (use Drizzle Studio to set `pricing: { 'roof-trim': { perSqm: 25 } }` on the wood material if needed).
- [ ] Submit an order from the configurator. Open `/admin/orders/<id>` — quote line items show the fascia row.
- [ ] Open the order PDF (if reachable) — fascia row present.
- [ ] Wall + fascia using the same wood material: no horizontal seam shift.
- [ ] Two-building scene with a `right ↔ left` connection: connected edges flush, free edges extend by overhang.
- [ ] Admin product editor: open an overkapping product, set `fasciaHeightMin = fasciaHeightMax = 0.4` and `defaults.dakbak.fasciaHeight = 0.4`. Save. Use that product slug in `/configurator?product=<slug>`. Slider area shows the locked value, no slider.

- [ ] **Step 6: Final commit (if any cleanup)**

If steps 1–5 surfaced trivial follow-ups (typo, lint nit, etc.), fix and commit:

```bash
git add -A
git commit -m "chore(dakbak): post-verification cleanup"
```

Otherwise the feature is done.

---

## Self-review

- **Spec coverage:** Every spec section maps to at least one task.
  - § Domain shape → Tasks 1, 2, 3, 4, 5, 6
  - § Catalog extensions → Tasks 7, 8, 9, 10, 11
  - § Pricing → Tasks 13, 14
  - § Rendering (incl. texture-fix) → Tasks 15, 16
  - § Configurator UI → Task 17
  - § Admin product editor → Task 18
  - § Order/invoice/PDF display → covered automatically by the new line item flowing through `quoteSnapshot`; no template edits needed because no current template renders a roof specs row (see comment in Task 19, manual smoke step).
  - § Tests → distributed across Tasks 4, 6, 7, 9, 10, 11, 12, 13, 14
- **Mutation hydration** → Task 12.
- **No placeholders.** Each step contains exact code or exact commands.
- **Type consistency.** `fasciaHeight`/`fasciaOverhang` on `RoofConfig` are required + non-optional. `defaults.dakbak.{fasciaHeight,fasciaOverhang}` and `constraints.dakbak.fascia{Height,Overhang}{Min,Max}` are all optional. `dakbakRange()` returns `{ height: {min,max}, overhang: {min,max} }` consistently across Tasks 10, 17.
- **Commit cadence.** One commit per task; broken intermediate states (Task 2) are signposted.

## Open follow-ups (not in scope)

- Pitched-roof eaves/rakes — sliders are flat-roof-only.
- Schematic floor-plan rendering of overhang — stays at wall outline (per product owner).
- Per-side overhang — single scene-level value for now; per-side can layer in later if needed.
- VAT/admin invoicing presentation of dakbak specs (if a "Dak" row gets added later, it should read `fasciaHeight` + `fasciaOverhang` from `configSnapshot.roof`, which is already preserved at order time).
