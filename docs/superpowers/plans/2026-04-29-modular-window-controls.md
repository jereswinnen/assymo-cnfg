# Modular Window Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two window controls (auto-from-width segment dividers + schuifraam product flag with X-axis slide animation) wired through admin → scene → 3D → quote, with a hybrid registry that doors can plug into later.

**Architecture:** Three layers. (1) Code-level registry `OPENING_AUTO_CONTROLS` declares the auto-derive-from-dimension family (today: `segments`). (2) `WindowMeta` (jsonb on `supplier_products.meta`) carries per-product config and a typed `schuifraam` flag. (3) `WallWindow.segmentCountOverride` carries the per-instance user choice; ephemeral schuifraam open/close state lives in `useUIStore`. A pure `resolveWindowControls(window, product)` returns the flat view consumed by sidebar, 3D mesh, and pricing.

**Tech Stack:** TypeScript, Next.js 16, React 19, react-three-fiber + drei, Zustand + zundo, Drizzle (jsonb — no migration), Vite+ for tests.

**Reference spec:** `docs/superpowers/specs/2026-04-29-modular-window-controls-design.md`

---

## File Structure

**Domain (framework-free, TDD):**
- Create: `src/domain/openings/controls.ts` — `OPENING_AUTO_CONTROLS` registry + `deriveSegmentCount`.
- Create: `src/domain/openings/resolve.ts` — `resolveWindowControls`.
- Create: `src/domain/openings/index.ts` — re-exports.
- Modify: `src/domain/supplier/types.ts` — extend `WindowMeta` with `segments` + `schuifraam`; add error codes.
- Modify: `src/domain/supplier/product.ts` — extend `validateWindowMeta`; widen `WINDOW_META_KEYS`.
- Modify: `src/domain/building/types.ts` — add `WallWindow.segmentCountOverride`.
- Modify: `src/domain/pricing/calculate.ts` — add segment + schuifraam surcharge sub-lines.
- Modify: `src/domain/supplier/quote.ts` — extend `getSupplierWindowLineItem` to include surcharges.

**Tests (centralised in `tests/`):**
- Create: `tests/domain/openings/controls.spec.ts`
- Create: `tests/domain/openings/resolve.spec.ts`
- Modify: `tests/domain/supplier/product.spec.ts` (extend window meta validation cases).
- Modify: `tests/domain/pricing/calculate.spec.ts` (extend window line-item cases).

**Store + i18n:**
- Modify: `src/store/useUIStore.ts` — `windowAnimations` slice + `toggleWindowOpen`.
- Modify: `src/store/useConfigStore.ts` — `setWindowSegmentOverride` action.
- Modify: `src/domain/config/mutations.ts` — pure `setWindowSegmentOverride` mutation.
- Modify: `src/lib/i18n.ts` — new `nl` keys.

**UI:**
- Modify: `src/components/admin/catalog/SupplierProductForm.tsx` — Controls card in window branch + form values + meta-mapping.
- Modify: `src/components/ui/WindowConfig.tsx` — Controls section under each window row.
- Modify: `src/components/canvas/WindowMesh.tsx` — segment + schuifraam render path.
- Modify: `src/components/canvas/Wall.tsx` — pass resolved view into `WindowMesh`.

---

## Task 1: Add `WindowMeta.segments` + `WindowMeta.schuifraam` types and error codes

**Files:**
- Modify: `src/domain/supplier/types.ts`

- [ ] **Step 1: Extend `WindowMeta` interface and `SUPPLIER_ERROR_CODES`**

In `src/domain/supplier/types.ts`, replace the existing `WindowMeta` interface (currently lines 32-38) with:

```ts
export interface WindowMetaSegments {
  enabled: boolean;
  /** Width (mm) at which the FIRST divider appears. Required when enabled. */
  autoThresholdMm: number;
  /** When set, every additional `perAdditionalThresholdMm` mm of width adds
   *  one more divider. Absent → at most 1 divider. */
  perAdditionalThresholdMm?: number;
  /** Hard cap on divider count. Absent → unbounded. */
  maxCount?: number;
  /** Optional pricing hook — added per-divider when count > 0. */
  surchargeCentsPerDivider?: number;
}

export interface WindowMetaSchuifraam {
  enabled: boolean;
  /** Optional flat surcharge applied when this product is selected. */
  surchargeCents?: number;
}

export interface WindowMeta {
  glazingType?: 'double' | 'triple' | 'single';
  uValue?: number;
  frameMaterial?: string;
  openable?: boolean;
  leadTimeDays?: number;
  segments?: WindowMetaSegments;
  schuifraam?: WindowMetaSchuifraam;
}
```

Add two new entries to `SUPPLIER_ERROR_CODES`:

```ts
  segmentsInvalid: 'segments_invalid',
  schuifraamInvalid: 'schuifraam_invalid',
```

- [ ] **Step 2: Verify the file compiles in isolation**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (no errors). The new types are pure additions.

- [ ] **Step 3: Commit**

```bash
git add src/domain/supplier/types.ts
git commit -m "feat(domain): add WindowMeta.segments + WindowMeta.schuifraam types"
```

---

## Task 2: Extend `validateWindowMeta` for the new fields

**Files:**
- Modify: `src/domain/supplier/product.ts`
- Test: `tests/domain/supplier/product.spec.ts`

- [ ] **Step 1: Write failing test cases**

Open `tests/domain/supplier/product.spec.ts` and add inside the existing `validateWindowMeta` describe block:

```ts
test('accepts segments with required threshold', () => {
  const r = validateWindowMeta({
    segments: { enabled: true, autoThresholdMm: 1500 },
  });
  expect(r.errors).toEqual([]);
  expect(r.value?.segments).toEqual({ enabled: true, autoThresholdMm: 1500 });
});

test('rejects segments enabled without autoThresholdMm', () => {
  const r = validateWindowMeta({ segments: { enabled: true } });
  expect(r.value).toBeNull();
  expect(r.errors).toContain(SUPPLIER_ERROR_CODES.segmentsInvalid);
});

test('rejects negative autoThresholdMm', () => {
  const r = validateWindowMeta({
    segments: { enabled: true, autoThresholdMm: -1 },
  });
  expect(r.value).toBeNull();
});

test('rejects maxCount < 1', () => {
  const r = validateWindowMeta({
    segments: { enabled: true, autoThresholdMm: 1500, maxCount: 0 },
  });
  expect(r.value).toBeNull();
});

test('rejects negative surchargeCentsPerDivider', () => {
  const r = validateWindowMeta({
    segments: { enabled: true, autoThresholdMm: 1500, surchargeCentsPerDivider: -10 },
  });
  expect(r.value).toBeNull();
});

test('accepts schuifraam enabled without surcharge', () => {
  const r = validateWindowMeta({ schuifraam: { enabled: true } });
  expect(r.errors).toEqual([]);
  expect(r.value?.schuifraam).toEqual({ enabled: true });
});

test('accepts schuifraam with surcharge', () => {
  const r = validateWindowMeta({
    schuifraam: { enabled: true, surchargeCents: 25000 },
  });
  expect(r.value?.schuifraam?.surchargeCents).toBe(25000);
});

test('rejects negative schuifraam surcharge', () => {
  const r = validateWindowMeta({
    schuifraam: { enabled: true, surchargeCents: -1 },
  });
  expect(r.value).toBeNull();
});
```

