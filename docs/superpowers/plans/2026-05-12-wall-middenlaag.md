# Wall Middenlaag (Insulation + Timber Frame) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional middle layer (`materialIdMiddenlaag`) to walls of `overkapping`, `berging`, and `muur` — a solid insulation panel (priced per m²) or a vertical-post timber frame (priced per beam) — fully driven by the per-tenant admin material catalog.

**Architecture:** New `'middenlaag'` material category whose pricing slot is a discriminated union (`kind: 'panel' | 'frame'`); all middenlaag-specific data (thickness, beam dimensions, per-unit price) lives inside the existing `pricing` jsonb on the materials row — no DB migration. Walls render up to three slabs at fixed proportions (`WALL_THICKNESS` stays 0.15 m); the frame kind replaces the middle slab with N vertical posts. Pricing emits a third line item per wall when middenlaag is set, flowing through `quote.items[].lineItems` to the existing admin order table + invoice PDF unchanged.

**Tech Stack:** TypeScript, Next.js 16 (App Router), React Three Fiber, SVG plattegrond, Zustand, Drizzle (no schema migration needed), Vitest via Vite+.

**Spec:** `docs/superpowers/specs/2026-05-12-wall-middenlaag-design.md`

---

## File touch-list

**Domain (framework-free):**

- `src/domain/building/types.ts` — add `materialIdMiddenlaag` to `WallConfig`.
- `src/domain/building/constants.ts` — add `WALL_LAYER_PROPORTIONS`.
- `src/domain/catalog/types.ts` — add `'middenlaag'` MaterialCategory, `MiddenlaagPricing` type, `MaterialPricing.middenlaag` slot, `'wallMiddenlaag'` ProductSlot.
- `src/domain/catalog/material.ts` — extend `validatePricing` with the middenlaag branch.
- `src/domain/catalog/product.ts` — extend `ProductBuildingDefaults` with `materialIdMiddenlaag`; thread `mats.wallMiddenlaag` through `applyProductDefaults`.
- `src/domain/config/validate.ts` — validate `materialIdMiddenlaag` against the tenant's middenlaag catalog.
- `src/domain/config/mutations.ts` — `addBuilding` hydrates `materialIdMiddenlaag` onto every wall when the product specifies one.
- `src/domain/materials/resolve.ts` — add `getEffectiveMiddenlaagMaterial`.
- `src/domain/pricing/calculate.ts` — emit the middenlaag line item in `wallLineItem`.

**UI:**

- `src/components/canvas/Wall.tsx` — render up to three slabs; frame kind replaces middle slab with vertical post meshes.
- `src/components/schematic/SchematicWalls.tsx` — extend the strip rendering to up to three strips.
- `src/components/ui/SurfaceProperties.tsx` — middenlaag section with `+ toevoegen` / picker / "Verwijderen" + kind-aware spec caption.
- `src/components/admin/catalog/MaterialForm.tsx` — kind-aware middenlaag panel in the row form.

**Glue:**

- `src/lib/i18n.ts` — new keys for line item labels, panel labels, admin form labels.
- `src/db/seed.ts` — three idempotent demo rows (rockwool-100, pir-80, sls-38x89-hoh600).

**Tests:**

- `tests/materials-effective-middenlaag.test.ts` (new)
- `tests/validate-wall-middenlaag.test.ts` (new)
- `tests/pricing-wall-middenlaag.test.ts` (new)
- `tests/catalog-material-middenlaag.test.ts` (new)
- `tests/catalog-product-wall-middenlaag.test.ts` (new)

---

## Conventions (read once)

- `validateMaterial` (config validator) already accepts `string | null | undefined`. The middenlaag check reuses the existing `unknown_material` error code with path `walls.<side>.materialIdMiddenlaag`.
- `validatePricing` (admin material validator) uses error codes `pricing_invalid` and `pricing_category_mismatch`. The middenlaag branch reuses both — `pricing_invalid` for malformed shape (missing thicknessMm, wrong kind, etc.) and `pricing_category_mismatch` when the entry's key is `'middenlaag'` but the row doesn't list it in `categories`.
- All numeric admin inputs reject `NaN`, `Infinity`, and `≤ 0` (same gate the existing per-m² validator uses).
- The `'middenlaag'` category is a no-flags category — `flags.clearsOpenings` and `flags.isVoid` are wall- and floor-only respectively; nothing to add.

---

## Task 1: Add `materialIdMiddenlaag` to `WallConfig`

**Files:**
- Modify: `src/domain/building/types.ts`

- [ ] **Step 1: Add the optional field**

Open `src/domain/building/types.ts`. Find the `WallConfig` interface. Add the new field right after `materialIdInner`:

```ts
export interface WallConfig {
  // …existing fields
  materialId?: string;
  materialIdInner?: string | null;
  /** Optional middenlaag (middle-layer material) — references a non-archived
   *  material row whose `categories` includes `'middenlaag'`. `undefined` /
   *  `null` = no middenlaag on this wall. Per-wall only — no
   *  inherit-from-building fallback. */
  materialIdMiddenlaag?: string | null;
  hasDoor: boolean;
  // …
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS — the field is optional, no existing consumer breaks.

- [ ] **Step 3: Commit**

```bash
git add src/domain/building/types.ts
git commit -m "feat(domain): add WallConfig.materialIdMiddenlaag"
```

---

## Task 2: Add `WALL_LAYER_PROPORTIONS` constant

**Files:**
- Modify: `src/domain/building/constants.ts`

- [ ] **Step 1: Add the proportions constant**

Open `src/domain/building/constants.ts`. Near the existing `WALL_THICKNESS` declaration, append:

```ts
/** Proportions of `WALL_THICKNESS` allocated to each cladding layer when a
 *  wall has middenlaag and/or inner cladding set. Sum must equal 1.0.
 *  Outer + inner are the painted skins; middenlaag is the middle filling.
 *  These are fixed for v1; a follow-up may derive wall thickness from the
 *  chosen middenlaag's `thicknessMm` instead. */
export const WALL_LAYER_PROPORTIONS = {
  outerCladding: 0.20,
  middenlaag:    0.60,
  innerCladding: 0.20,
} as const;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/domain/building/constants.ts
git commit -m "feat(domain): add WALL_LAYER_PROPORTIONS constant"
```

---

## Task 3: Add `'middenlaag'` MaterialCategory + `MiddenlaagPricing` type

**Files:**
- Modify: `src/domain/catalog/types.ts`

- [ ] **Step 1: Extend `MaterialCategory` + `MATERIAL_CATEGORIES`**

Open `src/domain/catalog/types.ts`. Update the union (around line 5) and the array (around line 135):

```ts
export type MaterialCategory =
  | 'wall'
  | 'roof-cover'
  | 'roof-trim'
  | 'floor'
  | 'door'
  | 'gate'
  | 'middenlaag';

export const MATERIAL_CATEGORIES: readonly MaterialCategory[] = [
  'wall',
  'roof-cover',
  'roof-trim',
  'floor',
  'door',
  'gate',
  'middenlaag',
] as const;
```

- [ ] **Step 2: Add `MiddenlaagKind` + `MiddenlaagPricing` types**

In the same file, right after the existing pricing types (e.g. `GatePricing`), add:

```ts
export type MiddenlaagKind = 'panel' | 'frame';

export type MiddenlaagPricing =
  | {
      kind: 'panel';
      /** Stored thickness (mm). v1: data + admin display only — does NOT
       *  drive visual wall thickness. */
      thicknessMm: number;
      perSqm: number;
    }
  | {
      kind: 'frame';
      /** SLS beam depth (mm). Typical range 35–89 mm. */
      thicknessMm: number;
      /** Beam width (mm), parallel to the wall plane. Typical SLS: 38–45 mm. */
      beamWidthMm: number;
      /** Hart-op-hart spacing (mm). Typical 400–600 mm. */
      beamSpacingMm: number;
      perBeam: number;
    };
```

- [ ] **Step 3: Extend `MaterialPricing` interface**

Same file. Find the `MaterialPricing` interface and add the slot:

```ts
export interface MaterialPricing {
  wall?: WallPricing;
  'roof-cover'?: RoofCoverPricing;
  'roof-trim'?: RoofTrimPricing;
  floor?: FloorPricing;
  door?: DoorPricing;
  gate?: GatePricing;
  middenlaag?: MiddenlaagPricing;
}
```

- [ ] **Step 4: Extend `ProductSlot` + maps**

Same file. Update three exports:

```ts
export type ProductSlot =
  | 'wallCladding'
  | 'wallCladdingInner'
  | 'wallMiddenlaag'
  | 'roofCovering'
  | 'roofTrim'
  | 'floor'
  | 'door';

export const PRODUCT_SLOTS: readonly ProductSlot[] = [
  'wallCladding',
  'wallCladdingInner',
  'wallMiddenlaag',
  'roofCovering',
  'roofTrim',
  'floor',
  'door',
] as const;

