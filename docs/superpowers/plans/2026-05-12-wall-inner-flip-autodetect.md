# Wall Inner-Flip Auto-Detect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-detect the correct outer/inner cladding face mapping for `muur` primitives based on nearby structural buildings, with a sticky manual user override.

**Architecture:** Two optional booleans on `WallConfig` (`innerFlipped`, `innerFlippedManual`); a pure detector `detectInnerFlip(muur, buildings): boolean` in `src/domain/building/innerFlip.ts`; a mutation `applyInnerFlipAutoDetect(cfg, buildingId)` called at muur creation and at drag-end. Renderers multiply the existing per-wall `outerSign` by `(innerFlipped ? -1 : 1)` to produce `effectiveOuterSign` — single touch point in both `Wall.tsx` and `SchematicWalls.tsx`. Manual override sets `innerFlippedManual = true` and locks subsequent auto-detect from overwriting.

**Tech Stack:** TypeScript, React Three Fiber, SVG plattegrond, Zustand, Vitest via Vite+. No DB / schema / pricing changes.

**Spec:** `docs/superpowers/specs/2026-05-12-wall-inner-flip-autodetect-design.md`

---

## File touch-list

**Domain (framework-free):**

- `src/domain/building/types.ts` — add `innerFlipped` + `innerFlippedManual` to `WallConfig`.
- `src/domain/building/innerFlip.ts` (new) — `detectInnerFlip` helper + `INNER_FLIP_DETECT_RADIUS` constant.
- `src/domain/building/index.ts` — re-export the new file.
- `src/domain/config/mutations.ts` — wire `detectInnerFlip` into `addBuilding` muur spawn path; add `applyInnerFlipAutoDetect(cfg, buildingId)` mutation.

**UI:**

- `src/components/schematic/SchematicView.tsx` — call `applyInnerFlipAutoDetect` on `pointerup` after a muur drag commits.
- `src/components/canvas/Wall.tsx` — compute `effectiveOuterSign = (wallCfg.innerFlipped ? -1 : 1) * outwardSign` and apply where `outwardSign` is currently multiplied.
- `src/components/schematic/SchematicWalls.tsx` — same `effectiveOuterSign` wrap.
- `src/components/ui/SurfaceProperties.tsx` — render the manual flip button when the building is a muur AND `materialIdInner || materialIdMiddenlaag` is set.

**Glue:**

- `src/lib/i18n.ts` — `wallProperties.flipInnerOuter` key.

**Tests:**

- `tests/inner-flip-detect.test.ts` (new) — the pure helper.
- `tests/inner-flip-mutations.test.ts` (new) — addBuilding muur + applyInnerFlipAutoDetect mutations.

---

## Conventions (read once)

- `WallConfig`'s wall key for a muur is always `'front'` (per `wallsForType` in `src/domain/config/mutations.ts:63`). The mutations write `walls.front.innerFlipped` / `walls.front.innerFlippedManual`.
- Detector radius constant `INNER_FLIP_DETECT_RADIUS = 5` (metres). Tunable, but locked at 5 for v1.
- `detectInnerFlip` returns `false` for non-muur buildings — caller doesn't need to pre-filter.
- `applyInnerFlipAutoDetect` is a no-op when `walls.front.innerFlippedManual === true` — caller doesn't need to check the lock either.
- All renderer changes are single-line wraps: `const effectiveOuterSign = (wallCfg.innerFlipped ? -1 : 1) * outwardSign;` then use `effectiveOuterSign` where `outwardSign` is currently multiplied into an offset. The strip / slab tables are unchanged.

---

## Task 1: Add `innerFlipped` + `innerFlippedManual` to `WallConfig`

**Files:**
- Modify: `src/domain/building/types.ts`

- [ ] **Step 1: Add the optional fields**

Open `src/domain/building/types.ts`. Find the `WallConfig` interface. Add the two new fields right after `materialIdMiddenlaag`:

```ts
export interface WallConfig {
  // …existing fields, including materialIdInner / materialIdMiddenlaag
  materialIdMiddenlaag?: string | null;
  /** When true, the wall's outer / inner face assignment is flipped relative
   *  to the default geometric convention. Auto-set on muur creation and on
   *  drag-end; user can toggle it manually via the wall properties panel
   *  (which also sets `innerFlippedManual`). */
  innerFlipped?: boolean;
  /** When true, the user has manually toggled `innerFlipped` — auto-detect
   *  events MUST NOT overwrite the value. Reset only by an explicit
   *  "reset to auto" affordance (deferred to v1.1). */
  innerFlippedManual?: boolean;
  hasDoor: boolean;
  // …
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS — both fields are optional so existing consumers are unaffected.

- [ ] **Step 3: Commit**

```bash
git add src/domain/building/types.ts
git commit -m "feat(domain): add WallConfig.innerFlipped + innerFlippedManual"
```

---

## Task 2: `detectInnerFlip` helper + radius constant

**Files:**
- Create: `src/domain/building/innerFlip.ts`
- Modify: `src/domain/building/index.ts`
- Test: `tests/inner-flip-detect.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/inner-flip-detect.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import { detectInnerFlip, INNER_FLIP_DETECT_RADIUS } from '@/domain/building';
import { makeBuilding } from './fixtures';