- [ ] **Step 2: Run tests — they should fail**

Run: `pnpm test tests/domain/supplier/product.spec.ts`
Expected: 8 new failures (validator currently rejects unknown keys via `WINDOW_META_KEYS`, so even shape-correct inputs fail).

- [ ] **Step 3: Widen `WINDOW_META_KEYS` and add validation branches**

In `src/domain/supplier/product.ts`:

1. Replace `WINDOW_META_KEYS` (line 46) with:

```ts
const WINDOW_META_KEYS = new Set([
  'glazingType', 'uValue', 'frameMaterial', 'openable', 'leadTimeDays',
  'segments', 'schuifraam',
]);
```

2. Inside `validateWindowMeta`, before the final `if (errors.length > 0)` return (around line 354), add:

```ts
if ('segments' in meta) {
  const s = meta.segments;
  if (!isObject(s) || typeof s.enabled !== 'boolean') {
    errors.push(SUPPLIER_ERROR_CODES.segmentsInvalid);
  } else if (s.enabled) {
    if (typeof s.autoThresholdMm !== 'number' || !Number.isFinite(s.autoThresholdMm) || s.autoThresholdMm < 0) {
      errors.push(SUPPLIER_ERROR_CODES.segmentsInvalid);
    } else {
      const seg: WindowMeta['segments'] = {
        enabled: true,
        autoThresholdMm: s.autoThresholdMm,
      };
      if ('perAdditionalThresholdMm' in s) {
        if (typeof s.perAdditionalThresholdMm !== 'number' || s.perAdditionalThresholdMm <= 0) {
          errors.push(SUPPLIER_ERROR_CODES.segmentsInvalid);
        } else {
          seg.perAdditionalThresholdMm = s.perAdditionalThresholdMm;
        }
      }
      if ('maxCount' in s) {
        if (!isPositiveInt(s.maxCount, 1000)) {
          errors.push(SUPPLIER_ERROR_CODES.segmentsInvalid);
        } else {
          seg.maxCount = s.maxCount;
        }
      }
      if ('surchargeCentsPerDivider' in s) {
        if (!isNonNegativeInt(s.surchargeCentsPerDivider)) {
          errors.push(SUPPLIER_ERROR_CODES.segmentsInvalid);
        } else {
          seg.surchargeCentsPerDivider = s.surchargeCentsPerDivider;
        }
      }
      out.segments = seg;
    }
  } else {
    out.segments = { enabled: false, autoThresholdMm: 0 };
  }
}

if ('schuifraam' in meta) {
  const s = meta.schuifraam;
  if (!isObject(s) || typeof s.enabled !== 'boolean') {
    errors.push(SUPPLIER_ERROR_CODES.schuifraamInvalid);
  } else {
    const sf: WindowMeta['schuifraam'] = { enabled: s.enabled };
    if ('surchargeCents' in s) {
      if (!isNonNegativeInt(s.surchargeCents)) {
        errors.push(SUPPLIER_ERROR_CODES.schuifraamInvalid);
      } else {
        sf.surchargeCents = s.surchargeCents;
      }
    }
    out.schuifraam = sf;
  }
}
```

3. Make sure `isPositiveInt` is imported from `_validation.ts` (it already is via the existing import).

- [ ] **Step 4: Run tests — they should pass**

Run: `pnpm test tests/domain/supplier/product.spec.ts`
Expected: PASS (all 8 new cases + all existing cases).

- [ ] **Step 5: Commit**

```bash
git add src/domain/supplier/product.ts tests/domain/supplier/product.spec.ts
git commit -m "feat(domain): validate WindowMeta segments + schuifraam"
```

---

## Task 3: Add `WallWindow.segmentCountOverride`

**Files:**
- Modify: `src/domain/building/types.ts`

- [ ] **Step 1: Extend `WallWindow` interface**

In `src/domain/building/types.ts`, replace the `WallWindow` interface (currently lines 19-26) with:

```ts
export interface WallWindow {
  id: string;
  position: number;    // 0.0–1.0 horizontal fraction of usable wall length
  width: number;       // meters
  height: number;      // meters
  sillHeight: number;  // meters from ground to bottom of window
  supplierProductId?: string | null;
  /** User override for segment count. `undefined` → auto-derive from width.
   *  `0` → explicitly no segments. Ignored when the resolved supplier
   *  product has no `segments.enabled`. */
  segmentCountOverride?: number;
}
```

- [ ] **Step 2: Verify compile**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (pure addition).

- [ ] **Step 3: Commit**

```bash
git add src/domain/building/types.ts
git commit -m "feat(domain): add WallWindow.segmentCountOverride"
```

---

## Task 4: Create the openings registry and `deriveSegmentCount`

**Files:**
- Create: `src/domain/openings/controls.ts`
- Test: `tests/domain/openings/controls.spec.ts`

- [ ] **Step 1: Write failing test for `deriveSegmentCount`**

Create `tests/domain/openings/controls.spec.ts`:

```ts
import { describe, test, expect } from 'vite-plus/test';
import { deriveSegmentCount } from '@/domain/openings';

describe('deriveSegmentCount', () => {
  test('returns 0 when config absent', () => {
    expect(deriveSegmentCount(2000, undefined)).toBe(0);
  });

  test('returns 0 when disabled', () => {
    expect(deriveSegmentCount(2000, { enabled: false, autoThresholdMm: 1500 })).toBe(0);
  });

  test('returns 0 when width below threshold', () => {
    expect(deriveSegmentCount(1499, { enabled: true, autoThresholdMm: 1500 })).toBe(0);
  });

  test('returns 1 at threshold without perAdditional', () => {
    expect(deriveSegmentCount(1500, { enabled: true, autoThresholdMm: 1500 })).toBe(1);
  });

  test('returns 1 well past threshold without perAdditional', () => {
    expect(deriveSegmentCount(5000, { enabled: true, autoThresholdMm: 1500 })).toBe(1);
  });

  test('adds one divider per perAdditionalThresholdMm', () => {
    const cfg = { enabled: true, autoThresholdMm: 1500, perAdditionalThresholdMm: 1000 };
    expect(deriveSegmentCount(1500, cfg)).toBe(1);
    expect(deriveSegmentCount(2499, cfg)).toBe(1);
    expect(deriveSegmentCount(2500, cfg)).toBe(2);
    expect(deriveSegmentCount(3500, cfg)).toBe(3);
  });

  test('caps at maxCount', () => {
    const cfg = {
      enabled: true,
      autoThresholdMm: 1500,
      perAdditionalThresholdMm: 500,
      maxCount: 3,
    };
    expect(deriveSegmentCount(10000, cfg)).toBe(3);
  });

  test('without perAdditional but with maxCount=0 returns 0', () => {
    expect(deriveSegmentCount(2000, { enabled: true, autoThresholdMm: 1500, maxCount: 0 })).toBe(0);
  });
});
```