export const PRODUCT_SLOT_TO_CATEGORY: Record<ProductSlot, MaterialCategory> = {
  wallCladding: 'wall',
  wallCladdingInner: 'wall',
  wallMiddenlaag: 'middenlaag',
  roofCovering: 'roof-cover',
  roofTrim: 'roof-trim',
  floor: 'floor',
  door: 'door',
};
```

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS. Any `Record<MaterialCategory, …>` or `Record<ProductSlot, …>` literal anywhere that's now missing the new keys must be filled in. Quickly grep for those:

```bash
grep -rn "Record<MaterialCategory" src/ --include="*.ts" --include="*.tsx"
grep -rn "Record<ProductSlot"     src/ --include="*.ts" --include="*.tsx"
```

If TypeScript reports a missing-key error in a literal somewhere, add a sensible default entry (typically `undefined` / a noop value matching its peers) and proceed.

- [ ] **Step 6: Full test suite**

Run: `pnpm test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/domain/catalog/types.ts
git commit -m "feat(catalog): add 'middenlaag' MaterialCategory + MiddenlaagPricing + wallMiddenlaag slot"
```

---

## Task 4: Material validator — middenlaag pricing branch

**Files:**
- Modify: `src/domain/catalog/material.ts`
- Test: `tests/catalog-material-middenlaag.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `tests/catalog-material-middenlaag.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import { validateMaterialCreate } from '@/domain/catalog';

const base = {
  slug: 'm', name: 'M', color: '#888',
  flags: {},
  textures: null as null,
  tileSize: null as null,
};

describe('validateMaterialCreate — middenlaag pricing', () => {
  it('accepts a well-formed panel row', () => {
    const result = validateMaterialCreate({
      ...base,
      categories: ['middenlaag'],
      pricing: { middenlaag: { kind: 'panel', thicknessMm: 100, perSqm: 12 } },
    });
    expect(result.errors).toEqual([]);
  });

  it('accepts a well-formed frame row', () => {
    const result = validateMaterialCreate({
      ...base,
      categories: ['middenlaag'],
      pricing: {
        middenlaag: {
          kind: 'frame', thicknessMm: 89, beamWidthMm: 38,
          beamSpacingMm: 600, perBeam: 15,
        },
      },
    });
    expect(result.errors).toEqual([]);
  });

  it("rejects a 'middenlaag' row whose pricing slot is missing", () => {
    const result = validateMaterialCreate({
      ...base,
      categories: ['middenlaag'],
      pricing: {},
    });
    expect(result.errors.some(e => e.field === 'pricing.middenlaag' && e.code === 'pricing_invalid')).toBe(true);
  });

  it("rejects pricing.middenlaag.kind='panel' that carries beam fields", () => {
    const result = validateMaterialCreate({
      ...base,
      categories: ['middenlaag'],
      pricing: {
        middenlaag: {
          kind: 'panel', thicknessMm: 100, perSqm: 12, beamSpacingMm: 600,
        },
      },
    });
    expect(result.errors.some(e => e.field === 'pricing.middenlaag' && e.code === 'pricing_invalid')).toBe(true);
  });

  it("rejects pricing.middenlaag.kind='frame' missing perBeam", () => {
    const result = validateMaterialCreate({
      ...base,
      categories: ['middenlaag'],
      pricing: {
        middenlaag: {
          kind: 'frame', thicknessMm: 89, beamWidthMm: 38, beamSpacingMm: 600,
        },
      },
    });
    expect(result.errors.some(e => e.field === 'pricing.middenlaag' && e.code === 'pricing_invalid')).toBe(true);
  });

  it("rejects pricing.middenlaag on a row whose categories doesn't include 'middenlaag'", () => {
    const result = validateMaterialCreate({
      ...base,
      categories: ['wall'],
      pricing: {
        wall: { perSqm: 50 },
        middenlaag: { kind: 'panel', thicknessMm: 100, perSqm: 12 },
      },
    });
    expect(result.errors.some(e => e.field === 'pricing.middenlaag' && e.code === 'pricing_category_mismatch')).toBe(true);
  });

  it('rejects perSqm <= 0', () => {
    const result = validateMaterialCreate({
      ...base,
      categories: ['middenlaag'],
      pricing: { middenlaag: { kind: 'panel', thicknessMm: 100, perSqm: 0 } },
    });
    expect(result.errors.some(e => e.field === 'pricing.middenlaag' && e.code === 'pricing_invalid')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- catalog-material-middenlaag`
