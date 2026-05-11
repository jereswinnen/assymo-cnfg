# Inner Wall Cladding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional second material per wall (inner cladding) selectable on the 2D plattegrond, priced through the existing per-tenant `'wall'` catalog.

**Architecture:** New optional field `materialIdInner` on `WallConfig`, plus `face: 'outer' | 'inner'` extension on `SelectedElement`. The 2D plattegrond becomes the only surface that drives face selection — each wall renders as two parallel strips when inner is set, with separate hit targets. The 3D wall stays a single solid box but paints the outer-facing and inner-facing large faces with their respective materials via a per-face materials array. Pricing emits a second `wall.<side>.inner` line item per wall when inner is set, reusing the existing `wallNetArea` and `pricing.wall.perSqm`. Product defaults grow a new `wallCladdingInner` slot mapped to the `'wall'` category.

**Tech Stack:** TypeScript, Next.js 16 (App Router), React Three Fiber for 3D, SVG for the 2D plattegrond, Zustand (config + UI store), Vitest via Vite+, Drizzle (no schema migration needed — the data lives inside the existing `walls` jsonb on configs).

**Spec:** `docs/superpowers/specs/2026-05-11-inner-wall-cladding-design.md`

---

## File touch-list

**Domain (framework-free):**
- `src/domain/building/types.ts` — extend `WallConfig` + `SelectedElement`.
- `src/domain/materials/resolve.ts` — add `getEffectiveInnerWallMaterial`.
- `src/domain/pricing/calculate.ts` — emit inner line item.
- `src/domain/config/validate.ts` — validate `materialIdInner`.
- `src/domain/catalog/types.ts` — add `'wallCladdingInner'` slot.
- `src/domain/catalog/product.ts` — hydrate `materialIdInner` in `applyProductDefaults`; thread through product validators.

**UI:**
- `src/components/schematic/SchematicWalls.tsx` — two-strip rendering, per-face hit targets, per-face highlight.
- `src/components/schematic/SchematicView.tsx` — thread `face` through wall-click dispatch.
- `src/components/ui/SurfaceProperties.tsx` — inner picker + add/remove affordances + face header switching.
- `src/components/canvas/Wall.tsx` — per-face materials array on BoxGeometry when inner is set.

**Glue:**
- `src/lib/i18n.ts` — new keys.

**Tests:**
- `tests/openings.test.ts` (existing — make sure migration coverage is solid).
- `tests/pricing-wall-inner.test.ts` (new).
- `tests/materials-effective-inner.test.ts` (new).
- `tests/validate-wall-inner.test.ts` (new).
- `tests/catalog-product-wall-inner.test.ts` (new).
- `tests/snap.test.ts` (existing — keep passing).

---

## Naming & error-code conventions (read once)

- The existing `validate.ts` uses a single error code `unknown_material` with a `path` (e.g. `walls.front.materialId`). The inner-cladding check reuses this code with path `walls.<side>.materialIdInner` — no new error code is introduced; the path disambiguates inner vs outer.
- The existing `validateMaterial(slug, path, errors, materials)` accepts `string | undefined`. The new field can also be `null`; the validator helper is widened to accept `string | null | undefined` and treats both `undefined` and `null` as "not set" (early return).
- Product-defaults validation reuses the existing slot-keyed plumbing. The new `wallCladdingInner` slot maps to the `'wall'` category in `PRODUCT_SLOT_TO_CATEGORY`, so the existing category checks fire automatically.

---

## Task 1: Extend `WallConfig` and `SelectedElement`

**Files:**
- Modify: `src/domain/building/types.ts`

- [ ] **Step 1: Extend `WallConfig` with `materialIdInner`**

Open `src/domain/building/types.ts`. Find the `WallConfig` interface (around line 36). Add the new field right after the existing `materialId`:

```ts
export interface WallConfig {
  /** Override of the building's primaryMaterialId. When undefined the wall
   *  inherits from `BuildingEntity.primaryMaterialId`. */
  materialId?: string;
  /** Optional inner-side cladding override. `undefined` / `null` = no inner
   *  cladding on this wall. When a string, it must reference a non-archived
   *  material in the tenant's `'wall'` category catalog. There is no
   *  inherit-from-building fallback — inner cladding is per-wall only. */
  materialIdInner?: string | null;
  hasDoor: boolean;
  // …rest unchanged
}
```

- [ ] **Step 2: Extend `SelectedElement` with `face`**

In the same file, find the `SelectedElement` union (around line 151) and extend the wall member:

```ts
export type SelectedElement =
  | { type: 'wall'; id: WallId; buildingId: string; face?: 'outer' | 'inner' }
  | { type: 'roof' }
  | null;
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (the new fields are optional so no existing consumer breaks).

- [ ] **Step 4: Commit**

```bash
git add src/domain/building/types.ts
git commit -m "feat(domain): add materialIdInner + SelectedElement.face"
```

---

## Task 2: Material resolver — `getEffectiveInnerWallMaterial`

**Files:**
- Modify: `src/domain/materials/resolve.ts`
- Test: `tests/materials-effective-inner.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/materials-effective-inner.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import { getEffectiveInnerWallMaterial } from '@/domain/materials';
import type { WallConfig, BuildingEntity } from '@/domain/building';

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