- [ ] **Step 2: Run test — should fail**

Run: `pnpm test tests/domain/openings/controls.spec.ts`
Expected: FAIL — `Cannot find module '@/domain/openings'`.

- [ ] **Step 3: Create the registry + helper**

Create `src/domain/openings/controls.ts`:

```ts
import type { WindowMeta } from '@/domain/supplier';

/** Opening-side kinds the registry knows about. */
export type OpeningKind = 'window' | 'door';

/** Auto-derive-from-dimension control. Today's only entry: `segments`. */
export interface OpeningAutoControl {
  id: 'segments';
  /** Which opening kinds this control can apply to. */
  applicableKinds: readonly OpeningKind[];
  /** Which dimension drives the auto count. */
  axis: 'width' | 'height';
}

export const OPENING_AUTO_CONTROLS: readonly OpeningAutoControl[] = [
  { id: 'segments', applicableKinds: ['window', 'door'], axis: 'width' },
] as const;

/** Pure: compute the auto-derived segment count for a window width.
 *  Caller passes `widthMm` (millimetres) and the product's `segments` config.
 *  Returns 0 when config absent or disabled. */
export function deriveSegmentCount(
  widthMm: number,
  cfg: WindowMeta['segments'],
): number {
  if (!cfg || !cfg.enabled) return 0;
  if (widthMm < cfg.autoThresholdMm) return 0;
  const max = cfg.maxCount ?? Infinity;
  if (max <= 0) return 0;
  if (!cfg.perAdditionalThresholdMm) {
    return Math.min(1, max);
  }
  const raw = 1 + Math.floor(
    (widthMm - cfg.autoThresholdMm) / cfg.perAdditionalThresholdMm,
  );
  return Math.min(raw, max);
}
```

Create `src/domain/openings/index.ts`:

```ts
export * from './controls';
export * from './resolve';
```

(`./resolve` is created in Task 5 — leave the line; pnpm tsc will re-pass after Task 5.)

For now to keep this task green on its own, replace the index temporarily with:

```ts
export * from './controls';
```

(Task 5 will add the `resolve` export.)

- [ ] **Step 4: Run test — should pass**

Run: `pnpm test tests/domain/openings/controls.spec.ts`
Expected: PASS (all 8 cases).

- [ ] **Step 5: Commit**

```bash
git add src/domain/openings/controls.ts src/domain/openings/index.ts tests/domain/openings/controls.spec.ts
git commit -m "feat(domain): add openings registry + deriveSegmentCount"
```

---

## Task 5: Create `resolveWindowControls`

**Files:**
- Create: `src/domain/openings/resolve.ts`
- Modify: `src/domain/openings/index.ts`
- Test: `tests/domain/openings/resolve.spec.ts`

- [ ] **Step 1: Write failing test**

Create `tests/domain/openings/resolve.spec.ts`:

```ts
import { describe, test, expect } from 'vite-plus/test';
import { resolveWindowControls } from '@/domain/openings';
import type { WallWindow } from '@/domain/building';
import type { SupplierProductRow, WindowMeta } from '@/domain/supplier';

function makeProduct(meta: WindowMeta): SupplierProductRow {
  return {
    id: 'p1', tenantId: 't1', supplierId: 's1', kind: 'window',
    sku: 'W1', name: 'Window 1', heroImage: null,
    widthMm: 2000, heightMm: 1500, priceCents: 10000,
    meta, sortOrder: 0, archivedAt: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

function makeWindow(extras: Partial<WallWindow> = {}): WallWindow {
  return { id: 'w1', position: 0.5, width: 2.0, height: 1.5, sillHeight: 0.9, ...extras };
}

describe('resolveWindowControls', () => {
  test('returns empty view when product is null', () => {
    const r = resolveWindowControls(makeWindow(), null);
    expect(r.segments.count).toBe(0);
    expect(r.schuifraam.enabled).toBe(false);
  });

  test('auto-derives count from product width when enabled', () => {
    const product = makeProduct({
      segments: { enabled: true, autoThresholdMm: 1500 },
    });
    const r = resolveWindowControls(makeWindow(), product);
    expect(r.segments.count).toBe(1);
  });

  test('override wins over auto', () => {
    const product = makeProduct({
      segments: { enabled: true, autoThresholdMm: 1500 },
    });
    const r = resolveWindowControls(makeWindow({ segmentCountOverride: 3 }), product);
    expect(r.segments.count).toBe(3);
  });

  test('zero override disables segments even when product enables them', () => {
    const product = makeProduct({
      segments: { enabled: true, autoThresholdMm: 1500 },
    });
    const r = resolveWindowControls(makeWindow({ segmentCountOverride: 0 }), product);
    expect(r.segments.count).toBe(0);
  });

  test('override is ignored when product disables segments', () => {
    const product = makeProduct({});
    const r = resolveWindowControls(makeWindow({ segmentCountOverride: 5 }), product);
    expect(r.segments.count).toBe(0);
  });

  test('schuifraam.enabled mirrors product meta', () => {
    const product = makeProduct({ schuifraam: { enabled: true, surchargeCents: 25000 } });
    const r = resolveWindowControls(makeWindow(), product);
    expect(r.schuifraam.enabled).toBe(true);
    expect(r.schuifraam.surchargeCents).toBe(25000);
  });

  test('exposes segment per-divider surcharge from meta', () => {
    const product = makeProduct({
      segments: { enabled: true, autoThresholdMm: 1500, surchargeCentsPerDivider: 5000 },
    });
    const r = resolveWindowControls(makeWindow(), product);
    expect(r.segments.surchargeCentsPerDivider).toBe(5000);
  });
});
```

- [ ] **Step 2: Run test — should fail**

Run: `pnpm test tests/domain/openings/resolve.spec.ts`
Expected: FAIL — `Cannot find module '@/domain/openings'` (or missing export).

- [ ] **Step 3: Create resolver**

Create `src/domain/openings/resolve.ts`:

```ts
import type { WallWindow } from '@/domain/building';
import type { SupplierProductRow, WindowMeta } from '@/domain/supplier';
import { deriveSegmentCount } from './controls';

export interface ResolvedWindowControls {
  segments: {
    /** Final divider count after auto-derive + override. Always ≥ 0. */
    count: number;
    /** From product meta. Defaults to 0 (no surcharge). */
    surchargeCentsPerDivider: number;
  };
  schuifraam: {
    enabled: boolean;
    surchargeCents: number;
  };
}

const EMPTY: ResolvedWindowControls = {
  segments: { count: 0, surchargeCentsPerDivider: 0 },
  schuifraam: { enabled: false, surchargeCents: 0 },
};

export function resolveWindowControls(
  window: WallWindow,
  product: SupplierProductRow | null,
): ResolvedWindowControls {
  if (!product || product.kind !== 'window') return EMPTY;
  const meta = product.meta as WindowMeta;

  const segCfg = meta.segments;
  let segCount = 0;
  if (segCfg?.enabled) {
    if (window.segmentCountOverride !== undefined) {
      segCount = Math.max(0, Math.floor(window.segmentCountOverride));
      if (segCfg.maxCount != null) segCount = Math.min(segCount, segCfg.maxCount);
    } else {
      segCount = deriveSegmentCount(product.widthMm, segCfg);
    }
  }

  return {
    segments: {
      count: segCount,
      surchargeCentsPerDivider: segCfg?.surchargeCentsPerDivider ?? 0,
    },
    schuifraam: {
      enabled: meta.schuifraam?.enabled ?? false,
      surchargeCents: meta.schuifraam?.surchargeCents ?? 0,
    },
  };
}
```

Update `src/domain/openings/index.ts` to:

```ts
export * from './controls';
export * from './resolve';
```

- [ ] **Step 4: Run tests — should pass**

Run: `pnpm test tests/domain/openings/`
Expected: PASS (all controls + resolve cases).

- [ ] **Step 5: Commit**

```bash
git add src/domain/openings/resolve.ts src/domain/openings/index.ts tests/domain/openings/resolve.spec.ts
git commit -m "feat(domain): resolveWindowControls combines product meta + per-instance override"
```

---

## Task 6: Wire pricing — segment + schuifraam surcharges into the supplier window line item

**Files:**
- Modify: `src/domain/supplier/quote.ts`
- Modify: `src/domain/pricing/calculate.ts`
- Test: `tests/domain/pricing/calculate.spec.ts`

- [ ] **Step 1: Write failing tests**

Open `tests/domain/pricing/calculate.spec.ts` and add (in the appropriate window-pricing describe block, or a new one near it):

```ts
test('window line includes per-divider surcharge when product enables segments', () => {
  // Set up a building with a window referencing a supplier product whose
  // meta.segments.surchargeCentsPerDivider = 5000 and width auto-derives 2 segments.
  // Override the window's segmentCountOverride to 2 to bypass auto for determinism.
  // Expected: window line total = product.priceCents/100 + 2 × 50 = 100 (assuming
  // priceCents=0 here for clarity); test the delta.
  // ... full set-up follows existing test patterns in this file ...
});

test('window line includes schuifraam surcharge when product enables it', () => {
  // Similar — meta.schuifraam.surchargeCents = 25000 → +250 EUR added to line.
});

test('window line surcharges absent when meta lacks the fields', () => {
  // Window with a supplier product whose meta has no segments/schuifraam.
  // Expected: line total === product.priceCents / 100.
});
```

(Match the existing test set-up helpers in `calculate.spec.ts` — most likely a `makeConfig`/`makeProduct` factory.)

- [ ] **Step 2: Run tests — should fail**

Run: `pnpm test tests/domain/pricing/calculate.spec.ts`
Expected: FAIL — surcharges aren't yet added.

- [ ] **Step 3: Extend `getSupplierWindowLineItem`**

In `src/domain/supplier/quote.ts`, replace `getSupplierWindowLineItem` (lines 42-61) with a version that accepts the resolved controls and emits sub-line surcharges. Add a new helper return type:

```ts
import type { WallWindow } from '@/domain/building';
import type { ResolvedWindowControls } from '@/domain/openings';

export interface SupplierWindowLineItem extends SupplierLineItem {
  /** Sub-lines folded into `total` so the caller can choose to show them. */
  surcharges: Array<{
    labelKey: string;
    labelParams: Record<string, string | number>;
    cents: number;
  }>;
}

export function getSupplierWindowLineItem(
  productId: string,
  products: readonly SupplierProductRow[],
  controls: ResolvedWindowControls,
): SupplierWindowLineItem | null {
  const product = findActive(productId, products);
  if (!product) {
    return {
      labelKey: 'quote.line.supplierMissing',
      labelParams: { id: productId, kind: 'window' },
      total: 0,
      source: { kind: 'supplierProduct', productId, sku: '' },
      surcharges: [],
    };
  }
  const surcharges: SupplierWindowLineItem['surcharges'] = [];
  let totalCents = product.priceCents;
  if (controls.segments.count > 0 && controls.segments.surchargeCentsPerDivider > 0) {
    const cents = controls.segments.count * controls.segments.surchargeCentsPerDivider;
    surcharges.push({
      labelKey: 'quote.window.segmentSurcharge',
      labelParams: { count: controls.segments.count },
      cents,
    });
    totalCents += cents;
  }
  if (controls.schuifraam.enabled && controls.schuifraam.surchargeCents > 0) {
    surcharges.push({
      labelKey: 'quote.window.schuifraamSurcharge',
      labelParams: {},
      cents: controls.schuifraam.surchargeCents,
    });
    totalCents += controls.schuifraam.surchargeCents;
  }
  return {
    labelKey: 'quote.line.supplierWindow',
    labelParams: { name: product.name, sku: product.sku },
    total: totalCents / 100,
    source: { kind: 'supplierProduct', productId, sku: product.sku },
    surcharges,
  };
}
```

- [ ] **Step 4: Update the caller in `pricing/calculate.ts`**

In `src/domain/pricing/calculate.ts`, find the windows loop (around line 187) and replace the body with:

```ts
for (const win of wallCfg.windows ?? []) {
  if (win.supplierProductId) {
    const product = supplierProducts.find(p => p.id === win.supplierProductId) ?? null;
    const controls = resolveWindowControls(win, product);
    const winItem = getSupplierWindowLineItem(win.supplierProductId, supplierProducts, controls);
    if (winItem) {
      lineItems.push({
        labelKey: winItem.labelKey,
        labelParams: winItem.labelParams,
        area: 0,
        materialCost: 0,
        insulationCost: 0,
        extrasCost: winItem.total,
        total: winItem.total,
        source: winItem.source,
      });
    }
  } else {
    extrasCost += priceBook.windowFee;
  }
}
```

Add at the top of `calculate.ts`:

```ts
import { resolveWindowControls } from '@/domain/openings';
```

- [ ] **Step 5: Run tests — should pass**

Run: `pnpm test tests/domain/pricing/`
Expected: PASS — including the 3 new cases. Existing window-pricing cases should also still pass (the helper signature changed, but all callers are this single loop).

- [ ] **Step 6: Run the full test suite to catch any other call sites**