Expected: most cases fail (validator doesn't know `middenlaag` yet).

- [ ] **Step 3: Extend `validatePricing` with the middenlaag branch**

Open `src/domain/catalog/material.ts`. Find `validatePricing` (around line 99). Inside the `for ([key, entry])` loop, AFTER the `door` branch and BEFORE the generic `wall / roof-cover / floor / gate` branch, add:

```ts
if (key === 'middenlaag') {
  if (!isObject(entry)) {
    errors.push({ field: `pricing.${key}`, code: 'pricing_invalid' });
    return undefined;
  }
  const kind = (entry as Record<string, unknown>).kind;
  if (kind === 'panel') {
    const t = (entry as Record<string, unknown>).thicknessMm;
    const p = (entry as Record<string, unknown>).perSqm;
    const expected = new Set(['kind', 'thicknessMm', 'perSqm']);
    const extra = Object.keys(entry).some(k => !expected.has(k));
    if (
      extra
      || typeof t !== 'number' || !Number.isFinite(t) || t <= 0
      || typeof p !== 'number' || !Number.isFinite(p) || p <= 0
    ) {
      errors.push({ field: `pricing.${key}`, code: 'pricing_invalid' });
      return undefined;
    }
    out.middenlaag = { kind: 'panel', thicknessMm: t, perSqm: p };
    continue;
  }
  if (kind === 'frame') {
    const t  = (entry as Record<string, unknown>).thicknessMm;
    const bw = (entry as Record<string, unknown>).beamWidthMm;
    const bs = (entry as Record<string, unknown>).beamSpacingMm;
    const pb = (entry as Record<string, unknown>).perBeam;
    const expected = new Set(['kind', 'thicknessMm', 'beamWidthMm', 'beamSpacingMm', 'perBeam']);
    const extra = Object.keys(entry).some(k => !expected.has(k));
    if (
      extra
      || typeof t  !== 'number' || !Number.isFinite(t)  || t  <= 0
      || typeof bw !== 'number' || !Number.isFinite(bw) || bw <= 0
      || typeof bs !== 'number' || !Number.isFinite(bs) || bs <= 0
      || typeof pb !== 'number' || !Number.isFinite(pb) || pb <= 0
    ) {
      errors.push({ field: `pricing.${key}`, code: 'pricing_invalid' });
      return undefined;
    }
    out.middenlaag = {
      kind: 'frame', thicknessMm: t, beamWidthMm: bw, beamSpacingMm: bs, perBeam: pb,
    };
    continue;
  }
  errors.push({ field: `pricing.${key}`, code: 'pricing_invalid' });
  return undefined;
}
```

- [ ] **Step 4: Confirm the generic perSqm branch skips middenlaag**

The remaining `// wall / roof-cover / floor / gate` branch must not run for `middenlaag` — the `continue` statements at the end of each kind branch already ensure that. Verify by reading the surrounding code.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- catalog-material-middenlaag`
Expected: 7 passing.

- [ ] **Step 6: Full test suite**

Run: `pnpm test`
Expected: all green (~720 now).

- [ ] **Step 7: Commit**

```bash
git add src/domain/catalog/material.ts tests/catalog-material-middenlaag.test.ts
git commit -m "feat(catalog): validate middenlaag pricing (panel + frame kinds)"
```

---

## Task 5: Resolver — `getEffectiveMiddenlaagMaterial`

**Files:**
- Modify: `src/domain/materials/resolve.ts`
- Test: `tests/materials-effective-middenlaag.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/materials-effective-middenlaag.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import { getEffectiveMiddenlaagMaterial } from '@/domain/materials';
import type { WallConfig } from '@/domain/building';

function makeWall(extras: Partial<WallConfig> = {}): WallConfig {
  return {
    hasDoor: false,
    doorSize: 'enkel',
    doorHasWindow: false,
    doorPosition: 0.5,
    doorSwing: 'naar_buiten',
    windows: [],
    ...extras,
  };
}

describe('getEffectiveMiddenlaagMaterial', () => {
  it('returns null when materialIdMiddenlaag is undefined', () => {
    expect(getEffectiveMiddenlaagMaterial(makeWall())).toBeNull();
  });

  it('returns null when materialIdMiddenlaag is null', () => {
    expect(getEffectiveMiddenlaagMaterial(makeWall({ materialIdMiddenlaag: null }))).toBeNull();
  });

  it('returns the slug when set', () => {
    expect(getEffectiveMiddenlaagMaterial(makeWall({ materialIdMiddenlaag: 'rockwool-100' }))).toBe('rockwool-100');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- materials-effective-middenlaag`
Expected: FAIL (export not found).

- [ ] **Step 3: Add the resolver**

Open `src/domain/materials/resolve.ts`. Append at the end:

```ts
/** Effective middenlaag material slug — per-wall only, no inheritance.
 *  Returns `null` when no middenlaag is set on this wall. */
export function getEffectiveMiddenlaagMaterial(wall: WallConfig): string | null {
  return wall.materialIdMiddenlaag ?? null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test -- materials-effective-middenlaag`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/domain/materials/resolve.ts tests/materials-effective-middenlaag.test.ts
git commit -m "feat(materials): add getEffectiveMiddenlaagMaterial"
```

---

## Task 6: Config validator — check `materialIdMiddenlaag` against tenant catalog

**Files:**
- Modify: `src/domain/config/validate.ts`
- Test: `tests/validate-wall-middenlaag.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `tests/validate-wall-middenlaag.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import { validateConfig } from '@/domain/config';
import { makeConfig } from './fixtures';
import type { MaterialRow } from '@/domain/catalog';

function makeMiddenlaag(slug: string, archived = false): MaterialRow {
  return {
    id: `m-${slug}`, tenantId: 't1', categories: ['middenlaag'], slug, name: slug,
    color: '#888', textures: null, tileSize: null,
    pricing: { middenlaag: { kind: 'panel', thicknessMm: 100, perSqm: 12 } },
    flags: {},
    archivedAt: archived ? '2026-01-01' : null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

describe('validateConfig — wall middenlaag', () => {
  it('accepts undefined', () => {
    const config = makeConfig();
    const errors = validateConfig(config, [makeMiddenlaag('rockwool-100')]);
    expect(errors).toEqual([]);
  });

  it('accepts null', () => {
    const config = makeConfig();
    config.buildings[0].walls.front.materialIdMiddenlaag = null;
    const errors = validateConfig(config, [makeMiddenlaag('rockwool-100')]);
    expect(errors).toEqual([]);
  });

  it('accepts a known middenlaag slug', () => {
    const config = makeConfig();
    config.buildings[0].walls.front.materialIdMiddenlaag = 'rockwool-100';
    const errors = validateConfig(config, [makeMiddenlaag('rockwool-100')]);
    expect(errors).toEqual([]);
  });

  it('rejects an unknown slug', () => {
    const config = makeConfig();
    config.buildings[0].walls.front.materialIdMiddenlaag = 'ghost';
    const errors = validateConfig(config, [makeMiddenlaag('rockwool-100')]);
    expect(errors.some(e =>
      e.code === 'unknown_material'
      && e.path.endsWith('walls.front.materialIdMiddenlaag'),
    )).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- validate-wall-middenlaag`
Expected: FAIL on the "unknown slug" case.

- [ ] **Step 3: Wire `materialIdMiddenlaag` into `validateWall`**

Open `src/domain/config/validate.ts`. Find `validateWall`. Add the new check directly below the existing `materialIdInner` check:

```ts
validateMaterial(wall.materialId, `${basePath}.materialId`, errors, materials);
validateMaterial(wall.materialIdInner, `${basePath}.materialIdInner`, errors, materials);
validateMaterial(wall.materialIdMiddenlaag, `${basePath}.materialIdMiddenlaag`, errors, materials);
validateMaterial(wall.doorMaterialId, `${basePath}.doorMaterialId`, errors, materials);
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test -- validate-wall-middenlaag`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/domain/config/validate.ts tests/validate-wall-middenlaag.test.ts
git commit -m "feat(validate): check materialIdMiddenlaag against tenant catalog"
```

---

## Task 7: Pricing — emit `wall.<side>.middenlaag` line item

**Files:**
- Modify: `src/domain/pricing/calculate.ts`
- Test: `tests/pricing-wall-middenlaag.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `tests/pricing-wall-middenlaag.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import { calculateTotalQuote, DEFAULT_PRICE_BOOK } from '@/domain/pricing';
import { makeConfig } from './fixtures';
import type { MaterialRow } from '@/domain/catalog';

function makeWallMaterial(slug: string, perSqm: number): MaterialRow {
  return {
    id: `m-${slug}`, tenantId: 't1', categories: ['wall'], slug, name: slug,
    color: '#888', textures: null, tileSize: null,
    pricing: { wall: { perSqm } }, flags: {},
    archivedAt: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

function makePanel(slug: string, perSqm: number, thicknessMm = 100): MaterialRow {
  return {
    id: `m-${slug}`, tenantId: 't1', categories: ['middenlaag'], slug, name: slug,
    color: '#888', textures: null, tileSize: null,
    pricing: { middenlaag: { kind: 'panel', thicknessMm, perSqm } }, flags: {},
    archivedAt: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

function makeFrame(slug: string, beamSpacingMm: number, perBeam: number): MaterialRow {
  return {
    id: `m-${slug}`, tenantId: 't1', categories: ['middenlaag'], slug, name: slug,
    color: '#888', textures: null, tileSize: null,
    pricing: {
      middenlaag: {
        kind: 'frame', thicknessMm: 89, beamWidthMm: 38,
        beamSpacingMm, perBeam,
      },
    },
    flags: {},
    archivedAt: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

describe('wall pricing with middenlaag', () => {
  it('no middenlaag → no .middenlaag line items', () => {
    const config = makeConfig();
    const materials = [makeWallMaterial('wood', 100)];
    const quote = calculateTotalQuote(config, DEFAULT_PRICE_BOOK, materials, [], []);
    const middenlaags = quote.items.flatMap(b => b.lineItems).filter(li => li.labelKey.endsWith('.middenlaag'));
    expect(middenlaags).toHaveLength(0);
  });

  it('panel middenlaag emits area × perSqm', () => {
    const config = makeConfig();
    config.buildings[0].primaryMaterialId = 'wood';
    config.buildings[0].walls.front.materialIdMiddenlaag = 'rockwool';
    const materials = [
      makeWallMaterial('wood', 100),
      makePanel('rockwool', 12, 100),
    ];
    const quote = calculateTotalQuote(config, DEFAULT_PRICE_BOOK, materials, [], []);
    const items = quote.items.flatMap(b => b.lineItems);
    const outer = items.find(li => li.labelKey === 'wall.front');
    const mid = items.find(li => li.labelKey === 'wall.front.middenlaag');
    expect(outer).toBeDefined();
    expect(mid).toBeDefined();
    expect(mid!.area).toBeCloseTo(outer!.area, 6);
    expect(mid!.materialCost).toBeCloseTo(outer!.area * 12, 4);
    expect(mid!.extrasCost).toBe(0);
  });

  it('frame middenlaag emits beamCount × perBeam', () => {
    // Wall front of the makeConfig fixture is 4m wide. With 600mm h.o.h.
    // we expect Math.ceil(4000/600) + 1 = 7 + 1 = 8 beams.
    // (Math.ceil(6.66...) = 7, +1 = 8.)
    const config = makeConfig();
    config.buildings[0].walls.front.materialIdMiddenlaag = 'sls';
    const materials = [
      makeWallMaterial('wood', 100),
      makeFrame('sls', 600, 15),
    ];
    const quote = calculateTotalQuote(config, DEFAULT_PRICE_BOOK, materials, [], []);
    const items = quote.items.flatMap(b => b.lineItems);
    const frame = items.find(li => li.labelKey === 'wall.front.middenlaag.frame');
    expect(frame).toBeDefined();
    expect(frame!.materialCost).toBeCloseTo(8 * 15, 4);
    expect(frame!.area).toBe(0);
    expect(frame!.extrasCost).toBe(0);
    expect(frame!.labelParams).toEqual({ count: 8 });
  });
});
```

NOTE: Before running, confirm the `makeConfig` fixture's first building dimensions (default is `width: 4, depth: 4` per `tests/fixtures.ts`). If it differs, recompute the expected beam count in the third test using `Math.ceil(width * 1000 / 600) + 1` and update the assertion accordingly.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test -- pricing-wall-middenlaag`
Expected: FAIL on the panel + frame cases.

- [ ] **Step 3: Import the resolver + emit the line item**

Open `src/domain/pricing/calculate.ts`. Update the existing `@/domain/materials` import to include the new helper:

```ts
import {
  // …existing items
  getEffectiveInnerWallMaterial,
  getEffectiveMiddenlaagMaterial,
} from '@/domain/materials';
```

Then inside `wallLineItem`, AFTER the inner-cladding emission block and BEFORE `return lineItems`, add:

```ts
// Middenlaag — additive line item.
const middenlaagSlug = getEffectiveMiddenlaagMaterial(wallCfg);
if (middenlaagSlug) {
  const row = materials?.find(m => m.slug === middenlaagSlug) ?? null;
  const pricing = row?.pricing.middenlaag;
  if (pricing) {
    if (pricing.kind === 'panel') {
      const cost = area * pricing.perSqm;
      lineItems.push({
        labelKey: `${WALL_LABEL_KEY[wallId] ?? wallId}.middenlaag`,
        area,
        materialCost: cost,
        insulationCost: 0,
        extrasCost: 0,
        total: cost,
      });
    } else {
      // frame
      const wallLength = getWallLength(wallId, building.dimensions);
      const count = Math.max(
        2,
        Math.ceil((wallLength * 1000) / pricing.beamSpacingMm) + 1,
      );
      const cost = count * pricing.perBeam;
      lineItems.push({
        labelKey: `${WALL_LABEL_KEY[wallId] ?? wallId}.middenlaag.frame`,
        labelParams: { count },
        area: 0,
        materialCost: cost,
        insulationCost: 0,
        extrasCost: 0,
        total: cost,
      });
    }
  }
}

return lineItems;
```

This requires `materials: MaterialRow[]` to be available in `wallLineItem` — check the existing signature; if it's not threaded yet, pass it from the caller (`calculateTotalQuote` invokes `wallLineItem`). Trace the signature chain and thread `materials` in if missing. Existing `wallCatalog` / `doorCatalog` are derived projections — we need the full `materials` rows here because middenlaag pricing isn't shaped like the per-m² projections.

CONCRETE: if `wallLineItem` doesn't already take `materials`, change its signature to:

```ts
function wallLineItem(
  wallId: WallId,
  building: BuildingEntity,
  effectiveHeight: number,
  priceBook: PriceBook,
  wallCatalog: readonly { atomId: string; pricePerSqm: number }[],
  doorCatalog: readonly { atomId: string; surcharge: number }[],
  supplierProducts: readonly SupplierProductRow[],
  materials: readonly MaterialRow[],
  buildings?: BuildingEntity[],
): LineItem[]
```

…and pass `materials` from `calculateTotalQuote`'s call site.

- [ ] **Step 4: Run to verify the tests pass**

Run: `pnpm test -- pricing-wall-middenlaag`
Expected: 3 passing.

- [ ] **Step 5: Full suite**

Run: `pnpm test`
Expected: all previously-green tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/domain/pricing/calculate.ts tests/pricing-wall-middenlaag.test.ts
git commit -m "feat(pricing): emit wall.<side>.middenlaag line item (panel + frame)"
```

---

## Task 8: Product defaults — hydrate `materialIdMiddenlaag` from `wallMiddenlaag` slot

**Files:**
- Modify: `src/domain/catalog/product.ts`
- Modify: `src/domain/config/mutations.ts`
- Test: `tests/catalog-product-wall-middenlaag.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `tests/catalog-product-wall-middenlaag.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import { applyProductDefaults } from '@/domain/catalog';
import type { ProductRow } from '@/domain/catalog';

function makeProduct(extras: Partial<ProductRow> = {}): ProductRow {
  return {
    id: 'p1', tenantId: 't1', kind: 'berging', slug: 'std', name: 'Std',
    heroImage: null, basePriceCents: 0, sortOrder: 0,
    archivedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01',
    defaults: { materials: { wallCladding: 'wood', wallMiddenlaag: 'rockwool-100' } },
    constraints: {},
    ...extras,
  };
}

describe('applyProductDefaults — middenlaag', () => {
  it('surfaces wallMiddenlaag on the returned defaults', () => {
    const out = applyProductDefaults(makeProduct());
    expect(out.materialIdMiddenlaag).toBe('rockwool-100');
  });

  it('returns no middenlaag when the product omits wallMiddenlaag', () => {
    const p = makeProduct();
    delete p.defaults.materials!.wallMiddenlaag;
    const out = applyProductDefaults(p);
    expect(out.materialIdMiddenlaag).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- catalog-product-wall-middenlaag`
Expected: FAIL (no `materialIdMiddenlaag` field on returned defaults).

- [ ] **Step 3: Extend `ProductBuildingDefaults`**

Open `src/domain/catalog/product.ts`. Find `ProductBuildingDefaults`. Add the field right under `materialIdInner`:

```ts
export interface ProductBuildingDefaults {
  // …existing fields
  primaryMaterialId?: string;
  materialIdInner?: string;
  /** When set, applied to every wall's `materialIdMiddenlaag` at spawn. */
  materialIdMiddenlaag?: string;
  floor?: { materialId: string };
  // …
}
```

- [ ] **Step 4: Wire `applyProductDefaults`**

In the same file, find `applyProductDefaults`'s `if (mats)` block. Add the new assignment right below `wallCladdingInner`:

```ts
if (mats.wallCladding) out.primaryMaterialId = mats.wallCladding;
if (mats.wallCladdingInner) out.materialIdInner = mats.wallCladdingInner;
if (mats.wallMiddenlaag) out.materialIdMiddenlaag = mats.wallMiddenlaag;
if (mats.floor) out.floor = { materialId: mats.floor };
```

- [ ] **Step 5: Hydrate onto every wall at spawn**

Open `src/domain/config/mutations.ts`. Find the existing `materialIdInner` hydration in `addBuilding` (introduced by the inner-cladding work — extends a `walls` map per wall id). Add a parallel block right next to it:

```ts
const walls = wallsForType(type);
if (productDefaults?.materialIdInner) {
  for (const wId of Object.keys(walls) as WallId[]) {
    walls[wId].materialIdInner = productDefaults.materialIdInner;
  }
}
if (productDefaults?.materialIdMiddenlaag) {
  for (const wId of Object.keys(walls) as WallId[]) {
    walls[wId].materialIdMiddenlaag = productDefaults.materialIdMiddenlaag;
  }
}
```

(Adjust the local variable names to match the actual code — read the current `mutations.ts` first; the inner-cladding hydration is the model to mirror.)

- [ ] **Step 6: Run the test**

Run: `pnpm test -- catalog-product-wall-middenlaag`
Expected: 2 passing.

- [ ] **Step 7: Full suite**

Run: `pnpm test`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add src/domain/catalog/product.ts src/domain/config/mutations.ts tests/catalog-product-wall-middenlaag.test.ts
git commit -m "feat(catalog): hydrate materialIdMiddenlaag from product defaults"
```

---

## Task 9: 2D plattegrond — three-strip rendering

**Files:**
- Modify: `src/components/schematic/SchematicWalls.tsx`

UI-only — no new unit tests. Verify via `pnpm exec tsc --noEmit` + `pnpm test` (no regression) + `pnpm build` + manual smoke.

- [ ] **Step 1: Resolve the middenlaag color**

In `SolidWall`, just after the existing `innerSlug` / `innerColor` resolution, add:

```ts
const middenlaagSlug = cfg.materialIdMiddenlaag ?? null;
const middenlaagColor = middenlaagSlug
  ? getAtomColor(materials, middenlaagSlug, 'middenlaag')
  : null;
```

- [ ] **Step 2: Replace the two-strip layout with a 1 / 2 / 3 strip layout**

The current implementation branches on `hasInner` to render one rect or two strips per segment. Generalise so the segment renderer emits 1, 2, or 3 strips depending on which materials are set. Replace the existing per-segment `hasInner` branch with:

```ts
const hasMiddenlaag = !!middenlaagSlug;
const hasInner = !!innerSlug;

// Decide the strip layout for THIS wall:
//   neither     → 1 strip (full thickness)
//   inner only  → 2 strips (outer + inner half-thicknesses)
//   middenlaag only → 2 strips: outer (20%) + middenlaag fills inner+middenlaag share (80%)
//   both        → 3 strips: outer (20%) + middenlaag (60%) + inner (20%)
type Strip = { fillBase: string; offsetNorm: number; thicknessNorm: number };
const strips: Strip[] = (() => {
  if (!hasMiddenlaag && !hasInner) {
    return [{
      fillBase: getAtomColor(materials, cfg.materialId ?? primaryMaterialId, 'wall'),
      offsetNorm: 0,
      thicknessNorm: 1,
    }];
  }
  if (!hasMiddenlaag && hasInner) {
    return [
      { fillBase: getAtomColor(materials, cfg.materialId ?? primaryMaterialId, 'wall'), offsetNorm:  0.25, thicknessNorm: 0.50 },
      { fillBase: innerColor ?? '#888',                                                 offsetNorm: -0.25, thicknessNorm: 0.50 },
    ];
  }
  if (hasMiddenlaag && !hasInner) {
    return [
      { fillBase: getAtomColor(materials, cfg.materialId ?? primaryMaterialId, 'wall'), offsetNorm:  0.40, thicknessNorm: 0.20 },
      { fillBase: middenlaagColor ?? '#888',                                            offsetNorm: -0.10, thicknessNorm: 0.80 },
    ];
  }
  return [
    { fillBase: getAtomColor(materials, cfg.materialId ?? primaryMaterialId, 'wall'), offsetNorm:  0.40, thicknessNorm: 0.20 },
    { fillBase: middenlaagColor ?? '#888',                                            offsetNorm:  0.00, thicknessNorm: 0.60 },
    { fillBase: innerColor ?? '#888',                                                 offsetNorm: -0.40, thicknessNorm: 0.20 },
  ];
})();
```

The `offsetNorm` values are positions of each strip's CENTRE along the perpendicular axis, expressed as a fraction of `T` from the wall's midline, with `+` toward the outward direction. `thicknessNorm` is the strip's thickness as a fraction of `T`. For example for the three-strip case: outer centre is at `+0.40 × T` (= midline + 30 mm out → centre of the outer 30 mm strip), middenlaag centre is `0` (wall midline), inner centre is `-0.40 × T`.

- [ ] **Step 3: Render each strip per segment**

Replace the inside of the segments `.map` to iterate strips and emit one `<rect>` per strip per segment:

```ts
const renderedRects = renderSegments.map(([s, e], i) => {
  const segLen = e - s;
  if (segLen < 0.01) return null;
  const segCenter = (s + e) / 2;

  return (
    <g key={i}>
      {strips.map((strip, idx) => {
        const stripT = strip.thicknessNorm * T;
        const perpOffset = outerSign * (strip.offsetNorm * T);
        const x = isH
          ? cx + segCenter - segLen / 2
          : cx + perpOffset - stripT / 2;
        const y = isH
          ? cy + perpOffset - stripT / 2
          : cy + segCenter - segLen / 2;
        const w = isH ? segLen : stripT;
        const h = isH ? stripT : segLen;
        return (
          <rect
            key={idx}
            x={x} y={y} width={w} height={h}
            fill={isSelected ? '#3b82f6' : strip.fillBase}
            fillOpacity={isSelected ? 0.5 : 0.35}
            stroke={strokeColor}
            strokeWidth={0.02}
            cursor={onWallClick ? 'pointer' : undefined}
            pointerEvents={onWallClick ? 'auto' : 'none'}
            onClick={(ev) => { ev.stopPropagation(); onWallClick?.(); }}
          />
        );
      })}
    </g>
  );
});
```

(The earlier two-strip block and its `outerStripFill` / `innerStripFill` / `outerStripOpacity` / `innerStripOpacity` locals can be removed — replaced by the strip table above.)

- [ ] **Step 4: Typecheck + tests + build**

```bash
pnpm exec tsc --noEmit   # must be clean
pnpm test                # all green
pnpm build               # success
```

- [ ] **Step 5: Commit**

```bash
git add src/components/schematic/SchematicWalls.tsx
git commit -m "feat(schematic): render wall as 1/2/3 strips depending on middenlaag + inner cladding"
```

---

## Task 10: 3D wall — three slabs + frame post meshes

**Files:**
- Modify: `src/components/canvas/Wall.tsx`

UI-only — no new unit tests. Verify via typecheck / tests / build / manual smoke.

- [ ] **Step 1: Resolve the middenlaag material + pricing**

Inside `Wall.tsx`, just after the existing `innerSlug` / `innerColor` / `innerTexture` resolution, add:

```ts
const middenlaagSlug = wallCfg
  ? getEffectiveMiddenlaagMaterial(wallCfg)
  : null;
const middenlaagRow = middenlaagSlug
  ? materials.find(m => m.slug === middenlaagSlug) ?? null
  : null;
const middenlaagPricing = middenlaagRow?.pricing.middenlaag ?? null;
const middenlaagColor = middenlaagSlug
  ? getAtomColor(materials, middenlaagSlug, 'middenlaag')
  : null;
// Unconditional hook — placeholder slug when no middenlaag.
const middenlaagTexture = useWallTexture(middenlaagSlug ?? materialId, wallLength, height);
```

Import the resolver in the existing `@/domain/materials` import line:

```ts
import {
  // …existing
  getEffectiveInnerWallMaterial,
  getEffectiveMiddenlaagMaterial,
} from '@/domain/materials';
```

- [ ] **Step 2: Extend the layer-layout `useMemo`**

The existing `useMemo` returns `{ size, position, rotation, halfSlabSize, outerPosition, innerPosition }`. Generalise it to return a `layers` array describing every layer the wall needs, with each layer carrying its world position and the slab dimensions.

Replace the existing `useMemo` body with this. Adjust to match the local var conventions in your file:

```ts
type LayerRole = 'whole' | 'outerCladding' | 'middenlaag' | 'innerCladding';
interface LayerSpec {
  role: LayerRole;
  /** World position of the slab centre. */
  position: [number, number, number];
  /** Slab size: [width-along-wall, height, thickness-perpendicular-to-wall]. */
  size: [number, number, number];
}

const { layout, rotation } = useMemo(() => {
  const t = WALL_THICKNESS;
  const inset = isMuur ? 0 : 0.01;
  const w = width - inset * 2;
  const d = depth - inset * 2;
  const rot: [number, number, number] = [0, 0, 0];

  // Outward direction in world coords for each wall.
  let perpAxis: 'x' | 'z';
  let outwardSign: 1 | -1;
  let centre: [number, number, number];
  let lengthAlongWall: number;

  switch (wallId) {
    case 'front':
      perpAxis = 'z'; outwardSign =  1;
      centre = [0, height / 2, isMuur ? 0 : depth / 2 - inset];
      lengthAlongWall = w;
      break;
    case 'back':
      perpAxis = 'z'; outwardSign = -1;
      centre = [0, height / 2, -depth / 2 + inset];
      lengthAlongWall = w;
      break;
    case 'left':
      perpAxis = 'x'; outwardSign = -1;
      centre = [-width / 2 + inset, height / 2, 0];
      lengthAlongWall = d;
      break;
    case 'right':
      perpAxis = 'x'; outwardSign =  1;
      centre = [ width / 2 - inset, height / 2, 0];
      lengthAlongWall = d;
      break;
  }

  // Helper: produce a layer at a perpendicular offset from the wall centre.
  function layer(role: LayerRole, offsetNorm: number, thicknessNorm: number): LayerSpec {
    const thickness = thicknessNorm * t;
    const offset = outwardSign * (offsetNorm * t);
    const pos: [number, number, number] =
      perpAxis === 'z'
        ? [centre[0], centre[1], centre[2] + offset]
        : [centre[0] + offset, centre[1], centre[2]];
    const size: [number, number, number] =
      perpAxis === 'z'
        ? [lengthAlongWall, height, thickness]
        : [thickness, height, lengthAlongWall];
    return { role, position: pos, size };
  }

  // Layer layouts mirror the strip layouts in the plattegrond.
  const hasInner = !!innerSlug;
  const hasMiddenlaag = !!middenlaagSlug;
  let layers: LayerSpec[];
  if (!hasInner && !hasMiddenlaag) {
    layers = [layer('whole', 0, 1)];
  } else if (hasInner && !hasMiddenlaag) {
    layers = [
      layer('outerCladding',  0.25, 0.50),
      layer('innerCladding', -0.25, 0.50),
    ];
  } else if (!hasInner && hasMiddenlaag) {
    layers = [
      layer('outerCladding',  0.40, 0.20),
      layer('middenlaag',    -0.10, 0.80),
    ];
  } else {
    layers = [
      layer('outerCladding',  0.40, 0.20),
      layer('middenlaag',     0.00, 0.60),
      layer('innerCladding', -0.40, 0.20),
    ];
  }

  return { layout: { layers, perpAxis, outwardSign, lengthAlongWall }, rotation: rot };
}, [wallId, width, depth, height, isMuur, innerSlug, middenlaagSlug]);
```

- [ ] **Step 3: Geometry: half-thickness when slabs share opening cutouts**

The existing `wallGeo` (full-thickness extrude) and `halfSlabGeo` (half-thickness extrude, used for outer + inner slabs in the inner-cladding path) become layer-specific. The simplest path: build ONE geometry per distinct slab thickness on the fly. Since the geometry needs to be UV-correct for its thickness, build geometries per-layer when openings exist.

Replace the current `halfSlabGeo` useMemo with a layer-keyed geometry resolver. Concretely, build a `Map<role, ExtrudeGeometry>`:

```ts
const layerGeoms = useMemo(() => {
  if (!hasOpenings) return null;
  const m = new Map<LayerRole, import('three').ExtrudeGeometry>();
  for (const layer of layout.layers) {
    m.set(layer.role, createWallWithOpeningsGeo(
      wallLength,
      height,
      layer.size[2],  // for front/back walls; for left/right walls thickness is size[0]
      wallId,
      doorHole,
      windowHoles,
    ));
  }
  return m;
}, [hasOpenings, layout, wallLength, height, wallId, doorHole, windowHoles]);

useEffect(() => () => { layerGeoms?.forEach(g => g.dispose()); }, [layerGeoms]);
```

NOTE on the thickness arg: for front/back walls the perpendicular axis is z, so the geometry's extrude depth equals `layer.size[2]`. For left/right walls the perpendicular axis is x, so the extrude depth equals `layer.size[0]`. The `createWallWithOpeningsGeo` helper internally applies the per-wallId rotation that handles this — pass whichever of `size[0]` / `size[2]` is the perpendicular thickness for the given wall:

```ts
const perpThickness =
  layout.perpAxis === 'z' ? layer.size[2] : layer.size[0];
```

…and use `perpThickness` as the third arg to `createWallWithOpeningsGeo`.

- [ ] **Step 4: Render N slab meshes per the `layout.layers` table**

Inside the existing `<group>`, replace the previous outer-only / outer+inner branching with a loop over `layout.layers`. Each layer either:
- Renders a panel-style mesh (the regular box / extrude), OR
- For middenlaag with frame kind, renders a SET of vertical post meshes inside the cavity instead of a solid slab.

Sketch:

```tsx
return (
  <group>
    {layout.layers.map((layer, i) => {
      // Material resolution per role.
      const isOuter = layer.role === 'outerCladding' || layer.role === 'whole';
      const isInner = layer.role === 'innerCladding';
      const isMid   = layer.role === 'middenlaag';

      const slabSlug =
        isMid && middenlaagSlug ? middenlaagSlug :
        isInner && innerSlug    ? innerSlug      :
        materialId;
      const slabColor =
        isMid && middenlaagColor ? middenlaagColor :
        isInner && innerColor    ? innerColor      :
        color;
      const slabTexture =
        isMid    ? middenlaagTexture :
        isInner  ? innerTexture      :
        texture;

      // Frame middenlaag: render posts instead of a solid slab.
      if (isMid && middenlaagPricing?.kind === 'frame') {
        return (
          <FramePosts
            key={i}
            wallId={wallId}
            wallLength={layout.lengthAlongWall}
            height={height}
            slabPosition={layer.position}
            rotation={rotation}
            perpAxis={layout.perpAxis}
            perpThickness={layout.perpAxis === 'z' ? layer.size[2] : layer.size[0]}
            beamWidthMm={middenlaagPricing.beamWidthMm}
            beamSpacingMm={middenlaagPricing.beamSpacingMm}
            slug={middenlaagSlug!}
            color={middenlaagColor ?? '#888'}
            texture={middenlaagTexture}
            envMapIntensity={WALL_ENV_MAP_INTENSITY[middenlaagSlug!] ?? 0.4}
            doorHole={doorHole}
            windowHoles={windowHoles}
            isSelected={isSelected}
            hovered={hovered}
            pointerHandlers={pointerHandlers}
          />
        );
      }

      // Panel / cladding slab.
      const perpThickness = layout.perpAxis === 'z' ? layer.size[2] : layer.size[0];
      const geo = hasOpenings ? layerGeoms?.get(layer.role) ?? null : null;
      return (
        <mesh
          key={i}
          ref={i === 0 ? meshRef : undefined}
          position={layer.position}
          rotation={rotation}
          castShadow
          receiveShadow
          {...pointerHandlers}
        >
          {geo ? (
            <primitive object={geo} attach="geometry" />
          ) : (
            <boxGeometry args={layer.size} />
          )}
          <meshStandardMaterial
            color={slabTexture?.map ? (WALL_TEXTURE_TINT[slabSlug] ?? '#ffffff') : slabColor}
            map={slabTexture?.map ?? undefined}
            normalMap={slabTexture?.normalMap ?? undefined}
            roughnessMap={slabTexture?.roughnessMap ?? undefined}
            metalness={0.1}
            roughness={slabTexture?.roughnessMap ? 1 : 0.7}
            envMapIntensity={WALL_ENV_MAP_INTENSITY[slabSlug] ?? 0.4}
            emissive={isSelected ? '#3b82f6' : hovered ? '#60a5fa' : '#000000'}
            emissiveIntensity={isSelected ? 0.35 : hovered ? 0.15 : 0}
          />
        </mesh>
      );
    })}

    <WallOpenings
      wallId={wallId}
      wallPosition={layout.layers[0].position}
      wallLength={wallLength}
      height={height}
      wallCfg={wallCfg}
      effectiveDoorMaterial={building ? getEffectiveDoorMaterial(wallCfg, building, buildings) : 'wood'}
    />
  </group>
);
```

(`perpThickness` is unused here — the boxGeometry's `args` already encode it. Drop the local if the linter complains.)

- [ ] **Step 5: `FramePosts` sub-component**

Add at the bottom of `Wall.tsx` (or a sibling file):

```tsx
interface FramePostsProps {
  wallId: WallId;
  wallLength: number;
  height: number;
  slabPosition: [number, number, number];
  rotation: [number, number, number];
  perpAxis: 'x' | 'z';
  perpThickness: number;
  beamWidthMm: number;
  beamSpacingMm: number;
  slug: string;
  color: string;
  texture: ReturnType<typeof useWallTexture>;
  envMapIntensity: number;
  doorHole: DoorHole | null;
  windowHoles: WindowHole[];
  isSelected: boolean;
  hovered: boolean;
  pointerHandlers: Record<string, unknown>;
}

function FramePosts({
  wallLength, height, slabPosition, rotation, perpAxis, perpThickness,
  beamWidthMm, beamSpacingMm, slug, color, texture, envMapIntensity,
  doorHole, windowHoles, isSelected, hovered, pointerHandlers,
}: FramePostsProps) {
  // Evenly-spaced post centres along the wall. Start with the corner-anchored
  // count formula used in pricing: ceil(L / spacing) + 1.
  const beamW = beamWidthMm / 1000;
  const spacing = beamSpacingMm / 1000;
  const rawCount = Math.max(2, Math.ceil(wallLength / spacing) + 1);
  const halfL = wallLength / 2;
  const step = wallLength / (rawCount - 1);

  // Post centre positions along the wall length (local axis), each tested
  // against door / window cutouts. Drop posts whose footprint overlaps an
  // opening at ground level (door) or at any vertical height the window
  // covers (window).
  const posts = Array.from({ length: rawCount }, (_, k) => -halfL + k * step)
    .filter(localX => {
      // Door cutout: full height (ground → DOOR_H). Any post within ±beamW/2
      // of the door's horizontal extent is dropped — the post would intersect
      // the doorway.
      if (doorHole) {
        const dHalf = doorHole.width / 2;
        if (Math.abs(localX - doorHole.x) < dHalf + beamW / 2) return false;
      }
      // Window cutouts: drop posts that overlap horizontally AND vertically
      // somewhere in the post's vertical span. For simplicity drop any post
      // whose horizontal centre lies within the window's horizontal extent —
      // a post passing through a window opening looks wrong even if it
      // would technically have material above + below it.
      for (const win of windowHoles) {
        const wHalf = win.width / 2;
        if (Math.abs(localX - win.x) < wHalf + beamW / 2) return false;
      }
      return true;
    });

  // Post mesh geometry: a thin tall box. Dimensions depend on wall orientation.
  // `size`: [along-wall, height, perpendicular-to-wall].
  const size: [number, number, number] = [beamW, height, perpThickness];

  return (
    <>
      {posts.map((localX, i) => {
        // The post's position in world coords = slabPosition + offset along
        // the wall length axis. perpAxis tells us which world axis runs
        // perpendicular to the wall; the OTHER horizontal axis runs along the
        // wall length. For front/back walls (perpAxis = z), along = x.
        // For left/right walls (perpAxis = x), along = z.
        const pos: [number, number, number] =
          perpAxis === 'z'
            ? [slabPosition[0] + localX, slabPosition[1], slabPosition[2]]
            : [slabPosition[0], slabPosition[1], slabPosition[2] + localX];

        const meshSize: [number, number, number] =
          perpAxis === 'z' ? [beamW, height, perpThickness]
                           : [perpThickness, height, beamW];

        return (
          <mesh
            key={i}
            position={pos}
            rotation={rotation}
            castShadow
            receiveShadow
            {...pointerHandlers}
          >
            <boxGeometry args={meshSize} />
            <meshStandardMaterial
              color={texture?.map ? (WALL_TEXTURE_TINT[slug] ?? '#ffffff') : color}
              map={texture?.map ?? undefined}
              normalMap={texture?.normalMap ?? undefined}
              roughnessMap={texture?.roughnessMap ?? undefined}
              metalness={0.1}
              roughness={texture?.roughnessMap ? 1 : 0.7}
              envMapIntensity={envMapIntensity}
              emissive={isSelected ? '#3b82f6' : hovered ? '#60a5fa' : '#000000'}
              emissiveIntensity={isSelected ? 0.35 : hovered ? 0.15 : 0}
            />
          </mesh>
        );
      })}
    </>
  );
}
```

- [ ] **Step 6: Typecheck / tests / build**

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

All must be clean.

- [ ] **Step 7: Manual smoke**

`pnpm dev`, then:

1. Wall with no middenlaag, no inner → renders as today.
2. Set inner cladding only → existing two-slab look.
3. Set middenlaag = panel rockwool → two slabs, outer 20% thick + middenlaag fills the inner side (80%).
4. Set middenlaag = panel + inner cladding → three slabs.
5. Set middenlaag = frame (SLS 38×89 h.o.h. 600) → outer slab + N vertical posts (~7 on a 4m wall) + (optional) inner slab.
6. Walls with a door / window → posts that would land in the opening are gone.

- [ ] **Step 8: Commit**

```bash
git add src/components/canvas/Wall.tsx
git commit -m "feat(canvas): render middenlaag slab + frame posts in 3D wall"
```

---

## Task 11: Wall properties panel — middenlaag section

**Files:**
- Modify: `src/components/ui/SurfaceProperties.tsx`
- Modify: `src/lib/i18n.ts`

- [ ] **Step 1: Add i18n keys**

Open `src/lib/i18n.ts`, append to the `nl` map near the existing wall keys:

```ts
'wall.front.middenlaag': 'Middenlaag voorgevel',
'wall.back.middenlaag': 'Middenlaag achtergevel',
'wall.left.middenlaag': 'Middenlaag linkergevel',
'wall.right.middenlaag': 'Middenlaag rechtergevel',
'wall.front.middenlaag.frame': 'Houten frame voorgevel',
'wall.back.middenlaag.frame': 'Houten frame achtergevel',
'wall.left.middenlaag.frame': 'Houten frame linkergevel',
'wall.right.middenlaag.frame': 'Houten frame rechtergevel',
'wallProperties.middenlaag': 'Middenlaag',
'wallProperties.addMiddenlaag': '+ Middenlaag toevoegen',
'wallProperties.removeMiddenlaag': 'Verwijderen',
'wallProperties.middenlaagPanelSpec': '{name} — {thickness} mm',
'wallProperties.middenlaagFrameSpec': '{name} — {width}×{depth} mm h.o.h. {spacing} mm',
```

The `t(key, params)` helper substitutes `{name}` / `{thickness}` etc. via the existing param-interpolation pattern used by other multi-param keys (search the file for an existing example like `surface.windows` if you need a reference).

- [ ] **Step 2: Add the Middenlaag section between Buitenbekleding and Binnenbekleding**

Open `src/components/ui/SurfaceProperties.tsx`. Pull the middenlaag-aware tenant catalog. The existing `useTenantCatalogs({ wall: selectedWall }, …)` hook needs to also return a middenlaag catalog. If the hook doesn't accept that today, extend it; otherwise inline a `materials.filter(m => m.categories.includes('middenlaag'))` projection in this component.

Add to imports:

```ts
import { useTenant } from '@/lib/TenantProvider';
```

Inside the component, derive the middenlaag catalog:

```ts
const { catalog: { materials } } = useTenant();
const middenlaagCatalog = useMemo(
  () => materials.filter(m => m.categories.includes('middenlaag') && !m.archivedAt),
  [materials],
);
```

(Adjust imports — `useMemo` from React if it isn't imported yet.)

Compute the middenlaag slug + the spec caption:

```ts
const middenlaagSlug = wallCfg.materialIdMiddenlaag ?? null;
const middenlaagRow = middenlaagSlug
  ? middenlaagCatalog.find(m => m.slug === middenlaagSlug) ?? null
  : null;
const middenlaagPricing = middenlaagRow?.pricing.middenlaag ?? null;
const middenlaagSpec: string | null = !middenlaagRow || !middenlaagPricing
  ? null
  : middenlaagPricing.kind === 'panel'
    ? t('wallProperties.middenlaagPanelSpec', { name: middenlaagRow.name, thickness: middenlaagPricing.thicknessMm })
    : t('wallProperties.middenlaagFrameSpec', {
        name: middenlaagRow.name,
        width: middenlaagPricing.beamWidthMm,
        depth: middenlaagPricing.thicknessMm,
        spacing: middenlaagPricing.beamSpacingMm,
      });
```

Render the section. Insert AFTER the outer-cladding block and BEFORE the inner-cladding block:

```tsx
{/* Middenlaag */}
{middenlaagSlug == null ? (
  <button
    type="button"
    className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
    onClick={() => {
      const seed = middenlaagCatalog[0]?.slug;
      if (!seed) return;
      updateBuildingWall(buildingId, wallId, { materialIdMiddenlaag: seed });
    }}
  >
    {t('wallProperties.addMiddenlaag')}
  </button>
) : (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <SectionLabel>{t('wallProperties.middenlaag')}</SectionLabel>
      <button
        type="button"
        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline"
        onClick={() => updateBuildingWall(buildingId, wallId, { materialIdMiddenlaag: null })}
      >
        {t('wallProperties.removeMiddenlaag')}
      </button>
    </div>
    <MaterialSelect
      catalog={middenlaagCatalog.map(m => ({
        atomId: m.slug, name: m.name, color: m.color,
      }))}
      value={middenlaagSlug}
      category="middenlaag"
      onChange={(atomId) => updateBuildingWall(buildingId, wallId, { materialIdMiddenlaag: atomId })}
      ariaLabel={t('wallProperties.middenlaag')}
    />
    {middenlaagSpec && (
      <p className="text-[11px] text-muted-foreground italic">{middenlaagSpec}</p>
    )}
  </div>
)}
```

NOTE: `MaterialSelect` expects its `catalog` prop in the same shape the outer / inner pickers use. Read the existing usage of `MaterialSelect` in this file and match its prop names exactly — the snippet above shows the structure but may need a small adapter (e.g. `pricePerSqm` field omitted for middenlaag since per-beam pricing doesn't map onto a per-m² display). Drop `showPrice` if it'd be misleading on per-beam rows.

- [ ] **Step 3: Typecheck / tests / build**

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

- [ ] **Step 4: Manual smoke**

`pnpm dev`:

1. Select a wall — Middenlaag section sits between Buitenbekleding and Binnenbekleding with a `+ Middenlaag toevoegen` button.
2. Click the button — picker appears, defaults to the first middenlaag material. Spec caption shows underneath.
3. Switch to a frame-kind material — caption updates to "Vurenhout SLS — 38×89 mm h.o.h. 600 mm".
4. "Verwijderen" clears it; the section collapses back to the button.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/SurfaceProperties.tsx src/lib/i18n.ts
git commit -m "feat(ui): wall panel exposes the middenlaag picker + spec caption"
```

---

## Task 12: Admin material form — kind-aware middenlaag block

**Files:**
- Modify: `src/components/admin/catalog/MaterialForm.tsx`
- Modify: `src/lib/i18n.ts` (admin keys)

This is the largest UI task — read the existing form's structure first to match the patterns (Zod schema if any, react-hook-form usage, the per-category pricing pattern).

- [ ] **Step 1: Add admin i18n keys**

Append to `src/lib/i18n.ts`:

```ts
'admin.material.middenlaagKind': 'Type',
'admin.material.middenlaagKind.panel': 'Paneel',
'admin.material.middenlaagKind.frame': 'Frame',
'admin.material.beamDepthMm': 'Diepte (mm)',
'admin.material.beamWidthMm': 'Breedte balk (mm)',
'admin.material.beamSpacingMm': 'H.o.h. (mm)',
'admin.material.perBeam': 'Prijs per balk',
'admin.material.thicknessMm': 'Dikte (mm)',
'admin.material.middenlaagSection': 'Middenlaag',
```

- [ ] **Step 2: Surface the new category in the categories multi-select**

The form already has a categories multi-select fed by `MATERIAL_CATEGORIES`. Because Task 3 added `'middenlaag'` to that array, the option appears automatically. Confirm by reading the form's categories rendering code — if the form hard-codes the category list anywhere, replace it with the imported `MATERIAL_CATEGORIES` constant.

- [ ] **Step 3: Add a conditional "Middenlaag" pricing block**

Locate the section that renders per-category pricing inputs (today it renders `pricing.wall.perSqm`, `pricing.floor.perSqm`, etc., conditionally per-category in `categories`). Add a matching block shown when `categories.includes('middenlaag')`:

```tsx
{categories.includes('middenlaag') && (
  <section className="space-y-3 rounded-md border border-border p-3">
    <h3 className="text-sm font-medium">{t('admin.material.middenlaagSection')}</h3>

    <FormField name="pricing.middenlaag.kind" render={…}>
      <FormLabel>{t('admin.material.middenlaagKind')}</FormLabel>
      <select
        value={midKind}
        onChange={(e) => setMidKind(e.target.value as MiddenlaagKind)}
      >
        <option value="panel">{t('admin.material.middenlaagKind.panel')}</option>
        <option value="frame">{t('admin.material.middenlaagKind.frame')}</option>
      </select>
    </FormField>

    {/* Panel inputs */}
    {midKind === 'panel' && (
      <>
        <NumberField name="pricing.middenlaag.thicknessMm" label={t('admin.material.thicknessMm')} />
        <NumberField name="pricing.middenlaag.perSqm"      label={t('admin.material.perSqm')} />
      </>
    )}

    {/* Frame inputs */}
    {midKind === 'frame' && (
      <>
        <NumberField name="pricing.middenlaag.thicknessMm"  label={t('admin.material.beamDepthMm')} />
        <NumberField name="pricing.middenlaag.beamWidthMm"  label={t('admin.material.beamWidthMm')} />
        <NumberField name="pricing.middenlaag.beamSpacingMm" label={t('admin.material.beamSpacingMm')} />
        <NumberField name="pricing.middenlaag.perBeam"      label={t('admin.material.perBeam')} />
      </>
    )}
  </section>
)}
```

The `FormField` / `NumberField` placeholders should be replaced with the actual form primitives this file uses — read the existing per-m² inputs to match exact prop names and validation hooks. Key requirements:

- The form's `pricing` state must store `pricing.middenlaag` as the discriminated union the validator expects. When the user switches `kind`, clear the previous kind's keys (panel fields when switching to frame, frame fields when switching to panel) before persisting.
- All four numeric fields gate on `> 0` and finite (the validator will reject otherwise, but client-side feedback is nicer).

- [ ] **Step 4: Update the form's payload-builder for create / patch**

The form posts to `POST /api/admin/materials` (create) or `PATCH /api/admin/materials/[id]` (edit). The serialiser must construct `pricing.middenlaag` correctly per kind. Trace the existing `submit` handler and add the equivalent middenlaag branch.

- [ ] **Step 5: Manual smoke**

`pnpm dev` → log in as super_admin or tenant_admin → `/admin/catalog/materials` → create a new material:

1. Set categories = ['middenlaag'], kind = 'panel', thickness = 100, perSqm = 12 → save → row appears in the table.
2. Edit the row → change kind to 'frame' → frame fields appear, panel fields disappear → fill them in → save → still works.
3. Try invalid input (e.g. perBeam = -5) → form refuses to submit or server returns 422 with `pricing_invalid`.

- [ ] **Step 6: Typecheck + tests + build**

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/catalog/MaterialForm.tsx src/lib/i18n.ts
git commit -m "feat(admin): kind-aware middenlaag block in material form"
```

---

## Task 13: Seed — demo middenlaag rows

**Files:**
- Modify: `src/db/seed.ts`

- [ ] **Step 1: Read the existing wall material seed**

Open `src/db/seed.ts`. Locate the section that inserts wall-category materials (rows like `wood`, `brick`, etc.) using `INSERT … ON CONFLICT (tenant_id, slug) DO NOTHING` or the Drizzle equivalent. The middenlaag seeds follow the same shape, just with a different category + pricing.

- [ ] **Step 2: Add three demo rows (idempotent)**

Insert after the existing wall material block. The exact SQL / Drizzle syntax mirrors the existing pattern; conceptually:

`TENANT_ID` already exists in this file (defined near the top as `'assymo'`). Reuse it.

```ts
const middenlaagSeeds = [
  {
    slug: 'rockwool-100',
    name: 'Rockwool 100mm',
    color: '#FFCC66',
    categories: ['middenlaag'] as const,
    pricing: {
      middenlaag: { kind: 'panel' as const, thicknessMm: 100, perSqm: 12 },
    },
    flags: {},
    textures: null,
    tileSize: null,
  },
  {
    slug: 'pir-80',
    name: 'PIR 80mm',
    color: '#F1E9C6',
    categories: ['middenlaag'] as const,
    pricing: {
      middenlaag: { kind: 'panel' as const, thicknessMm: 80, perSqm: 18 },
    },
    flags: {},
    textures: null,
    tileSize: null,
  },
  {
    slug: 'sls-38x89-hoh600',
    name: 'Vurenhout SLS 38×89',
    color: '#C4955A',
    categories: ['middenlaag'] as const,
    pricing: {
      middenlaag: {
        kind: 'frame' as const,
        thicknessMm: 89,
        beamWidthMm: 38,
        beamSpacingMm: 600,
        perBeam: 15,
      },
    },
    flags: {},
    textures: null,
    tileSize: null,
  },
];

for (const seed of middenlaagSeeds) {
  await db
    .insert(materials)
    .values({
      id: crypto.randomUUID(),
      tenantId: TENANT_ID,
      ...seed,
    })
    .onConflictDoNothing({ target: [materials.tenantId, materials.slug] });
}
```

(Adjust to the actual existing seed style — variable names, awaited helpers, etc.)

CRITICAL: `onConflictDoNothing` ensures existing rows are NOT modified. This is the constraint the user called out. NEVER use `onConflictDoUpdate` for middenlaag seeds.

- [ ] **Step 3: Dry-run the seed locally**

If you have a local Neon dev DB:

```bash
pnpm db:seed
```

Verify:
- A fresh DB picks up all three rows.
- A re-run picks up only missing rows (existing rows untouched).

If no local DB is available, skip the run; the `ON CONFLICT DO NOTHING` semantics are the contract.

- [ ] **Step 4: Commit**

```bash
git add src/db/seed.ts
git commit -m "feat(seed): add middenlaag demo rows (rockwool-100, pir-80, sls-38x89-hoh600)"
```

---

## Task 14: Full regression sweep + verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all green. Total should be the pre-feature count + the new tests from this plan (~15 new across pricing / validate / resolve / applyDefaults / material-validator).

- [ ] **Step 2: TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: SUCCESS.

- [ ] **Step 4: Lint scan (informational)**

Run:

```bash
pnpm lint 2>&1 | grep -E "Wall\.tsx|SchematicWalls\.tsx|SurfaceProperties\.tsx|MaterialForm\.tsx|catalog/material\.ts|config/validate\.ts|pricing/calculate\.ts|materials/resolve\.ts|catalog/product\.ts|catalog/types\.ts|building/constants\.ts|building/types\.ts|config/mutations\.ts|i18n\.ts|seed\.ts" | head -40
```

Pre-existing warnings are fine per CLAUDE.md; **no NEW errors in changed files**.

- [ ] **Step 5: Manual UI smoke checklist**

`pnpm dev`, then:

1. **Plattegrond / 3D consistency**: with neither middenlaag nor inner cladding set, both views render exactly as before this work. ✓
2. **Panel middenlaag**: add rockwool-100 to a berging's front wall. Plattegrond shows two strips (outer + middenlaag); 3D shows two slabs. ✓
3. **Frame middenlaag**: switch to sls-38x89-hoh600. Plattegrond strip colour changes to the wood colour; 3D replaces the middle slab with 7 vertical posts on a 4m wall (or `ceil(width/0.6)+1`). ✓
4. **All three layers**: add inner cladding on top → plattegrond now three strips, 3D three slabs (outer + middenlaag panel) OR (outer + frame posts + inner). ✓
5. **Opening interaction**: add a door to the front wall with frame middenlaag → posts that would overlap the door are missing; the rest stand. ✓
6. **Quote / order**: pricing block shows `wall.front.middenlaag` (panel) or `wall.front.middenlaag.frame — N staanders` (frame). Submit an order → quote snapshot inside `/admin/orders/<id>` shows the same lines. ✓
7. **Invoice PDF**: issue an invoice → download the PDF → middenlaag lines appear in the line-items table with the correct totals. ✓
8. **Admin material form**: create a new middenlaag row with kind = panel → save → list shows it. Edit, switch to frame → frame fields appear → save → list still works. ✓
9. **Legacy scene compat**: open an existing scene that pre-dates this feature → no visual or pricing changes; opening / saving doesn't introduce middenlaag fields. ✓
10. **Seed re-run safety**: re-running `pnpm db:seed` against a populated DB does NOT touch any existing materials rows. ✓

- [ ] **Step 6: Final commit (optional, for any docstring tweaks landed)**

```bash
git status
# If clean, skip; otherwise commit any tiny cleanups.
```

---

## Out of scope (do NOT implement)

- Per-wall override of layer proportions (constants only).
- Per-tenant override of layer proportions (constants only).
- R-value / U-value calculations.
- Window/door reveals showing exposed cavity edges around openings.
- Per-beam individual marks in the 2D plattegrond (middenlaag strip carries one solid colour).
- Wall thickness varying with the chosen middenlaag (path documented in the spec as future work).
- Database schema migration — `pricing.middenlaag` rides inside the existing `pricing` jsonb column.
- Any change to share codes / `nanoid` generation — the new optional field doesn't require migration.