function makeBuilding(): BuildingEntity {
  return {
    id: 'b1',
    type: 'berging',
    position: [0, 0],
    dimensions: { width: 4, depth: 4, height: 2.6 },
    primaryMaterialId: 'wood',
    walls: {},
    hasCornerBraces: false,
    floor: { materialId: 'beton' },
    orientation: 'horizontal',
    heightOverride: null,
  };
}

describe('getEffectiveInnerWallMaterial', () => {
  it('returns null when materialIdInner is undefined', () => {
    expect(getEffectiveInnerWallMaterial(makeWall(), makeBuilding())).toBeNull();
  });

  it('returns null when materialIdInner is null', () => {
    expect(getEffectiveInnerWallMaterial(makeWall({ materialIdInner: null }), makeBuilding())).toBeNull();
  });

  it('returns the inner material id when set', () => {
    expect(getEffectiveInnerWallMaterial(makeWall({ materialIdInner: 'osb' }), makeBuilding())).toBe('osb');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- materials-effective-inner`
Expected: FAIL (export `getEffectiveInnerWallMaterial` not found).

- [ ] **Step 3: Add the resolver**

Open `src/domain/materials/resolve.ts`. Add the new export at the end of the file:

```ts
/** Effective inner-side wall material slug — per-wall only, no inheritance.
 *  Returns `null` when inner cladding is not enabled on this wall. */
export function getEffectiveInnerWallMaterial(
  wall: WallConfig,
  _building: BuildingEntity,
  _buildings?: BuildingEntity[],
): string | null {
  if (!wall.materialIdInner) return null;
  return wall.materialIdInner;
}
```

(The unused `_building` / `_buildings` params keep the signature parallel to `getEffectiveWallMaterial` for callers that pass them by reflex.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- materials-effective-inner`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/domain/materials/resolve.ts tests/materials-effective-inner.test.ts
git commit -m "feat(materials): add getEffectiveInnerWallMaterial"
```

---

## Task 3: Validation — inner material must exist in tenant catalog

**Files:**
- Modify: `src/domain/config/validate.ts`
- Test: `tests/validate-wall-inner.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/validate-wall-inner.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import { validateConfig } from '@/domain/config';
import { makeConfig } from './fixtures';
import type { MaterialRow } from '@/domain/catalog';

function makeMaterial(id: string, slug: string, archived = false): MaterialRow {
  return {
    id, tenantId: 't1', categories: ['wall'], slug, name: slug,
    color: '#888', textures: null, tileSize: null,
    pricing: { wall: { perSqm: 50 } }, flags: {},
    archivedAt: archived ? '2026-01-01' : null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

describe('validateConfig — wall inner cladding', () => {
  it('accepts undefined materialIdInner', () => {
    const config = makeConfig();
    const errors = validateConfig(config, [makeMaterial('m1', 'wood')]);
    expect(errors).toEqual([]);
  });

  it('accepts null materialIdInner', () => {
    const config = makeConfig();
    config.buildings[0].walls.front.materialIdInner = null;
    const errors = validateConfig(config, [makeMaterial('m1', 'wood')]);
    expect(errors).toEqual([]);
  });

  it('accepts a known wall material slug', () => {
    const config = makeConfig();
    config.buildings[0].walls.front.materialIdInner = 'wood';
    const errors = validateConfig(config, [makeMaterial('m1', 'wood')]);
    expect(errors).toEqual([]);
  });

  it('rejects an unknown materialIdInner slug', () => {
    const config = makeConfig();
    config.buildings[0].walls.front.materialIdInner = 'ghost';
    const errors = validateConfig(config, [makeMaterial('m1', 'wood')]);
    expect(errors.some(e =>
      e.code === 'unknown_material'
      && e.path.endsWith('walls.front.materialIdInner'),
    )).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- validate-wall-inner`
Expected: FAIL on the "unknown materialIdInner" case (validator doesn't look at the new field yet).

- [ ] **Step 3: Widen `validateMaterial` to accept `null`**

In `src/domain/config/validate.ts`, change the helper signature so it tolerates the `null` sentinel:

```ts
function validateMaterial(
  slug: string | null | undefined,
  path: string,
  errors: ValidationError[],
  materials: MaterialRow[],
): void {
  if (slug === undefined || slug === null) return;
  if (materials.length === 0) return;
  if (!getAtom(materials, slug)) {
    errors.push({
      path,
      code: 'unknown_material',
      message: `Material slug "${slug}" is not registered`,
    });
  }
}
```

- [ ] **Step 4: Wire `materialIdInner` into `validateWall`**

In the same file, find `validateWall` (around line 79) and add the inner check directly below the existing `materialId` check:

```ts
validateMaterial(wall.materialId, `${basePath}.materialId`, errors, materials);
validateMaterial(wall.materialIdInner, `${basePath}.materialIdInner`, errors, materials);
validateMaterial(wall.doorMaterialId, `${basePath}.doorMaterialId`, errors, materials);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test -- validate-wall-inner`
Expected: 4 passing.

- [ ] **Step 6: Commit**

```bash
git add src/domain/config/validate.ts tests/validate-wall-inner.test.ts
git commit -m "feat(validate): check materialIdInner against tenant catalog"
```

---

## Task 4: Pricing — emit a second line item per wall when inner is set

**Files:**
- Modify: `src/domain/pricing/calculate.ts`
- Test: `tests/pricing-wall-inner.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/pricing-wall-inner.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import { calculateTotalQuote } from '@/domain/pricing';
import { DEFAULT_PRICE_BOOK } from '@/domain/pricing';
import { makeConfig } from './fixtures';
import type { MaterialRow } from '@/domain/catalog';

function makeWallMaterial(id: string, slug: string, perSqm: number): MaterialRow {
  return {
    id, tenantId: 't1', categories: ['wall'], slug, name: slug,
    color: '#888', textures: null, tileSize: null,
    pricing: { wall: { perSqm } }, flags: {},
    archivedAt: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

describe('wall pricing with inner cladding', () => {
  it('emits one wall.<side> line item per wall when inner is not set', () => {
    const config = makeConfig();
    const materials = [makeWallMaterial('m1', 'wood', 100)];
    const quote = calculateTotalQuote(config, DEFAULT_PRICE_BOOK, materials, [], []);
    const fronts = quote.items.flatMap(b => b.lineItems).filter(li => li.labelKey === 'wall.front');
    const fronts_inner = quote.items.flatMap(b => b.lineItems).filter(li => li.labelKey === 'wall.front.inner');
    expect(fronts).toHaveLength(1);
    expect(fronts_inner).toHaveLength(0);
  });

  it('emits a second wall.<side>.inner line item with the inner material cost', () => {
    const config = makeConfig();
    // Force primary to 'wood' (so outer === wood), inner to 'osb'.
    config.buildings[0].primaryMaterialId = 'wood';
    config.buildings[0].walls.front.materialIdInner = 'osb';
    const materials = [
      makeWallMaterial('m1', 'wood', 100),
      makeWallMaterial('m2', 'osb',  40),
    ];
    const quote = calculateTotalQuote(config, DEFAULT_PRICE_BOOK, materials, [], []);
    const fronts = quote.items.flatMap(b => b.lineItems);
    const outer = fronts.find(li => li.labelKey === 'wall.front');
    const inner = fronts.find(li => li.labelKey === 'wall.front.inner');
    expect(outer).toBeDefined();
    expect(inner).toBeDefined();
    // Same net area on both — openings already subtracted on outer line.
    expect(inner!.area).toBeCloseTo(outer!.area, 6);
    expect(inner!.materialCost).toBeCloseTo(outer!.area * 40, 4);
    expect(inner!.extrasCost).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- pricing-wall-inner`
Expected: FAIL on the second test (no inner line item emitted yet).

- [ ] **Step 3: Wire the helper into `wallLineItem`**

Open `src/domain/pricing/calculate.ts`. Update the imports at the top to include the new resolver:

```ts
import {
  getEffectiveWallMaterial,
  getEffectiveInnerWallMaterial,
  getEffectiveDoorMaterial,
} from '@/domain/materials';
```

(Add `getEffectiveInnerWallMaterial` to whatever import the file already uses — keep the others as-is.)

- [ ] **Step 4: Emit the inner line item**

Still in `calculate.ts`, find `wallLineItem` (around line 134) and add the inner emission right BEFORE the final `return lineItems;`:

```ts
// Inner cladding — additive line item, same net area, no extras.
const innerSlug = getEffectiveInnerWallMaterial(wallCfg, building, buildings);
if (innerSlug) {
  const innerCost = area * findPrice(wallCatalog, innerSlug);
  lineItems.push({
    labelKey: `${WALL_LABEL_KEY[wallId] ?? wallId}.inner`,
    area,
    materialCost: innerCost,
    insulationCost: 0,
    extrasCost: 0,
    total: innerCost,
  });
}

return lineItems;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test -- pricing-wall-inner`
Expected: 2 passing.

- [ ] **Step 6: Run the FULL suite to catch regressions**

Run: `pnpm test`
Expected: all previously-passing tests still pass (706+ now).

- [ ] **Step 7: Commit**

```bash
git add src/domain/pricing/calculate.ts tests/pricing-wall-inner.test.ts
git commit -m "feat(pricing): emit wall.<side>.inner line item when inner cladding is set"
```

---

## Task 5: Add `wallCladdingInner` ProductSlot

**Files:**
- Modify: `src/domain/catalog/types.ts`
- Test: confirmed via Task 6

- [ ] **Step 1: Extend the slot enum + maps**

Open `src/domain/catalog/types.ts`. Update three exports:

```ts
export type ProductSlot =
  | 'wallCladding'
  | 'wallCladdingInner'
  | 'roofCovering'
  | 'roofTrim'
  | 'floor'
  | 'door';

export const PRODUCT_SLOTS: readonly ProductSlot[] = [
  'wallCladding',
  'wallCladdingInner',
  'roofCovering',
  'roofTrim',
  'floor',
  'door',
] as const;

export const PRODUCT_SLOT_TO_CATEGORY: Record<ProductSlot, MaterialCategory> = {
  wallCladding: 'wall',
  wallCladdingInner: 'wall',
  roofCovering: 'roof-cover',
  roofTrim: 'roof-trim',
  floor: 'floor',
  door: 'door',
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS — the slot consumers all key off `PRODUCT_SLOTS` so the new value flows through automatically. If a `Record<ProductSlot, …>` literal is now missing the key, TypeScript flags it; add the missing entry (likely none).

- [ ] **Step 3: Run the full suite**

Run: `pnpm test`
Expected: all green (the existing catalog tests parameterise across `PRODUCT_SLOTS` so the new slot is exercised; they should remain neutral until we add behaviour).

- [ ] **Step 4: Commit**

```bash
git add src/domain/catalog/types.ts
git commit -m "feat(catalog): add wallCladdingInner ProductSlot mapped to 'wall' category"
```

---

## Task 6: Hydrate `materialIdInner` from product defaults

**Files:**
- Modify: `src/domain/catalog/product.ts`
- Modify: `src/store/useConfigStore.ts` (the consumer of `applyProductDefaults` that creates the building).
- Test: `tests/catalog-product-wall-inner.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/catalog-product-wall-inner.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import { applyProductDefaults, validateProductCreate } from '@/domain/catalog';
import type { ProductRow, MaterialRow } from '@/domain/catalog';

function makeProduct(extras: Partial<ProductRow> = {}): ProductRow {
  return {
    id: 'p1', tenantId: 't1', kind: 'berging', slug: 'std', name: 'Std',
    heroImage: null, basePriceCents: 0, sortOrder: 0,
    archivedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01',
    defaults: { materials: { wallCladding: 'wood', wallCladdingInner: 'osb' } },
    constraints: {},
    ...extras,
  };
}

function makeMaterial(slug: string, category: 'wall' | 'roof-cover' = 'wall'): MaterialRow {
  return {
    id: `m-${slug}`, tenantId: 't1', categories: [category], slug, name: slug,
    color: '#888', textures: null, tileSize: null,
    pricing: { wall: { perSqm: 50 } }, flags: {},
    archivedAt: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

describe('applyProductDefaults — inner cladding', () => {
  it('surfaces wallCladdingInner on the returned defaults', () => {
    const out = applyProductDefaults(makeProduct());
    expect(out.materialIdInner).toBe('osb');
  });

  it('returns no inner field when the product omits wallCladdingInner', () => {
    const p = makeProduct();
    delete p.defaults.materials!.wallCladdingInner;
    const out = applyProductDefaults(p);
    expect(out.materialIdInner).toBeUndefined();
  });
});

describe('validateProductCreate — inner cladding', () => {
  it('accepts wallCladdingInner referencing a wall-category material', () => {
    const errors = validateProductCreate(
      {
        kind: 'berging', slug: 'p', name: 'P', basePriceCents: 0,
        defaults: { materials: { wallCladdingInner: 'osb' } }, constraints: {},
      },
      { materials: [makeMaterial('osb', 'wall')] },
    );
    expect(errors).toEqual([]);
  });

  it('rejects wallCladdingInner referencing a non-wall material', () => {
    const errors = validateProductCreate(
      {
        kind: 'berging', slug: 'p', name: 'P', basePriceCents: 0,
        defaults: { materials: { wallCladdingInner: 'epdm' } }, constraints: {},
      },
      { materials: [makeMaterial('epdm', 'roof-cover')] },
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- catalog-product-wall-inner`
Expected: FAIL on `applyProductDefaults` returning undefined `materialIdInner` (field doesn't exist on the return type yet).

- [ ] **Step 3: Extend `ProductBuildingDefaults`**

Open `src/domain/catalog/product.ts`. Find `ProductBuildingDefaults` (around line 688) and add the new field:

```ts
export interface ProductBuildingDefaults {
  sourceProductId: string;
  type: ProductKind;
  dimensions: { width?: number; depth?: number; height?: number };
  primaryMaterialId?: string;
  /** When set, applied to every wall's `materialIdInner` at spawn. */
  materialIdInner?: string;
  floor?: { materialId: string };
  roof?: {
    coveringId?: string;
    trimMaterialId?: string;
    fasciaHeight?: number;
    fasciaOverhang?: number;
  };
  door?: { doorMaterialId?: string };
  gateConfig?: {
    partCount?: 1 | 2;
    materialId?: string;
    swingDirection?: 'inward' | 'outward' | 'sliding';
    motorized?: boolean;
    partGapMm?: number;
  };
}
```

- [ ] **Step 4: Wire `applyProductDefaults` to read the new slot**

Still in `product.ts`, find `applyProductDefaults` (around line 743). In the `if (mats)` block (around line 779), add the inner-cladding line right below `wallCladding`:

```ts
if (mats.wallCladding) out.primaryMaterialId = mats.wallCladding;
if (mats.wallCladdingInner) out.materialIdInner = mats.wallCladdingInner;
if (mats.floor) out.floor = { materialId: mats.floor };
```

- [ ] **Step 5: Verify product create/patch validators already cover the new slot**

`validateProductCreate` / `validateProductPatch` already iterate `PRODUCT_SLOTS` and check each slot's material against `PRODUCT_SLOT_TO_CATEGORY`. Because Task 5 added the slot + its category mapping, the validators pick it up for free. Skim `src/domain/catalog/product.ts` and confirm no slot is hard-coded — if anything reads `mats.wallCladding` explicitly without iterating, leave that as-is (the slot-iteration validators are what enforce the category check).

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test -- catalog-product-wall-inner`
Expected: 4 passing.

- [ ] **Step 7: Hydrate the field onto each wall at spawn**

Open `src/store/useConfigStore.ts`. Find where `addBuilding` consumes the product-defaults payload — it spreads them onto the new `BuildingEntity` and creates the per-wall `WallConfig` map. After the per-wall map is built, add a hydration pass:

```ts
// Hydrate inner cladding onto every wall when the product specifies it.
if (defaults?.materialIdInner) {
  for (const wallId of Object.keys(building.walls) as WallId[]) {
    building.walls[wallId].materialIdInner = defaults.materialIdInner;
  }
}
```

(Adjust the variable names to match the local code — the key behaviour is: if `defaults.materialIdInner` is set, write it to every wall in `building.walls`.)

- [ ] **Step 8: Run the full suite**

Run: `pnpm test`
Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add src/domain/catalog/product.ts src/store/useConfigStore.ts tests/catalog-product-wall-inner.test.ts
git commit -m "feat(catalog): hydrate materialIdInner from product defaults"
```

---

## Task 7: 2D plattegrond — split wall into outer/inner strips with per-face hit targets

**Files:**
- Modify: `src/components/schematic/SchematicWalls.tsx`
- Modify: `src/components/schematic/SchematicView.tsx`

This task is UI-only — no new unit tests; manual verification at the end. Keep the strip layout dead simple: when inner cladding is on, draw two strips along the wall's thickness with a thin separator; otherwise keep today's single rectangle.

- [ ] **Step 1: Extend `onWallClick` to carry a face**

Open `src/components/schematic/SchematicWalls.tsx`. Find the `SchematicWallsProps` interface and widen the click handler:

```ts
interface SchematicWallsProps {
  // …existing fields
  onWallClick?: (wallId: WallId, buildingId: string, face?: 'outer' | 'inner') => void;
}
```

Pass the same widening down to the `SolidWall` component props:

```ts
function SolidWall({
  // …existing fields
  onWallClick?: (face?: 'outer' | 'inner') => void;
}) { … }
```

Update the call site inside the parent (`SchematicWalls`):

```ts
<SolidWall
  // …existing props
  onWallClick={onWallClick ? (face) => onWallClick(g.wallId, buildingId, face) : undefined}
/>
```

- [ ] **Step 2: Render the split strips inside `SolidWall`**

Still in `SchematicWalls.tsx`, change `SolidWall` so that when `cfg.materialIdInner` is set it renders TWO strips per segment instead of one rectangle. The strips share the same `segments` array (so cutouts stay aligned). Half-thickness per strip; the outer strip sits on the outward edge (i.e. on the side OPPOSITE the wall's `inward` direction, since `inward` points toward the building's interior).

Replace the existing rect-rendering block with the following (keeping the existing handle-no-openings branch as a fallback):

```ts
const innerSlug = cfg.materialIdInner ?? null;
const hasInner = !!innerSlug;
const innerColor = hasInner
  ? getAtomColor(materials, innerSlug, 'wall')
  : null;

const halfT = T / 2;
// Outward direction (opposite of inward): for 'front' wall geom.inward = [0,-1]
// → outward is [0,+1]. For 'back' geom.inward = [0,+1] → outward is [0,-1].
// We don't need the full vector — we only need to know on which side of the
// wall midline the outer strip sits along the perpendicular axis. The
// SchematicWalls geometry conventionally puts the wall midline at cy (h) or
// cx (v); the outer face is the one matching the building's outward normal.
// For 'front' walls (axis 'h', inward [0,-1]) the outer face is at cy + halfT.
// For 'back' walls (axis 'h', inward [0,+1]) the outer face is at cy - halfT.
// (Mirror for vertical walls.)

const outerSign =
  g.wallId === 'front' ? +1 :
  g.wallId === 'back'  ? -1 :
  g.wallId === 'left'  ? -1 :
  g.wallId === 'right' ? +1 :
  +1;
```

Then inside the segments loop, render two strips instead of one when `hasInner`:

```ts
return segments.map(([s, e], i) => {
  const segLen = e - s;
  if (segLen < 0.01) return null;
  const segCenter = (s + e) / 2;

  if (!hasInner) {
    // Single-strip (existing) behaviour.
    const x = isH ? cx + segCenter - segLen / 2 : cx - T / 2;
    const y = isH ? cy - T / 2 : cy + segCenter - segLen / 2;
    const w = isH ? segLen : T;
    const h = isH ? T : segLen;
    return (
      <rect
        key={i}
        x={x}
        y={y}
        width={w}
        height={h}
        fill={fillColor}
        fillOpacity={fillOpacity}
        stroke={strokeColor}
        strokeWidth={0.02}
        cursor={onWallClick ? 'pointer' : undefined}
        pointerEvents={onWallClick ? 'auto' : 'none'}
        onClick={(e) => { e.stopPropagation(); onWallClick?.('outer'); }}
      />
    );
  }

  // Two-strip rendering. Outer + inner strips, each half-thickness.
  // For horizontal walls, the perpendicular axis is Y (screen Y = world Z).
  // Outer strip sits at `cy + outerSign * halfT/2` with height `halfT`.
  const outerOff = (outerSign * halfT) / 2;
  const innerOff = (-outerSign * halfT) / 2;
  const innerFillBase = isSelected && selectedElement?.face === 'inner'
    ? '#3b82f6'
    : (innerColor ?? '#888');
  const outerFillBase = isSelected && (selectedElement?.face ?? 'outer') === 'outer'
    ? '#3b82f6'
    : fillColor;
  const outerOp = isSelected && (selectedElement?.face ?? 'outer') === 'outer' ? 0.5 : fillOpacity;
  const innerOp = isSelected && selectedElement?.face === 'inner' ? 0.5 : fillOpacity;

  const outerRect = isH
    ? { x: cx + segCenter - segLen / 2, y: cy + outerOff - halfT / 2, w: segLen, h: halfT }
    : { x: cx + outerOff - halfT / 2, y: cy + segCenter - segLen / 2, w: halfT, h: segLen };
  const innerRect = isH
    ? { x: cx + segCenter - segLen / 2, y: cy + innerOff - halfT / 2, w: segLen, h: halfT }
    : { x: cx + innerOff - halfT / 2, y: cy + segCenter - segLen / 2, w: halfT, h: segLen };

  return (
    <g key={i}>
      <rect
        x={outerRect.x} y={outerRect.y}
        width={outerRect.w} height={outerRect.h}
        fill={outerFillBase}
        fillOpacity={outerOp}
        stroke={strokeColor}
        strokeWidth={0.02}
        cursor={onWallClick ? 'pointer' : undefined}
        pointerEvents={onWallClick ? 'auto' : 'none'}
        onClick={(ev) => { ev.stopPropagation(); onWallClick?.('outer'); }}
      />
      <rect
        x={innerRect.x} y={innerRect.y}
        width={innerRect.w} height={innerRect.h}
        fill={innerFillBase}
        fillOpacity={innerOp}
        stroke={strokeColor}
        strokeWidth={0.02}
        cursor={onWallClick ? 'pointer' : undefined}
        pointerEvents={onWallClick ? 'auto' : 'none'}
        onClick={(ev) => { ev.stopPropagation(); onWallClick?.('inner'); }}
      />
    </g>
  );
});
```

This uses the existing `selectedElement` already imported by the file — if it isn't, wire it through `SolidWall`'s props. (Currently `isSelected` is computed from `selectedElement` in the parent and passed in; pass `selectedElement?.face` down too, OR pass `selectedFace?: 'outer' | 'inner'`.)

Add a prop `selectedFace?: 'outer' | 'inner'` to `SolidWall` and use it instead of reading `selectedElement` directly:

```ts
function SolidWall({
  // …existing fields
  selectedFace,
}: {
  // …existing fields
  selectedFace?: 'outer' | 'inner';
}) {
  // …
  const outerSelected = isSelected && (selectedFace ?? 'outer') === 'outer';
  const innerSelected = isSelected && selectedFace === 'inner';
  // use these where the snippet above referenced selectedElement?.face
}
```

Pass it from the parent `SchematicWalls`:

```ts
<SolidWall
  // …existing props
  selectedFace={isSelected ? selectedElement?.face : undefined}
/>
```

Where `isSelected` and `selectedElement` are already available in the parent's selected-detection logic.

- [ ] **Step 3: Thread `face` through `SchematicView`'s click dispatch**

Open `src/components/schematic/SchematicView.tsx`. Find the `onWallClick` callback that's passed into `<SchematicWalls />`. Today it dispatches `selectElement({ type: 'wall', id: wallId, buildingId })`. Widen it:

```ts
const onWallClick = useCallback(
  (wallId: WallId, buildingId: string, face?: 'outer' | 'inner') => {
    selectElement({ type: 'wall', id: wallId, buildingId, face });
  },
  [selectElement],
);
```

- [ ] **Step 4: Typecheck + manual smoke**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

Then `pnpm dev` and verify in the browser:
- A wall with no inner cladding renders as today (one rectangle in the plattegrond).
- A wall with `materialIdInner` set renders two parallel strips; each strip is independently clickable; clicking outer/inner highlights only that strip and the URL/state reflects `face: 'outer'|'inner'`.

- [ ] **Step 5: Commit**

```bash
git add src/components/schematic/SchematicWalls.tsx src/components/schematic/SchematicView.tsx
git commit -m "feat(schematic): split wall into outer/inner strips with per-face selection"
```

---

## Task 8: Wall properties panel — add/remove inner + face-aware picker

**Files:**
- Modify: `src/components/ui/SurfaceProperties.tsx`
- Modify: `src/lib/i18n.ts`

- [ ] **Step 1: Add i18n keys**

Open `src/lib/i18n.ts` and add to the `nl` map:

```ts
  'wall.front.inner': 'Binnenbekleding voorgevel',
  'wall.back.inner': 'Binnenbekleding achtergevel',
  'wall.left.inner': 'Binnenbekleding linkergevel',
  'wall.right.inner': 'Binnenbekleding rechtergevel',
  'wallProperties.outer': 'Buitenbekleding',
  'wallProperties.inner': 'Binnenbekleding',
  'wallProperties.addInner': '+ Binnenbekleding toevoegen',
  'wallProperties.removeInner': 'Verwijderen',
```

(If your file groups keys by namespace, place them next to the existing wall keys.)

- [ ] **Step 2: Render the outer/inner sections**

Open `src/components/ui/SurfaceProperties.tsx`. The file already builds the outer material picker; we wrap it in a "Buitenbekleding" section header and add a parallel "Binnenbekleding" section below.

Sketch (adjust to match the file's actual JSX style):

```tsx
const face = selectedElement?.type === 'wall' ? (selectedElement.face ?? 'outer') : 'outer';
const innerSlug = wallCfg.materialIdInner ?? null;
const innerCatalogEntry = wallCatalog.find(e => e.atomId === innerSlug);

const seedInner = () => {
  const seed =
    wallCatalog.find(e => e.atomId === building.primaryMaterialId)?.atomId
    ?? wallCatalog[0]?.atomId;
  if (!seed) return; // tenant has no wall materials — should never happen
  updateBuildingWall(buildingId, wallId, { materialIdInner: seed });
  selectElement({ type: 'wall', id: wallId, buildingId, face: 'inner' });
};
const clearInner = () => {
  updateBuildingWall(buildingId, wallId, { materialIdInner: null });
  selectElement({ type: 'wall', id: wallId, buildingId, face: 'outer' });
};
const switchFace = (next: 'outer' | 'inner') => {
  selectElement({ type: 'wall', id: wallId, buildingId, face: next });
};

return (
  <>
    {/* OUTER */}
    <SectionHeader
      label={t('wallProperties.outer')}
      active={face === 'outer'}
      onClick={() => switchFace('outer')}
    />
    {/* …existing outer picker block, unchanged… */}

    {/* INNER */}
    {innerSlug == null ? (
      <button type="button" onClick={seedInner} className="…">
        {t('wallProperties.addInner')}
      </button>
    ) : (
      <>
        <SectionHeader
          label={t('wallProperties.inner')}
          active={face === 'inner'}
          onClick={() => switchFace('inner')}
          trailing={
            <button type="button" onClick={clearInner} className="…">
              {t('wallProperties.removeInner')}
            </button>
          }
        />
        <MaterialPicker
          catalog={wallCatalog}
          value={innerSlug}
          category="wall"
          onChange={(atomId) => updateBuildingWall(buildingId, wallId, { materialIdInner: atomId })}
        />
      </>
    )}
  </>
);
```

`SectionHeader` is a tiny local component (or two `<div>`s with conditional styling) — keep the visual treatment in line with the rest of the panel's section headers. The `active` prop highlights the section that matches the currently-selected face.

`MaterialPicker` is whatever component the existing outer picker already uses (read the current file to copy its props verbatim). Pass `wallCatalog` (already memo'd in the file) so the same per-product allow-list narrowing applies to the inner picker.

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Manual smoke**

`pnpm dev` and check:
- Selecting a wall with no inner shows only the outer picker + the "+ Binnenbekleding toevoegen" button.
- Clicking the button seeds inner with the building's primary wall material; the panel switches to show two sections; the plattegrond shows the split strips with the inner one highlighted (since `selectElement` was called with `face: 'inner'`).
- Clicking "Verwijderen" clears `materialIdInner` and collapses the panel back to outer-only; the plattegrond returns to a single rectangle.
- Switching face via header click updates which strip is highlighted in the plattegrond.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/SurfaceProperties.tsx src/lib/i18n.ts
git commit -m "feat(ui): wall panel exposes optional inner cladding picker"
```

---

## Task 9: 3D wall — paint outer / inner large faces with their respective materials

**Files:**
- Modify: `src/components/canvas/Wall.tsx`

`Wall.tsx` currently renders the wall as a single `<mesh>` with one `meshStandardMaterial` for the whole BoxGeometry. To paint outer and inner faces differently, we render six face-materials (Three.js BoxGeometry's material index order: `[+x, -x, +y, -y, +z, -z]`).

For walls whose long axis runs along X (`front` / `back`), the large faces are `+z` (index 4) and `-z` (index 5). For walls whose long axis runs along Z (`left` / `right`), the large faces are `+x` (index 0) and `-x` (index 1). Outer is the face whose normal points in the building's outward direction; inner is the opposite.

- [ ] **Step 1: Resolve the inner material slug + color**

Inside the `Wall` function component (after `materialId` is computed), add:

```ts
const innerSlug = wallCfg && building
  ? getEffectiveInnerWallMaterial(wallCfg, building, buildings)
  : null;
const innerColor = innerSlug ? getAtomColor(materials, innerSlug, 'wall') : null;
const innerTexture = useWallTexture(innerSlug ?? materialId, wallLength, height);
```

(Import `getEffectiveInnerWallMaterial` from `@/domain/materials`. The texture call must be unconditional — React Hooks rule — so it always runs; we just feed it a fallback id when no inner is set.)

- [ ] **Step 2: Determine outer/inner face indices**

Still in the same function:

```ts
type FaceIndex = 0 | 1 | 2 | 3 | 4 | 5; // [+x, -x, +y, -y, +z, -z]
const isLongX = wallId === 'front' || wallId === 'back';
const outerFaceIndex: FaceIndex =
  wallId === 'front' ? 4 :   // +z
  wallId === 'back'  ? 5 :   // -z
  wallId === 'left'  ? 1 :   // -x
  /* right */          0;     // +x
const innerFaceIndex: FaceIndex = isLongX
  ? (outerFaceIndex === 4 ? 5 : 4)
  : (outerFaceIndex === 0 ? 1 : 0);
```

- [ ] **Step 3: Render with per-face materials when inner is set**

The existing render returns a single `<mesh>` with one `<meshStandardMaterial>` (the file may use a richer setup with textures + env map intensity). When inner is unset, leave that path EXACTLY as it is. When inner IS set, switch to a `<meshStandardMaterial attach={...} />` per face. React Three Fiber's array-attach pattern lets you place a material on a specific index:

```tsx
{!innerSlug ? (
  <mesh /* …existing props… */>
    {/* existing single material */}
  </mesh>
) : (
  <mesh /* …existing props… */>
    {[0, 1, 2, 3, 4, 5].map(idx => {
      const isOuter = idx === outerFaceIndex;
      const isInner = idx === innerFaceIndex;
      const slug = isInner ? innerSlug : materialId;
      const tint = isInner ? innerColor : color;
      const tex = isInner ? innerTexture : texture;
      return (
        <meshStandardMaterial
          key={idx}
          attach={`material-${idx}`}
          map={tex ?? undefined}
          color={tex ? (WALL_TEXTURE_TINT[slug] ?? '#ffffff') : tint}
          envMapIntensity={WALL_ENV_MAP_INTENSITY[slug] ?? 0.4}
        />
      );
    })}
  </mesh>
);
```

(Match the existing `Wall.tsx` material props — `roughness`, `metalness`, etc. — for both branches. Read the file once and copy the existing material element verbatim into the per-face render; the only thing that changes per index is `slug`/`tint`/`tex`.)

- [ ] **Step 4: Click handling stays wall-level**

Make sure the existing click handler still dispatches `selectElement({ type: 'wall', id: wallId, buildingId })` WITHOUT a `face` argument. If the existing dispatch currently passes a partial selection object, change it to spread the existing `selectedElement?.face` so that clicking the SAME wall in 3D preserves the face the user picked in the plattegrond; switching to a DIFFERENT wall drops face back to default:

```ts
const prevFace =
  selectedElement?.type === 'wall'
  && selectedElement.id === wallId
  && selectedElement.buildingId === buildingId
    ? selectedElement.face
    : undefined;
onClick(() => selectElement({ type: 'wall', id: wallId, buildingId, face: prevFace }));
```

- [ ] **Step 5: Typecheck + smoke**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

Then `pnpm dev`:
- Wall with no inner: looks identical to before.
- Wall with inner set: from outside you see the outer material; orbit inside and you see the inner material. No visible cavity — single solid box.

- [ ] **Step 6: Commit**

```bash
git add src/components/canvas/Wall.tsx
git commit -m "feat(canvas): paint outer/inner faces of wall box with separate materials"
```

---

## Task 10: Full regression sweep + final verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: ALL passing, including the new files added in this plan. Total should be ≥ 706 (was 700 before this plan; the new tests add ~12).

- [ ] **Step 2: TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS, no errors.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: SUCCESS.

- [ ] **Step 4: Lint check (informational)**

Run: `pnpm lint 2>&1 | grep -E "SurfaceProperties|SchematicWalls|Wall\.tsx|inner" | head -20`
Expected: no NEW errors introduced by this plan's edits. Pre-existing errors in unrelated files are fine per CLAUDE.md.

- [ ] **Step 5: Manual UI smoke checklist**

Open `pnpm dev`, then run through:

1. New berging on a blank canvas — wall panel shows only outer picker + "+ Binnenbekleding toevoegen" button. ✓
2. Click "+ Binnenbekleding toevoegen" — inner picker appears; plattegrond shows two strips on every wall; inner strip is highlighted; URL/state has `face: 'inner'`. ✓
3. Pick a different inner material — quote updates with a `wall.<side>.inner` line item per wall. ✓
4. Click outer strip in plattegrond — outer section becomes the focused header; quote stays the same. ✓
5. Click "Verwijderen" on the inner section — `materialIdInner` clears on that wall; the wall returns to a single rectangle in plattegrond and that wall's `wall.<side>.inner` line item disappears. ✓
6. In 3D: from outside the building you see the outer material; orbit inside and you see the inner material. ✓
7. Save the scene (POST `/api/configs`) — the round-trip preserves `materialIdInner`. ✓
8. Create an order — `quoteSnapshot.items[].lineItems` contains the inner line items. ✓
9. Open an existing pre-feature scene (no `materialIdInner` anywhere) — looks and prices identically to before. ✓

- [ ] **Step 6: Final commit (if any docstring tweaks landed)**

```bash
git status
# If clean, skip; if anything tiny landed (e.g. comment fix), commit it.
```

---

## Out of scope (do NOT implement)

- A separate `'wall-inner'` material category.
- A tenant-level flat surcharge for inner cladding.
- Door-panel inner side.
- Per-face insulation.
- Inner cladding on `poort` (no walls).
- Schema migration — there is none; `materialIdInner` is purely optional inside the existing `walls` jsonb.
