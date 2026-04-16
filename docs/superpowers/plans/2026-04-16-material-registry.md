# Material Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralise material/finish selection across walls, roof trim, roof covering, floor, and doors into an atoms + catalogs registry that mirrors a future DB schema, and remove the unused wall `finish` feature. Prepare share codes (v6) for admin-driven catalog edits by switching from index encoding to inline slug encoding.

**Architecture:** Two-layer registry. `atoms.ts` holds material primitives (slug, label key, hex color, optional PBR texture paths, optional tile sizes) keyed by a stable slug — mirrors a `materials` DB table. Per-object `catalogs/*.ts` files hold arrays of entries that reference atoms by slug and carry object-specific context (price per sqm, surcharge, behaviour flags) — mirror `{object}_materials` DB join tables. UI, 3D rendering, pricing, and serialization read through the registry.

**Tech Stack:** Next.js 16 (App Router) + React 19 + Three.js (@react-three/fiber) + Zustand + TypeScript 5. Package manager: **pnpm**. No test framework — verification uses `pnpm tsc --noEmit`, `pnpm build`, and manual dev-server smoke tests.

**Scope notes:**
- Project has **no test framework** installed. Do not add Vitest/Jest — verification is type-check + build + dev-server smoke. Each phase includes a manual smoke-test checklist.
- **Baseline lint has 15 pre-existing errors** (unrelated to this work). Do not attempt to fix them. The plan's success criterion is: `pnpm tsc --noEmit` passes cleanly, `pnpm build` succeeds, and the smoke-test checklist passes.
- User confirmed: **no legacy share-code migration** needed. Version 5 codes can stop decoding when version 6 ships. Remove v2/v3/v4/v5 decode branches as part of the v6 switch.
- All work happens in the `.worktrees/material-registry` worktree on branch `feat/material-registry`. Absolute paths in this plan reflect that worktree.

---

## File Structure

### New files
```
src/lib/materials/
  atoms.ts          — MATERIALS_REGISTRY record, MaterialAtom type, helpers
  catalogs/
    wall.ts         — WALL_CATALOG: WallCatalogEntry[]
    roof-trim.ts    — ROOF_TRIM_CATALOG: RoofTrimCatalogEntry[]
    roof-cover.ts   — ROOF_COVERING_CATALOG: RoofCoveringCatalogEntry[]
    floor.ts        — FLOOR_CATALOG: FloorCatalogEntry[]
    door.ts         — DOOR_CATALOG: DoorCatalogEntry[]
  types.ts          — shared catalog entry types
  index.ts          — barrel re-export
```

### Modified files
```
src/types/building.ts            — remove WallConfig.finish, remove SurfaceMaterial/RoofCovering interfaces (moved to materials/)
src/lib/constants.ts             — remove WALL_MATERIALS, ROOF_COVERINGS, FLOOR_MATERIALS, DOOR_MATERIALS, FINISHES, DEFAULT_WALL.finish
src/lib/configCode.ts            — bump VERSION to 6, remove v2-v5 decode branches, switch to slug encoding, drop FINISH_IDS
src/lib/i18n.ts                  — remove surface.finish, finish.* keys; add material.<atom>.label keys for every atom
src/lib/pricing.ts               — import from materials/ instead of constants.ts
src/lib/textures.ts              — read texture paths and tile sizes from atoms registry instead of local maps
src/components/ui/SurfaceProperties.tsx   — remove FINISHES block; read materials from WALL_CATALOG
src/components/ui/RoofConfigSection.tsx   — read trim from ROOF_TRIM_CATALOG, coverings from ROOF_COVERING_CATALOG
src/components/ui/FloorConfigSection.tsx  — read from FLOOR_CATALOG
src/components/ui/DoorConfig.tsx          — read from DOOR_CATALOG
src/components/canvas/Wall.tsx            — resolve atom colour/texture via registry
src/components/canvas/Roof.tsx            — resolve trim + covering atoms via registry
src/components/canvas/Floor.tsx           — resolve floor atom via registry
src/components/schematic/WallElevation.tsx — resolve wall atom via registry
src/components/schematic/SchematicWalls.tsx — resolve wall atom via registry
src/components/schematic/exportFloorPlan.ts — resolve wall atom via registry
src/store/useConfigStore.ts       — DEFAULT_WALL no longer has `finish`
```

---

## Task 1: Remove wall `finish` feature

This phase is self-contained and lowest risk. It removes the `finish` field (Mat/Satijn/Glans) from `WallConfig`, its UI, its i18n keys, and its serialization. This prepares the field list that v6 share codes will encode.

**Files:**
- Modify: `src/types/building.ts:34-45` (WallConfig interface)
- Modify: `src/lib/constants.ts:34` (FINISHES), `:67-78` (DEFAULT_WALL)
- Modify: `src/lib/i18n.ts:69-75` (finish keys)
- Modify: `src/components/ui/SurfaceProperties.tsx:4` (import), `:84-102` (finish UI block)
- Modify: `src/lib/configCode.ts:148` (FINISH_IDS), `:166-167` (encodeWall write), `:188-189` (decodeWall read), `:215-218` (decodeWall return)

- [ ] **Step 1.1: Remove `finish` field from `WallConfig`**

Edit `src/types/building.ts`:

```typescript
export interface WallConfig {
  materialId: string;
  hasDoor: boolean;
  doorMaterialId: DoorMaterialId;
  doorSize: DoorSize;
  doorHasWindow: boolean;
  doorPosition: number;
  doorSwing: DoorSwing;
  doorMirror?: boolean;
  windows: WallWindow[];
}
```

(Delete line `finish: string;` at line 36.)

- [ ] **Step 1.2: Remove `FINISHES` constant and `finish` from `DEFAULT_WALL`**

Edit `src/lib/constants.ts`:

Delete lines 33-34:
```typescript
// Dutch finishes
export const FINISHES = ['Mat', 'Satijn', 'Glans'] as const;
```

And in `DEFAULT_WALL` (lines 67-78), remove the `finish: 'Mat',` line so it becomes:

```typescript
export const DEFAULT_WALL: WallConfig = {
  materialId: 'wood',
  hasDoor: false,
  doorMaterialId: 'wood',
  doorSize: 'enkel',
  doorHasWindow: false,
  doorPosition: 0.5,
  doorSwing: 'naar_buiten',
  doorMirror: false,
  windows: [],
};
```

- [ ] **Step 1.3: Remove `finish` i18n keys**

Edit `src/lib/i18n.ts` — delete these four lines (currently 69-75 area):

```
'finish.mat': 'Mat',
'finish.satijn': 'Satijn',
'finish.glans': 'Glans',
...
'surface.finish': 'Afwerking',
```

(Keep any keys unrelated to finish; only these four are to be deleted.)

- [ ] **Step 1.4: Remove finish UI from SurfaceProperties**

Edit `src/components/ui/SurfaceProperties.tsx`:

Change line 4 from:
```typescript
import { WALL_MATERIALS, FINISHES } from '@/lib/constants';
```
to:
```typescript
import { WALL_MATERIALS } from '@/lib/constants';
```

Delete the entire finish block (currently lines 84-102):
```jsx
      {!isGlass && (
        <div className="space-y-2">
          <SectionLabel>{t('surface.finish')}</SectionLabel>
          <ToggleGroup
            type="single"
            value={wallCfg.finish}
            onValueChange={(v) => { if (v) handleChange('finish', v); }}
            ...
          </ToggleGroup>
        </div>
      )}
```