Run: `pnpm test`
Expected: PASS. If anything else calls `getSupplierWindowLineItem`, surface those failures and update the callers (pass an empty resolved view: `resolveWindowControls(win, product)` or the explicit `EMPTY`-shaped object).

- [ ] **Step 7: Commit**

```bash
git add src/domain/supplier/quote.ts src/domain/pricing/calculate.ts tests/domain/pricing/calculate.spec.ts
git commit -m "feat(pricing): segment + schuifraam surcharges on supplier window lines"
```

---

## Task 7: Add pure mutation `setWindowSegmentOverride`

**Files:**
- Modify: `src/domain/config/mutations.ts`

- [ ] **Step 1: Add the mutation function**

In `src/domain/config/mutations.ts`, add (placing it next to other window-related mutations):

```ts
/** Set or clear the segment-count override on a specific window.
 *  `count = null` clears the override (returns to auto-derive). */
export function setWindowSegmentOverride(
  state: ConfigState,
  buildingId: string,
  wallId: WallId,
  windowId: string,
  count: number | null,
): Partial<ConfigState> {
  return {
    buildings: state.buildings.map(b => {
      if (b.id !== buildingId) return b;
      const wall = b.walls[wallId];
      if (!wall) return b;
      return {
        ...b,
        walls: {
          ...b.walls,
          [wallId]: {
            ...wall,
            windows: wall.windows.map(w =>
              w.id === windowId
                ? count == null
                  ? (() => { const { segmentCountOverride: _drop, ...rest } = w; return rest; })()
                  : { ...w, segmentCountOverride: Math.max(0, Math.floor(count)) }
                : w,
            ),
          },
        },
      };
    }),
  };
}
```

(Match the surrounding `WallId`, `ConfigState` etc. imports — they already exist in this file.)

- [ ] **Step 2: Compile check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/domain/config/mutations.ts
git commit -m "feat(domain): add setWindowSegmentOverride mutation"
```

---

## Task 8: Wire the mutation into `useConfigStore`

**Files:**
- Modify: `src/store/useConfigStore.ts`

- [ ] **Step 1: Add to store interface + actions**

In `src/store/useConfigStore.ts`:

1. Find the existing `setWindowSupplierProduct` import (around line 46) — add to the import block:

```ts
  setWindowSegmentOverride as mSetWindowSegmentOverride,
```

2. Add to the store's `ConfigStoreActions` interface (next to the existing `setWindowSupplierProduct` declaration around line 92):

```ts
  setWindowSegmentOverride: (
    buildingId: string,
    wallSide: WallSide,
    windowId: string,
    count: number | null,
  ) => void;
```

3. Add the implementation in the store body (next to `setWindowSupplierProduct` around line 184):

```ts
      setWindowSegmentOverride: (buildingId, wallSide, windowId, count) =>
        set(mSetWindowSegmentOverride(get(), buildingId, wallSide, windowId, count)),
```

- [ ] **Step 2: Compile check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/store/useConfigStore.ts
git commit -m "feat(store): expose setWindowSegmentOverride action"
```

---

## Task 9: Add ephemeral `windowAnimations` slice to `useUIStore`

**Files:**
- Modify: `src/store/useUIStore.ts`

- [ ] **Step 1: Add the slice + action**

In `src/store/useUIStore.ts`, add to the state interface:

```ts
  /** Ephemeral schuifraam open/close state. Not persisted, not undoable. */
  windowAnimations: Record<string, { open: boolean }>;
  toggleWindowOpen: (windowId: string) => void;
  clearWindowAnimation: (windowId: string) => void;
```

And in the store body (after the existing initial state):

```ts
  windowAnimations: {},
  toggleWindowOpen: (windowId) =>
    set((state) => ({
      windowAnimations: {
        ...state.windowAnimations,
        [windowId]: { open: !(state.windowAnimations[windowId]?.open ?? false) },
      },
    })),
  clearWindowAnimation: (windowId) =>
    set((state) => {
      const { [windowId]: _drop, ...rest } = state.windowAnimations;
      return { windowAnimations: rest };
    }),
```

- [ ] **Step 2: Compile check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/store/useUIStore.ts
git commit -m "feat(store): ephemeral windowAnimations slice"
```

---

## Task 10: Add i18n keys

**Files:**
- Modify: `src/lib/i18n.ts`

- [ ] **Step 1: Add the new keys**

In `src/lib/i18n.ts`, add to the `nl` translation map:

```ts
  // Window controls — sidebar
  'configurator.window.controls.section': 'Bedieningen',
  'configurator.window.controls.segments': 'Segmenten',
  'configurator.window.controls.segments.auto': 'Auto',
  'configurator.window.controls.segments.autoHint': 'Auto · {{count}} segmenten',
  'configurator.window.controls.schuifraam.open': 'Open',
  'configurator.window.controls.schuifraam.close': 'Sluit',

  // Admin form labels
  'admin.catalog.supplierProducts.field.segments.enabled': 'Segmenten ingeschakeld',
  'admin.catalog.supplierProducts.field.segments.autoThresholdMm': 'Drempel (mm)',
  'admin.catalog.supplierProducts.field.segments.perAdditionalThresholdMm': 'Volgende drempel (mm)',
  'admin.catalog.supplierProducts.field.segments.maxCount': 'Maximum aantal',
  'admin.catalog.supplierProducts.field.segments.surchargeEur': 'Toeslag per segment (€)',
  'admin.catalog.supplierProducts.field.schuifraam.enabled': 'Schuifraam',
  'admin.catalog.supplierProducts.field.schuifraam.surchargeEur': 'Toeslag schuifraam (€)',

  // Quote line labels
  'quote.window.segmentSurcharge': 'Segmenttoeslag ({{count}}×)',
  'quote.window.schuifraamSurcharge': 'Schuifraamtoeslag',
```

- [ ] **Step 2: Build to confirm no key collisions**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/i18n.ts
git commit -m "feat(i18n): translation keys for window controls"
```

---

## Task 11: Admin form — add Controls card to the window branch of `SupplierProductForm`

**Files:**
- Modify: `src/components/admin/catalog/SupplierProductForm.tsx`

- [ ] **Step 1: Extend form schema and `FormValues`**

In `SupplierProductForm.tsx`:

1. Find the zod schema (around line 80). Add to its shape:

```ts
  segmentsEnabled: z.boolean(),
  segmentsAutoThresholdMm: z.number().int().nonnegative().nullable(),
  segmentsPerAdditionalThresholdMm: z.number().int().positive().nullable(),
  segmentsMaxCount: z.number().int().positive().nullable(),
  segmentsSurchargeEur: z.string(),
  schuifraamEnabled: z.boolean(),
  schuifraamSurchargeEur: z.string(),
```

2. Find `defaultsFromRow` (around line 148) and extend the returned object after `openable`:

```ts
    segmentsEnabled: !!winMeta.segments?.enabled,
    segmentsAutoThresholdMm: winMeta.segments?.autoThresholdMm ?? null,
    segmentsPerAdditionalThresholdMm: winMeta.segments?.perAdditionalThresholdMm ?? null,
    segmentsMaxCount: winMeta.segments?.maxCount ?? null,
    segmentsSurchargeEur:
      winMeta.segments?.surchargeCentsPerDivider != null
        ? centsToEuroInput(winMeta.segments.surchargeCentsPerDivider)
        : '',
    schuifraamEnabled: !!winMeta.schuifraam?.enabled,
    schuifraamSurchargeEur:
      winMeta.schuifraam?.surchargeCents != null
        ? centsToEuroInput(winMeta.schuifraam.surchargeCents)
        : '',
```

3. Find `emptyDefaults` (around line 175) and add the same keys with empty defaults:

```ts
    segmentsEnabled: false,
    segmentsAutoThresholdMm: null,
    segmentsPerAdditionalThresholdMm: null,
    segmentsMaxCount: null,
    segmentsSurchargeEur: '',
    schuifraamEnabled: false,
    schuifraamSurchargeEur: '',
```

- [ ] **Step 2: Map form values into `meta` on submit**

In `onSubmit`, in the `else if (values.kind === 'window')` branch (around line 231), append after the `leadTimeDays` line:

```ts
      if (values.segmentsEnabled) {
        const seg: Record<string, unknown> = {
          enabled: true,
          autoThresholdMm: values.segmentsAutoThresholdMm ?? 0,
        };
        if (values.segmentsPerAdditionalThresholdMm != null) {
          seg.perAdditionalThresholdMm = values.segmentsPerAdditionalThresholdMm;
        }
        if (values.segmentsMaxCount != null) {
          seg.maxCount = values.segmentsMaxCount;
        }
        const segCents = parseEuroToCents(values.segmentsSurchargeEur);
        if (segCents > 0) seg.surchargeCentsPerDivider = segCents;
        meta.segments = seg;
      }
      if (values.schuifraamEnabled) {
        const sf: Record<string, unknown> = { enabled: true };
        const sfCents = parseEuroToCents(values.schuifraamSurchargeEur);
        if (sfCents > 0) sf.surchargeCents = sfCents;
        meta.schuifraam = sf;
      }
```

- [ ] **Step 3: Add the Controls card UI inside the window branch**

In the JSX, find the closing `</Card>` of the window branch (around line 689 — the card that holds glazingType / frameMaterial / uValue / openable / leadTimeDays). Immediately before that closing `</Card>`, INSIDE the existing `CardContent` after the `openable` field, append a divider and the controls block:

```tsx
              <hr className="border-border" />

              <FormField
                control={form.control}
                name="segmentsEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="cursor-pointer">
                      {t('admin.catalog.supplierProducts.field.segments.enabled')}
                    </FormLabel>
                  </FormItem>
                )}
              />
              {form.watch('segmentsEnabled') && (
                <div className="grid grid-cols-2 gap-4 pl-6">
                  <FormField
                    control={form.control}
                    name="segmentsAutoThresholdMm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('admin.catalog.supplierProducts.field.segments.autoThresholdMm')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="1"
                            min={0}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.value === '' ? null : Number(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="segmentsPerAdditionalThresholdMm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('admin.catalog.supplierProducts.field.segments.perAdditionalThresholdMm')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="1"
                            min={1}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.value === '' ? null : Number(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="segmentsMaxCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('admin.catalog.supplierProducts.field.segments.maxCount')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="1"
                            min={1}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.value === '' ? null : Number(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="segmentsSurchargeEur"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('admin.catalog.supplierProducts.field.segments.surchargeEur')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <hr className="border-border" />

              <FormField
                control={form.control}
                name="schuifraamEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="cursor-pointer">
                      {t('admin.catalog.supplierProducts.field.schuifraam.enabled')}
                    </FormLabel>
                  </FormItem>
                )}
              />
              {form.watch('schuifraamEnabled') && (
                <div className="pl-6">
                  <FormField
                    control={form.control}
                    name="schuifraamSurchargeEur"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('admin.catalog.supplierProducts.field.schuifraam.surchargeEur')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
```

- [ ] **Step 4: Build + visual smoke**

Run: `pnpm exec tsc --noEmit && pnpm build`
Expected: PASS.

Also start the dev server (`pnpm dev`) and confirm:
- `/admin/catalog/suppliers/<id>/products/new?kind=window` shows the new Segments + Schuifraam toggles.
- Toggling them reveals the inline subforms.
- Saving + reopening retains values.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/catalog/SupplierProductForm.tsx
git commit -m "feat(admin): window-product Controls card (segments + schuifraam)"
```

---

## Task 12: Configurator sidebar — Controls section in `WindowConfig`

**Files:**
- Modify: `src/components/ui/WindowConfig.tsx`

- [ ] **Step 1: Add a Controls block under each window row**

In `WindowConfig.tsx`:

1. Pull the new store action and resolver:

```ts
// At top:
import { resolveWindowControls } from '@/domain/openings';
import { useUIStore } from '@/store/useUIStore';

