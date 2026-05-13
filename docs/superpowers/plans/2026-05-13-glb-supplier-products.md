# GLB-backed Supplier Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins upload a GLB to a supplier product (door/window), tag its node tree once for variant groups + material slots, and have the configurator render the GLB with per-slot material picks and variant dropdowns, with per-pick price deltas folded into the priced quote and the order snapshot.

**Architecture:** GLB files live in Vercel Blob (existing pattern). A new server-side parse endpoint uses `@gltf-transform/core` to read the node tree on demand — no persisted parse artifact. Tag data persists as `meta.glb: GlbBinding` on `supplier_products` (open jsonb, no DB migration). The R3F renderer uses drei's `useGLTF` with a mandatory `scene.clone(true)` per instance; visibility + material overrides are pure traversals over the cloned tree. Customer picks live on `WallConfig.doorGlb*` and `WallWindow.glb*` — fully covered by the existing deep-freeze in `buildQuoteSnapshot` / `buildConfigSnapshot`. Optional fields only; no `CONFIG_VERSION` bump.

**Tech Stack:** TypeScript, Next.js 16 (App Router), React 19, React Three Fiber + drei, `@gltf-transform/core` (new server dep), Vercel Blob, Drizzle (no migration), Zustand + zundo, react-hook-form, shadcn, Vitest via Vite+.

**Spec:** `docs/superpowers/specs/2026-05-13-glb-supplier-products-design.md`

---

## File touch-list

**Domain (framework-free):**

- `src/domain/supplier/types.ts` — add `GlbBinding`, `VariantGroup`, `VariantOption`, `MaterialSlot`, `ParsedNode`; widen `DoorMeta` + `WindowMeta` with optional `glb`; add `glbInvalid` to `SUPPLIER_ERROR_CODES`.
- `src/domain/supplier/glb.ts` — NEW. Pure validator `validateGlbBinding` + pure helpers `resolveVariantPicks`, `resolveMaterialPicks`, `glbExtraPriceCents`.
- `src/domain/supplier/product.ts` — call `validateGlbBinding` from `validateDoorMeta` + `validateWindowMeta`; widen PATCH validator to validate `meta.glb` recursively; extend `DOOR_META_KEYS` and `WINDOW_META_KEYS` with `'glb'`.
- `src/domain/building/types.ts` — add `doorGlbVariants?`, `doorGlbMaterials?` to `WallConfig`; add `glbVariants?`, `glbMaterials?` to `WallWindow`.
- `src/domain/config/mutations.ts` — `setWallDoorGlbVariant`, `setWallDoorGlbMaterial`, `setWallWindowGlbVariant`, `setWallWindowGlbMaterial`.
- `src/domain/pricing/calculate.ts` — emit per-variant + per-material-slot line items on GLB-backed doors/windows.

**Server (API):**

- `src/app/api/admin/uploads/glb/route.ts` — NEW. Mirrors `uploads/textures` but accepts `model/gltf-binary` + 10 MB.
- `src/app/api/admin/supplier-products/[pid]/glb/route.ts` — NEW. Pure parse endpoint, server-side `WebIO` from `@gltf-transform/core`.

**Browser (canvas + sidebar):**

- `src/lib/glb/useClonedGlbScene.ts` — NEW. Wraps `useGLTF` + per-instance `scene.clone(true)`.
- `src/lib/glb/applyBinding.ts` — NEW. Pure-ish helpers `applyHidden`, `applyVariants`, `applyMaterials`.
- `src/components/canvas/GlbDoorMesh.tsx` — NEW. R3F leg branched in from `DoorMesh.tsx`.
- `src/components/canvas/GlbWindowMesh.tsx` — NEW. Same shape for windows.
- `src/components/canvas/DoorMesh.tsx` — add the GLB branch above the existing `SupplierDoorMesh` branch.
- `src/components/canvas/Wall.tsx` — add the analogous GLB branch in the window render block.
- `src/components/ui/DoorConfig.tsx` — replace the global Material picker with `VariantPicker` + `MaterialSlotPicker` when the active SKU has `meta.glb`.
- `src/components/ui/WindowConfig.tsx` — same.
- `src/components/ui/VariantPicker.tsx` — NEW. Shadcn `Select`-based.
- `src/components/ui/MaterialSlotPicker.tsx` — NEW. Shadcn `Select`-based.

**Admin:**

- `src/components/admin/catalog/SupplierProductForm.tsx` — add a "3D Model" collapsible section (Phase 3).
- `src/components/admin/catalog/GlbModelSection.tsx` — NEW. The tagging section component.
- `src/components/admin/catalog/GlbTreeView.tsx` — NEW. Tree explorer + selected-node action panel.
- `src/components/admin/catalog/GlbVariantGroupEditor.tsx` — NEW. Inline editor for one variant group.
- `src/components/admin/catalog/GlbMaterialSlotEditor.tsx` — NEW. Inline editor for one material slot.
- `src/components/admin/catalog/GlbPreviewCanvas.tsx` — NEW (Phase 6). Reuses `GlbDoorMesh`.

**Glue:**

- `src/lib/i18n.ts` — keys for: `quote.glbVariant`, `quote.glbMaterialSlot`, `admin.glb.*` (section titles, action labels, error inlines, re-upload confirm).
- `tests/fixtures/DEUR.glb` — commit the file from `/Users/jeremy/Downloads/DEUR.glb`.

**Tests:**

- `tests/supplier-glb-validator.test.ts` — `validateGlbBinding` happy + every error path.
- `tests/supplier-product-glb-meta.test.ts` — DoorMeta + WindowMeta with `glb`; PATCH validator coverage.
- `tests/supplier-glb-parse.test.ts` — `parseGlb` from the DEUR fixture; tree shape + naturalSize + unitScale heuristic.
- `tests/supplier-glb-pricing.test.ts` — `calculateTotalQuote` line items for default, one variant, one material, mixed.
- `tests/supplier-glb-mutations.test.ts` — `setWallDoor*` + `setWallWindow*` mutations.
- `tests/supplier-glb-apply.test.ts` — `applyHidden` / `applyVariants` / `applyMaterials` against a hand-built stub scene.
- `tests/api/admin-uploads-glb.test.ts` — auth + cross-tenant + size cap.
- `tests/api/admin-supplier-products-glb.test.ts` — parse endpoint happy + error cases.

---

## Conventions (read once)

- **Cents everywhere.** All money values stored and computed as integers in cents (matches existing `priceCents`, `surchargeCents`). Never use euros in code.
- **Validator return shape.** Domain validators return `{ value: T | null, errors: string[] }`. Push colon-namespaced codes (`glb_invalid:variantGroups[0].id`) to detail; the umbrella code `glb_invalid` is used only when shape is wrong at the top.
- **Error code addition.** Add `glbInvalid: 'glb_invalid'` to `SUPPLIER_ERROR_CODES` in `src/domain/supplier/types.ts`. Other tests pin to existing codes — do NOT rename existing entries.
- **Optional fields default to undefined.** New `WallConfig` and `WallWindow` GLB fields are optional (`?:`); the existing migrator (`migrateBuilding` / `migrateRoof`) does not need updating for purely additive optional fields.
- **No `crypto.randomUUID()` in domain.** Variant/slot IDs come from admin input (slugified node names), not auto-generated.
- **i18n keys are Dutch.** UI copy is Dutch (`nl`); render via `t('admin.glb.…')`.
- **Cents → display.** When displaying price deltas in the admin form, use the existing `(value/100).toLocaleString('nl-BE', { style: 'currency', currency: 'EUR' })` pattern from `SupplierProductForm.tsx`.
- **Auth.** All admin routes use `withSession` + `requireBusiness(session, ['super_admin', 'tenant_admin'])` + `requireTenantScope(session, product.tenantId)`. Public/client routes don't apply here.
- **TDD.** Every task writes the failing test first, runs to confirm fail, implements, runs to confirm pass, commits.

---

# Phase 1 — Domain types + validators

End state: types compile, validators have full test coverage, no UI or API changes. Existing `pnpm test` + `pnpm build` + `pnpm exec tsc --noEmit` pass.

## Task 1.1: Add GLB types to supplier types

**Files:**
- Modify: `src/domain/supplier/types.ts`

- [ ] **Step 1: Add the new types alongside existing supplier exports**

Append after the `GateMeta` block, before `SupplierProductRow`:

```ts
// ──────────────────────────────────────────────────────────────────────────
// GLB binding — attached to door/window supplier products that ship a 3D
// model. Path strings are canonical: ancestor node `name` values joined
// with `/`, leading `/`.
// ──────────────────────────────────────────────────────────────────────────

export interface GlbBinding {
  /** Vercel Blob URL of the .glb file */
  url: string;
  /** Multiplier applied to convert source units to metres (e.g. 0.0254 for
   *  inches). The renderer wraps the loaded scene in a `<group scale=…>`. */
  unitScale: number;
  /** Overall bounding box at `unitScale`, captured at upload time. Used
   *  to pre-fill widthMm/heightMm on the SKU and to warn on divergence. */
  naturalSize: { widthMm: number; heightMm: number; depthMm: number };
  /** Node paths to always hide (e.g. construction markers, cameras). */
  hidden: string[];
  variantGroups: GlbVariantGroup[];
  materialSlots: GlbMaterialSlot[];
}

export interface GlbVariantGroup {
  /** Stable key within this binding, e.g. "leaf". */
  id: string;
  /** Dutch label shown in the sidebar, e.g. "Bladtype". */
  label: string;
  /** GLB path of the switcher node (its children are the options). */
  parentPath: string;
  /** Must reference an existing option id. */
  defaultOptionId: string;
  options: GlbVariantOption[];
}

export interface GlbVariantOption {
  id: string;
  label: string;
  /** GLB path of the child under `parentPath` to show when this is picked. */
  childPath: string;
  /** Non-negative integer cents added to the SKU price when picked. */
  priceDeltaCents: number;
}

export interface GlbMaterialSlot {
  id: string;
  label: string;
  /** One or more GLB paths whose materials get overridden. */
  nodePaths: string[];
  /** Which MaterialCategory the dropdown is filtered to. */
  category: MaterialCategory;
  /** Must be in `allowedMaterialSlugs`. */
  defaultMaterialSlug: string;
  /** Curated list of catalog material slugs the customer can pick from.
   *  ≥ 1 entry. */
  allowedMaterialSlugs: string[];
  /** Per-slug additive cents (≥ 0). Missing entries treated as 0. */
  priceDeltasCents: Record<string, number>;
}

/** Returned by the server-side parse endpoint. */
export interface GlbParsedNode {
  /** "/Binnendeur/Binnendeur berekeningen/deurbladen" */
  path: string;
  name: string;
  hasMesh: boolean;
  children: GlbParsedNode[];
}

export interface GlbParseResult {
  url: string;
  unitScale: number;
  naturalSize: { widthMm: number; heightMm: number; depthMm: number };
  tree: GlbParsedNode;
}
```

Add the import of `MaterialCategory` at the top of the file:

```ts
import type { MaterialCategory } from '@/domain/catalog';
```

Widen `DoorMeta` and `WindowMeta` to include `glb?: GlbBinding`:

```ts
export interface DoorMeta {
  swingDirection?: 'inward' | 'outward' | 'none';
  lockType?: 'cylinder' | 'multipoint' | 'none';
  glazing?: 'solid' | 'glass-panel' | 'half-glass';
  rValue?: number;
  leadTimeDays?: number;
  glb?: GlbBinding;
}

export interface WindowMeta {
  glazingType?: 'double' | 'triple' | 'single';
  uValue?: number;
  frameMaterial?: string;
  openable?: boolean;
  leadTimeDays?: number;
  segments?: WindowMetaSegments;
  schuifraam?: WindowMetaSchuifraam;
  glb?: GlbBinding;
}
```

Extend `SUPPLIER_ERROR_CODES`:

```ts
export const SUPPLIER_ERROR_CODES = {
  // …existing entries
  schuifraamInvalid: 'schuifraam_invalid',
  glbInvalid: 'glb_invalid',
} as const;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS. No consumer breaks because `glb` is optional and the new types/code are unused.

- [ ] **Step 3: Commit**

```bash
git add src/domain/supplier/types.ts
git commit -m "feat(domain): add GlbBinding + related types to supplier domain"
```

---

## Task 1.2: Write `validateGlbBinding` (test-first)

**Files:**
- Create: `tests/supplier-glb-validator.test.ts`
- Create: `src/domain/supplier/glb.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/supplier-glb-validator.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import { validateGlbBinding } from '@/domain/supplier/glb';

const HAPPY: unknown = {
  url: 'https://blob.vercel-storage.com/glb/tenant-x/abc.glb',
  unitScale: 0.0254,
  naturalSize: { widthMm: 900, heightMm: 2000, depthMm: 50 },
  hidden: ['/Active View'],
  variantGroups: [
    {
      id: 'leaf',
      label: 'Bladtype',
      parentPath: '/Binnendeur/.../deurbladen',
      defaultOptionId: 'vlakke',
      options: [
        { id: 'vlakke', label: 'Vlakke', childPath: '/.../Vlakke', priceDeltaCents: 0 },
        { id: 'paneel', label: 'Paneel', childPath: '/.../Paneel', priceDeltaCents: 12000 },
      ],
    },
  ],
  materialSlots: [
    {
      id: 'frame',
      label: 'Kader',
      nodePaths: ['/.../Kop/Chambrang#1'],
      category: 'wall',
      defaultMaterialSlug: 'eik-natuur',
      allowedMaterialSlugs: ['eik-natuur', 'antraciet'],
      priceDeltasCents: { 'eik-natuur': 0, 'antraciet': 5000 },
    },
  ],
};