Also remove the unused `ToggleGroup, ToggleGroupItem` imports if they are no longer referenced elsewhere in the file (verify first — `DoorConfig` and `WindowConfig` child components don't count). Delete the import line only if no other usage remains in SurfaceProperties itself.

- [ ] **Step 1.5: Remove finish from share-code encode/decode**

Edit `src/lib/configCode.ts`:

Delete line 148: `const FINISH_IDS = ['Mat', 'Satijn', 'Glans'];`

In `encodeWall` (around line 165), delete line 167: `w.write(indexOf(FINISH_IDS, wall.finish), 2);`

In `decodeWall` (around line 187), delete line 189: `const finish = FINISH_IDS[clamp(r.read(2), 0, 2)];`

In the return statement of `decodeWall` (line 215-218), remove `finish` from the returned object:

```typescript
  return {
    materialId, hasDoor, doorMaterialId, doorSize,
    doorHasWindow, doorPosition, doorSwing, windows,
  };
```

**Note:** this changes the wire format of v5. That's acceptable per user scope — v5 codes no longer need to decode. The v6 bump in Task 6 supersedes this anyway.

- [ ] **Step 1.6: Type-check and build**

Run from the worktree root:
```bash
pnpm tsc --noEmit
```
Expected: no output (passes). If any file still references `wallCfg.finish` or `FINISHES` or `FINISH_IDS`, fix it. Use `grep -rn "\.finish\|FINISHES\|FINISH_IDS\|surface\.finish\|finish\." src` to find stragglers.

```bash
pnpm build
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 1.7: Dev-server smoke test**

```bash
pnpm dev
```

Open `http://localhost:3000`, then:
1. Click a wall on a `berging` building.
2. Verify the wall material buttons (Hout/Steen/Stucwerk/Metaal/Glas) still render and clicking them changes the wall colour in the 3D view.
3. Verify there is no longer a "Afwerking" (finish) toggle group below the materials.
4. Verify clicking "Glas" still clears doors/windows.

Kill the dev server.

- [ ] **Step 1.8: Commit**

```bash
git add -A
git commit -m "feat: remove unused wall finish field (Mat/Satijn/Glans)"
```

---

## Task 2: Create materials registry skeleton (atoms + types)

Create the new `src/lib/materials/` directory with atoms registry and shared catalog entry types. No consumers yet — this only adds new files. Importing the new files into existing ones happens in later tasks.

**Files:**
- Create: `src/lib/materials/types.ts`
- Create: `src/lib/materials/atoms.ts`
- Create: `src/lib/materials/index.ts`

- [ ] **Step 2.1: Create `src/lib/materials/types.ts`**

```typescript
/** Primitives shared across all object-type catalogs. Maps 1:1 to a future
 *  `materials` DB table row. */
export interface MaterialAtom {
  /** Stable slug (kebab or snake). Becomes DB `slug` column. */
  id: string;
  /** i18n key for the human-readable name. */
  labelKey: string;
  /** Fallback colour if no texture, or tint colour when texture present. */
  color: string;
  /** Optional PBR texture set. */
  textures?: {
    color: string;
    normal: string;
    roughness: string;
  };
  /** Meters each texture tile covers (controls repeat density). */
  tileSize?: [number, number];
  /** Soft-delete placeholder. Admin will set this; configurator treats
   *  non-null as "hide from picker, still render in existing configs". */
  archivedAt?: string | null;
}

/** Per-object catalog entry — references an atom by slug and adds
 *  object-specific context. Each object type has its own entry shape. */
export interface BaseCatalogEntry {
  atomId: string;
}

export interface WallCatalogEntry extends BaseCatalogEntry {
  pricePerSqm: number;
  /** If true, selecting this material clears doors and windows
   *  (currently used by `glass`). */
  clearsOpenings?: boolean;
}

export interface RoofTrimCatalogEntry extends BaseCatalogEntry {
  // Trim has no price — it's purely visual in the current pricing model.
}

export interface RoofCoveringCatalogEntry extends BaseCatalogEntry {
  pricePerSqm: number;
}

export interface FloorCatalogEntry extends BaseCatalogEntry {
  pricePerSqm: number;
  /** Marks the "none" option — renders no floor geometry, no swatch. */
  isVoid?: boolean;
}

export interface DoorCatalogEntry extends BaseCatalogEntry {
  /** Flat surcharge added to door base price. */
  surcharge: number;
}
```

- [ ] **Step 2.2: Create `src/lib/materials/atoms.ts`**

This file is the single source of truth for material primitives. Every atom that any catalog references must exist here. Slugs preserve existing string IDs (`wood`, `brick`, `render`, `metal`, `glass`, `dakpannen`, `riet`, `epdm`, `polycarbonaat`, `metaal`, `geen`, `tegels`, `beton`, `hout`, `aluminium`, `pvc`, `staal`) — do not rename during this refactor. Texture data is moved from `src/lib/textures.ts` WALL_TEXTURE_MAP / FLOOR_TEXTURE_MAP / ROOF_TEXTURE_MAP / WALL_TILE_SIZE / FLOOR_TILE_SIZE / ROOF_TILE_SIZE.

Note that `metal` (wall) and `metaal` (roof covering) are distinct atoms with different slugs — leave them separate; reconciling is a follow-up decision.

```typescript
import type { MaterialAtom } from './types';

/** Flat registry of all material primitives used across object catalogs.
 *  Mirrors a future `materials` DB table. Keys are stable slugs. */
export const MATERIALS_REGISTRY: Record<string, MaterialAtom> = {
  // ── Wall / structural surface atoms ────────────────────────────────
  wood: {
    id: 'wood',
    labelKey: 'material.wood',
    color: '#8B6914',
    textures: {
      color: '/textures/wood_color.jpg',
      normal: '/textures/wood_normal.jpg',
      roughness: '/textures/wood_roughness.jpg',
    },
    tileSize: [1.5, 1.5],
  },
  brick: {
    id: 'brick',
    labelKey: 'material.brick',
    color: '#8B4513',
    textures: {
      color: '/textures/brick_color.jpg',
      normal: '/textures/brick_normal.jpg',
      roughness: '/textures/brick_roughness.jpg',
    },
    tileSize: [3, 2],
  },
  render: {
    id: 'render',
    labelKey: 'material.render',
    color: '#F5F5DC',
    textures: {
      color: '/textures/plaster_color.jpg',
      normal: '/textures/plaster_normal.jpg',
      roughness: '/textures/plaster_roughness.jpg',
    },
    tileSize: [3, 3],
  },
  metal: {
    id: 'metal',
    labelKey: 'material.metal',
    color: '#708090',
    textures: {
      color: '/textures/metal_color.jpg',
      normal: '/textures/metal_normal.jpg',
      roughness: '/textures/metal_roughness.jpg',
    },
    tileSize: [1.5, 2],
  },
  glass: {
    id: 'glass',
    labelKey: 'material.glass',
    color: '#B8D4E3',
  },

  // ── Roof covering atoms ────────────────────────────────────────────
  dakpannen: {
    id: 'dakpannen',
    labelKey: 'material.dakpannen',
    color: '#8B4513',
    textures: {
      color: '/textures/roof_tiles_color.jpg',
      normal: '/textures/roof_tiles_normal.jpg',
      roughness: '/textures/roof_tiles_roughness.jpg',
    },
    tileSize: [2, 2],
  },
  riet: {
    id: 'riet',
    labelKey: 'material.riet',
    color: '#C4A84E',
    textures: {
      color: '/textures/thatch_color.jpg',
      normal: '/textures/thatch_normal.jpg',
      roughness: '/textures/thatch_roughness.jpg',
    },
    tileSize: [3, 3],
  },
  epdm: {
    id: 'epdm',
    labelKey: 'material.epdm',
    color: '#2C2C2C',
  },
  polycarbonaat: {
    id: 'polycarbonaat',
    labelKey: 'material.polycarbonaat',
    color: '#D4E8F0',
  },
  metaal: {
    id: 'metaal',
    labelKey: 'material.metaal',
    color: '#708090',
  },

  // ── Floor atoms ────────────────────────────────────────────────────
  geen: {
    id: 'geen',
    labelKey: 'material.geen',
    color: 'transparent',
  },
  tegels: {
    id: 'tegels',
    labelKey: 'material.tegels',
    color: '#B0A090',
    textures: {
      color: '/textures/floor_tiles_color.jpg',
      normal: '/textures/floor_tiles_normal.jpg',
      roughness: '/textures/floor_tiles_roughness.jpg',
    },
    tileSize: [2, 2],
  },
  beton: {
    id: 'beton',
    labelKey: 'material.beton',
    color: '#A0A0A0',
    textures: {
      color: '/textures/floor_concrete_color.jpg',
      normal: '/textures/floor_concrete_normal.jpg',
      roughness: '/textures/floor_concrete_roughness.jpg',
    },
    tileSize: [3, 3],
  },
  hout: {
    id: 'hout',
    labelKey: 'material.hout',
    color: '#C4A672',
    textures: {
      color: '/textures/floor_wood_color.jpg',
      normal: '/textures/floor_wood_normal.jpg',
      roughness: '/textures/floor_wood_roughness.jpg',
    },
    tileSize: [1.5, 1.5],
  },

  // ── Door atoms ─────────────────────────────────────────────────────
  aluminium: {
    id: 'aluminium',
    labelKey: 'material.aluminium',
    color: '#A8ADB4',
  },
  pvc: {
    id: 'pvc',
    labelKey: 'material.pvc',
    color: '#E8E8E8',
  },
  staal: {
    id: 'staal',
    labelKey: 'material.staal',
    color: '#4A5058',
  },
  // Note: `wood` (above) is reused by doors. No duplicate atom needed.
};

/** Resolve an atom by slug. Returns null if not registered. */
export function getAtom(slug: string): MaterialAtom | null {
  return MATERIALS_REGISTRY[slug] ?? null;
}

/** Resolve an atom's colour, falling back to a neutral grey if missing. */
export function getAtomColor(slug: string): string {
  return MATERIALS_REGISTRY[slug]?.color ?? '#808080';
}
```

- [ ] **Step 2.3: Create `src/lib/materials/index.ts`**

```typescript
export * from './types';
export * from './atoms';
export * from './catalogs/wall';
export * from './catalogs/roof-trim';
export * from './catalogs/roof-cover';
export * from './catalogs/floor';
export * from './catalogs/door';
```

- [ ] **Step 2.4: Create placeholder catalog files so `index.ts` does not break the build**

Because Task 2.3 imports all five catalog files, they must exist (even empty) before `pnpm tsc --noEmit` passes. Create each with an empty export:

`src/lib/materials/catalogs/wall.ts`:
```typescript
import type { WallCatalogEntry } from '../types';
export const WALL_CATALOG: WallCatalogEntry[] = [];
```

`src/lib/materials/catalogs/roof-trim.ts`:
```typescript
import type { RoofTrimCatalogEntry } from '../types';
export const ROOF_TRIM_CATALOG: RoofTrimCatalogEntry[] = [];
```

`src/lib/materials/catalogs/roof-cover.ts`:
```typescript
import type { RoofCoveringCatalogEntry } from '../types';
export const ROOF_COVERING_CATALOG: RoofCoveringCatalogEntry[] = [];
```

`src/lib/materials/catalogs/floor.ts`:
```typescript
import type { FloorCatalogEntry } from '../types';
export const FLOOR_CATALOG: FloorCatalogEntry[] = [];
```

`src/lib/materials/catalogs/door.ts`:
```typescript
import type { DoorCatalogEntry } from '../types';
export const DOOR_CATALOG: DoorCatalogEntry[] = [];
```

Task 3 fills these in.

- [ ] **Step 2.5: Type-check**

```bash
pnpm tsc --noEmit
```
Expected: no output (passes).

- [ ] **Step 2.6: Commit**

```bash
git add src/lib/materials
git commit -m "feat: add materials registry skeleton (atoms + catalog types)"
```

---

## Task 3: Populate catalogs with current material definitions

Fill in every catalog with entries that reproduce today's material lists exactly. No consumers migrate yet — this just locks in the data so Task 4-7 can swap imports one file at a time.

**Files:**
- Modify: `src/lib/materials/catalogs/wall.ts`
- Modify: `src/lib/materials/catalogs/roof-trim.ts`
- Modify: `src/lib/materials/catalogs/roof-cover.ts`
- Modify: `src/lib/materials/catalogs/floor.ts`
- Modify: `src/lib/materials/catalogs/door.ts`

Source data is in `src/lib/constants.ts`: WALL_MATERIALS (lines 16-22), ROOF_COVERINGS (lines 25-31), FLOOR_MATERIALS (lines 99-104), DOOR_MATERIALS (lines 50-55). Trim currently reuses WALL_MATERIALS; keep that mapping.

- [ ] **Step 3.1: Populate `wall.ts`**

```typescript
import type { WallCatalogEntry } from '../types';

export const WALL_CATALOG: WallCatalogEntry[] = [
  { atomId: 'wood',   pricePerSqm: 45 },
  { atomId: 'brick',  pricePerSqm: 65 },
  { atomId: 'render', pricePerSqm: 55 },
  { atomId: 'metal',  pricePerSqm: 70 },
  { atomId: 'glass',  pricePerSqm: 120, clearsOpenings: true },
];
```

- [ ] **Step 3.2: Populate `roof-trim.ts`**

```typescript
import type { RoofTrimCatalogEntry } from '../types';

export const ROOF_TRIM_CATALOG: RoofTrimCatalogEntry[] = [
  { atomId: 'wood' },
  { atomId: 'brick' },
  { atomId: 'render' },
  { atomId: 'metal' },
  { atomId: 'glass' },
];
```

- [ ] **Step 3.3: Populate `roof-cover.ts`**

```typescript
import type { RoofCoveringCatalogEntry } from '../types';

export const ROOF_COVERING_CATALOG: RoofCoveringCatalogEntry[] = [
  { atomId: 'dakpannen',     pricePerSqm: 55 },
  { atomId: 'riet',          pricePerSqm: 85 },
  { atomId: 'epdm',          pricePerSqm: 35 },
  { atomId: 'polycarbonaat', pricePerSqm: 40 },
  { atomId: 'metaal',        pricePerSqm: 50 },
];
```

- [ ] **Step 3.4: Populate `floor.ts`**

```typescript
import type { FloorCatalogEntry } from '../types';

export const FLOOR_CATALOG: FloorCatalogEntry[] = [
  { atomId: 'geen',   pricePerSqm: 0,  isVoid: true },
  { atomId: 'tegels', pricePerSqm: 35 },
  { atomId: 'beton',  pricePerSqm: 25 },
  { atomId: 'hout',   pricePerSqm: 55 },
];
```

- [ ] **Step 3.5: Populate `door.ts`**

```typescript
import type { DoorCatalogEntry } from '../types';

export const DOOR_CATALOG: DoorCatalogEntry[] = [
  { atomId: 'wood',      surcharge: 0 },
  { atomId: 'aluminium', surcharge: 150 },
  { atomId: 'pvc',       surcharge: 0 },
  { atomId: 'staal',     surcharge: 250 },
];
```

- [ ] **Step 3.6: Add helper to resolve a catalog entry with its atom**

Append to `src/lib/materials/atoms.ts`:

```typescript
import type { BaseCatalogEntry } from './types';

/** Join a catalog entry with its atom. Returns null if atom missing. */
export function resolveEntry<T extends BaseCatalogEntry>(
  entry: T,
): (T & { atom: MaterialAtom }) | null {
  const atom = getAtom(entry.atomId);
  if (!atom) return null;
  return { ...entry, atom };
}

/** Resolve a catalog to [entry, atom] tuples, skipping archived atoms. */
export function resolveCatalog<T extends BaseCatalogEntry>(
  catalog: T[],
): Array<T & { atom: MaterialAtom }> {
  const out: Array<T & { atom: MaterialAtom }> = [];
  for (const entry of catalog) {
    const atom = getAtom(entry.atomId);
    if (!atom) continue;
    if (atom.archivedAt) continue;
    out.push({ ...entry, atom });
  }
  return out;
}
```

- [ ] **Step 3.7: Add i18n keys for every atom label**

Edit `src/lib/i18n.ts`. Add these keys alongside existing `material.*` entries (keeping Dutch labels that match current UI copy):

```typescript
'material.wood': 'Hout',
'material.brick': 'Steen',
'material.render': 'Stucwerk',
'material.metal': 'Metaal',
'material.glass': 'Glas',
'material.dakpannen': 'Dakpannen',
'material.riet': 'Riet',
'material.epdm': 'EPDM',
'material.polycarbonaat': 'Polycarbonaat',
'material.metaal': 'Staalplaten',
'material.geen': 'Geen',
'material.tegels': 'Tegels',
'material.beton': 'Beton',
'material.hout': 'Hout (vlonders)',
'material.aluminium': 'Aluminium',
'material.pvc': 'PVC',
'material.staal': 'Staal',
```

If any of these keys already exist (e.g. `material.wood`), do not duplicate — just ensure the value matches.

- [ ] **Step 3.8: Type-check**

```bash
pnpm tsc --noEmit
```
Expected: no output.

- [ ] **Step 3.9: Commit**

```bash
git add src/lib/materials src/lib/i18n.ts
git commit -m "feat: populate material catalogs and i18n labels"
```

---

## Task 4: Migrate wall material + roof trim to read from catalogs

This is the consistency win. Both pickers render from the same catalog data shape. No share-code changes yet — serialization still uses the current string IDs.

**Files:**
- Modify: `src/components/ui/SurfaceProperties.tsx`
- Modify: `src/components/ui/RoofConfigSection.tsx` (trim half only — covering in Task 5)
- Modify: `src/components/canvas/Wall.tsx`
- Modify: `src/components/canvas/Roof.tsx` (fascia half only — covering in Task 5)
- Modify: `src/components/schematic/WallElevation.tsx`
- Modify: `src/components/schematic/SchematicWalls.tsx`
- Modify: `src/components/schematic/exportFloorPlan.ts`
- Modify: `src/lib/pricing.ts` (wall side only)
- Modify: `src/lib/textures.ts` (wall + roof-trim helpers)

- [ ] **Step 4.1: Rewrite `SurfaceProperties.tsx` material picker to use `WALL_CATALOG`**

Change imports: drop `WALL_MATERIALS` from `@/lib/constants`, add:
```typescript
import { WALL_CATALOG, resolveCatalog } from '@/lib/materials';
```

Replace the material grid (`WALL_MATERIALS.map(...)` block, lines 47-81) with catalog-driven rendering:

```jsx
<div className="grid grid-cols-5 gap-1.5">
  {resolveCatalog(WALL_CATALOG).map(({ atomId, atom, clearsOpenings }) => {
    const isSelected = wallCfg.materialId === atomId;
    return (
      <button
        key={atomId}
        onClick={() => {
          handleChange('materialId', atomId);
          if (clearsOpenings) {
            handleChange('hasDoor', false);
            handleChange('windows', []);
          }
        }}
        className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all ${
          isSelected
            ? 'border-primary bg-primary/5 ring-1 ring-primary'
            : 'border-border hover:border-primary/40'
        }`}
      >
        <span
          className="h-7 w-7 rounded-md border border-border/50"
          style={{
            backgroundColor: atom.color,
            opacity: atomId === 'glass' ? 0.6 : 1,
          }}
        />
        <span className={`text-[10px] font-medium leading-tight ${
          isSelected ? 'text-primary' : 'text-muted-foreground'
        }`}>
          {t(atom.labelKey)}
        </span>
      </button>
    );
  })}