// Inside the component, alongside other store reads:
const setWindowSegmentOverride = useConfigStore((s) => s.setWindowSegmentOverride);
const windowAnimations = useUIStore((s) => s.windowAnimations);
const toggleWindowOpen = useUIStore((s) => s.toggleWindowOpen);
```

2. Inside the `windows.map((win, i) => …)` block, immediately before the closing `</div>` of the per-window outer card (around line 222–223), insert:

```tsx
{(() => {
  const product = activeProduct;
  const ctrl = resolveWindowControls(win, product ?? null);
  const productMeta = product?.meta as import('@/domain/supplier').WindowMeta | undefined;
  const segEnabled = !!productMeta?.segments?.enabled;
  const sfEnabled = !!productMeta?.schuifraam?.enabled;
  if (!segEnabled && !sfEnabled) return null;

  const maxOptions = productMeta?.segments?.maxCount ?? 8;
  const overrideValue = win.segmentCountOverride;
  const isAuto = overrideValue === undefined;
  const autoCount = ctrl.segments.count;

  return (
    <div className="border-t border-border/50 px-3 py-2 space-y-2">
      <p className="text-[11px] font-medium text-muted-foreground">
        {t('configurator.window.controls.section')}
      </p>

      {segEnabled && (
        <div className="space-y-1">
          <p className="text-xs">{t('configurator.window.controls.segments')}</p>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setWindowSegmentOverride(buildingId, wallId, win.id, null)}
              className={`px-2 py-0.5 rounded text-xs border ${
                isAuto
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              {isAuto
                ? t('configurator.window.controls.segments.autoHint', { count: autoCount })
                : t('configurator.window.controls.segments.auto')}
            </button>
            {Array.from({ length: maxOptions + 1 }, (_, n) => (
              <button
                key={n}
                type="button"
                onClick={() => setWindowSegmentOverride(buildingId, wallId, win.id, n)}
                className={`px-2 py-0.5 rounded text-xs border tabular-nums ${
                  !isAuto && overrideValue === n
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {sfEnabled && (
        <button
          type="button"
          onClick={() => toggleWindowOpen(win.id)}
          className="text-xs px-2 py-1 rounded border border-border hover:bg-muted/50"
        >
          {windowAnimations[win.id]?.open
            ? t('configurator.window.controls.schuifraam.close')
            : t('configurator.window.controls.schuifraam.open')}
        </button>
      )}
    </div>
  );
})()}
```

- [ ] **Step 2: Build + visual smoke**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

In the dev server, place a window and select a supplier product whose `segments` or `schuifraam` is enabled (set this up via admin first, or seed). Confirm:
- Controls section appears only when the product enables them.
- Auto button toggles on/off cleanly; selecting `0`–`N` overrides.
- Schuifraam Open/Sluit toggles button label and ephemeral state.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/WindowConfig.tsx
git commit -m "feat(configurator): window Controls section (segments + schuifraam)"
```

---

## Task 13: 3D rendering — segment dividers (vertical, non-schuifraam)

**Files:**
- Modify: `src/components/canvas/WindowMesh.tsx`
- Modify: `src/components/canvas/Wall.tsx`

- [ ] **Step 1: Pass resolved view + window into `WindowMesh`**

In `Wall.tsx`, locate the `windowXs.map(...)` block (around line 298). Replace its body:

```tsx
{windowXs.map((wx, i) => {
  const win = (wallCfg.windows ?? [])[i];
  const windowSupplierProduct = win?.supplierProductId
    ? supplierCatalog.products.find(p => p.id === win.supplierProductId) ?? undefined
    : undefined;
  return (
    <WindowMesh
      key={i}
      x={wx}
      width={win?.width}
      height={win?.height}
      sillHeight={win?.sillHeight}
      supplierProduct={windowSupplierProduct}
      wallWindow={win}
    />
  );
})}
```

- [ ] **Step 2: Extend `WindowMeshProps` and rendering**

In `WindowMesh.tsx`, replace the props interface and `WindowMesh` router:

```ts
import type { WallWindow } from '@/domain/building';
import { resolveWindowControls } from '@/domain/openings';
import { useUIStore } from '@/store/useUIStore';

interface WindowMeshProps {
  x: number;
  width?: number;
  height?: number;
  sillHeight?: number;
  supplierProduct?: SupplierProductRow;
  wallWindow?: WallWindow;
}
```

In `WindowMesh` default export:

```tsx
export default function WindowMesh(props: WindowMeshProps) {
  if (props.supplierProduct) {
    return (
      <SupplierWindowMesh
        x={props.x}
        supplierProduct={props.supplierProduct}
        sillHeight={props.sillHeight}
        wallWindow={props.wallWindow}
      />
    );
  }
  return <StandardWindowMesh {...props} />;
}
```

- [ ] **Step 3: Render vertical mullions in `SupplierWindowMesh`**

Replace `SupplierWindowMesh` with:

```tsx
function SupplierWindowMesh({
  x,
  supplierProduct,
  sillHeight = WIN_SILL_DEFAULT,
  wallWindow,
}: {
  x: number;
  supplierProduct: SupplierProductRow;
  sillHeight?: number;
  wallWindow?: WallWindow;
}) {
  const width = supplierProduct.widthMm / 1000;
  const height = supplierProduct.heightMm / 1000;
  const winY = sillHeight + height / 2;
  const heroUrl = supplierProduct.heroImage;

  const ctrl = wallWindow
    ? resolveWindowControls(wallWindow, supplierProduct)
    : { segments: { count: 0, surchargeCentsPerDivider: 0 }, schuifraam: { enabled: false, surchargeCents: 0 } };
  const segmentCount = ctrl.segments.count;
  const isSchuifraam = ctrl.schuifraam.enabled;
  const open = useUIStore((s) =>
    wallWindow ? !!s.windowAnimations[wallWindow.id]?.open : false,
  );

  // Mullion offsets (X centres) for `segmentCount` vertical dividers,
  // equally spaced. Returns an array of length `segmentCount`.
  const mullionXs: number[] = [];
  if (segmentCount > 0) {
    const step = width / (segmentCount + 1);
    for (let i = 1; i <= segmentCount; i++) {
      mullionXs.push(-width / 2 + step * i);
    }
  }

  return (
    <group position={[x, winY, 0]}>
      {heroUrl ? (
        <SupplierWindowGlazing width={width} height={height} heroUrl={heroUrl} />
      ) : (
        <mesh material={glassMat}>
          <boxGeometry args={[width, height, WIN_DEPTH]} />
        </mesh>
      )}

      {/* Mullions — only when NOT schuifraam (schuifraam path is in Task 14) */}
      {!isSchuifraam && mullionXs.map((mx, i) => (
        <mesh key={`m-${i}`} position={[mx, 0, 0]} material={frameMat}>
          <boxGeometry args={[FRAME_T * 0.7, height, FRAME_D]} />
        </mesh>
      ))}

      {/* Frame: top / bottom / left / right (unchanged) */}
      <mesh position={[0, height / 2 + FRAME_T / 2, 0]} material={frameMat}>
        <boxGeometry args={[width + FRAME_T * 2, FRAME_T, FRAME_D]} />
      </mesh>
      <mesh position={[0, -height / 2 - FRAME_T / 2, 0]} material={frameMat}>
        <boxGeometry args={[width + FRAME_T * 2, FRAME_T, FRAME_D]} />
      </mesh>
      <mesh position={[-width / 2 - FRAME_T / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T, height + FRAME_T * 2, FRAME_D]} />
      </mesh>
      <mesh position={[width / 2 + FRAME_T / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T, height + FRAME_T * 2, FRAME_D]} />
      </mesh>

      {/* Schuifraam panes will be added in Task 14, gated on isSchuifraam */}
      {void open /* used in Task 14 */}
    </group>
  );
}
```

(Leave the `void open` line — Task 14 will replace this entire block; we're keeping it lint-clean for the interim commit.)

- [ ] **Step 4: Compile + visual smoke**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

In the dev server, place a window with a supplier product that enables `segments` (e.g. autoThresholdMm: 1500, perAdditionalThresholdMm: 1000). Confirm vertical mullion(s) render. Toggle the sidebar override `0` and `2`. The pane geometry stays a single mesh — only mullion meshes change.

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/WindowMesh.tsx src/components/canvas/Wall.tsx
git commit -m "feat(canvas): vertical mullion dividers driven by resolved segment count"
```

---

## Task 14: 3D rendering — schuifraam panes + X-axis slide animation

**Files:**
- Modify: `src/components/canvas/WindowMesh.tsx`

- [ ] **Step 1: Replace the schuifraam stub with split panes + animation**

In `WindowMesh.tsx`, inside `SupplierWindowMesh`, replace the section from `{!isSchuifraam && mullionXs.map(...)` through the `{void open}` line with:

```tsx
{!isSchuifraam ? (
  <>
    {/* Single glazing pane underneath */}
    {/* (Already rendered above; mullions overlay it.) */}
    {mullionXs.map((mx, i) => (
      <mesh key={`m-${i}`} position={[mx, 0, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T * 0.7, height, FRAME_D]} />
      </mesh>
    ))}
  </>
) : (
  <SchuifraamPanes
    width={width}
    height={height}
    segmentCount={segmentCount}
    open={open}
    heroUrl={heroUrl}
  />
)}
```

Also, when `isSchuifraam`, suppress the underlying single glazing pane drawn at the top of the group. Easiest approach: split the glazing render so it ONLY runs in the non-schuifraam path. Restructure the early glazing block to:

```tsx
{!isSchuifraam && (
  heroUrl ? (
    <SupplierWindowGlazing width={width} height={height} heroUrl={heroUrl} />
  ) : (
    <mesh material={glassMat}>
      <boxGeometry args={[width, height, WIN_DEPTH]} />
    </mesh>
  )
)}
```

Then implement `SchuifraamPanes` below `SupplierWindowMesh`:

```tsx
const PANE_OVERLAP_M = 0.03; // ~30mm overlap on the rail axis

function SchuifraamPanes({
  width,
  height,
  segmentCount,
  open,
  heroUrl,
}: {
  width: number;
  height: number;
  segmentCount: number;
  open: boolean;
  heroUrl: string | null;
}) {
  const paneCount = segmentCount + 1;
  // Equal slot width before overlap
  const slotW = width / paneCount;
  // Each pane is a bit wider so adjacent panes overlap
  const paneW = slotW + PANE_OVERLAP_M;

  // First pane is "fixed" (i=0). Remaining slide to +X by slotW × i when open.
  return (
    <>
      {Array.from({ length: paneCount }, (_, i) => {
        const baseX = -width / 2 + slotW / 2 + i * slotW;
        const slideX = i === 0 ? 0 : (open ? slotW * i : 0);
        return (
          <SchuifraamPane
            key={i}
            x={baseX + slideX}
            width={paneW}
            height={height}
            heroUrl={heroUrl}
            zOffset={i % 2 === 0 ? 0 : WIN_DEPTH * 0.6}
          />
        );
      })}
    </>
  );
}

function SchuifraamPane({
  x,
  width,
  height,
  heroUrl,
  zOffset,
}: {
  x: number;
  width: number;
  height: number;
  heroUrl: string | null;
  zOffset: number;
}) {
  return (
    <group position={[x, 0, zOffset]}>
      {heroUrl ? (
        <SupplierWindowGlazing width={width} height={height} heroUrl={heroUrl} />
      ) : (
        <mesh material={glassMat}>
          <boxGeometry args={[width, height, WIN_DEPTH]} />
        </mesh>
      )}
    </group>
  );
}
```

(Animation note: this jumps to open/closed. For a smooth slide, wrap `slideX` in a `useFrame` lerp toward a target — but only if doors do this today. If door swing is also instant, leave this instant for parity. If door swing is animated via `useSpring` or similar, copy that pattern here.)

- [ ] **Step 2: Compile + visual smoke**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

In the dev server: configure an admin supplier window product with `schuifraam.enabled = true` and `segments.enabled = true` (e.g. autoThresholdMm 1500, perAdditional 1000). Place it on a wall. Click "Open" in the sidebar Controls section — non-fixed panes should jump to +X by their slot width. "Sluit" returns them. Mullions are absent in this mode.

- [ ] **Step 3: Match door animation pattern (if any)**

Search for door open/close animation:
```bash
grep -rn "useFrame\|useSpring" src/components/canvas/DoorMesh.tsx
```

If doors animate, copy that pattern into `SchuifraamPane` (replace `slideX` with a ref + `useFrame` lerp toward target). If doors don't animate, leave instant.

- [ ] **Step 4: Commit**

```bash
git add src/components/canvas/WindowMesh.tsx
git commit -m "feat(canvas): schuifraam panes with X-axis slide on open/close"
```

---

## Task 15: Final verification

**Files:** none — purely verification.

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: PASS (existing 413+ cases + ~12-15 new ones in openings + supplier + pricing).

- [ ] **Step 2: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 4: Lint (net-new errors only)**

Run: `pnpm lint`
Expected: any new errors must be fixed; pre-existing warnings allowed.

- [ ] **Step 5: Manual UAT in dev server**

Run: `pnpm dev` and walk through:

1. **Admin path:**
   - `/admin/catalog/suppliers/<id>/products/new?kind=window`.
   - Toggle "Segmenten ingeschakeld"; fill threshold (e.g. 1500), perAdditional (1000), maxCount (4), surcharge (50).
   - Toggle "Schuifraam"; fill surcharge (250).
   - Save → reopen → values retained.
   - Edit, untick, save → fields cleared from meta on next reopen.

2. **Configurator (segments only):**
   - Place a window, switch to "Uit catalogus", pick the product above.
   - Width auto-divider count appears in the 3D mesh (vertical mullions).
   - Sidebar shows "Auto · 2 segmenten" hint; clicking `0`–`4` overrides.
   - Quote line shows segment surcharge sub-line.

3. **Configurator (schuifraam):**
   - Same window product (or a separate one with both controls).
   - Sidebar shows "Open" button; clicking slides panes; "Sluit" reverses.
   - Quote line shows schuifraam surcharge.

4. **Cross-check:**
   - Submit an order via "In winkelmandje"; check `/admin/orders/<id>` shows the surcharges in the snapshot.
   - Naked window (no supplier product) shows no Controls section; pricing unchanged.

- [ ] **Step 6: Final summary commit (if any docs need a tweak)**

Skip if no changes; otherwise commit any minor polish:

```bash
git add -p && git commit -m "chore: polish window controls feature"
```

---

## Self-review notes

- **Spec coverage:** Every spec section maps to a task — domain registry (Task 4), `WindowMeta` extension (Task 1) + validation (Task 2), `WallWindow` extension (Task 3), `resolveWindowControls` (Task 5), pricing (Task 6), store actions (Tasks 7–9), i18n (Task 10), admin UI (Task 11), sidebar UI (Task 12), 3D segments (Task 13), 3D schuifraam (Task 14), verification (Task 15).
- **Open items from spec** addressed: mullion thickness reuses existing `FRAME_T` constant; schuifraam slide direction is hard +X (matching the simplest door pattern — confirm in Task 14 step 3 and lift to clearance-aware later if needed).
- **No scene migration** needed: every new field is optional; legacy `WallWindow` rows simply have no `segmentCountOverride`.