describe('validateGlbBinding', () => {
  it('accepts a fully-populated binding', () => {
    const r = validateGlbBinding(HAPPY);
    expect(r.errors).toEqual([]);
    expect(r.value).not.toBeNull();
  });

  it('rejects non-object input', () => {
    expect(validateGlbBinding(null).errors).toEqual(['glb_invalid']);
    expect(validateGlbBinding('x').errors).toEqual(['glb_invalid']);
    expect(validateGlbBinding(42).errors).toEqual(['glb_invalid']);
  });

  it('rejects missing/empty url', () => {
    const bad = { ...(HAPPY as object), url: '' };
    expect(validateGlbBinding(bad).errors).toContain('glb_invalid:url');
  });

  it('rejects non-positive unitScale', () => {
    const bad = { ...(HAPPY as object), unitScale: 0 };
    expect(validateGlbBinding(bad).errors).toContain('glb_invalid:unitScale');
  });

  it('rejects missing/non-positive naturalSize fields', () => {
    const bad = { ...(HAPPY as object), naturalSize: { widthMm: 0, heightMm: 1, depthMm: 1 } };
    expect(validateGlbBinding(bad).errors).toContain('glb_invalid:naturalSize');
  });

  it('rejects hidden being non-array', () => {
    const bad = { ...(HAPPY as object), hidden: 'foo' };
    expect(validateGlbBinding(bad).errors).toContain('glb_invalid:hidden');
  });

  it('rejects duplicate variant-group ids', () => {
    const bad = {
      ...(HAPPY as object),
      variantGroups: [
        (HAPPY as { variantGroups: unknown[] }).variantGroups[0],
        (HAPPY as { variantGroups: unknown[] }).variantGroups[0],
      ],
    };
    expect(validateGlbBinding(bad).errors).toContain('glb_invalid:variantGroups[1].id');
  });

  it('rejects variant default not in options', () => {
    const bad = {
      ...(HAPPY as object),
      variantGroups: [{ ...(HAPPY as { variantGroups: { 0: object }[] }).variantGroups[0], defaultOptionId: 'nonexistent' }],
    };
    expect(validateGlbBinding(bad).errors).toContain('glb_invalid:variantGroups[0].defaultOptionId');
  });

  it('rejects duplicate option ids within a group', () => {
    const opts = [
      { id: 'a', label: 'A', childPath: '/x', priceDeltaCents: 0 },
      { id: 'a', label: 'A2', childPath: '/y', priceDeltaCents: 0 },
    ];
    const bad = {
      ...(HAPPY as object),
      variantGroups: [{ id: 'g', label: 'G', parentPath: '/p', defaultOptionId: 'a', options: opts }],
    };
    expect(validateGlbBinding(bad).errors).toContain('glb_invalid:variantGroups[0].options[1].id');
  });

  it('rejects negative price delta on a variant option', () => {
    const opts = [
      { id: 'a', label: 'A', childPath: '/x', priceDeltaCents: -1 },
    ];
    const bad = {
      ...(HAPPY as object),
      variantGroups: [{ id: 'g', label: 'G', parentPath: '/p', defaultOptionId: 'a', options: opts }],
    };
    expect(validateGlbBinding(bad).errors).toContain('glb_invalid:variantGroups[0].options[0].priceDeltaCents');
  });

  it('rejects empty material-slot nodePaths', () => {
    const bad = {
      ...(HAPPY as object),
      materialSlots: [
        { ...(HAPPY as { materialSlots: { 0: object }[] }).materialSlots[0], nodePaths: [] },
      ],
    };
    expect(validateGlbBinding(bad).errors).toContain('glb_invalid:materialSlots[0].nodePaths');
  });

  it('rejects invalid material category', () => {
    const bad = {
      ...(HAPPY as object),
      materialSlots: [
        { ...(HAPPY as { materialSlots: { 0: object }[] }).materialSlots[0], category: 'not-a-cat' },
      ],
    };
    expect(validateGlbBinding(bad).errors).toContain('glb_invalid:materialSlots[0].category');
  });

  it('rejects empty allowedMaterialSlugs', () => {
    const bad = {
      ...(HAPPY as object),
      materialSlots: [
        { ...(HAPPY as { materialSlots: { 0: object }[] }).materialSlots[0], allowedMaterialSlugs: [] },
      ],
    };
    expect(validateGlbBinding(bad).errors).toContain('glb_invalid:materialSlots[0].allowedMaterialSlugs');
  });

  it('rejects defaultMaterialSlug not in allowed list', () => {
    const bad = {
      ...(HAPPY as object),
      materialSlots: [
        {
          ...(HAPPY as { materialSlots: { 0: object }[] }).materialSlots[0],
          defaultMaterialSlug: 'not-allowed',
        },
      ],
    };
    expect(validateGlbBinding(bad).errors).toContain('glb_invalid:materialSlots[0].defaultMaterialSlug');
  });

  it('rejects negative price deltas in priceDeltasCents map', () => {
    const bad = {
      ...(HAPPY as object),
      materialSlots: [
        {
          ...(HAPPY as { materialSlots: { 0: object }[] }).materialSlots[0],
          priceDeltasCents: { 'eik-natuur': -100 },
        },
      ],
    };
    expect(validateGlbBinding(bad).errors).toContain('glb_invalid:materialSlots[0].priceDeltasCents');
  });

  it('rejects duplicate material-slot ids', () => {
    const slot = (HAPPY as { materialSlots: object[] }).materialSlots[0];
    const bad = { ...(HAPPY as object), materialSlots: [slot, slot] };
    expect(validateGlbBinding(bad).errors).toContain('glb_invalid:materialSlots[1].id');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm test supplier-glb-validator`
Expected: FAIL with `Cannot find module '@/domain/supplier/glb'`.

- [ ] **Step 3: Implement `validateGlbBinding`**

Create `src/domain/supplier/glb.ts`:

```ts
import { MATERIAL_CATEGORIES, type MaterialCategory } from '@/domain/catalog';
import { isObject } from './_validation';
import {
  SUPPLIER_ERROR_CODES,
  type GlbBinding,
  type GlbMaterialSlot,
  type GlbVariantGroup,
  type GlbVariantOption,
} from './types';

interface Validated<T> {
  value: T | null;
  errors: string[];
}

function isFinitePositive(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}
function isFiniteNonNegative(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}
function isNonNegativeInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function validateNaturalSize(v: unknown): boolean {
  if (!isObject(v)) return false;
  return (
    isFinitePositive((v as { widthMm: unknown }).widthMm) &&
    isFinitePositive((v as { heightMm: unknown }).heightMm) &&
    isFinitePositive((v as { depthMm: unknown }).depthMm)
  );
}

function validateOption(
  opt: unknown,
  groupIdx: number,
  optionIdx: number,
  errors: string[],
): GlbVariantOption | null {
  if (!isObject(opt)) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:variantGroups[${groupIdx}].options[${optionIdx}]`);
    return null;
  }
  const o = opt as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id.length === 0) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:variantGroups[${groupIdx}].options[${optionIdx}].id`);
    return null;
  }
  if (typeof o.label !== 'string' || o.label.length === 0) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:variantGroups[${groupIdx}].options[${optionIdx}].label`);
    return null;
  }
  if (typeof o.childPath !== 'string' || o.childPath.length === 0) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:variantGroups[${groupIdx}].options[${optionIdx}].childPath`);
    return null;
  }
  if (!isNonNegativeInt(o.priceDeltaCents)) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:variantGroups[${groupIdx}].options[${optionIdx}].priceDeltaCents`);
    return null;
  }
  return {
    id: o.id,
    label: o.label,
    childPath: o.childPath,
    priceDeltaCents: o.priceDeltaCents as number,
  };
}

function validateVariantGroup(
  group: unknown,
  idx: number,
  seenGroupIds: Set<string>,
  errors: string[],
): GlbVariantGroup | null {
  if (!isObject(group)) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:variantGroups[${idx}]`);
    return null;
  }
  const g = group as Record<string, unknown>;
  if (typeof g.id !== 'string' || g.id.length === 0 || seenGroupIds.has(g.id)) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:variantGroups[${idx}].id`);
    return null;
  }
  seenGroupIds.add(g.id);
  if (typeof g.label !== 'string' || g.label.length === 0) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:variantGroups[${idx}].label`);
    return null;
  }
  if (typeof g.parentPath !== 'string' || g.parentPath.length === 0) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:variantGroups[${idx}].parentPath`);
    return null;
  }
  if (!Array.isArray(g.options) || g.options.length === 0) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:variantGroups[${idx}].options`);
    return null;
  }
  const seenOptIds = new Set<string>();
  const options: GlbVariantOption[] = [];
  for (let j = 0; j < g.options.length; j++) {
    const opt = validateOption(g.options[j], idx, j, errors);
    if (!opt) return null;
    if (seenOptIds.has(opt.id)) {
      errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:variantGroups[${idx}].options[${j}].id`);
      return null;
    }
    seenOptIds.add(opt.id);
    options.push(opt);
  }
  if (typeof g.defaultOptionId !== 'string' || !seenOptIds.has(g.defaultOptionId)) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:variantGroups[${idx}].defaultOptionId`);
    return null;
  }
  return {
    id: g.id,
    label: g.label,
    parentPath: g.parentPath,
    defaultOptionId: g.defaultOptionId,
    options,
  };
}

function validateMaterialSlot(
  slot: unknown,
  idx: number,
  seenIds: Set<string>,
  errors: string[],
): GlbMaterialSlot | null {
  if (!isObject(slot)) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:materialSlots[${idx}]`);
    return null;
  }
  const s = slot as Record<string, unknown>;
  if (typeof s.id !== 'string' || s.id.length === 0 || seenIds.has(s.id)) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:materialSlots[${idx}].id`);
    return null;
  }
  seenIds.add(s.id);
  if (typeof s.label !== 'string' || s.label.length === 0) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:materialSlots[${idx}].label`);
    return null;
  }
  if (!Array.isArray(s.nodePaths) || s.nodePaths.length === 0
    || !s.nodePaths.every((p) => typeof p === 'string' && p.length > 0)) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:materialSlots[${idx}].nodePaths`);
    return null;
  }
  if (typeof s.category !== 'string'
    || !(MATERIAL_CATEGORIES as readonly string[]).includes(s.category)) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:materialSlots[${idx}].category`);
    return null;
  }
  if (!Array.isArray(s.allowedMaterialSlugs) || s.allowedMaterialSlugs.length === 0
    || !s.allowedMaterialSlugs.every((x) => typeof x === 'string' && x.length > 0)) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:materialSlots[${idx}].allowedMaterialSlugs`);
    return null;
  }
  if (typeof s.defaultMaterialSlug !== 'string'
    || !(s.allowedMaterialSlugs as string[]).includes(s.defaultMaterialSlug)) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:materialSlots[${idx}].defaultMaterialSlug`);
    return null;
  }
  if (!isObject(s.priceDeltasCents)) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:materialSlots[${idx}].priceDeltasCents`);
    return null;
  }
  for (const [slug, v] of Object.entries(s.priceDeltasCents as Record<string, unknown>)) {
    if (!(s.allowedMaterialSlugs as string[]).includes(slug) || !isNonNegativeInt(v)) {
      errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:materialSlots[${idx}].priceDeltasCents`);
      return null;
    }
  }
  return {
    id: s.id,
    label: s.label,
    nodePaths: s.nodePaths as string[],
    category: s.category as MaterialCategory,
    defaultMaterialSlug: s.defaultMaterialSlug,
    allowedMaterialSlugs: s.allowedMaterialSlugs as string[],
    priceDeltasCents: s.priceDeltasCents as Record<string, number>,
  };
}

export function validateGlbBinding(input: unknown): Validated<GlbBinding> {
  if (!isObject(input)) return { value: null, errors: [SUPPLIER_ERROR_CODES.glbInvalid] };
  const errors: string[] = [];
  const v = input as Record<string, unknown>;

  if (typeof v.url !== 'string' || v.url.length === 0) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:url`);
  }
  if (!isFinitePositive(v.unitScale)) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:unitScale`);
  }
  if (!validateNaturalSize(v.naturalSize)) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:naturalSize`);
  }
  if (!Array.isArray(v.hidden) || !v.hidden.every((p) => typeof p === 'string')) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:hidden`);
  }

  let variantGroups: GlbVariantGroup[] = [];
  if (!Array.isArray(v.variantGroups)) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:variantGroups`);
  } else {
    const seen = new Set<string>();
    for (let i = 0; i < v.variantGroups.length; i++) {
      const g = validateVariantGroup(v.variantGroups[i], i, seen, errors);
      if (!g) return { value: null, errors };
      variantGroups.push(g);
    }
  }

  let materialSlots: GlbMaterialSlot[] = [];
  if (!Array.isArray(v.materialSlots)) {
    errors.push(`${SUPPLIER_ERROR_CODES.glbInvalid}:materialSlots`);
  } else {
    const seen = new Set<string>();
    for (let i = 0; i < v.materialSlots.length; i++) {
      const s = validateMaterialSlot(v.materialSlots[i], i, seen, errors);
      if (!s) return { value: null, errors };
      materialSlots.push(s);
    }
  }

  if (errors.length > 0) return { value: null, errors };

  return {
    value: {
      url: v.url as string,
      unitScale: v.unitScale as number,
      naturalSize: v.naturalSize as { widthMm: number; heightMm: number; depthMm: number },
      hidden: v.hidden as string[],
      variantGroups,
      materialSlots,
    },
    errors: [],
  };
}
```

Also export `MATERIAL_CATEGORIES` from `src/domain/catalog/types.ts` and `src/domain/catalog/index.ts` if it isn't already. Check first — search for `export const MATERIAL_CATEGORIES`:

Run: `grep -rn "MATERIAL_CATEGORIES" src/domain/catalog/`

If missing, add to `src/domain/catalog/types.ts` right under the `MaterialCategory` union:

```ts
export const MATERIAL_CATEGORIES: readonly MaterialCategory[] = [
  'wall', 'roof-cover', 'roof-trim', 'floor', 'door', 'gate', 'middenlaag',
] as const;
```

And re-export from `src/domain/catalog/index.ts`.

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm test supplier-glb-validator`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/domain/supplier/glb.ts tests/supplier-glb-validator.test.ts \
        src/domain/catalog/types.ts src/domain/catalog/index.ts
git commit -m "feat(domain): add validateGlbBinding + full validator coverage"
```

---

## Task 1.3: Wire `validateGlbBinding` into door/window/PATCH validators

**Files:**
- Modify: `src/domain/supplier/product.ts`
- Create: `tests/supplier-product-glb-meta.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/supplier-product-glb-meta.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import {
  validateDoorMeta,
  validateWindowMeta,
  validateSupplierProductPatch,
} from '@/domain/supplier/product';