</div>
```

Also replace `const isGlass = wallCfg.materialId === 'glass';` with a catalog-aware derivation:

```typescript
const currentWallEntry = WALL_CATALOG.find(e => e.atomId === wallCfg.materialId);
const isGlass = currentWallEntry?.clearsOpenings === true;
```

- [ ] **Step 4.2: Rewrite `RoofConfigSection.tsx` trim picker to use `ROOF_TRIM_CATALOG`**

Change imports: drop `WALL_MATERIALS` from `@/lib/constants`, add:
```typescript
import { ROOF_TRIM_CATALOG, resolveCatalog } from '@/lib/materials';
```

Replace the trim grid (lines 48-80, the `{WALL_MATERIALS.map(...)}` block under "Trim material — same options as wall materials") with:

```jsx
<div className="grid grid-cols-5 gap-1.5">
  {resolveCatalog(ROOF_TRIM_CATALOG).map(({ atomId, atom }) => {
    const isSelected = roof.trimMaterialId === atomId;
    return (
      <button
        key={atomId}
        onClick={() => updateRoof({ trimMaterialId: atomId })}
        className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all ${
          isSelected
            ? 'border-primary bg-primary/5 ring-1 ring-primary'
            : 'border-border hover:border-primary/40'
        }`}
      >
        <span
          className="h-7 w-7 rounded-md border border-border/50"
          style={{
            backgroundColor: atom.color,
            opacity: atomId === 'glass' ? 0.6 : 1,
          }}
        />
        <span className={`text-[10px] font-medium leading-tight ${
          isSelected ? 'text-primary' : 'text-muted-foreground'
        }`}>
          {t(atom.labelKey)}
        </span>
      </button>
    );
  })}
</div>
```

- [ ] **Step 4.3: Replace `useWallTexture` internal map with atom lookup**

Edit `src/lib/textures.ts`. Replace the `WALL_TEXTURE_MAP` constant (lines 8-29) and `WALL_TILE_SIZE` constant (lines 71-76) by deriving from the registry. At the top:

```typescript
import { MATERIALS_REGISTRY } from './materials/atoms';
```

Delete `WALL_TEXTURE_MAP` and `WALL_TILE_SIZE` declarations. Inside `useWallTexture` (line 106), change:

```typescript
const paths = WALL_TEXTURE_MAP[materialId];
const tileSize = WALL_TILE_SIZE[materialId];
```

to:

```typescript
const atom = MATERIALS_REGISTRY[materialId];
const paths = atom?.textures ?? null;
const tileSize = atom?.tileSize ?? null;
```

Do the same substitution inside `useFloorTexture` (line 229) using `FLOOR_TEXTURE_MAP`/`FLOOR_TILE_SIZE` and inside `useRoofTexture` (line 187) using `ROOF_TEXTURE_MAP`/`ROOF_TILE_SIZE` — after substitution, delete those three constant declarations too (delete `FLOOR_TEXTURE_MAP` lines 32-48, `FLOOR_TILE_SIZE` lines 64-68, `ROOF_TEXTURE_MAP` lines 51-62, `ROOF_TILE_SIZE` lines 78-81).

`useDoorTexture` (line 146) currently hard-wires `WALL_TEXTURE_MAP.wood` — replace with:

```typescript
const paths = MATERIALS_REGISTRY.wood?.textures ?? null;
```

- [ ] **Step 4.4: Verify wall/roof/floor 3D rendering still works via registry**

Open `src/components/canvas/Wall.tsx`. Find every use of `WALL_MATERIALS` (they look up `material.color` for the fallback when textures are not loaded). Replace the import:

```typescript
import { getAtomColor } from '@/lib/materials';
```

and replace `WALL_MATERIALS.find(m => m.id === wallCfg.materialId)?.color ?? '#fff'` (or similar) with `getAtomColor(wallCfg.materialId)`.

Do the same for `src/components/canvas/Roof.tsx` (trim fascia colour resolution only — covering handled in Task 5). Do the same for `src/components/canvas/Floor.tsx` (wrapped in Task 5 — skip here if not touched).

Run this grep to find every call site to update in Task 4:
```bash
grep -rn "WALL_MATERIALS" src
```

Every remaining reference in `canvas/`, `schematic/`, and `pricing.ts` must be replaced with `getAtomColor(...)` (for colour) or `WALL_CATALOG.find(e => e.atomId === id)?.pricePerSqm` (for pricing).

- [ ] **Step 4.5: Update `pricing.ts` wall side**

In `src/lib/pricing.ts`, change the import:

```typescript
import { WALL_CATALOG } from '@/lib/materials';
```

Remove `WALL_MATERIALS` from the `@/lib/constants` import at line 8.

The `findPrice` helper (line 28) still works — but you now pass the catalog:

```typescript
const materialCost = area * findPrice(WALL_CATALOG, wallCfg.materialId);
```

Because `findPrice` iterates on `{ id: string; pricePerSqm: number }`, change it to accept catalog-shaped entries:

```typescript
function findPrice(
  items: readonly { atomId: string; pricePerSqm: number }[],
  atomId: string,
): number {
  return items.find((m) => m.atomId === atomId)?.pricePerSqm ?? 0;
}
```

Update the one call site that used `WALL_MATERIALS` (line 101 area) to pass `WALL_CATALOG`. Leave the `ROOF_COVERINGS` and `FLOOR_MATERIALS` usage for now — Task 5 handles them.

- [ ] **Step 4.6: Update `schematic/WallElevation.tsx`, `schematic/SchematicWalls.tsx`, `schematic/exportFloorPlan.ts`**

In each file, replace `WALL_MATERIALS.find(m => m.id === id)?.color` with `getAtomColor(id)`. Import path: `import { getAtomColor } from '@/lib/materials';`. Remove the now-unused `WALL_MATERIALS` from the `@/lib/constants` import.

- [ ] **Step 4.7: Delete `WALL_MATERIALS` from constants.ts**

Only do this after grep confirms no remaining consumer. Run:

```bash
grep -rn "WALL_MATERIALS" src
```

Expected: zero matches outside the declaration itself.

Then edit `src/lib/constants.ts`: delete lines 15-22 (the `WALL_MATERIALS` const and its preceding comment). Also delete the `SurfaceMaterial` import from `@/types/building` if no other declaration in `constants.ts` uses it — verify with grep on `SurfaceMaterial` inside `constants.ts`.

- [ ] **Step 4.8: Type-check, build, smoke test**

```bash
pnpm tsc --noEmit && pnpm build
```

Dev-server smoke:
```bash
pnpm dev
```

In browser:
1. Click a `berging` wall — material picker shows 5 options (Hout/Steen/Stucwerk/Metaal/Glas). Clicking each changes the 3D wall colour and (for textured ones) the texture.
2. Click the roof section — trim picker shows the same 5 options. Clicking each changes the fascia board colour on the flat roof.
3. Click "Glas" on a wall — doors and windows clear, as before.
4. Open the quote panel — wall material line items show prices matching before (€45/m² for wood, €120/m² for glass, etc.).

- [ ] **Step 4.9: Commit**

```bash
git add -A
git commit -m "refactor: wall material and roof trim read from catalogs"
```

---

## Task 5: Migrate roof covering, floor, and door to catalogs

Same pattern as Task 4, applied to the remaining three object types. By the end, `src/lib/constants.ts` no longer exports any material arrays.

**Files:**
- Modify: `src/components/ui/RoofConfigSection.tsx` (covering half)
- Modify: `src/components/ui/FloorConfigSection.tsx`
- Modify: `src/components/ui/DoorConfig.tsx`
- Modify: `src/components/canvas/Roof.tsx` (covering half)
- Modify: `src/components/canvas/Floor.tsx`
- Modify: `src/lib/pricing.ts` (roof + floor + door sides)
- Modify: `src/lib/constants.ts` (delete ROOF_COVERINGS, FLOOR_MATERIALS, DOOR_MATERIALS)

- [ ] **Step 5.1: Rewrite roof covering picker in `RoofConfigSection.tsx`**

Replace the `ROOF_COVERINGS.map(...)` grid (lines 19-45 area) with:

```jsx
<div className="grid grid-cols-2 gap-1.5">
  {resolveCatalog(ROOF_COVERING_CATALOG).map(({ atomId, atom, pricePerSqm }) => {
    const isSelected = roof.coveringId === atomId;
    return (
      <button
        key={atomId}
        onClick={() => updateRoof({ coveringId: atomId as typeof roof.coveringId })}
        className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all ${
          isSelected
            ? 'border-primary bg-primary/5 ring-1 ring-primary'
            : 'border-border hover:border-primary/40'
        }`}
      >
        <div
          className="h-6 w-6 shrink-0 rounded-md border border-border/50"
          style={{ backgroundColor: atom.color }}
        />
        <div>
          <div className={`text-xs font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
            {t(atom.labelKey)}
          </div>
          <div className="text-[10px] text-muted-foreground">{'\u20AC'}{pricePerSqm}/m{'\u00B2'}</div>
        </div>
      </button>
    );
  })}
</div>
```

Import:
```typescript
import { ROOF_COVERING_CATALOG, resolveCatalog } from '@/lib/materials';
```

(Leave the existing `ROOF_TRIM_CATALOG`/`resolveCatalog` import from Task 4.2 merged into one import line.)

Note the `as typeof roof.coveringId` cast — the registry uses plain strings but `RoofConfig.coveringId` is typed `RoofCoveringId`. Task 7 tightens this.

- [ ] **Step 5.2: Rewrite `FloorConfigSection.tsx`**

```typescript
import { FLOOR_CATALOG, resolveCatalog } from '@/lib/materials';
```

Replace the `FLOOR_MATERIALS.map(...)` grid with:

```jsx
<div className="grid grid-cols-2 gap-1.5">
  {resolveCatalog(FLOOR_CATALOG).map(({ atomId, atom, isVoid }) => {
    const isSelected = floorMaterialId === atomId;
    return (
      <button
        key={atomId}
        onClick={() => updateBuildingFloor(selectedBuildingId, {
          materialId: atomId as typeof floorMaterialId,
        })}
        className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-all ${
          isSelected
            ? 'border-primary bg-primary/5 ring-1 ring-primary text-primary'
            : 'border-border text-foreground hover:border-primary/40'
        }`}
      >
        {!isVoid && (
          <span
            className="inline-block h-5 w-5 shrink-0 rounded-md border border-border/50"
            style={{ backgroundColor: atom.color }}
          />
        )}
        {t(atom.labelKey)}
      </button>
    );
  })}