describe('detectInnerFlip', () => {
  it('returns false for non-muur buildings', () => {
    const overkapping = makeBuilding({ id: 'ok', type: 'overkapping', position: [0, 0], dimensions: { width: 4, depth: 4, height: 2.6 } });
    expect(detectInnerFlip(overkapping, [])).toBe(false);
  });

  it('returns false for a muur with no structural neighbours', () => {
    const muur = makeBuilding({
      id: 'm', type: 'muur', position: [50, 50],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'horizontal',
    });
    expect(detectInnerFlip(muur, [muur])).toBe(false);
  });

  it('returns false when the default-inner face already points toward the neighbour centroid', () => {
    // Horizontal muur at (0, -1) with default outward = -y (per outerSign
    // convention for horizontal muurs sitting on the front side of a
    // structural). Overkapping at origin → centroid at (2, 2). Default-outer
    // face is at y ≈ -1 - 0.075, default-inner at y ≈ -1 + 0.075 — inner is
    // closer to the +y centroid → no flip.
    const muur = makeBuilding({
      id: 'm', type: 'muur', position: [0, -1],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'horizontal',
    });
    const ok = makeBuilding({ id: 'ok', type: 'overkapping', position: [0, 0], dimensions: { width: 4, depth: 4, height: 2.6 } });
    // EXACT expectation depends on the chosen outward-direction convention
    // for muurs (see the implementation). If your detector implementation
    // ends up with the opposite default, swap the expected boolean and the
    // next test's expectation symmetrically.
    expect(detectInnerFlip(muur, [muur, ok])).toBe(false);
  });

  it('returns true when the default-outer face points toward the neighbour centroid (flip needed)', () => {
    // Mirror of the previous test — muur on the +y side of the overkapping.
    // Default-outer is at y ≈ wallY + 0.075, default-inner at wallY - 0.075.
    // Overkapping centroid at (2, 2), muur at (0, 5) → centroid is at -y from
    // the muur. If the default-outward convention is +y here, outer points
    // away from centroid and inner toward it — no flip. If it's -y, outer
    // points toward centroid (further from it) — flip.
    //
    // Implementation note for the engineer: pick whichever case matches
    // your detector's outward convention and document the symmetric case
    // here. The test set must cover BOTH (one returns true, one returns
    // false) so the detector is exercised in both directions.
    const muur = makeBuilding({
      id: 'm', type: 'muur', position: [0, 5],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'horizontal',
    });
    const ok = makeBuilding({ id: 'ok', type: 'overkapping', position: [0, 0], dimensions: { width: 4, depth: 4, height: 2.6 } });
    expect(detectInnerFlip(muur, [muur, ok])).toBe(true);
  });

  it('ignores neighbours outside INNER_FLIP_DETECT_RADIUS', () => {
    expect(INNER_FLIP_DETECT_RADIUS).toBe(5);
    const muur = makeBuilding({
      id: 'm', type: 'muur', position: [0, 0],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'horizontal',
    });
    // Overkapping placed >10m away from the muur's centre.
    const farOk = makeBuilding({
      id: 'ok', type: 'overkapping', position: [20, 20],
      dimensions: { width: 4, depth: 4, height: 2.6 },
    });
    expect(detectInnerFlip(muur, [muur, farOk])).toBe(false);
  });

  it('ignores paal / muur neighbours (only structural buildings count)', () => {
    const muur = makeBuilding({
      id: 'm', type: 'muur', position: [0, 0],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'horizontal',
    });
    const otherMuur = makeBuilding({
      id: 'm2', type: 'muur', position: [0, 1],
      dimensions: { width: 3, depth: 0.15, height: 2.6 },
      orientation: 'horizontal',
    });
    const paal = makeBuilding({
      id: 'p', type: 'paal', position: [0, 1],
      dimensions: { width: 0.15, depth: 0.15, height: 2.6 },
    });
    expect(detectInnerFlip(muur, [muur, otherMuur, paal])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- inner-flip-detect`
Expected: FAIL — `detectInnerFlip` not exported.

- [ ] **Step 3: Implement the helper**

Create `src/domain/building/innerFlip.ts`:

```ts
import type { BuildingEntity } from './types';
import { WALL_THICKNESS } from './constants';

/** Radius (m) within which we look for structural neighbours when deciding
 *  whether a muur's default outer/inner face assignment needs flipping.
 *  Walls beyond this radius are treated as unrelated to the muur's
 *  placement. */
export const INNER_FLIP_DETECT_RADIUS = 5;

/** Centre of a building's footprint in world coords (XZ plane). */
function buildingCentre(b: BuildingEntity): [number, number] {
  return [
    b.position[0] + b.dimensions.width / 2,
    b.position[1] + b.dimensions.depth / 2,
  ];
}

/** Default-outward direction (unit vector in the XZ plane) for a muur,
 *  derived from its `orientation`. A horizontal muur (long axis = X)
 *  defaults to outward = -z (its `front` wall faces -z by convention in
 *  `getWallGeometries` / Wall.tsx); a vertical muur defaults to outward
 *  = -x.
 *
 *  NB: This must match the convention used by `outerSign` in the
 *  renderers when `innerFlipped === false`. If you swap the convention
 *  there, swap it here too. */
function defaultOutwardDir(b: BuildingEntity): [number, number] {
  return b.orientation === 'horizontal' ? [0, -1] : [-1, 0];
}

function distance(a: [number, number], c: [number, number]): number {
  const dx = a[0] - c[0];
  const dy = a[1] - c[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/** Whether the muur's default outer/inner face assignment should be flipped
 *  so the "inner" face points toward the centroid of nearby structural
 *  buildings.
 *
 *  Returns `false` (no flip needed) when:
 *  - The building isn't a muur.
 *  - No structural (`overkapping` / `berging`) neighbours sit within
 *    `INNER_FLIP_DETECT_RADIUS`.
 *  - The default-inner face is already closer to the neighbour centroid.
 *
 *  Otherwise returns `true`. */
export function detectInnerFlip(
  building: BuildingEntity,
  buildings: BuildingEntity[],
): boolean {
  if (building.type !== 'muur') return false;

  const muurCentre = buildingCentre(building);

  const neighbours = buildings.filter(b => {
    if (b.id === building.id) return false;
    if (b.type !== 'overkapping' && b.type !== 'berging') return false;
    return distance(buildingCentre(b), muurCentre) <= INNER_FLIP_DETECT_RADIUS;
  });

  if (neighbours.length === 0) return false;

  const sumX = neighbours.reduce((acc, b) => acc + buildingCentre(b)[0], 0);
  const sumY = neighbours.reduce((acc, b) => acc + buildingCentre(b)[1], 0);
  const centroid: [number, number] = [
    sumX / neighbours.length,
    sumY / neighbours.length,
  ];

  const [ox, oy] = defaultOutwardDir(building);
  const half = WALL_THICKNESS / 2;
  const defaultOuterFace: [number, number] = [
    muurCentre[0] + half * ox,
    muurCentre[1] + half * oy,
  ];
  const defaultInnerFace: [number, number] = [
    muurCentre[0] - half * ox,
    muurCentre[1] - half * oy,
  ];

  return distance(defaultOuterFace, centroid) < distance(defaultInnerFace, centroid);
}
```

- [ ] **Step 4: Re-export from the building barrel**

Open `src/domain/building/index.ts` and append:

```ts
export * from './innerFlip';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- inner-flip-detect`
Expected: 6 passing.

NOTE: tests 3 and 4 are written symmetrically with the assumption that horizontal muurs have default outward = -z. If your implementation lands the opposite convention (i.e. you read `outerSign` in `SchematicWalls.tsx` and it points +z for `front`), swap the expected booleans on those two cases so the test set still proves both branches. The remaining 4 tests don't depend on convention.

- [ ] **Step 6: Commit**

```bash
git add src/domain/building/innerFlip.ts src/domain/building/index.ts tests/inner-flip-detect.test.ts
git commit -m "feat(domain): add detectInnerFlip helper for muur cladding orientation"
```

---

## Task 3: `applyInnerFlipAutoDetect` mutation + `addBuilding` hookup

**Files:**
- Modify: `src/domain/config/mutations.ts`
- Test: `tests/inner-flip-mutations.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `tests/inner-flip-mutations.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import { addBuilding, applyInnerFlipAutoDetect } from '@/domain/config';
import { makeConfig } from './fixtures';

describe('addBuilding (muur)', () => {
  it('writes innerFlipped on a fresh muur based on existing buildings', () => {
    // makeConfig starts with one berging at origin (4x4). Adding a muur to
    // its +y side puts the muur outside the berging's centroid; the
    // detector decides flip-or-not.
    const seed = makeConfig();
    const result = addBuilding(seed, 'muur', [0, 5]);
    const muur = result.buildings.find(b => b.type === 'muur');
    expect(muur).toBeDefined();
    // innerFlipped is a boolean (true or false), never undefined after
    // creation: the spawn path always sets it explicitly via detection.
    expect(typeof muur!.walls.front.innerFlipped).toBe('boolean');
    expect(muur!.walls.front.innerFlippedManual).toBeUndefined();
  });

  it('leaves innerFlipped false when no structural neighbours exist', () => {
    // Empty config: spawn a muur with nothing else around.
    const seed = makeConfig();
    // Strip the seed building so the muur is alone.
    const empty = { ...seed, buildings: [] };
    const result = addBuilding(empty, 'muur', [0, 0]);
    const muur = result.buildings.find(b => b.type === 'muur');
    expect(muur!.walls.front.innerFlipped).toBe(false);
  });
});

describe('applyInnerFlipAutoDetect', () => {
  it('updates innerFlipped on the muur when geometry says so', () => {
    const seed = makeConfig();
    const withMuur = addBuilding(seed, 'muur', [0, 5]);
    const muur = withMuur.buildings.find(b => b.type === 'muur')!;
    // Force innerFlipped to a known wrong value, then re-run detect.
    const dirty = {
      ...withMuur,
      buildings: withMuur.buildings.map(b =>
        b.id === muur.id
          ? { ...b, walls: { ...b.walls, front: { ...b.walls.front, innerFlipped: !b.walls.front.innerFlipped } } }
          : b,
      ),
    };
    const cleaned = applyInnerFlipAutoDetect(dirty, muur.id);
    const finalMuur = cleaned.buildings.find(b => b.id === muur.id)!;
    // applyInnerFlipAutoDetect should write the canonical value (same as
    // what the original addBuilding wrote).
    expect(finalMuur.walls.front.innerFlipped).toBe(muur.walls.front.innerFlipped);
  });

  it('is a no-op when innerFlippedManual is true', () => {
    const seed = makeConfig();
    const withMuur = addBuilding(seed, 'muur', [0, 5]);
    const muur = withMuur.buildings.find(b => b.type === 'muur')!;
    // Mark as manually overridden + set innerFlipped to whatever the
    // opposite of detection would be.
    const auto = muur.walls.front.innerFlipped ?? false;
    const overridden = {
      ...withMuur,
      buildings: withMuur.buildings.map(b =>
        b.id === muur.id
          ? {
              ...b,
              walls: {
                ...b.walls,
                front: {
                  ...b.walls.front,
                  innerFlipped: !auto,
                  innerFlippedManual: true,
                },
              },
            }
          : b,
      ),
    };
    const result = applyInnerFlipAutoDetect(overridden, muur.id);
    const final = result.buildings.find(b => b.id === muur.id)!;
    // Both fields preserved verbatim.
    expect(final.walls.front.innerFlipped).toBe(!auto);
    expect(final.walls.front.innerFlippedManual).toBe(true);
  });

  it('is a no-op for non-muur buildings', () => {
    const seed = makeConfig();
    const bergingId = seed.buildings[0].id;
    const result = applyInnerFlipAutoDetect(seed, bergingId);
    expect(result).toBe(seed); // referential equality — no mutation
  });

  it('is a no-op when the building id is unknown', () => {
    const seed = makeConfig();
    const result = applyInnerFlipAutoDetect(seed, 'no-such-id');
    expect(result).toBe(seed);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- inner-flip-mutations`
Expected: FAIL — `applyInnerFlipAutoDetect` not exported, and `addBuilding`'s muur path doesn't yet write `innerFlipped`.

- [ ] **Step 3: Wire `detectInnerFlip` into `addBuilding`**

Open `src/domain/config/mutations.ts`. Find `addBuilding`. The function constructs a new `BuildingEntity` (call it whatever the local variable is — likely `building` or `entity`) and returns `{ ...cfg, buildings: [...cfg.buildings, entity] }`.

After the entity is fully constructed BUT before it's appended to the array, add:

```ts
// For a fresh muur, compute the auto-detect flip against the scene as it
// would be AFTER adding this muur — so the detector excludes the muur
// itself when looking for neighbours, but knows the muur is present in
// the scene if any later helper inspects the list.
if (entity.type === 'muur') {
  const flip = detectInnerFlip(entity, [...cfg.buildings, entity]);
  entity.walls.front.innerFlipped = flip;
}
```

(Substitute `entity` for whatever the local variable is in this codebase — read lines ~95–135 of `mutations.ts` to confirm. The crucial part is that the mutation runs AFTER `walls` exists on the entity and BEFORE the entity ships back in the returned ConfigData.)

Add the import at the top of the file:

```ts
import { detectInnerFlip } from '@/domain/building';
```

(Or extend the existing `from '@/domain/building'` import line — there's already one or more in the file.)

Invariant the test asserts: after `addBuilding(cfg, 'muur', position)`, the new muur's `walls.front.innerFlipped` is a definite boolean (`true` or `false`). Never `undefined` on a freshly-spawned muur.

- [ ] **Step 4: Add the `applyInnerFlipAutoDetect` mutation**

Still in `src/domain/config/mutations.ts`, append after the existing `setPoleAttachment` mutation:

```ts
/** Recompute and write `walls.front.innerFlipped` for a muur whose position
 *  may have changed. No-op when the building isn't a muur, when it doesn't
 *  exist in the scene, or when the wall's `innerFlippedManual` flag is set
 *  (locked by the user). */
export function applyInnerFlipAutoDetect(
  cfg: ConfigData,
  buildingId: string,
): ConfigData {
  const building = cfg.buildings.find(b => b.id === buildingId);
  if (!building) return cfg;
  if (building.type !== 'muur') return cfg;

  const wallCfg = building.walls.front;
  if (!wallCfg) return cfg;
  if (wallCfg.innerFlippedManual === true) return cfg;

  const flip = detectInnerFlip(building, cfg.buildings);
  if (flip === (wallCfg.innerFlipped ?? false)) return cfg; // already correct

  return {
    ...cfg,
    buildings: cfg.buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            walls: {
              ...b.walls,
              front: { ...b.walls.front, innerFlipped: flip },
            },
          }
        : b,
    ),
  };
}
```

Export `applyInnerFlipAutoDetect` from `src/domain/config/index.ts` if there's a barrel re-export — otherwise the import via `@/domain/config/mutations` works.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- inner-flip-mutations`
Expected: 5 passing.

- [ ] **Step 6: Full suite**

Run: `pnpm test`
Expected: all green (~745 now).

- [ ] **Step 7: Commit**

```bash
git add src/domain/config/mutations.ts src/domain/config/index.ts tests/inner-flip-mutations.test.ts
git commit -m "feat(mutations): wire inner-flip auto-detect into addBuilding + applyInnerFlipAutoDetect"
```

(Drop `index.ts` from the add list if there's no barrel re-export needed.)

---

## Task 4: Renderer hook — `effectiveOuterSign` in `Wall.tsx`

**Files:**
- Modify: `src/components/canvas/Wall.tsx`

UI-only — verify via `pnpm exec tsc --noEmit` + `pnpm test` (no regression) + `pnpm build`.

- [ ] **Step 1: Locate the `outwardSign` derivation**

Open `src/components/canvas/Wall.tsx`. The layout `useMemo` computes `outwardSign: 1 | -1` per `wallId`. For a muur, the `wallId` is always `'front'` (one wall per muur), so `outwardSign` is determined by the muur's orientation (the existing `switch (wallId)` handles it).

The `outwardSign` is then multiplied into the `offset` inside the local `layer(role, offsetNorm, thicknessNorm)` helper:

```ts
function layer(role: LayerRole, offsetNorm: number, thicknessNorm: number): LayerSpec {
  const thickness = thicknessNorm * t;
  const offset = outwardSign * (offsetNorm * t);  // ← THIS LINE
  // …
}
```

- [ ] **Step 2: Read `wallCfg.innerFlipped` and wrap the sign**

Above the `layer` helper inside the same `useMemo` (or right after `outwardSign` is determined), add:

```ts
const effectiveOuterSign = (wallCfg?.innerFlipped ? -1 : 1) * outwardSign;
```

Then update the `offset` line to use `effectiveOuterSign`:

```ts
const offset = effectiveOuterSign * (offsetNorm * t);
```

`wallCfg` is already in scope of the useMemo via the closure (the renderer reads it earlier in the component). If it isn't yet a dependency of this `useMemo`, add `wallCfg?.innerFlipped` to the dependency array so the layout recomputes when the flip toggles.

- [ ] **Step 3: Typecheck / tests / build**

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

All must be clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/canvas/Wall.tsx
git commit -m "feat(canvas): apply innerFlipped to wall slab orientation in 3D"
```

---

## Task 5: Renderer hook — `effectiveOuterSign` in `SchematicWalls.tsx`

**Files:**
- Modify: `src/components/schematic/SchematicWalls.tsx`

UI-only.

- [ ] **Step 1: Locate the `outerSign` derivation**

Open `src/components/schematic/SchematicWalls.tsx`. `SolidWall` computes:

```ts
const outerSign =
  geom.wallId === 'front' ? +1 :
  geom.wallId === 'back'  ? -1 :
  geom.wallId === 'left'  ? -1 :
  /* right */               +1;
```

Then uses `outerSign` inside the per-strip render loop as:

```ts
const perpOffset = outerSign * (strip.offsetNorm * T);
```

- [ ] **Step 2: Wrap with `effectiveOuterSign`**

Right below the `outerSign` declaration, add:

```ts
const effectiveOuterSign = (cfg.innerFlipped ? -1 : 1) * outerSign;
```

Then change the per-strip line to:

```ts
const perpOffset = effectiveOuterSign * (strip.offsetNorm * T);
```

`cfg` is already the `WallConfig` in scope of `SolidWall` (`cfg.materialIdInner`, `cfg.materialIdMiddenlaag` are already read from it).

- [ ] **Step 3: Typecheck / tests / build**

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

All must be clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/schematic/SchematicWalls.tsx
git commit -m "feat(schematic): apply innerFlipped to wall strip orientation in 2D"
```

---

## Task 6: Drag-end trigger in `SchematicView`

**Files:**
- Modify: `src/components/schematic/SchematicView.tsx`

UI-only.

- [ ] **Step 1: Add a config-store action for the mutation**

The existing zustand store (`src/store/useConfigStore.ts`) wraps domain mutations. Find an existing thin wrapper (e.g. `setPoleAttachment`) and add a sibling that calls `applyInnerFlipAutoDetect`:

```ts
// Inside the store creator:
applyInnerFlipAutoDetect: (buildingId: string) =>
  set((s) => ({ ...applyInnerFlipAutoDetect(s, buildingId) })),
```

Or, if the store works on a slice of `ConfigData`, follow the slice pattern the file already uses. The function name on the store should match the mutation: `applyInnerFlipAutoDetect`.

- [ ] **Step 2: Wire the call in `onPointerUp`**

Open `src/components/schematic/SchematicView.tsx`. Find the existing `onPointerUp` callback that commits drag positions. After the final position update lands in the store (e.g. `updateBuildingPosition(...)` or its sibling), add:

```ts
// If we just dragged a muur, re-detect its inner-flip against the new
// scene state. applyInnerFlipAutoDetect short-circuits for non-muur
// types and when innerFlippedManual is true, so this is safe to call
// for every drag end without per-type branching.
if (draggedBuilding) {
  applyInnerFlipAutoDetect(draggedBuilding.id);
}
```

Read the surrounding code to see how the just-dragged building's id is available — there's likely a `draggedBuildingId` ref or a hook used at drag start. Use that. If a group drag is in flight, call `applyInnerFlipAutoDetect` for every dragged building id.

- [ ] **Step 3: Typecheck / tests / build**

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

All must be clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/schematic/SchematicView.tsx src/store/useConfigStore.ts
git commit -m "feat(schematic): re-detect inner-flip on drag-end for muurs"
```

---

## Task 7: Manual flip button in the wall panel

**Files:**
- Modify: `src/components/ui/SurfaceProperties.tsx`
- Modify: `src/lib/i18n.ts`

UI-only.

- [ ] **Step 1: Add the i18n key**

Append to the `nl` map in `src/lib/i18n.ts`:

```ts
'wallProperties.flipInnerOuter': 'Binnen-/buitenkant omdraaien',
```

- [ ] **Step 2: Render the button**

Open `src/components/ui/SurfaceProperties.tsx`. Inside the wall panel body, in the section that already conditionally renders middenlaag / inner cladding affordances, add:

```tsx
{building?.type === 'muur'
  && (wallCfg.materialIdInner != null || wallCfg.materialIdMiddenlaag != null) && (
  <button
    type="button"
    className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
    onClick={() => updateBuildingWall(buildingId, wallId, {
      innerFlipped: !(wallCfg.innerFlipped ?? false),
      innerFlippedManual: true,
    })}
  >
    {t('wallProperties.flipInnerOuter')}
  </button>
)}
```

Place it near the middenlaag section or just below the outer cladding section — wherever fits the existing visual rhythm. The button only appears when the building is a muur AND at least one of inner/middenlaag is set (no flip is meaningful otherwise).

- [ ] **Step 3: Typecheck / tests / build / smoke**

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

All must be clean.

Manual smoke (`pnpm dev`):

1. Add a muur next to a berging. The plattegrond / 3D show one side as the binnenbekleding facing the berging — auto-detect picked the correct side.
2. Click "Binnen-/buitenkant omdraaien". The inner / outer sides swap immediately; the panel button is sticky-locked from now on.
3. Drag the muur to the OTHER side of the berging. Auto-detect does NOT re-run (because `innerFlippedManual` is true). The flip stays as the user set it.
4. Add another muur. The new one gets fresh auto-detect.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/SurfaceProperties.tsx src/lib/i18n.ts
git commit -m "feat(ui): manual flip button for muur inner/outer cladding"
```

---

## Task 8: Full regression sweep + verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all green. Total should be the pre-feature count + 11 new tests (6 detect + 5 mutations) ≈ 749.

- [ ] **Step 2: TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: SUCCESS.

- [ ] **Step 4: Lint scan (informational)**

```bash
pnpm lint 2>&1 | grep -E "innerFlip|Wall\.tsx|SchematicWalls\.tsx|SchematicView\.tsx|SurfaceProperties\.tsx|mutations\.ts|building/types\.ts|i18n\.ts" | head -30
```

Pre-existing warnings are fine per CLAUDE.md — no NEW errors in changed files.

- [ ] **Step 5: Manual UI smoke checklist**

`pnpm dev`, then:

1. **Fresh muur near berging** — add a muur on either side of an existing berging. Set its `materialIdInner` to a contrasting material. The inner colour shows on the side facing the berging interior; the outer colour faces outward. Match holds whether you drop the muur on the +y or -y side.
2. **Drag a muur across the berging** — release on the opposite side. The flip auto-updates. The inner cladding now faces the new direction.
3. **Manual flip is sticky** — click "Binnen-/buitenkant omdraaien" on a wall. The sides swap; the visual state holds across building moves (drag the muur around and the user's choice stays put).
4. **Free-standing muur** — drop a muur far from any structural building. Inner-cladding side picks the default convention (no flip); the user can manually toggle if needed.
5. **Plattegrond ↔ 3D consistency** — for every flip case above, the plattegrond strips and the 3D slabs both show the same side as inner / outer.
6. **No-cladding muur** — a muur with neither `materialIdInner` nor `materialIdMiddenlaag` set shows no flip button in the panel (the toggle is only meaningful when a second cladding exists).

- [ ] **Step 6: Final commit (optional)**

```bash
git status
# If any tiny cleanups remain (e.g. unused imports), commit them; otherwise skip.
```

---

## Out of scope (do NOT implement)

- Auto-detect for overkapping / berging walls — already correct.
- Tie-breaking heuristic for equidistant neighbours.
- Reset-to-auto link in the wall properties panel (defer to v1.1).
- Re-detection during a live drag (only at pointer-up).
- Auto-detection on poort — poort has no `walls` map (`wallsForType('poort')` returns `{}`).
- Visualisation badge indicating "auto-detected" inner vs "manual override".
- Any pricing / quote line change.
- Database / schema migration. `innerFlipped` and `innerFlippedManual` are optional booleans inside the existing `walls` jsonb.