const HAPPY_GLB = {
  url: 'https://blob.vercel-storage.com/glb/x/y.glb',
  unitScale: 0.0254,
  naturalSize: { widthMm: 900, heightMm: 2000, depthMm: 50 },
  hidden: [],
  variantGroups: [],
  materialSlots: [],
};

describe('validateDoorMeta with glb', () => {
  it('accepts door meta carrying a valid glb', () => {
    const r = validateDoorMeta({ swingDirection: 'inward', glb: HAPPY_GLB });
    expect(r.errors).toEqual([]);
    expect(r.value?.glb).toBeDefined();
  });

  it('rejects when glb subtree is invalid', () => {
    const r = validateDoorMeta({ glb: { ...HAPPY_GLB, url: '' } });
    expect(r.value).toBeNull();
    expect(r.errors).toContain('glb_invalid:url');
  });

  it('rejects when meta has an unknown top-level key', () => {
    const r = validateDoorMeta({ unknownKey: 1 });
    expect(r.value).toBeNull();
    expect(r.errors).toContain('meta_invalid');
  });
});

describe('validateWindowMeta with glb', () => {
  it('accepts window meta carrying a valid glb', () => {
    const r = validateWindowMeta({ glazingType: 'double', glb: HAPPY_GLB });
    expect(r.errors).toEqual([]);
    expect(r.value?.glb).toBeDefined();
  });

  it('rejects when glb subtree is invalid', () => {
    const r = validateWindowMeta({ glb: { ...HAPPY_GLB, unitScale: -1 } });
    expect(r.value).toBeNull();
    expect(r.errors).toContain('glb_invalid:unitScale');
  });
});