</div>
```

- [ ] **Step 5.3: Rewrite door material picker in `DoorConfig.tsx`**

Change import line 5 to drop `DOOR_MATERIALS`:
```typescript
import { clampOpeningPosition, DOOR_W, DOUBLE_DOOR_W, getWallLength, WIN_W } from '@/lib/constants';
import { DOOR_CATALOG, resolveCatalog } from '@/lib/materials';
```

Replace the `DOOR_MATERIALS.map(...)` in the ToggleGroup (lines 100-104) with:

```jsx
{resolveCatalog(DOOR_CATALOG).map(({ atomId, atom }) => (
  <ToggleGroupItem key={atomId} value={atomId} className="flex-1 text-xs">
    {t(atom.labelKey)}
  </ToggleGroupItem>
))}
```

- [ ] **Step 5.4: Update canvas and pricing consumers**

Run:
```bash
grep -rn "FLOOR_MATERIALS\|ROOF_COVERINGS\|DOOR_MATERIALS" src
```

For each remaining reference in `canvas/` or `pricing.ts`:
- Colour/visual lookups → `getAtomColor(id)` or `MATERIALS_REGISTRY[id]`.
- Pricing lookups → use the relevant catalog: `FLOOR_CATALOG.find(e => e.atomId === id)?.pricePerSqm ?? 0`, analogous for `ROOF_COVERING_CATALOG`, and for door surcharge `DOOR_CATALOG.find(e => e.atomId === id)?.surcharge ?? 0`.

In `src/lib/pricing.ts`:

- Drop `ROOF_COVERINGS`, `FLOOR_MATERIALS`, `DOOR_MATERIALS` from the constants import.
- Add:
  ```typescript
  import {
    WALL_CATALOG,
    ROOF_COVERING_CATALOG,
    FLOOR_CATALOG,
    DOOR_CATALOG,
  } from '@/lib/materials';
  ```
- Replace `findSurcharge` body:
  ```typescript
  function findSurcharge(id: string): number {
    return DOOR_CATALOG.find((m) => m.atomId === id)?.surcharge ?? 0;
  }
  ```
- Update `roofLineItem` to use `ROOF_COVERING_CATALOG` in place of `ROOF_COVERINGS`.
- Update `floorLineItem` to use `FLOOR_CATALOG` in place of `FLOOR_MATERIALS`.

`findPrice` should already accept `{ atomId, pricePerSqm }` after Task 4.5 — all catalogs have that shape, so no further change.

- [ ] **Step 5.5: Delete dead exports from `constants.ts`**

Verify:
```bash
grep -rn "ROOF_COVERINGS\|FLOOR_MATERIALS\|DOOR_MATERIALS\|FLOOR_TEXTURE_MAP\|ROOF_TEXTURE_MAP\|WALL_TILE_SIZE\|FLOOR_TILE_SIZE\|ROOF_TILE_SIZE" src
```

Expected: only matches inside `src/lib/constants.ts` (declarations) and `src/lib/textures.ts` (declarations already removed in Task 4.3 if you did it). If `textures.ts` still has references, finish the Task 4.3 removal now.

In `src/lib/constants.ts`, delete:
- Lines 25-31 (`ROOF_COVERINGS`)
- Lines 43-55 (`DoorMaterial` interface and `DOOR_MATERIALS` const)
- Lines 92-104 (`FloorMaterial` interface and `FLOOR_MATERIALS` const)

Also remove `SurfaceMaterial, RoofCovering` from the `@/types/building` import if unused.

- [ ] **Step 5.6: Delete unused interfaces from `types/building.ts`**

Delete:
- Lines 15-20 (`SurfaceMaterial` interface)
- Lines 63-68 (`RoofCovering` interface)

- [ ] **Step 5.7: Type-check, build, smoke test**

```bash
pnpm tsc --noEmit && pnpm build
```

Smoke test in dev server — run through every picker:
1. Wall material, roof covering, roof trim, floor material, door material — each renders and changes reflect in 3D and/or quote.
2. Switching roof covering updates roof colour/texture correctly (dakpannen texture still loads).
3. Floor material "Geen" still renders nothing; "Hout (vlonders)" shows wood texture.
4. Door material toggle group still updates label.

- [ ] **Step 5.8: Commit**

```bash
git add -A
git commit -m "refactor: roof covering, floor, and door read from catalogs"
```

---

## Task 6: Bump share code to version 6 with slug encoding

Switch share-code material references from fixed 3-bit indices into local lookup tables to inline length-prefixed slug strings. This decouples wire format from catalog order, so admin-driven catalog edits will not invalidate existing codes. Remove v2/v3/v4/v5 decode branches.

**Rationale for string-based encoding:** Once an admin can rename/reorder/delete materials, index encoding is unsafe. Slug strings are stable identifiers — even if the human-readable label changes in the DB, the slug is the record's identity. Code size grows (a `polycarbonaat` reference is 13 chars × 8 bits + 4-bit length = 108 bits vs 3 bits before) — acceptable per user: this is an internal tool and roof material references are rare (one per roof, one per wall, etc.).

**Files:**
- Modify: `src/lib/configCode.ts`

- [ ] **Step 6.1: Add slug helpers to BitWriter/BitReader**

In `src/lib/configCode.ts`, extend the `BitWriter` class (around line 78):

```typescript
  /** Writes a lowercase ASCII slug of up to 15 chars. Format:
   *  4 bits length + length*8 bits ASCII. */
  writeSlug(slug: string): void {
    const len = Math.min(slug.length, 15);
    this.write(len, 4);
    for (let i = 0; i < len; i++) {
      this.write(slug.charCodeAt(i) & 0xff, 8);
    }
  }
```

Extend `BitReader` (around line 110):

```typescript
  readSlug(): string {
    const len = this.read(4);
    let out = '';
    for (let i = 0; i < len; i++) {
      out += String.fromCharCode(this.read(8));
    }
    return out;
  }
```

- [ ] **Step 6.2: Delete legacy lookup arrays**

Delete these lines from `configCode.ts`:
- Line 142: `const COVERING_IDS: RoofCoveringId[] = [...]`
- Line 143: `const TRIM_MATERIAL_IDS = [...]`
- Line 144: `const FLOOR_IDS: FloorMaterialId[] = [...]`
- Line 147: `const MATERIAL_IDS = [...]`
- Line 149: `const DOOR_MATERIAL_IDS: DoorMaterialId[] = [...]`

Keep `BUILDING_TYPES`, `ORIENTATIONS`, `WALL_SLOTS`, `WALL_SIDES`, `DOOR_SIZES`, `DOOR_SWINGS` — those are not material lookups.

- [ ] **Step 6.3: Bump VERSION and rewrite `encodeState` / `encodeWall` material fields**

Change line 163:
```typescript
const VERSION = 6;
```

Update header emission at lines 231-232 — version 6 = extended version 2 past the 4-base (0,2) + (2,2) = 4 + 2 = 6:
```typescript
w.write(0, 2); // escape: extended version
w.write(2, 2); // extension bits: 4 + 2 = version 6
```

In `encodeWall` (around line 165), replace the material write:
- Was: `w.write(indexOf(MATERIAL_IDS, wall.materialId), 3);`
- Now: `w.writeSlug(wall.materialId);`

In `encodeWall`, the door-material write:
- Was: `w.write(indexOf(DOOR_MATERIAL_IDS, wall.doorMaterialId), 2);`
- Now: `w.writeSlug(wall.doorMaterialId);`

In `encodeState` roof section (around line 239-240):
- Was:
  ```typescript
  w.write(indexOf(COVERING_IDS, roof.coveringId), 3);
  w.write(indexOf(TRIM_MATERIAL_IDS, roof.trimMaterialId), 3);
  ```
- Now:
  ```typescript
  w.writeSlug(roof.coveringId);
  w.writeSlug(roof.trimMaterialId);
  ```

In the overkapping/berging branch (around line 293):
- Was: `w.write(indexOf(FLOOR_IDS, b.floor.materialId), 2);`
- Now: `w.writeSlug(b.floor.materialId);`

- [ ] **Step 6.4: Rewrite `decodeState` / `decodeWall` to only handle v6**

Replace lines 335-345 (version detection) with:

```typescript
let version = r.read(2);
if (version === 0) {
  version = 4 + r.read(2);
}
if (version !== 6) throw new Error(`Unsupported share code version: ${version}`);
```

Delete the `isV3`, `isV4`, `isV5` flags (lines 342-344).

In the roof section (replace lines 350-354):
```typescript
const coveringId = r.readSlug() as RoofCoveringId;
const trimMaterialId = r.readSlug();
const insulation = r.read(1) === 1;
const insulationThickness = insulation ? clamp(r.read(5) * 10 + 50, 50, 300) : 150;
const hasSkylight = r.read(1) === 1;
```

Default height (replace lines 362-366) — drop v3/v4 branches:
```typescript
const defaultHeight = clamp(r.read(4) * 0.1 + 2.2, 2.2, 3);
```

In the building loop:

- Building type: drop version conditional — always read 2 bits (lines 373-375 become):
  ```typescript
  const typeIdx = r.read(2);
  const type = BUILDING_TYPES[clamp(typeIdx, 0, BUILDING_TYPES.length - 1)];
  ```
- Remove the `(isV4 || isV5)` wrapper around heightOverride / orientation (lines 380-388) — those now always read:
  ```typescript
  let heightOverride: number | null = null;
  const hasOverride = r.read(1) === 1;
  if (hasOverride) {
    heightOverride = clamp(r.read(4) * 0.1 + 2.2, 2.2, 3);
  }
  const orientation = ORIENTATIONS[clamp(r.read(1), 0, 1)];
  ```
- `paal` branch: drop the v3 fallback (lines 391-398) — height always comes from override/default:
  ```typescript
  if (type === 'paal') {
    const height = heightOverride ?? defaultHeight;
    const posX = r.readSigned(7) * 0.5;
    const posZ = r.readSigned(7) * 0.5;
    buildings.push({
      id: crypto.randomUUID(),
      type: 'paal',
      position: [posX, posZ],
      dimensions: { width: 0.15, depth: 0.15, height },
      walls: {},
      hasCornerBraces: false,
      floor: { materialId: 'geen' },
      orientation,
      heightOverride,
    });
    continue;
  }
  ```
- `muur` branch: drop the `(isV4 || isV5)` guard and center-to-corner migration (lines 416-444):
  ```typescript
  if (type === 'muur') {
    const width = clamp(r.read(5) * 0.5 + 1, 1, 16.5);
    const posX = r.readSigned(7) * 0.5;
    const posZ = r.readSigned(7) * 0.5;
    const height = heightOverride ?? defaultHeight;

    const hasFrontWall = r.read(1) === 1;
    const walls: Record<string, WallConfig> = {};
    if (hasFrontWall) {
      walls['front'] = decodeWall(r);
    }

    buildings.push({
      id: crypto.randomUUID(),
      type: 'muur',
      position: [posX, posZ],
      dimensions: { width, depth: 0.2, height },
      walls,
      hasCornerBraces: false,
      floor: { materialId: 'geen' },
      orientation,
      heightOverride,
    });
    continue;
  }
  ```
- overkapping/berging branch (lines 446-478): drop `isV5` ternaries — always use v5 ranges. Floor material is now a slug:
  ```typescript
  const width = clamp(r.read(9) * 0.1 + 1, 1, 40);
  const depth = clamp(r.read(6) * 0.1 + 1, 1, 7);
  const height = clamp(r.read(4) * 0.1 + 2.2, 2.2, 3);
  const posX = r.readSigned(7) * 0.5;
  const posZ = r.readSigned(7) * 0.5;
  const floorMaterialId = r.readSlug() as FloorMaterialId;
  const hasCornerBraces = r.read(1) === 1;

  const mask = r.read(4);
  const walls: Record<string, WallConfig> = {};
  for (let i = 0; i < WALL_SLOTS.length; i++) {
    if (!(mask & (1 << i))) continue;
    walls[WALL_SLOTS[i]] = decodeWall(r);
  }

  buildings.push({
    id: crypto.randomUUID(),
    type,
    position: [posX, posZ],
    dimensions: { width, depth, height },
    walls: Object.keys(walls).length > 0 ? walls : getDefaultWalls(type),
    hasCornerBraces,
    floor: { materialId: floorMaterialId },
    orientation,
    heightOverride,
  });
  ```

In `decodeWall` (replace lines 187-219):

```typescript
function decodeWall(r: BitReader): WallConfig {
  const materialId = r.readSlug();
  const hasDoor = r.read(1) === 1;
  let doorMaterialId: DoorMaterialId = 'wood';
  let doorSize: DoorSize = 'enkel';
  let doorHasWindow = false;
  let doorPosition = 0.5;
  let doorSwing: DoorSwing = 'dicht';
  if (hasDoor) {
    doorMaterialId = r.readSlug() as DoorMaterialId;
    doorSize = DOOR_SIZES[clamp(r.read(1), 0, 1)];
    doorHasWindow = r.read(1) === 1;
    doorPosition = r.read(7) / 100;
    doorSwing = DOOR_SWINGS[clamp(r.read(2), 0, 2)];
  }
  const windowCount = clamp(r.read(3), 0, 7);
  const windows: WallWindow[] = [];
  for (let i = 0; i < windowCount; i++) {
    windows.push({
      id: crypto.randomUUID(),
      position: r.read(7) / 100,
      width: r.read(7) / 10,
      height: r.read(7) / 10,
      sillHeight: r.read(7) / 10,
    });
  }

  return {
    materialId, hasDoor, doorMaterialId, doorSize,
    doorHasWindow, doorPosition, doorSwing, windows,
  };
}
```

- [ ] **Step 6.5: Remove now-unused `indexOf` calls that referenced deleted arrays**

The `indexOf` helper (line 153) still has users (`BUILDING_TYPES`, `ORIENTATIONS`, `WALL_SIDES`, `DOOR_SIZES`, `DOOR_SWINGS`, `FLOOR_IDS` — wait, FLOOR_IDS is deleted). Scan the file:

```bash
grep -n "indexOf(" src/lib/configCode.ts
```

Every remaining `indexOf(...)` call should reference one of the retained arrays (`BUILDING_TYPES`, `ORIENTATIONS`, `WALL_SIDES`, `DOOR_SIZES`, `DOOR_SWINGS`). None should reference `MATERIAL_IDS`, `FINISH_IDS`, `COVERING_IDS`, `TRIM_MATERIAL_IDS`, `FLOOR_IDS`, `DOOR_MATERIAL_IDS` — those are deleted.

- [ ] **Step 6.6: Ad-hoc encode/decode roundtrip check**

Because there is no test framework, verify with a one-off script. Create `scripts/verify-share-code.ts`:

```typescript
import { encodeState, decodeState } from '@/lib/configCode';
import { DEFAULT_ROOF, DEFAULT_WALL } from '@/lib/constants';
import type { BuildingEntity } from '@/types/building';