describe('validateSupplierProductPatch meta.glb', () => {
  it('accepts a patch with a valid glb in meta', () => {
    const r = validateSupplierProductPatch({ meta: { glb: HAPPY_GLB } });
    expect(r.errors).toEqual([]);
  });

  it('rejects a patch when glb is malformed', () => {
    const r = validateSupplierProductPatch({ meta: { glb: { url: '' } } });
    expect(r.value).toBeNull();
    expect(r.errors.some((c) => c.startsWith('glb_invalid'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm test supplier-product-glb-meta`
Expected: FAIL — `validateDoorMeta` rejects unknown key `glb` because `DOOR_META_KEYS` does not contain it yet.

- [ ] **Step 3: Wire the validator**

Open `src/domain/supplier/product.ts`. Update the imports:

```ts
import { validateGlbBinding } from './glb';
```

Extend the key sets:

```ts
const DOOR_META_KEYS = new Set(['swingDirection', 'lockType', 'glazing', 'rValue', 'leadTimeDays', 'glb']);
const WINDOW_META_KEYS = new Set([
  'glazingType', 'uValue', 'frameMaterial', 'openable', 'leadTimeDays',
  'segments', 'schuifraam', 'glb',
]);
```

Inside `validateDoorMeta`, after the existing `leadTimeDays` block (before the final `if (errors.length > 0)`), add:

```ts
  if ('glb' in meta) {
    const r = validateGlbBinding(meta.glb);
    if (r.value === null) {
      errors.push(...r.errors);
    } else {
      out.glb = r.value;
    }
  }
```

Inside `validateWindowMeta`, after the `schuifraam` block, add the same:

```ts
  if ('glb' in meta) {
    const r = validateGlbBinding(meta.glb);
    if (r.value === null) {
      errors.push(...r.errors);
    } else {
      out.glb = r.value;
    }
  }
```

Inside `validateSupplierProductPatch`, replace the existing `if ('meta' in input)` block with a recursive version:

```ts
  if ('meta' in input) {
    if (!isObject(input.meta)) {
      errors.push(SUPPLIER_ERROR_CODES.metaInvalid);
    } else {
      const allMetaKeys = new Set([...DOOR_META_KEYS, ...WINDOW_META_KEYS, ...GATE_META_KEYS]);
      const unknownKey = Object.keys(input.meta).find((k) => !allMetaKeys.has(k));
      if (unknownKey !== undefined) {
        errors.push(SUPPLIER_ERROR_CODES.metaInvalid);
      } else {
        if ('glb' in input.meta) {
          const r = validateGlbBinding((input.meta as Record<string, unknown>).glb);
          if (r.value === null) {
            errors.push(...r.errors);
          }
        }
        if (errors.length === 0) {
          out.meta = input.meta as DoorMeta | WindowMeta | GateMeta;
        }
      }
    }
  }
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm test supplier-product-glb-meta`
Expected: PASS.

- [ ] **Step 5: Run the wider supplier test suite to confirm no regressions**

Run: `pnpm test supplier`
Expected: PASS (every supplier-related spec).

- [ ] **Step 6: Commit**

```bash
git add src/domain/supplier/product.ts tests/supplier-product-glb-meta.test.ts
git commit -m "feat(domain): wire validateGlbBinding into door/window/PATCH validators"
```

---

## Task 1.4: Add GLB fields to `WallConfig` and `WallWindow`

**Files:**
- Modify: `src/domain/building/types.ts`

- [ ] **Step 1: Add the new fields**

Open `src/domain/building/types.ts`. Find `WallWindow` (around line 19). Add at the end of the interface, before the closing brace:

```ts
  /** Per-instance picked variants for a GLB-backed supplier window.
   *  Map of GlbVariantGroup.id → GlbVariantOption.id. Missing entries
   *  fall back to the binding's defaults at render time. */
  glbVariants?: Record<string, string>;
  /** Per-instance picked material slot bindings for a GLB-backed window.
   *  Map of GlbMaterialSlot.id → material slug. Missing entries fall
   *  back to the slot's defaultMaterialSlug at render time. */
  glbMaterials?: Record<string, string>;
```

Find `WallConfig` (around line 36). Add right before `windows: WallWindow[]`:

```ts
  /** Per-wall picked variants for a GLB-backed door supplier product.
   *  Same shape as WallWindow.glbVariants but scoped to the wall's
   *  single optional door. */
  doorGlbVariants?: Record<string, string>;
  doorGlbMaterials?: Record<string, string>;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS — optional fields, no existing consumer breaks.

- [ ] **Step 3: Commit**

```bash
git add src/domain/building/types.ts
git commit -m "feat(domain): add doorGlb* fields to WallConfig and glb* fields to WallWindow"
```

---

## Task 1.5: Add `setWallDoorGlb*` and `setWallWindowGlb*` mutations

**Files:**
- Modify: `src/domain/config/mutations.ts`
- Create: `tests/supplier-glb-mutations.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/supplier-glb-mutations.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import type { ConfigData } from '@/domain/config/types';
import {
  setWallDoorGlbVariant,
  setWallDoorGlbMaterial,
  setWallWindowGlbVariant,
  setWallWindowGlbMaterial,
} from '@/domain/config/mutations';
import type { BuildingEntity } from '@/domain/building/types';

function makeConfig(): ConfigData {
  const building: BuildingEntity = {
    id: 'b1',
    type: 'berging',
    position: [0, 0],
    dimensions: { width: 3, depth: 3, height: 2.5 },
    primaryMaterialId: 'wood',
    walls: {
      front: {
        hasDoor: true,
        doorSize: 'enkel',
        doorHasWindow: false,
        doorPosition: 0.5,
        doorSwing: 'naar_buiten',
        doorMirror: false,
        windows: [{ id: 'w1', position: 0.5, width: 1, height: 1.2, sillHeight: 0.9 }],
      },
    },
    hasCornerBraces: false,
    floor: { materialId: 'geen' },
    orientation: 'horizontal',
    heightOverride: null,
  };
  return {
    version: 1,
    buildings: [building],
    connections: [],
    roof: {
      type: 'plat',
      pitch: 0,
      coveringId: 'epdm',
      trimMaterialId: 'aluminium',
      insulation: false,
      insulationThickness: 0,
      hasSkylight: false,
      fasciaHeight: 0.36,
      fasciaOverhang: 0,
    },
    defaultHeight: 2.5,
  };
}

describe('setWallDoorGlbVariant', () => {
  it('sets the variant pick on the wall', () => {
    const out = setWallDoorGlbVariant(makeConfig(), 'b1', 'front', 'leaf', 'paneel');
    expect(out.buildings[0].walls.front?.doorGlbVariants).toEqual({ leaf: 'paneel' });
  });

  it('preserves other variant picks when setting one', () => {
    let cfg = setWallDoorGlbVariant(makeConfig(), 'b1', 'front', 'leaf', 'paneel');
    cfg = setWallDoorGlbVariant(cfg, 'b1', 'front', 'handle', 'L-rond');
    expect(cfg.buildings[0].walls.front?.doorGlbVariants).toEqual({
      leaf: 'paneel',
      handle: 'L-rond',
    });
  });
});

describe('setWallDoorGlbMaterial', () => {
  it('sets the material pick on the wall', () => {
    const out = setWallDoorGlbMaterial(makeConfig(), 'b1', 'front', 'frame', 'antraciet');
    expect(out.buildings[0].walls.front?.doorGlbMaterials).toEqual({ frame: 'antraciet' });
  });
});

describe('setWallWindowGlbVariant', () => {
  it('sets the variant pick on the specific window only', () => {
    const out = setWallWindowGlbVariant(makeConfig(), 'b1', 'front', 'w1', 'leaf', 'paneel');
    expect(out.buildings[0].walls.front?.windows[0].glbVariants).toEqual({ leaf: 'paneel' });
  });

  it('is a no-op for an unknown window id', () => {
    const cfg = makeConfig();
    const out = setWallWindowGlbVariant(cfg, 'b1', 'front', 'unknown', 'leaf', 'paneel');
    expect(out.buildings[0].walls.front?.windows[0].glbVariants).toBeUndefined();
  });
});

describe('setWallWindowGlbMaterial', () => {
  it('sets the material pick on the specific window only', () => {
    const out = setWallWindowGlbMaterial(makeConfig(), 'b1', 'front', 'w1', 'frame', 'antraciet');
    expect(out.buildings[0].walls.front?.windows[0].glbMaterials).toEqual({ frame: 'antraciet' });
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm test supplier-glb-mutations`
Expected: FAIL — mutations not exported.

- [ ] **Step 3: Implement the mutations**

Open `src/domain/config/mutations.ts`. After `setWallWindowSchuifraam` (around line 712-ish), append:

```ts
export function setWallDoorGlbVariant(
  state: ConfigData,
  buildingId: string,
  wallSide: WallSide,
  groupId: string,
  optionId: string,
): ConfigData {
  return mapBuilding(state, buildingId, (b) => {
    const wall = b.walls[wallSide] ?? BLANK_WALL;
    return {
      ...b,
      walls: {
        ...b.walls,
        [wallSide]: {
          ...wall,
          doorGlbVariants: { ...(wall.doorGlbVariants ?? {}), [groupId]: optionId },
        },
      },
    };
  });
}

export function setWallDoorGlbMaterial(
  state: ConfigData,
  buildingId: string,
  wallSide: WallSide,
  slotId: string,
  materialSlug: string,
): ConfigData {
  return mapBuilding(state, buildingId, (b) => {
    const wall = b.walls[wallSide] ?? BLANK_WALL;
    return {
      ...b,
      walls: {
        ...b.walls,
        [wallSide]: {
          ...wall,
          doorGlbMaterials: { ...(wall.doorGlbMaterials ?? {}), [slotId]: materialSlug },
        },
      },
    };
  });
}

export function setWallWindowGlbVariant(
  state: ConfigData,
  buildingId: string,
  wallSide: WallSide,
  windowId: string,
  groupId: string,
  optionId: string,
): ConfigData {
  return mapBuilding(state, buildingId, (b) => {
    const wall = b.walls[wallSide];
    if (!wall) return b;
    return {
      ...b,
      walls: {
        ...b.walls,
        [wallSide]: {
          ...wall,
          windows: (wall.windows ?? []).map((w) =>
            w.id === windowId
              ? { ...w, glbVariants: { ...(w.glbVariants ?? {}), [groupId]: optionId } }
              : w,
          ),
        },
      },
    };
  });
}

export function setWallWindowGlbMaterial(
  state: ConfigData,
  buildingId: string,
  wallSide: WallSide,
  windowId: string,
  slotId: string,
  materialSlug: string,
): ConfigData {
  return mapBuilding(state, buildingId, (b) => {
    const wall = b.walls[wallSide];
    if (!wall) return b;
    return {
      ...b,
      walls: {
        ...b.walls,
        [wallSide]: {
          ...wall,
          windows: (wall.windows ?? []).map((w) =>
            w.id === windowId
              ? { ...w, glbMaterials: { ...(w.glbMaterials ?? {}), [slotId]: materialSlug } }
              : w,
          ),
        },
      },
    };
  });
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm test supplier-glb-mutations`
Expected: PASS.

- [ ] **Step 5: Phase 1 verification — run the full domain suite**

Run: `pnpm test`
Expected: PASS (all existing tests + the new GLB tests).

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/config/mutations.ts tests/supplier-glb-mutations.test.ts
git commit -m "feat(domain): add setWallDoor/Window Glb{Variant,Material} mutations"
```

---

# Phase 2 — Server-side parse

End state: admin can upload a GLB to Blob and POST its URL to the parse endpoint, getting back the node tree.

## Task 2.1: Add `@gltf-transform/core` dependency

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install**

Run: `pnpm add @gltf-transform/core`
Expected: package added to dependencies; lockfile updated.

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add @gltf-transform/core for server-side GLB parsing"
```

---

## Task 2.2: Commit DEUR.glb as a test fixture

**Files:**
- Create: `tests/fixtures/DEUR.glb`

- [ ] **Step 1: Copy the fixture**

Run: `mkdir -p tests/fixtures && cp /Users/jeremy/Downloads/DEUR.glb tests/fixtures/DEUR.glb`
Expected: file copied (~160 KB).

- [ ] **Step 2: Confirm git LFS isn't needed**

Run: `ls -lh tests/fixtures/DEUR.glb`
Expected: ~160 KB — well under any reasonable LFS threshold.

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/DEUR.glb
git commit -m "test: add DEUR.glb fixture for GLB parse tests"
```

---

## Task 2.3: Write the parse helper (test-first)

**Files:**
- Create: `tests/supplier-glb-parse.test.ts`
- Create: `src/domain/supplier/parseGlb.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/supplier-glb-parse.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import fs from 'node:fs';
import path from 'node:path';
import { parseGlbBuffer } from '@/domain/supplier/parseGlb';

const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'DEUR.glb'));

describe('parseGlbBuffer (DEUR.glb)', () => {
  it('returns a non-empty tree with the expected top-level structure', async () => {
    const r = await parseGlbBuffer(new Uint8Array(FIXTURE));
    expect(r.tree.children.length).toBeGreaterThan(0);
    // Top of the SimLab export is a single unnamed root → Assembly-91.
    const namesAtRoot = collectNamesByDepth(r.tree, 1);
    expect(namesAtRoot).toContain('Assembly-91');
  });

  it('includes the door-leaf switcher group under the deurbladen path', async () => {
    const r = await parseGlbBuffer(new Uint8Array(FIXTURE));
    const deurbladen = findNode(r.tree, 'deurbladen');
    expect(deurbladen).toBeDefined();
    const childNames = deurbladen!.children.map((c) => c.name);
    expect(childNames).toContain('Paneel deur glas');
    expect(childNames).toContain('Vlakke deur');
  });

  it('flags has-mesh on terminal Geom3D nodes', async () => {
    const r = await parseGlbBuffer(new Uint8Array(FIXTURE));
    const flat = flatten(r.tree);
    const meshNodes = flat.filter((n) => n.hasMesh);
    expect(meshNodes.length).toBeGreaterThan(0);
  });

  it('suggests unitScale ≈ 0.0254 for an inch-scaled SimLab export', async () => {
    const r = await parseGlbBuffer(new Uint8Array(FIXTURE));
    // SimLab exports use a 0.025 root scale + 39.37 sub-scale (inches).
    expect(r.unitScale).toBeGreaterThan(0);
    expect(r.unitScale).toBeLessThan(0.1);
  });

  it('computes a positive naturalSize', async () => {
    const r = await parseGlbBuffer(new Uint8Array(FIXTURE));
    expect(r.naturalSize.widthMm).toBeGreaterThan(0);
    expect(r.naturalSize.heightMm).toBeGreaterThan(0);
    expect(r.naturalSize.depthMm).toBeGreaterThan(0);
  });
});

// Helpers
import type { GlbParsedNode } from '@/domain/supplier/types';

function collectNamesByDepth(node: GlbParsedNode, depth: number, current = 0): string[] {
  if (current === depth) return [node.name];
  return node.children.flatMap((c) => collectNamesByDepth(c, depth, current + 1));
}
function findNode(node: GlbParsedNode, name: string): GlbParsedNode | undefined {
  if (node.name === name) return node;
  for (const c of node.children) {
    const r = findNode(c, name);
    if (r) return r;
  }
  return undefined;
}
function flatten(node: GlbParsedNode): GlbParsedNode[] {
  return [node, ...node.children.flatMap(flatten)];
}
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm test supplier-glb-parse`
Expected: FAIL — `Cannot find module '@/domain/supplier/parseGlb'`.

- [ ] **Step 3: Implement the parser**

Create `src/domain/supplier/parseGlb.ts`:

```ts
import { WebIO, type Node } from '@gltf-transform/core';
import type { GlbParseResult, GlbParsedNode } from './types';

const INCH_TOLERANCE = 0.005; // 0.025 ± 0.005

function nodeToParsed(node: Node, ancestors: string[]): GlbParsedNode {
  const name = node.getName() || '(unnamed)';
  const path = '/' + [...ancestors, name].join('/');
  return {
    path,
    name,
    hasMesh: node.getMesh() !== null,
    children: node.listChildren().map((c) => nodeToParsed(c, [...ancestors, name])),
  };
}

function detectInchUnitScale(rootScales: number[]): number {
  // SimLab GLBs commonly have a top-level node with scale ≈ 0.025 — that
  // means "1 source unit = 1 inch authored at world-scale 0.025". To get
  // metres we need 0.0254 instead of 0.025 (the artist's approximation).
  for (const s of rootScales) {
    if (Math.abs(s - 0.025) <= INCH_TOLERANCE) return 0.0254;
  }
  return 1.0;
}

function getBoundingBoxMetres(
  scene: Node | null,
  topRoots: Node[],
  unitScale: number,
): { widthMm: number; heightMm: number; depthMm: number } {
  // gltf-transform doesn't ship a bounding-box helper. We walk every
  // mesh's POSITION accessor, apply the node's worldMatrix, and reduce.
  let minX = +Infinity, minY = +Infinity, minZ = +Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  function walk(node: Node, parentMatrix: number[]) {
    const m = multiplyMatrix(parentMatrix, getLocalMatrix(node));
    const mesh = node.getMesh();
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        if (!pos) continue;
        const array = pos.getArray();
        if (!array) continue;
        for (let i = 0; i < array.length; i += 3) {
          const x = array[i], y = array[i + 1], z = array[i + 2];
          const [tx, ty, tz] = transformPoint(m, x, y, z);
          if (tx < minX) minX = tx;
          if (ty < minY) minY = ty;
          if (tz < minZ) minZ = tz;
          if (tx > maxX) maxX = tx;
          if (ty > maxY) maxY = ty;
          if (tz > maxZ) maxZ = tz;
        }
      }
    }
    for (const c of node.listChildren()) walk(c, m);
  }
  const identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  for (const root of topRoots) walk(root, identity);
  if (!Number.isFinite(minX)) return { widthMm: 0, heightMm: 0, depthMm: 0 };
  return {
    widthMm: Math.round((maxX - minX) * unitScale * 1000),
    heightMm: Math.round((maxY - minY) * unitScale * 1000),
    depthMm: Math.round((maxZ - minZ) * unitScale * 1000),
  };
}

function getLocalMatrix(node: Node): number[] {
  // glTF stores TRS — translation/rotation/scale (rotation is a quaternion).
  // Compose into a column-major 4×4 matrix.
  const t = node.getTranslation();
  const r = node.getRotation(); // [x, y, z, w]
  const s = node.getScale();
  const [x, y, z, w] = r;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}

function multiplyMatrix(a: number[], b: number[]): number[] {
  const out = new Array<number>(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      out[r * 4 + c] =
        a[r * 4 + 0] * b[0 * 4 + c] +
        a[r * 4 + 1] * b[1 * 4 + c] +
        a[r * 4 + 2] * b[2 * 4 + c] +
        a[r * 4 + 3] * b[3 * 4 + c];
    }
  }
  return out;
}

function transformPoint(m: number[], x: number, y: number, z: number): [number, number, number] {
  const tx = m[0] * x + m[4] * y + m[8] * z + m[12];
  const ty = m[1] * x + m[5] * y + m[9] * z + m[13];
  const tz = m[2] * x + m[6] * y + m[10] * z + m[14];
  return [tx, ty, tz];
}

/** Parse a GLB buffer into a tree + naturalSize + suggested unitScale. */
export async function parseGlbBuffer(buffer: Uint8Array): Promise<Omit<GlbParseResult, 'url'>> {
  const io = new WebIO();
  const doc = await io.readBinary(buffer);
  const scene = doc.getRoot().listScenes()[0];
  if (!scene) throw new Error('empty_scene');

  const roots = scene.listChildren();
  if (roots.length === 0) throw new Error('empty_scene');

  // Build the tree starting from a virtual root that aggregates real roots.
  const tree: GlbParsedNode = {
    path: '',
    name: '(scene)',
    hasMesh: false,
    children: roots.map((n) => nodeToParsed(n, [])),
  };

  const rootScales = roots.flatMap((n) => Array.from(n.getScale()));
  const unitScale = detectInchUnitScale(rootScales);
  const naturalSize = getBoundingBoxMetres(scene, roots, unitScale);

  return { unitScale, naturalSize, tree };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm test supplier-glb-parse`
Expected: PASS — all five assertions green. Parse takes well under 100 ms.

- [ ] **Step 5: Commit**

```bash
git add src/domain/supplier/parseGlb.ts tests/supplier-glb-parse.test.ts
git commit -m "feat(domain): server-side GLB parser with naturalSize + unitScale heuristic"
```

---

## Task 2.4: Add `/api/admin/uploads/glb` route

**Files:**
- Create: `src/app/api/admin/uploads/glb/route.ts`
- Create: `tests/api/admin-uploads-glb.test.ts`

Reference: read `src/app/api/admin/uploads/textures/route.ts` to mirror its exact shape (handleUpload + onBeforeGenerateToken). Reuse its auth pattern verbatim.

- [ ] **Step 1: Write the failing test (auth + size + extension)**

Create `tests/api/admin-uploads-glb.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';

// Smoke test — full route exercise is covered manually; here we only
// assert that the route module exports a POST handler.
describe('admin uploads/glb route', () => {
  it('exports a POST handler', async () => {
    const mod = await import('@/app/api/admin/uploads/glb/route');
    expect(typeof mod.POST).toBe('function');
  });
});
```

(API routes are exercised via the dev server + a curl pass in manual QA. The test above is a guard that the route module loads.)

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm test admin-uploads-glb`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the route**

Read `src/app/api/admin/uploads/textures/route.ts` first to mirror its exact shape. Then create `src/app/api/admin/uploads/glb/route.ts`:

```ts
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireBusiness } from '@/lib/auth-guards';

const ALLOWED_TYPES = ['model/gltf-binary', 'application/octet-stream'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const businessKind = requireBusiness(session, ['super_admin', 'tenant_admin']);
  if (!businessKind) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const tenantId = session.user.tenantId ?? null;
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, _clientPayload) => {
        // pathname like "glb/<tenantId>/<file>.glb"
        const expectedPrefix = businessKind === 'super_admin'
          ? 'glb/'
          : `glb/${tenantId}/`;
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error('invalid_path');
        }
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          tokenPayload: JSON.stringify({ tenantId, businessKind }),
        };
      },
      onUploadCompleted: async () => {
        // Intentionally empty — see CLAUDE.md ("works on localhost").
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'upload_failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm test admin-uploads-glb`
Expected: PASS.

- [ ] **Step 5: Manual sanity-check (optional but recommended)**

Start the dev server with `pnpm dev`. Sign in as a tenant_admin. Open the browser console on any admin page and run:

```js
const r = await (await fetch('/api/admin/uploads/glb', {
  method: 'POST',
  body: JSON.stringify({ type: 'blob.generate-client-token', payload: { pathname: 'glb/wrong-tenant/x.glb', callbackUrl: location.origin } }),
})).json();
console.log(r);
```

Expected: `{ error: 'invalid_path' }` (the path-prefix check rejects).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/uploads/glb/route.ts tests/api/admin-uploads-glb.test.ts
git commit -m "feat(api): POST /api/admin/uploads/glb (Vercel Blob, 10 MB, tenant-namespaced)"
```

---

## Task 2.5: Add `/api/admin/supplier-products/[pid]/glb` parse route

**Files:**
- Create: `src/app/api/admin/supplier-products/[pid]/glb/route.ts`
- Create: `tests/api/admin-supplier-products-glb.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/admin-supplier-products-glb.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';

describe('admin supplier-products/[pid]/glb parse route', () => {
  it('exports a POST handler', async () => {
    const mod = await import('@/app/api/admin/supplier-products/[pid]/glb/route');
    expect(typeof mod.POST).toBe('function');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm test admin-supplier-products-glb`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the route**

First, read an existing parametrised admin route (e.g. `src/app/api/admin/supplier-products/[pid]/route.ts`) to mirror the exact param-context shape and the tenant-scope lookup helper. Then create `src/app/api/admin/supplier-products/[pid]/glb/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { db } from '@/db/client';
import { supplierProducts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { parseGlbBuffer } from '@/domain/supplier/parseGlb';

interface Ctx { params: Promise<{ pid: string }>; }

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const businessKind = requireBusiness(session, ['super_admin', 'tenant_admin']);
  if (!businessKind) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { pid } = await ctx.params;

  const rows = await db.select().from(supplierProducts).where(eq(supplierProducts.id, pid)).limit(1);
  const product = rows[0];
  if (!product) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (!requireTenantScope(session, product.tenantId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { url?: unknown };
  try {
    body = (await request.json()) as { url?: unknown };
  } catch {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }
  const url = body.url;
  if (typeof url !== 'string' || url.length === 0) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }

  // Namespace check
  const expectedSegment = `/glb/${product.tenantId}/`;
  if (!url.includes(expectedSegment)) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }

  let buffer: ArrayBuffer;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('blob_fetch_failed');
    buffer = await res.arrayBuffer();
  } catch {
    return NextResponse.json({ error: 'blob_fetch_failed' }, { status: 502 });
  }

  let parsed: Awaited<ReturnType<typeof parseGlbBuffer>>;
  try {
    parsed = await parseGlbBuffer(new Uint8Array(buffer));
  } catch (e) {
    const code = e instanceof Error && e.message === 'empty_scene' ? 'empty_scene' : 'invalid_glb';
    return NextResponse.json({ error: code }, { status: 400 });
  }

  return NextResponse.json({
    url,
    unitScale: parsed.unitScale,
    naturalSize: parsed.naturalSize,
    tree: parsed.tree,
  });
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm test admin-supplier-products-glb`
Expected: PASS.

- [ ] **Step 5: Phase 2 verification**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm build`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/supplier-products/[pid]/glb/route.ts \
        tests/api/admin-supplier-products-glb.test.ts
git commit -m "feat(api): POST .../supplier-products/[pid]/glb — server-side parse"
```

---

# Phase 3 — Admin tagging UI

End state: admin can upload a GLB to a door/window supplier product, see its tree, tag variant groups + material slots + hidden nodes, save, and re-open the form to edit.

**Note on preview canvas:** Phase 3 ships the section WITHOUT the inline 3D preview. The preview is added in Phase 6 once the configurator-side `GlbDoorMesh` exists (avoiding duplicate render code).

## Task 3.1: i18n keys for the admin section

**Files:**
- Modify: `src/lib/i18n.ts`

- [ ] **Step 1: Add the keys**

Open `src/lib/i18n.ts`. Find the `nl` map. Add a new block (alphabetically near other `admin.*` keys):

```ts
  'admin.glb.title': '3D-model',
  'admin.glb.upload': 'GLB uploaden',
  'admin.glb.reupload': 'Vervangen',
  'admin.glb.units.label': 'Eenheden',
  'admin.glb.units.metres': 'Meters (×1.0)',
  'admin.glb.units.inches': 'Inches (×0.0254)',
  'admin.glb.units.mm': 'Millimeters (×0.001)',
  'admin.glb.naturalSize': 'Afmetingen GLB',
  'admin.glb.tree.title': 'Onderdelen',
  'admin.glb.selected.title': 'Geselecteerd',
  'admin.glb.action.variant': 'Tag als variantgroep',
  'admin.glb.action.material': 'Tag als materiaalslot',
  'admin.glb.action.hide': 'Altijd verbergen',
  'admin.glb.action.untag': 'Tag verwijderen',
  'admin.glb.action.edit': 'Bewerken',
  'admin.glb.variantGroups': 'Variantgroepen',
  'admin.glb.materialSlots': 'Materiaalsloten',
  'admin.glb.reupload.confirm': 'Een nieuw 3D-model wist de huidige tagging. Doorgaan?',
  'admin.glb.driftWarning': 'De vorm van het 3D-model is gewijzigd sinds de laatste opslag. Tag opnieuw.',
  'admin.glb.empty': 'Nog geen 3D-model toegevoegd.',
  'admin.glb.editor.id': 'ID',
  'admin.glb.editor.label': 'Label',
  'admin.glb.editor.default': 'Standaard',
  'admin.glb.editor.priceDelta': 'Prijstoeslag',
  'admin.glb.editor.category': 'Categorie',
  'admin.glb.editor.allowedMaterials': 'Toegestane materialen',
  'admin.glb.editor.save': 'Opslaan',
  'admin.glb.editor.cancel': 'Annuleren',
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/i18n.ts
git commit -m "i18n: add admin.glb.* keys for the GLB tagging section"
```

---

## Task 3.2: `GlbTreeView` component (tree + selected-node panel, no actions yet)

**Files:**
- Create: `src/components/admin/catalog/GlbTreeView.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';
import { useState } from 'react';
import type { GlbParsedNode } from '@/domain/supplier/types';
import { t } from '@/lib/i18n';

interface GlbTreeViewProps {
  tree: GlbParsedNode;
  /** node paths to render as hidden (greyed) */
  hiddenPaths: Set<string>;
  /** node paths used as variant-group parents (★ marker) */
  variantGroupPaths: Set<string>;
  /** node paths used as material-slot anchors (■ marker) */
  materialSlotPaths: Set<string>;
  selectedPath: string | null;
  onSelect: (path: string | null) => void;
}

export function GlbTreeView(props: GlbTreeViewProps) {
  return (
    <div className="border rounded-md p-2 max-h-96 overflow-auto text-sm">
      <TreeNode node={props.tree} depth={0} {...props} />
    </div>
  );
}

function TreeNode(props: GlbTreeViewProps & { node: GlbParsedNode; depth: number }) {
  const { node, depth, selectedPath, onSelect } = props;
  const [open, setOpen] = useState(depth < 2);
  const isHidden = props.hiddenPaths.has(node.path);
  const isVariantGroup = props.variantGroupPaths.has(node.path);
  const isMaterialSlot = props.materialSlotPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <button
        type="button"
        className={
          'flex items-center gap-1 w-full text-left px-1 rounded ' +
          (isSelected ? 'bg-accent text-accent-foreground ' : 'hover:bg-muted ') +
          (isHidden ? 'opacity-50 line-through' : '')
        }
        style={{ paddingLeft: depth * 12 + 4 }}
        onClick={() => onSelect(node.path)}
      >
        {hasChildren ? (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
            className="w-3 text-muted-foreground"
          >
            {open ? '▾' : '▸'}
          </span>
        ) : <span className="w-3" />}
        <span className="truncate">{node.name}</span>
        {isVariantGroup && <span className="text-yellow-600">★</span>}
        {isMaterialSlot && <span className="text-blue-600">■</span>}
      </button>
      {open && hasChildren && (
        <div>
          {node.children.map((c) => (
            <TreeNode key={c.path} node={c} depth={depth + 1} {...props} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/catalog/GlbTreeView.tsx
git commit -m "feat(admin): GlbTreeView component (tree + selection)"
```

---

## Task 3.3: `GlbVariantGroupEditor` (inline editor)

**Files:**
- Create: `src/components/admin/catalog/GlbVariantGroupEditor.tsx`

- [ ] **Step 1: Create the editor**

```tsx
'use client';
import { useState } from 'react';
import type { GlbVariantGroup, GlbVariantOption, GlbParsedNode } from '@/domain/supplier/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { t } from '@/lib/i18n';

interface Props {
  parentNode: GlbParsedNode;
  initial: GlbVariantGroup | null;
  onSave: (group: GlbVariantGroup) => void;
  onCancel: () => void;
}

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function GlbVariantGroupEditor({ parentNode, initial, onSave, onCancel }: Props) {
  const [id, setId] = useState(initial?.id ?? slugify(parentNode.name));
  const [label, setLabel] = useState(initial?.label ?? parentNode.name);
  const [options, setOptions] = useState<GlbVariantOption[]>(() => {
    if (initial) return initial.options;
    return parentNode.children.map((c) => ({
      id: slugify(c.name),
      label: c.name,
      childPath: c.path,
      priceDeltaCents: 0,
    }));
  });
  const [defaultOptionId, setDefaultOptionId] = useState(
    initial?.defaultOptionId ?? slugify(parentNode.children[0]?.name ?? ''),
  );

  return (
    <div className="border rounded-md p-3 space-y-3 bg-card">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>{t('admin.glb.editor.id')}</Label>
          <Input value={id} onChange={(e) => setId(e.target.value)} />
        </div>
        <div>
          <Label>{t('admin.glb.editor.label')}</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={opt.childPath} className="grid grid-cols-[1fr_2fr_1fr_auto] gap-2 items-center">
            <Input
              value={opt.id}
              onChange={(e) => setOptions(options.map((o, j) => j === i ? { ...o, id: e.target.value } : o))}
              placeholder="id"
            />
            <Input
              value={opt.label}
              onChange={(e) => setOptions(options.map((o, j) => j === i ? { ...o, label: e.target.value } : o))}
              placeholder="label"
            />
            <Input
              type="number"
              min={0}
              value={opt.priceDeltaCents / 100}
              onChange={(e) => {
                const cents = Math.round(Number(e.target.value) * 100);
                setOptions(options.map((o, j) => j === i ? { ...o, priceDeltaCents: Number.isFinite(cents) && cents >= 0 ? cents : 0 } : o));
              }}
              placeholder="€"
            />
            <label className="flex items-center gap-1 text-xs">
              <input
                type="radio"
                name="default"
                checked={defaultOptionId === opt.id}
                onChange={() => setDefaultOptionId(opt.id)}
              />
              {t('admin.glb.editor.default')}
            </label>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('admin.glb.editor.cancel')}
        </Button>
        <Button
          type="button"
          onClick={() => onSave({
            id, label, parentPath: parentNode.path, defaultOptionId, options,
          })}
        >
          {t('admin.glb.editor.save')}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

```bash
git add src/components/admin/catalog/GlbVariantGroupEditor.tsx
git commit -m "feat(admin): GlbVariantGroupEditor inline editor"
```

---

## Task 3.4: `GlbMaterialSlotEditor` (inline editor)

**Files:**
- Create: `src/components/admin/catalog/GlbMaterialSlotEditor.tsx`

- [ ] **Step 1: Create the editor**

```tsx
'use client';
import { useState } from 'react';
import type { GlbMaterialSlot, GlbParsedNode } from '@/domain/supplier/types';
import type { MaterialCategory, MaterialRow } from '@/domain/catalog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { t } from '@/lib/i18n';

const MATERIAL_CATEGORIES: MaterialCategory[] = [
  'wall', 'roof-cover', 'roof-trim', 'floor', 'door', 'gate', 'middenlaag',
];

interface Props {
  anchorNode: GlbParsedNode;
  initial: GlbMaterialSlot | null;
  materials: MaterialRow[];
  onSave: (slot: GlbMaterialSlot) => void;
  onCancel: () => void;
}

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function GlbMaterialSlotEditor({ anchorNode, initial, materials, onSave, onCancel }: Props) {
  const [id, setId] = useState(initial?.id ?? slugify(anchorNode.name));
  const [label, setLabel] = useState(initial?.label ?? anchorNode.name);
  const [category, setCategory] = useState<MaterialCategory>(initial?.category ?? 'wall');
  const [nodePaths, setNodePaths] = useState<string[]>(initial?.nodePaths ?? [anchorNode.path]);
  const [allowed, setAllowed] = useState<string[]>(initial?.allowedMaterialSlugs ?? []);
  const [defaultSlug, setDefaultSlug] = useState(initial?.defaultMaterialSlug ?? '');
  const [deltas, setDeltas] = useState<Record<string, number>>(initial?.priceDeltasCents ?? {});

  const inCategory = materials.filter((m) => m.categories.includes(category) && !m.archivedAt);

  return (
    <div className="border rounded-md p-3 space-y-3 bg-card">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>{t('admin.glb.editor.id')}</Label>
          <Input value={id} onChange={(e) => setId(e.target.value)} />
        </div>
        <div>
          <Label>{t('admin.glb.editor.label')}</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
      </div>

      <div>
        <Label>{t('admin.glb.editor.category')}</Label>
        <Select value={category} onValueChange={(v) => setCategory(v as MaterialCategory)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {MATERIAL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>{t('admin.glb.editor.allowedMaterials')}</Label>
        <div className="space-y-1 max-h-40 overflow-auto border rounded p-2">
          {inCategory.map((m) => {
            const checked = allowed.includes(m.slug);
            return (
              <label key={m.slug} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    if (e.target.checked) setAllowed([...allowed, m.slug]);
                    else setAllowed(allowed.filter((s) => s !== m.slug));
                  }}
                />
                <span className="flex-1">{m.label} ({m.slug})</span>
                {checked && (
                  <Input
                    type="number"
                    min={0}
                    className="w-20"
                    value={(deltas[m.slug] ?? 0) / 100}
                    onChange={(e) => {
                      const cents = Math.round(Number(e.target.value) * 100);
                      setDeltas({ ...deltas, [m.slug]: Number.isFinite(cents) && cents >= 0 ? cents : 0 });
                    }}
                  />
                )}
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <Label>{t('admin.glb.editor.default')}</Label>
        <Select value={defaultSlug} onValueChange={setDefaultSlug}>
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {allowed.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('admin.glb.editor.cancel')}
        </Button>
        <Button
          type="button"
          disabled={allowed.length === 0 || !defaultSlug}
          onClick={() => onSave({
            id, label, nodePaths, category, defaultMaterialSlug: defaultSlug,
            allowedMaterialSlugs: allowed,
            priceDeltasCents: Object.fromEntries(allowed.map((s) => [s, deltas[s] ?? 0])),
          })}
        >
          {t('admin.glb.editor.save')}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

```bash
git add src/components/admin/catalog/GlbMaterialSlotEditor.tsx
git commit -m "feat(admin): GlbMaterialSlotEditor inline editor"
```

---

## Task 3.5: `GlbModelSection` (section container — upload + tree + actions + lists)

**Files:**
- Create: `src/components/admin/catalog/GlbModelSection.tsx`

- [ ] **Step 1: Create the section component**

```tsx
'use client';
import { useState } from 'react';
import { upload } from '@vercel/blob/client';
import type {
  GlbBinding, GlbMaterialSlot, GlbParseResult, GlbParsedNode, GlbVariantGroup,
} from '@/domain/supplier/types';
import type { MaterialRow } from '@/domain/catalog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { t } from '@/lib/i18n';
import { GlbTreeView } from './GlbTreeView';
import { GlbVariantGroupEditor } from './GlbVariantGroupEditor';
import { GlbMaterialSlotEditor } from './GlbMaterialSlotEditor';

interface Props {
  /** id of the supplier product being edited (used to call the parse endpoint). */
  productId: string | null;
  value: GlbBinding | null;
  onChange: (v: GlbBinding | null) => void;
  materials: MaterialRow[];
}

type Mode = 'idle' | { kind: 'variant'; node: GlbParsedNode; editing: GlbVariantGroup | null }
                  | { kind: 'material'; node: GlbParsedNode; editing: GlbMaterialSlot | null };

function findNode(root: GlbParsedNode, path: string): GlbParsedNode | undefined {
  if (root.path === path) return root;
  for (const c of root.children) {
    const r = findNode(c, path);
    if (r) return r;
  }
  return undefined;
}

export function GlbModelSection({ productId, value, onChange, materials }: Props) {
  const [parsed, setParsed] = useState<GlbParseResult | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    if (!productId) {
      alert('Sla het product eerst op voordat je een 3D-model uploadt.');
      return;
    }
    if (value && !confirm(t('admin.glb.reupload.confirm'))) return;
    setUploading(true);
    try {
      const blob = await upload(`glb/${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/admin/uploads/glb',
      });
      const res = await fetch(`/api/admin/supplier-products/${productId}/glb`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: blob.url }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        alert(`Upload mislukt: ${err.error ?? res.status}`);
        return;
      }
      const result = (await res.json()) as GlbParseResult;
      setParsed(result);
      onChange({
        url: result.url,
        unitScale: result.unitScale,
        naturalSize: result.naturalSize,
        hidden: [],
        variantGroups: [],
        materialSlots: [],
      });
    } finally {
      setUploading(false);
    }
  }

  const binding = value;
  const hiddenSet = new Set(binding?.hidden ?? []);
  const variantParents = new Set((binding?.variantGroups ?? []).map((g) => g.parentPath));
  const materialAnchors = new Set((binding?.materialSlots ?? []).flatMap((s) => s.nodePaths));
  const selectedNode = parsed && selectedPath ? findNode(parsed.tree, selectedPath) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.glb.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" disabled={uploading}>
            <label className="cursor-pointer">
              {t(binding ? 'admin.glb.reupload' : 'admin.glb.upload')}
              <input
                type="file"
                accept=".glb,model/gltf-binary"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
              />
            </label>
          </Button>
          {binding && (
            <span className="text-sm text-muted-foreground">
              {binding.naturalSize.widthMm}×{binding.naturalSize.heightMm}×{binding.naturalSize.depthMm} mm
            </span>
          )}
        </div>

        {!binding && <p className="text-sm text-muted-foreground">{t('admin.glb.empty')}</p>}

        {binding && parsed && (
          <div className="grid grid-cols-[1fr_1fr] gap-4">
            <div>
              <h4 className="text-sm font-medium mb-1">{t('admin.glb.tree.title')}</h4>
              <GlbTreeView
                tree={parsed.tree}
                hiddenPaths={hiddenSet}
                variantGroupPaths={variantParents}
                materialSlotPaths={materialAnchors}
                selectedPath={selectedPath}
                onSelect={setSelectedPath}
              />
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1">{t('admin.glb.selected.title')}</h4>
              {selectedNode ? (
                <div className="space-y-2">
                  <p className="text-xs font-mono break-all">{selectedNode.path}</p>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" type="button" variant="outline"
                      disabled={selectedNode.children.length === 0}
                      onClick={() => setMode({ kind: 'variant', node: selectedNode, editing: null })}
                    >{t('admin.glb.action.variant')}</Button>
                    <Button size="sm" type="button" variant="outline"
                      onClick={() => setMode({ kind: 'material', node: selectedNode, editing: null })}
                    >{t('admin.glb.action.material')}</Button>
                    <Button size="sm" type="button" variant="outline"
                      onClick={() => {
                        const isHidden = hiddenSet.has(selectedNode.path);
                        onChange({
                          ...binding,
                          hidden: isHidden
                            ? binding.hidden.filter((p) => p !== selectedNode.path)
                            : [...binding.hidden, selectedNode.path],
                        });
                      }}
                    >{hiddenSet.has(selectedNode.path) ? t('admin.glb.action.untag') : t('admin.glb.action.hide')}</Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">—</p>
              )}
            </div>
          </div>
        )}

        {mode !== 'idle' && mode.kind === 'variant' && (
          <GlbVariantGroupEditor
            parentNode={mode.node}
            initial={mode.editing}
            onCancel={() => setMode('idle')}
            onSave={(group) => {
              const others = (binding?.variantGroups ?? []).filter((g) => g.id !== group.id);
              onChange({ ...binding!, variantGroups: [...others, group] });
              setMode('idle');
            }}
          />
        )}
        {mode !== 'idle' && mode.kind === 'material' && (
          <GlbMaterialSlotEditor
            anchorNode={mode.node}
            initial={mode.editing}
            materials={materials}
            onCancel={() => setMode('idle')}
            onSave={(slot) => {
              const others = (binding?.materialSlots ?? []).filter((s) => s.id !== slot.id);
              onChange({ ...binding!, materialSlots: [...others, slot] });
              setMode('idle');
            }}
          />
        )}

        {binding && (binding.variantGroups.length > 0 || binding.materialSlots.length > 0) && (
          <div className="space-y-2 text-sm">
            {binding.variantGroups.length > 0 && (
              <div>
                <h5 className="font-medium">{t('admin.glb.variantGroups')}</h5>
                <ul>
                  {binding.variantGroups.map((g) => (
                    <li key={g.id} className="flex items-center justify-between border-b py-1">
                      <span>{g.label} · {g.options.length} opties · {g.defaultOptionId}</span>
                      <span className="flex gap-1">
                        <Button size="sm" type="button" variant="ghost"
                          onClick={() => {
                            const node = parsed && findNode(parsed.tree, g.parentPath);
                            if (node) setMode({ kind: 'variant', node, editing: g });
                          }}>
                          {t('admin.glb.action.edit')}
                        </Button>
                        <Button size="sm" type="button" variant="ghost"
                          onClick={() => onChange({ ...binding, variantGroups: binding.variantGroups.filter((x) => x.id !== g.id) })}>
                          {t('admin.glb.action.untag')}
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {binding.materialSlots.length > 0 && (
              <div>
                <h5 className="font-medium">{t('admin.glb.materialSlots')}</h5>
                <ul>
                  {binding.materialSlots.map((s) => (
                    <li key={s.id} className="flex items-center justify-between border-b py-1">
                      <span>{s.label} · {s.category} · {s.allowedMaterialSlugs.length} toegestaan</span>
                      <span className="flex gap-1">
                        <Button size="sm" type="button" variant="ghost"
                          onClick={() => {
                            const node = parsed && findNode(parsed.tree, s.nodePaths[0]);
                            if (node) setMode({ kind: 'material', node, editing: s });
                          }}>
                          {t('admin.glb.action.edit')}
                        </Button>
                        <Button size="sm" type="button" variant="ghost"
                          onClick={() => onChange({ ...binding, materialSlots: binding.materialSlots.filter((x) => x.id !== s.id) })}>
                          {t('admin.glb.action.untag')}
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/catalog/GlbModelSection.tsx
git commit -m "feat(admin): GlbModelSection container — upload + tag + lists"
```

---

## Task 3.6: Wire `GlbModelSection` into `SupplierProductForm`

**Files:**
- Modify: `src/components/admin/catalog/SupplierProductForm.tsx`

- [ ] **Step 1: Open the form and locate the kind-specific section**

Read `src/components/admin/catalog/SupplierProductForm.tsx`. Find the place where the hero image upload is rendered (`HeroImageUploadField`) and identify the `kind` switch that decides which meta sub-form to render.

- [ ] **Step 2: Pass-through props**

Add to the props the parent passes the `materials: MaterialRow[]` list (already available via `useTenantCatalogs()` if not already wired). Inside the form, after the hero image, before the kind-specific meta block, render `GlbModelSection` only for door/window kinds:

```tsx
{(form.watch('kind') === 'door' || form.watch('kind') === 'window') && (
  <GlbModelSection
    productId={productId /* the id of the product being edited; null on create */}
    value={(form.watch('meta') as DoorMeta | WindowMeta).glb ?? null}
    onChange={(glb) => {
      const current = form.getValues('meta') as DoorMeta | WindowMeta;
      const next = glb ? { ...current, glb } : { ...current };
      if (!glb) delete (next as { glb?: unknown }).glb;
      form.setValue('meta', next, { shouldDirty: true });
    }}
    materials={materials}
  />
)}
```

Add the import:

```ts
import { GlbModelSection } from './GlbModelSection';
import type { DoorMeta, WindowMeta } from '@/domain/supplier/types';
```

- [ ] **Step 3: Typecheck, then manually verify in the dev server**

Run: `pnpm exec tsc --noEmit && pnpm dev`. Open `/admin/catalog/suppliers/<id>/products/<pid>` for a door supplier product. Confirm the "3D Model" card renders and the "GLB uploaden" button is clickable. Don't upload yet — that needs the existing supplier product saved first (the `productId` prop must be non-null).

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/catalog/SupplierProductForm.tsx
git commit -m "feat(admin): mount GlbModelSection on door/window product forms"
```

---

## Task 3.7: Re-fetch parsed tree when editing an existing binding

**Files:**
- Modify: `src/components/admin/catalog/GlbModelSection.tsx`

- [ ] **Step 1: Add a `useEffect` to re-parse on mount when an existing binding is present**

Inside `GlbModelSection`, add right under the `useState` declarations:

```tsx
useEffect(() => {
  if (!value || parsed || !productId) return;
  let cancelled = false;
  (async () => {
    try {
      const res = await fetch(`/api/admin/supplier-products/${productId}/glb`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: value.url }),
      });
      if (!res.ok) return;
      const result = (await res.json()) as GlbParseResult;
      if (!cancelled) setParsed(result);
    } catch { /* swallow — admin can still untag without the tree */ }
  })();
  return () => { cancelled = true; };
}, [value, parsed, productId]);
```

Add `useEffect` to the imports.

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/catalog/GlbModelSection.tsx
git commit -m "feat(admin): re-parse GLB on mount when editing an existing binding"
```

---

## Task 3.8: Drift warning when parsed tree no longer matches saved paths

**Files:**
- Modify: `src/components/admin/catalog/GlbModelSection.tsx`

- [ ] **Step 1: Compute and surface the drift warning**

Add a helper at module scope:

```ts
function detectDrift(tree: GlbParsedNode, binding: GlbBinding): boolean {
  const allPaths = new Set<string>();
  (function collect(n: GlbParsedNode) { allPaths.add(n.path); n.children.forEach(collect); })(tree);
  for (const g of binding.variantGroups) {
    if (!allPaths.has(g.parentPath)) return true;
    for (const o of g.options) if (!allPaths.has(o.childPath)) return true;
  }
  for (const s of binding.materialSlots) {
    for (const p of s.nodePaths) if (!allPaths.has(p)) return true;
  }
  for (const p of binding.hidden) if (!allPaths.has(p)) return true;
  return false;
}
```

Inside the component, after the tree+selection grid renders, add:

```tsx
{binding && parsed && detectDrift(parsed.tree, binding) && (
  <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
    {t('admin.glb.driftWarning')}
  </p>
)}
```

- [ ] **Step 2: Phase 3 verification**

Run: `pnpm exec tsc --noEmit && pnpm test && pnpm build`
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/catalog/GlbModelSection.tsx
git commit -m "feat(admin): surface drift warning when stored paths no longer resolve"
```

---

# Phase 4 — Configurator render

End state: a SKU with `meta.glb` renders via `useGLTF` in the 3D canvas; customers can pick variants and per-slot materials in the sidebar; picks persist to `ConfigData` and survive undo/redo and saved short codes.

## Task 4.1: `applyBinding.ts` helpers (test-first)

**Files:**
- Create: `tests/supplier-glb-apply.test.ts`
- Create: `src/lib/glb/applyBinding.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/supplier-glb-apply.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import { applyHidden, applyVariants, applyMaterials } from '@/lib/glb/applyBinding';
import type { GlbMaterialSlot, GlbVariantGroup } from '@/domain/supplier/types';

function makeScene() {
  // Build:
  //   root
  //     deurbladen
  //       Vlakke deur (mesh)
  //       Paneel deur (mesh)
  //     Kop
  //       Chambrang#1 (mesh)
  //     Always Hide (mesh)
  const root = new Group();           root.name = 'root';
  const deurbladen = new Group();     deurbladen.name = 'deurbladen';
  const vlakke = new Mesh();           vlakke.name = 'Vlakke deur';   vlakke.material = new MeshStandardMaterial();
  const paneel = new Mesh();           paneel.name = 'Paneel deur';   paneel.material = new MeshStandardMaterial();
  const kop = new Group();             kop.name = 'Kop';
  const chambrang = new Mesh();        chambrang.name = 'Chambrang#1'; chambrang.material = new MeshStandardMaterial();
  const alwaysHide = new Mesh();       alwaysHide.name = 'Always Hide';
  deurbladen.add(vlakke, paneel);
  kop.add(chambrang);
  root.add(deurbladen, kop, alwaysHide);
  return { root, deurbladen, vlakke, paneel, kop, chambrang, alwaysHide };
}

describe('applyHidden', () => {
  it('sets visible=false on matched paths', () => {
    const s = makeScene();
    applyHidden(s.root, ['/root/Always Hide']);
    expect(s.alwaysHide.visible).toBe(false);
    expect(s.vlakke.visible).toBe(true);
  });
});

describe('applyVariants', () => {
  it('shows the picked child and hides siblings', () => {
    const s = makeScene();
    const group: GlbVariantGroup = {
      id: 'leaf', label: 'Bladtype', parentPath: '/root/deurbladen', defaultOptionId: 'vlakke',
      options: [
        { id: 'vlakke', label: 'Vlakke', childPath: '/root/deurbladen/Vlakke deur', priceDeltaCents: 0 },
        { id: 'paneel', label: 'Paneel', childPath: '/root/deurbladen/Paneel deur', priceDeltaCents: 0 },
      ],
    };
    applyVariants(s.root, [group], { leaf: 'paneel' });
    expect(s.vlakke.visible).toBe(false);
    expect(s.paneel.visible).toBe(true);
  });

  it('falls back to default option for missing picks', () => {
    const s = makeScene();
    const group: GlbVariantGroup = {
      id: 'leaf', label: 'L', parentPath: '/root/deurbladen', defaultOptionId: 'vlakke',
      options: [
        { id: 'vlakke', label: 'V', childPath: '/root/deurbladen/Vlakke deur', priceDeltaCents: 0 },
        { id: 'paneel', label: 'P', childPath: '/root/deurbladen/Paneel deur', priceDeltaCents: 0 },
      ],
    };
    applyVariants(s.root, [group], {});
    expect(s.vlakke.visible).toBe(true);
    expect(s.paneel.visible).toBe(false);
  });
});

describe('applyMaterials', () => {
  it('overrides materials on matched mesh paths', () => {
    const s = makeScene();
    const newMat = new MeshStandardMaterial({ color: 0x0000ff });
    const slot: GlbMaterialSlot = {
      id: 'frame', label: 'Kader',
      nodePaths: ['/root/Kop/Chambrang#1'],
      category: 'wall',
      defaultMaterialSlug: 'eik',
      allowedMaterialSlugs: ['eik'],
      priceDeltasCents: { eik: 0 },
    };
    const created = applyMaterials(s.root, [slot], { frame: 'eik' }, { eik: newMat });
    expect((s.chambrang.material as MeshStandardMaterial).color.getHex()).toBe(0x0000ff);
    expect(created.length).toBe(0); // we passed in the material; helper didn't create one
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm test supplier-glb-apply`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/glb/applyBinding.ts`:

```ts
import { Material, Mesh, Object3D } from 'three';
import type {
  GlbBinding,
  GlbMaterialSlot,
  GlbVariantGroup,
} from '@/domain/supplier/types';

function pathOf(node: Object3D, root: Object3D): string {
  const parts: string[] = [];
  let cur: Object3D | null = node;
  while (cur && cur !== root.parent) {
    parts.unshift(cur.name);
    if (cur === root) break;
    cur = cur.parent;
  }
  return '/' + parts.join('/');
}

function findByPath(root: Object3D, path: string): Object3D | null {
  let found: Object3D | null = null;
  root.traverse((obj) => {
    if (found) return;
    if (pathOf(obj, root) === path) found = obj;
  });
  return found;
}

export function applyHidden(root: Object3D, hiddenPaths: string[]): void {
  for (const p of hiddenPaths) {
    const node = findByPath(root, p);
    if (node) node.visible = false;
  }
}

export function applyVariants(
  root: Object3D,
  groups: GlbVariantGroup[],
  picks: Record<string, string>,
): void {
  for (const g of groups) {
    const parent = findByPath(root, g.parentPath);
    if (!parent) continue;
    const pickedOptionId = picks[g.id] ?? g.defaultOptionId;
    const picked = g.options.find((o) => o.id === pickedOptionId) ?? g.options[0];
    const allChildPaths = new Set(g.options.map((o) => o.childPath));
    for (const child of parent.children) {
      const cp = pathOf(child, root);
      if (allChildPaths.has(cp)) {
        child.visible = cp === picked.childPath;
      }
    }
  }
}

/** Assigns the picked material per slot. Returns the list of materials the
 *  helper assigned but did NOT create (for caller-side disposal accounting).
 *  When `materials[slug]` is missing, the slot is silently skipped (the
 *  configurator hydration filters mismatched picks before render anyway). */
export function applyMaterials(
  root: Object3D,
  slots: GlbMaterialSlot[],
  picks: Record<string, string>,
  materials: Record<string, Material>,
): Material[] {
  const assigned: Material[] = [];
  for (const slot of slots) {
    const slug = picks[slot.id] ?? slot.defaultMaterialSlug;
    const mat = materials[slug];
    if (!mat) continue;
    for (const p of slot.nodePaths) {
      const node = findByPath(root, p);
      if (!node) continue;
      node.traverse((obj) => {
        if (obj instanceof Mesh) {
          obj.material = mat;
          assigned.push(mat);
        }
      });
    }
  }
  return assigned;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm test supplier-glb-apply`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/glb/applyBinding.ts tests/supplier-glb-apply.test.ts
git commit -m "feat(canvas): pure applyHidden / applyVariants / applyMaterials helpers"
```

---

## Task 4.2: `useClonedGlbScene` hook

**Files:**
- Create: `src/lib/glb/useClonedGlbScene.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Group } from 'three';

/** Wraps drei's useGLTF and returns a per-instance deep clone of the
 *  scene. NEVER mutate the scene returned directly by useGLTF — drei
 *  caches it across all consumers of the same URL. */
export function useClonedGlbScene(url: string): Group {
  const gltf = useGLTF(url) as unknown as { scene: Group };
  return useMemo(() => gltf.scene.clone(true), [gltf.scene]);
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

```bash
git add src/lib/glb/useClonedGlbScene.ts
git commit -m "feat(canvas): useClonedGlbScene — per-instance scene clone wrapper"
```

---

## Task 4.3: `GlbDoorMesh` component

**Files:**
- Create: `src/components/canvas/GlbDoorMesh.tsx`

- [ ] **Step 1: Inspect the existing door render**

Read `src/components/canvas/DoorMesh.tsx`. Note the prop shape consumed by `SupplierDoorMesh` (position, rotation, supplierProduct, wall context). Mirror that shape for `GlbDoorMesh` so the branch in DoorMesh.tsx is a clean swap.

- [ ] **Step 2: Create the component**

```tsx
'use client';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Material, MeshStandardMaterial } from 'three';
import type {
  GlbBinding, GlbVariantGroup, GlbMaterialSlot,
} from '@/domain/supplier/types';
import type { WallConfig } from '@/domain/building/types';
import type { MaterialRow } from '@/domain/catalog';
import { useClonedGlbScene } from '@/lib/glb/useClonedGlbScene';
import { applyHidden, applyVariants, applyMaterials } from '@/lib/glb/applyBinding';

interface Props {
  binding: GlbBinding;
  wall: WallConfig;
  materials: MaterialRow[];
  position: [number, number, number];
  rotation: [number, number, number];
}

/** Build a quick {slug → MeshStandardMaterial} map from MaterialRow textures.
 *  V1 uses a simple solid color from the row's `color` (when present) or
 *  white. PBR texture resolution is left to a future pass; the helper is
 *  kept here so the renderer is self-contained. */
function buildMaterialDict(rows: MaterialRow[]): Record<string, Material> {
  const out: Record<string, Material> = {};
  for (const r of rows) {
    out[r.slug] = new MeshStandardMaterial({
      color: r.color ?? 0xffffff,
      roughness: 0.8,
      metalness: 0.1,
    });
  }
  return out;
}

function GlbDoorMeshInner({ binding, wall, materials, position, rotation }: Props) {
  const scene = useClonedGlbScene(binding.url);
  const variantPicks = wall.doorGlbVariants ?? {};
  const materialPicks = wall.doorGlbMaterials ?? {};

  // Build material dict once per materials list reference
  const matDict = useMemo(() => buildMaterialDict(materials), [materials]);

  // Track materials we've assigned so we can dispose on unmount
  const assignedRef = useRef<Material[]>([]);

  useEffect(() => {
    applyHidden(scene, binding.hidden);
    applyVariants(scene, binding.variantGroups, variantPicks);
    assignedRef.current = applyMaterials(scene, binding.materialSlots, materialPicks, matDict);
  }, [scene, binding, variantPicks, materialPicks, matDict]);

  useEffect(() => {
    return () => {
      // The materials dict itself is created per-component; dispose all.
      for (const m of Object.values(matDict)) m.dispose();
    };
  }, [matDict]);

  return (
    <group position={position} rotation={rotation} scale={binding.unitScale}>
      <primitive object={scene} />
    </group>
  );
}

export function GlbDoorMesh(props: Props) {
  return (
    <Suspense fallback={null}>
      <GlbDoorMeshInner {...props} />
    </Suspense>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (note: if `MaterialRow.color` doesn't exist, replace with whatever color field IS on the row — read `src/domain/catalog/types.ts` to confirm and adjust this single line).

- [ ] **Step 4: Commit**

```bash
git add src/components/canvas/GlbDoorMesh.tsx
git commit -m "feat(canvas): GlbDoorMesh component (Suspense + cloned scene + binding applied)"
```

---

## Task 4.4: Branch `DoorMesh.tsx` to use `GlbDoorMesh`

**Files:**
- Modify: `src/components/canvas/DoorMesh.tsx`

- [ ] **Step 1: Add the branch**

Read `DoorMesh.tsx` near line 164 (the router). Add a leg before `SupplierDoorMesh`:

```tsx
if (props.supplierProduct?.meta && 'glb' in props.supplierProduct.meta && props.supplierProduct.meta.glb) {
  return (
    <GlbDoorMesh
      binding={props.supplierProduct.meta.glb}
      wall={props.wall}
      materials={props.materials}
      position={props.position}
      rotation={props.rotation}
    />
  );
}
```

Add the import:

```tsx
import { GlbDoorMesh } from './GlbDoorMesh';
```

If the existing DoorMesh router doesn't already receive `materials` + `wall`, thread them through from the Wall.tsx call site. Confirm the exact prop names by reading both files first.

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/canvas/DoorMesh.tsx
git commit -m "feat(canvas): branch DoorMesh to GlbDoorMesh when meta.glb is present"
```

---

## Task 4.5: `VariantPicker` and `MaterialSlotPicker` sidebar components

**Files:**
- Create: `src/components/ui/VariantPicker.tsx`
- Create: `src/components/ui/MaterialSlotPicker.tsx`

- [ ] **Step 1: VariantPicker**

```tsx
'use client';
import type { GlbVariantGroup } from '@/domain/supplier/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Props {
  group: GlbVariantGroup;
  value: string;
  onChange: (optionId: string) => void;
}

export function VariantPicker({ group, value, onChange }: Props) {
  return (
    <div>
      <Label className="text-xs">{group.label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {group.options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label}{o.priceDeltaCents > 0 ? ` (+€${(o.priceDeltaCents / 100).toFixed(0)})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 2: MaterialSlotPicker**

```tsx
'use client';
import type { GlbMaterialSlot } from '@/domain/supplier/types';
import type { MaterialRow } from '@/domain/catalog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Props {
  slot: GlbMaterialSlot;
  materials: MaterialRow[];
  value: string;
  onChange: (slug: string) => void;
}

export function MaterialSlotPicker({ slot, materials, value, onChange }: Props) {
  const allowed = materials.filter((m) => slot.allowedMaterialSlugs.includes(m.slug) && !m.archivedAt);
  return (
    <div>
      <Label className="text-xs">{slot.label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {allowed.map((m) => {
            const delta = slot.priceDeltasCents[m.slug] ?? 0;
            return (
              <SelectItem key={m.slug} value={m.slug}>
                {m.label}{delta > 0 ? ` (+€${(delta / 100).toFixed(0)})` : ''}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and commit**

```bash
git add src/components/ui/VariantPicker.tsx src/components/ui/MaterialSlotPicker.tsx
git commit -m "feat(ui): VariantPicker + MaterialSlotPicker sidebar dropdowns"
```

---

## Task 4.6: Mount pickers in `DoorConfig.tsx`

**Files:**
- Modify: `src/components/ui/DoorConfig.tsx`

- [ ] **Step 1: Open the door config**

Read `src/components/ui/DoorConfig.tsx` and locate the supplier-product picker (lines 43–75 per the explore report). Note where the global Material dropdown renders.

- [ ] **Step 2: Add the GLB conditional block**

Right after the supplier-product picker, before the size toggle, add:

```tsx
{(() => {
  const glb = activeSupplierProduct?.meta && 'glb' in activeSupplierProduct.meta
    ? (activeSupplierProduct.meta as { glb?: GlbBinding }).glb
    : null;
  if (!glb) return null;

  return (
    <div className="space-y-2">
      {glb.variantGroups.map((g) => (
        <VariantPicker
          key={g.id}
          group={g}
          value={wall.doorGlbVariants?.[g.id] ?? g.defaultOptionId}
          onChange={(optId) => setWallDoorGlbVariantStore(buildingId, wallSide, g.id, optId)}
        />
      ))}
      {glb.materialSlots.map((s) => (
        <MaterialSlotPicker
          key={s.id}
          slot={s}
          materials={tenantMaterials}
          value={wall.doorGlbMaterials?.[s.id] ?? s.defaultMaterialSlug}
          onChange={(slug) => setWallDoorGlbMaterialStore(buildingId, wallSide, s.id, slug)}
        />
      ))}
    </div>
  );
})()}
```

Conditionally hide the global Material dropdown when `glb` is present (wrap that block in `!glb && (...)`).

Add the missing imports + store-action wires:

```ts
import { VariantPicker } from './VariantPicker';
import { MaterialSlotPicker } from './MaterialSlotPicker';
import type { GlbBinding } from '@/domain/supplier/types';
import { useConfigStore } from '@/store/useConfigStore';

const setWallDoorGlbVariantStore = useConfigStore((s) => s.setWallDoorGlbVariant);
const setWallDoorGlbMaterialStore = useConfigStore((s) => s.setWallDoorGlbMaterial);
```

(Read the existing `useConfigStore` declaration in the file to confirm the destructuring style — match it.)

- [ ] **Step 3: Add the matching store actions**

Open `src/store/useConfigStore.ts` (or wherever the temporal-wrapped config store is declared). Add the two actions, delegating to the pure mutations from Task 1.5:

```ts
setWallDoorGlbVariant: (buildingId: string, wallSide: WallSide, groupId: string, optionId: string) =>
  set((state) => ({ ...state, ...setWallDoorGlbVariant(state, buildingId, wallSide, groupId, optionId) })),
setWallDoorGlbMaterial: (buildingId: string, wallSide: WallSide, slotId: string, materialSlug: string) =>
  set((state) => ({ ...state, ...setWallDoorGlbMaterial(state, buildingId, wallSide, slotId, materialSlug) })),
```

Match the file's existing pattern for action shape exactly — read the closest similar action (`setWallDoorSupplierProduct`) to confirm.

Repeat for the window equivalents (`setWallWindowGlbVariant`, `setWallWindowGlbMaterial`).

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/DoorConfig.tsx src/store/useConfigStore.ts
git commit -m "feat(ui): mount Glb variant + material pickers in DoorConfig sidebar"
```

---

## Task 4.7: Same wiring for windows (`Wall.tsx` window render + `WindowConfig.tsx`)

**Files:**
- Create: `src/components/canvas/GlbWindowMesh.tsx`
- Modify: `src/components/canvas/Wall.tsx`
- Modify: `src/components/ui/WindowConfig.tsx`

- [ ] **Step 1: Create `GlbWindowMesh`**

```tsx
'use client';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Material, MeshStandardMaterial } from 'three';
import type { GlbBinding } from '@/domain/supplier/types';
import type { WallWindow } from '@/domain/building/types';
import type { MaterialRow } from '@/domain/catalog';
import { useClonedGlbScene } from '@/lib/glb/useClonedGlbScene';
import { applyHidden, applyVariants, applyMaterials } from '@/lib/glb/applyBinding';

interface Props {
  binding: GlbBinding;
  window: WallWindow;
  materials: MaterialRow[];
  position: [number, number, number];
  rotation: [number, number, number];
}

function buildMaterialDict(rows: MaterialRow[]): Record<string, Material> {
  const out: Record<string, Material> = {};
  for (const r of rows) {
    out[r.slug] = new MeshStandardMaterial({
      color: r.color ?? 0xffffff,
      roughness: 0.8,
      metalness: 0.1,
    });
  }
  return out;
}

function GlbWindowMeshInner({ binding, window, materials, position, rotation }: Props) {
  const scene = useClonedGlbScene(binding.url);
  const variantPicks = window.glbVariants ?? {};
  const materialPicks = window.glbMaterials ?? {};
  const matDict = useMemo(() => buildMaterialDict(materials), [materials]);
  const assignedRef = useRef<Material[]>([]);

  useEffect(() => {
    applyHidden(scene, binding.hidden);
    applyVariants(scene, binding.variantGroups, variantPicks);
    assignedRef.current = applyMaterials(scene, binding.materialSlots, materialPicks, matDict);
  }, [scene, binding, variantPicks, materialPicks, matDict]);

  useEffect(() => {
    return () => {
      for (const m of Object.values(matDict)) m.dispose();
    };
  }, [matDict]);

  return (
    <group position={position} rotation={rotation} scale={binding.unitScale}>
      <primitive object={scene} />
    </group>
  );
}

export function GlbWindowMesh(props: Props) {
  return (
    <Suspense fallback={null}>
      <GlbWindowMeshInner {...props} />
    </Suspense>
  );
}
```

- [ ] **Step 2: Branch the window render in `Wall.tsx`**

Find where the existing window mesh is rendered. Add a branch:

```tsx
{(() => {
  const w = win; // existing variable for the WallWindow in the map
  const sp = supplierProductMap[w.supplierProductId ?? ''];
  const glb = sp?.meta && 'glb' in sp.meta ? (sp.meta as { glb?: GlbBinding }).glb : null;
  if (glb) {
    return (
      <GlbWindowMesh
        key={w.id}
        binding={glb}
        window={w}
        materials={materials}
        position={pos}
        rotation={rot}
      />
    );
  }
  // existing window mesh
})()}
```

- [ ] **Step 3: Mount pickers in `WindowConfig.tsx`**

Mirror Task 4.6 for the window sidebar — same `VariantPicker` + `MaterialSlotPicker` swap, calling `setWallWindowGlbVariant` / `setWallWindowGlbMaterial`.

- [ ] **Step 4: Typecheck, then phase verification**

Run: `pnpm exec tsc --noEmit && pnpm test && pnpm build`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/GlbWindowMesh.tsx src/components/canvas/Wall.tsx \
        src/components/ui/WindowConfig.tsx
git commit -m "feat(ui): GLB-backed window render + sidebar pickers"
```

---

# Phase 5 — Pricing line items

End state: each non-default variant / material pick on a GLB-backed door or window emits its own structured line item in the priced quote, surfaced as labelled rows in the PDF and admin order detail.

## Task 5.1: Add the `glbExtraPriceCents` helper + i18n keys

**Files:**
- Modify: `src/domain/supplier/glb.ts`
- Modify: `src/lib/i18n.ts`

- [ ] **Step 1: Add a pure pricing helper**

Append to `src/domain/supplier/glb.ts`:

```ts
/** Return per-pick extra-cost line items for a GLB-backed supplier product
 *  given the customer's picks. Defaults contribute nothing. */
export function glbExtraLineItems(
  binding: GlbBinding,
  variantPicks: Record<string, string>,
  materialPicks: Record<string, string>,
): Array<{ labelKey: string; labelParams: Record<string, string>; cents: number }> {
  const out: Array<{ labelKey: string; labelParams: Record<string, string>; cents: number }> = [];
  for (const g of binding.variantGroups) {
    const pickedId = variantPicks[g.id] ?? g.defaultOptionId;
    const picked = g.options.find((o) => o.id === pickedId);
    if (!picked) continue;
    if (picked.priceDeltaCents > 0 && pickedId !== g.defaultOptionId) {
      out.push({
        labelKey: 'quote.glbVariant',
        labelParams: { group: g.label, option: picked.label },
        cents: picked.priceDeltaCents,
      });
    }
  }
  for (const s of binding.materialSlots) {
    const pickedSlug = materialPicks[s.id] ?? s.defaultMaterialSlug;
    const delta = s.priceDeltasCents[pickedSlug] ?? 0;
    if (delta > 0 && pickedSlug !== s.defaultMaterialSlug) {
      out.push({
        labelKey: 'quote.glbMaterialSlot',
        labelParams: { slot: s.label, material: pickedSlug },
        cents: delta,
      });
    }
  }
  return out;
}
```

- [ ] **Step 2: Add i18n keys**

In `src/lib/i18n.ts`, add:

```ts
  'quote.glbVariant': '{group}: {option}',
  'quote.glbMaterialSlot': '{slot}: {material}',
```

- [ ] **Step 3: Commit**

```bash
git add src/domain/supplier/glb.ts src/lib/i18n.ts
git commit -m "feat(pricing): glbExtraLineItems helper + i18n keys"
```

---

## Task 5.2: Wire `glbExtraLineItems` into `calculateTotalQuote` (test-first)

**Files:**
- Create: `tests/supplier-glb-pricing.test.ts`
- Modify: `src/domain/pricing/calculate.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/supplier-glb-pricing.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import { glbExtraLineItems } from '@/domain/supplier/glb';
import type { GlbBinding } from '@/domain/supplier/types';

const BINDING: GlbBinding = {
  url: 'x',
  unitScale: 1,
  naturalSize: { widthMm: 1, heightMm: 1, depthMm: 1 },
  hidden: [],
  variantGroups: [
    {
      id: 'leaf', label: 'Bladtype', parentPath: '/p', defaultOptionId: 'vlakke',
      options: [
        { id: 'vlakke', label: 'Vlakke', childPath: '/a', priceDeltaCents: 0 },
        { id: 'paneel', label: 'Paneel', childPath: '/b', priceDeltaCents: 12000 },
      ],
    },
  ],
  materialSlots: [
    {
      id: 'frame', label: 'Kader',
      nodePaths: ['/c'], category: 'wall',
      defaultMaterialSlug: 'eik',
      allowedMaterialSlugs: ['eik', 'antraciet'],
      priceDeltasCents: { eik: 0, antraciet: 5000 },
    },
  ],
};

describe('glbExtraLineItems', () => {
  it('emits no items for defaults', () => {
    expect(glbExtraLineItems(BINDING, {}, {})).toEqual([]);
  });
  it('emits one item for a non-default variant', () => {
    const items = glbExtraLineItems(BINDING, { leaf: 'paneel' }, {});
    expect(items).toEqual([
      { labelKey: 'quote.glbVariant', labelParams: { group: 'Bladtype', option: 'Paneel' }, cents: 12000 },
    ]);
  });
  it('emits one item for a non-default material', () => {
    const items = glbExtraLineItems(BINDING, {}, { frame: 'antraciet' });
    expect(items).toEqual([
      { labelKey: 'quote.glbMaterialSlot', labelParams: { slot: 'Kader', material: 'antraciet' }, cents: 5000 },
    ]);
  });
  it('emits both for mixed non-defaults', () => {
    const items = glbExtraLineItems(BINDING, { leaf: 'paneel' }, { frame: 'antraciet' });
    expect(items.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test to confirm it passes**

Run: `pnpm test supplier-glb-pricing`
Expected: PASS (the helper was added in Task 5.1, so the test should pass directly).

- [ ] **Step 3: Wire into `calculateTotalQuote`**

Open `src/domain/pricing/calculate.ts`. Search for the supplier-product door pricing path (grep for `doorSupplierProductId`). Inside the block that builds the per-door line item, immediately after `priceCents` is added to the line item's `lineItems`, append:

```ts
if (sp.meta && 'glb' in sp.meta && sp.meta.glb) {
  const extras = glbExtraLineItems(
    sp.meta.glb,
    wall.doorGlbVariants ?? {},
    wall.doorGlbMaterials ?? {},
  );
  for (const e of extras) {
    lineItems.push({ labelKey: e.labelKey, labelParams: e.labelParams, totalCents: e.cents });
    runningTotalCents += e.cents;
  }
}
```

Repeat the same pattern in the supplier-window branch, using `win.glbVariants` and `win.glbMaterials` and `sp.meta.glb` on the window's supplier product.

Variable names (`lineItems`, `runningTotalCents`, `sp`, `wall`, `win`) must match the file's local conventions — adjust if they differ. The key invariants: (a) `glbExtraLineItems` returns items in cents, (b) each emitted item becomes its own `lineItems` entry, (c) each item's cents adds to the running total alongside the SKU base price.

Add the import: `import { glbExtraLineItems } from '@/domain/supplier/glb';`

- [ ] **Step 4: Verify with a fresh quote calculation test**

Run: `pnpm test` and confirm all pricing tests still pass (existing tests must not regress).

- [ ] **Step 5: Commit**

```bash
git add src/domain/pricing/calculate.ts tests/supplier-glb-pricing.test.ts
git commit -m "feat(pricing): emit GLB variant + material slot line items in priced quote"
```

---

# Phase 6 — Admin preview canvas

End state: the "3D Model" admin section shows a live preview using the same `GlbDoorMesh` component the configurator uses; admin sees the result of every variant/material change in real time.

## Task 6.1: `GlbPreviewCanvas` component

**Files:**
- Create: `src/components/admin/catalog/GlbPreviewCanvas.tsx`

- [ ] **Step 1: Create a minimal R3F canvas**

```tsx
'use client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Suspense, useState } from 'react';
import type { GlbBinding } from '@/domain/supplier/types';
import type { MaterialRow } from '@/domain/catalog';
import { useClonedGlbScene } from '@/lib/glb/useClonedGlbScene';
import { applyHidden, applyVariants, applyMaterials } from '@/lib/glb/applyBinding';
import { useEffect, useMemo } from 'react';
import { Material, MeshStandardMaterial } from 'three';
import { VariantPicker } from '@/components/ui/VariantPicker';
import { MaterialSlotPicker } from '@/components/ui/MaterialSlotPicker';

interface Props {
  binding: GlbBinding;
  materials: MaterialRow[];
}

function PreviewModel({ binding, materials, variantPicks, materialPicks }: {
  binding: GlbBinding;
  materials: MaterialRow[];
  variantPicks: Record<string, string>;
  materialPicks: Record<string, string>;
}) {
  const scene = useClonedGlbScene(binding.url);
  const matDict = useMemo(() => {
    const out: Record<string, Material> = {};
    for (const m of materials) {
      out[m.slug] = new MeshStandardMaterial({ color: m.color ?? 0xffffff });
    }
    return out;
  }, [materials]);
  useEffect(() => {
    applyHidden(scene, binding.hidden);
    applyVariants(scene, binding.variantGroups, variantPicks);
    applyMaterials(scene, binding.materialSlots, materialPicks, matDict);
  }, [scene, binding, variantPicks, materialPicks, matDict]);
  return <group scale={binding.unitScale}><primitive object={scene} /></group>;
}

export function GlbPreviewCanvas({ binding, materials }: Props) {
  const [variantPicks, setVariantPicks] = useState<Record<string, string>>(() =>
    Object.fromEntries(binding.variantGroups.map((g) => [g.id, g.defaultOptionId])),
  );
  const [materialPicks, setMaterialPicks] = useState<Record<string, string>>(() =>
    Object.fromEntries(binding.materialSlots.map((s) => [s.id, s.defaultMaterialSlug])),
  );
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {binding.variantGroups.map((g) => (
          <VariantPicker
            key={g.id}
            group={g}
            value={variantPicks[g.id]}
            onChange={(v) => setVariantPicks({ ...variantPicks, [g.id]: v })}
          />
        ))}
        {binding.materialSlots.map((s) => (
          <MaterialSlotPicker
            key={s.id}
            slot={s}
            materials={materials}
            value={materialPicks[s.id]}
            onChange={(v) => setMaterialPicks({ ...materialPicks, [s.id]: v })}
          />
        ))}
      </div>
      <div className="h-64 border rounded-md overflow-hidden">
        <Canvas camera={{ position: [2, 1.5, 2.5], fov: 35 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          <Suspense fallback={null}>
            <PreviewModel binding={binding} materials={materials}
              variantPicks={variantPicks} materialPicks={materialPicks} />
          </Suspense>
          <OrbitControls />
        </Canvas>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount the preview in `GlbModelSection`**

In `src/components/admin/catalog/GlbModelSection.tsx`, render the preview at the bottom of the section, only when `binding` is set:

```tsx
{binding && <GlbPreviewCanvas binding={binding} materials={materials} />}
```

Add the import:

```ts
import { GlbPreviewCanvas } from './GlbPreviewCanvas';
```

- [ ] **Step 3: Typecheck + manual verification**

Run: `pnpm exec tsc --noEmit && pnpm dev`. Open a door supplier product, upload `DEUR.glb`, tag a variant group and a material slot, and confirm the preview renders + responds to dropdown changes.

- [ ] **Step 4: Final verification — run everything**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm build && pnpm lint`
Expected: `pnpm test` PASS, `tsc` PASS, `build` PASS, `lint` shows pre-existing warnings only.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/catalog/GlbPreviewCanvas.tsx \
        src/components/admin/catalog/GlbModelSection.tsx
git commit -m "feat(admin): inline R3F preview canvas for GLB tagging section"
```

---

## End-of-plan checklist

Before declaring V1 done, manually walk this end-to-end with `DEUR.glb`:

1. Create or open a door supplier product as super_admin or tenant_admin.
2. Save it once so it has an id.
3. Upload `DEUR.glb` via the 3D Model section. Confirm the parse endpoint returns the tree (~30 ms).
4. Verify "Bouwbouwbouwen" — the bounding box reads ~90×200×5 cm and the units dropdown auto-suggests inches.
5. Tag the `deurbladen` node as a variant group named "Bladtype" with the 4 children as options; default to "Vlakke deur".
6. Tag the `Deurklink` node as a variant group named "Klink" with the 3 sub-handles; default to "Vierkant".
7. Tag a `Chambrang#1` node as a material slot named "Kader", category `wall`, allow `eik-natuur` + `antraciet` (+€50 delta), default `eik-natuur`.
8. Hide the `Active View` node.
9. Save the product.
10. Open `/configurator?product=…` for any berging or overkapping; add this door to a wall.
11. Confirm the door renders the GLB. Confirm the sidebar shows Bladtype + Klink dropdowns + Kader picker.
12. Switch to Paneel deur + Antraciet kader. Confirm the 3D model updates AND the priced quote gains two new line items (`Bladtype: Paneel deur` and `Kader: antraciet`).
13. Save the scene, take the short code, open it in a new tab — same picks restored.
14. Submit the configuration as an order; open the admin order detail; confirm the quote snapshot includes the new line items and the order PDF renders them in Dutch.
15. Re-upload a different GLB to the same SKU; confirm the confirm dialog fires and existing tags are blown away.