const buildings: BuildingEntity[] = [
  {
    id: 'b1',
    type: 'berging',
    position: [0, 0],
    dimensions: { width: 4, depth: 4, height: 2.6 },
    walls: {
      front: { ...DEFAULT_WALL, materialId: 'glass' },
      back:  { ...DEFAULT_WALL, materialId: 'brick' },
      left:  { ...DEFAULT_WALL, materialId: 'polycarbonaat' },
      right: { ...DEFAULT_WALL, materialId: 'wood' },
    },
    hasCornerBraces: false,
    floor: { materialId: 'hout' },
    orientation: 'horizontal',
    heightOverride: null,
  },
];

const code = encodeState(buildings, [], { ...DEFAULT_ROOF, coveringId: 'dakpannen', trimMaterialId: 'metal' }, 2.6);
console.log('Encoded:', code);

const decoded = decodeState(code);
console.log('Decoded wall front materialId:', decoded.buildings[0].walls.front?.materialId);
console.log('Decoded floor materialId:', decoded.buildings[0].floor.materialId);
console.log('Decoded roof coveringId:', decoded.roof.coveringId);
console.log('Decoded roof trimMaterialId:', decoded.roof.trimMaterialId);

const ok =
  decoded.buildings[0].walls.front?.materialId === 'glass' &&
  decoded.buildings[0].walls.back?.materialId === 'brick' &&
  decoded.buildings[0].walls.left?.materialId === 'polycarbonaat' &&
  decoded.buildings[0].floor.materialId === 'hout' &&
  decoded.roof.coveringId === 'dakpannen' &&
  decoded.roof.trimMaterialId === 'metal';

if (!ok) { console.error('ROUNDTRIP FAIL'); process.exit(1); }
console.log('ROUNDTRIP OK');
```

Run it:
```bash
pnpm dlx tsx scripts/verify-share-code.ts
```

Expected: `ROUNDTRIP OK`. If it fails, inspect the encoded/decoded output.

Leave the file in place — it is a useful debugging aid and an ad-hoc regression test. It lives outside `src/`, so Next.js will not ship it.

- [ ] **Step 6.7: Build + dev smoke**

```bash
pnpm tsc --noEmit && pnpm build
pnpm dev
```

In browser:
1. Build a configuration (berging with varied wall materials, one pole, one muur), copy the share code.
2. Refresh the page, paste the code. Verify it decodes and all materials (walls, doors, floor, roof covering, trim) match.
3. Verify a v5 code (from before this PR) now throws or shows an error as expected — not silent corruption.

- [ ] **Step 6.8: Commit**

```bash
git add -A
git commit -m "feat: share code v6 — slug-based material encoding"
```

---

## Task 7: Tighten material ID types (branded slugs)

Optional hardening. Turn `WallConfig.materialId: string`, `RoofConfig.trimMaterialId: string`, `FloorConfig.materialId`, etc. into branded slug unions derived from the catalogs. Prevents typos at call sites.

Accept this task only if Tasks 1-6 landed cleanly. If there is any pressure to ship, skip this and file as follow-up.

**Files:**
- Modify: `src/lib/materials/types.ts`
- Modify: `src/types/building.ts`
- Modify: `src/lib/materials/catalogs/*.ts` (add `as const` where needed)

- [ ] **Step 7.1: Derive union types from catalogs**

In each catalog file, add:

`catalogs/wall.ts` (append):
```typescript
export type WallMaterialId = typeof WALL_CATALOG[number]['atomId'];
```

Mark the array `as const`:
```typescript
export const WALL_CATALOG = [
  { atomId: 'wood',   pricePerSqm: 45 },
  { atomId: 'brick',  pricePerSqm: 65 },
  { atomId: 'render', pricePerSqm: 55 },
  { atomId: 'metal',  pricePerSqm: 70 },
  { atomId: 'glass',  pricePerSqm: 120, clearsOpenings: true },
] as const satisfies readonly WallCatalogEntry[];
```

Repeat pattern for `RoofTrimMaterialId`, `RoofCoveringMaterialId` (rename from current `RoofCoveringId` for consistency), `FloorMaterialId`, `DoorMaterialId`.

- [ ] **Step 7.2: Re-point `types/building.ts`**

```typescript
import type { WallMaterialId } from '@/lib/materials/catalogs/wall';
import type { RoofTrimMaterialId } from '@/lib/materials/catalogs/roof-trim';
import type { RoofCoveringMaterialId } from '@/lib/materials/catalogs/roof-cover';
import type { FloorMaterialId } from '@/lib/materials/catalogs/floor';
import type { DoorMaterialId } from '@/lib/materials/catalogs/door';
```

Replace:
- `WallConfig.materialId: string` → `WallConfig.materialId: WallMaterialId`
- `RoofConfig.trimMaterialId: string` → `RoofConfig.trimMaterialId: RoofTrimMaterialId`
- `RoofConfig.coveringId: RoofCoveringId` → `RoofConfig.coveringId: RoofCoveringMaterialId` (and delete the old `RoofCoveringId` type alias, or re-export for compatibility)
- `FloorConfig.materialId: FloorMaterialId` — keep, but now derived from catalog

- [ ] **Step 7.3: Fix fallout**

Run `pnpm tsc --noEmit`. Every error points to a place where `string` was assumed. Add `as WallMaterialId` (etc.) where share-code decoding produces a slug read from input — the runtime `clamp` does not exist for strings, so if a bogus slug comes in, we can either throw or fall back to a default. Recommended: add a helper `toValidSlug(catalog, slug, fallback)` and use it in decode.

Skip this step if fallout is extensive — branding is best-effort.

- [ ] **Step 7.4: Type-check + smoke**

```bash
pnpm tsc --noEmit && pnpm build
```

- [ ] **Step 7.5: Commit**

```bash
git add -A
git commit -m "refactor: brand material IDs from catalog atomIds"
```

---

## Final verification

After all tasks complete, from the worktree root:

- [ ] **`pnpm tsc --noEmit`** → no errors.
- [ ] **`pnpm build`** → compiles successfully.
- [ ] **Manual smoke checklist:**
  1. Wall material picker works; each of wood/brick/render/metal/glass changes the 3D wall. Glass still clears openings.
  2. Roof trim picker works; same 5 options as walls.
  3. Roof covering picker works; dakpannen/riet show textures.
  4. Floor picker works; "Geen" hides floor, "Tegels" shows tile texture.
  5. Door material toggle works.
  6. Quote panel prices match pre-refactor values (spot-check: 16 m² wall of glass = €1920 material cost).
  7. Share code roundtrip: build a config, copy code, refresh, paste, verify identical state.

- [ ] **Merge strategy:** the branch `feat/material-registry` lives on top of `main`. When ready to merge, use `superpowers:finishing-a-development-branch` to choose between merge/PR/cleanup. Do not auto-merge until user confirms in the browser smoke test.

---

## Out-of-scope / follow-ups

These are explicitly NOT in this plan — file as separate work:

1. **Admin UI + API** — this plan only prepares the code shape. Building the actual admin dashboard, API endpoints, and DB migrations are separate projects.
2. **Reconciling `metal` (wall) and `metaal` (roof covering)** — currently distinct atoms with the same colour. Leave as two atoms during refactor; merge if/when admin lands.
3. **Centralised colour library** — atoms still carry their own `color` strings. A future pass could extract a `palette.ts` if duplicates emerge.
4. **Soft-delete behaviour in pickers** — `archivedAt` is stored on atoms but not yet exercised (catalogs pass `resolveCatalog` which skips archived). Admin work will actually set this field.
5. **Share-code version migration** — user opted to skip legacy v2-v5 decode support. If needed later, re-introduce version branches.
