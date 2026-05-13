# Dummy-wall ("Illustratie") Primitive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new building primitive `'dummy-wall'` that lets the configurator user "draw" extra geometry to illustrate something to the client (e.g. an existing house wall the new structure butts against). Dummy-walls have no snap, no pricing, no material catalog binding — they're free-placement white blocks of geometry with a clear visual marker so a client knows they're illustrative, not part of the quote.

**Architecture:** New primitive registered in `BUILDING_KIND_META` next to `muur`, with `snapKind: 'none'` (new value), `requiredCategories: []` (always available), and `sections: ['dimensions']`. The 3D path renders a hardcoded-white box with light-grey edge highlights; the 2D path styles the rectangle with a dashed outline and an "Illustratie" label inside. Pricing returns an empty line-item list for the type (no €0 row — the building is absent from the quote entirely). Snap detection skips dummy-walls as both source and target via a single helper applied at call sites, leaving `snap.ts` ignorant of the new type.

**Tech Stack:** TypeScript, Next.js 16 (App Router), React Three Fiber + drei, SVG plattegrond, Zustand, Vitest via Vite+. No DB migration.

**Spec:** None — design captured inline here (small, registry-driven addition).

---

## Decisions baked into this plan

- **No snap.** Dummy-wall never appears as a snap source or target.
- **Three adjustable dimensions: width × height × depth.** Real `muur` fixes depth to `POST_SIZE`; dummy-wall lets the user bump thickness up (0.05 – 0.40 m) for "this is the existing house wall" use cases.
- **Selectable, draggable, rotatable** like muur. `orientation: 'horizontal' | 'vertical'` is honoured.
- **No openings, no material picker, no middenlaag, no inner cladding, no corner braces.** Configure panel only shows dimensions.
- **Hardcoded white** regardless of tenant primaryMaterialId — no `MaterialRow` lookup, no PBR textures.
- **Visual markers:**
  - 2D: dashed stroke (`stroke-dasharray="0.15 0.10"`) + centred text label `Illustratie` inside the rectangle.
  - 3D: subtle edge highlights via drei `<Edges>` in light grey so the silhouette reads even from sharp angles. No badge in 3D — the white-against-tenant-coloured-buildings contrast plus the dashed 2D outline is enough.
- **Pricing absent.** The building doesn't contribute any `lineItems` to `quote.items` (not even a €0 "illustratie" line). Quote totals are mathematically identical with or without dummy-walls present.

---

## File touch-list

**Domain (framework-free):**

- `src/domain/building/types.ts` — add `'dummy-wall'` to `BuildingType` union.
- `src/domain/building/kinds.ts` — add registry entry; extend `BuildingKindMeta.snapKind` union with `'none'`; verify no exhaustive switch on `snapKind` breaks.
- `src/domain/config/mutations.ts` — `wallsForType` returns `{}` for dummy-wall; `createBuilding` picks default dimensions (width 4 m, depth 0.15 m, height 2.6 m).
- `src/domain/config/migrate.ts:74` — add `&& b.type !== 'dummy-wall'` to the `structural` filter so dummy-walls don't drive `defaultHeight`.
- `src/domain/pricing/calculate.ts` — `calculateBuildingQuote` early-returns `{ lineItems: [], total: 0 }` when `building.type === 'dummy-wall'`. Also add to the `postLineItem` skip list.
- `src/domain/building/snap.ts` — **not edited.** Skip dummy-walls at call sites instead (cleaner; keeps the snap module type-agnostic).
- `src/domain/schematic/dimensions.ts:431` — add dummy-wall to the `isMuur`-equivalent predicate via the shared helper (below).

**Shared helper (new):**

- `src/domain/building/predicates.ts` (new) — `isWallLikePrimitive(b: BuildingEntity): boolean` returning `true` for `muur` OR `dummy-wall`. Re-export from `@/domain/building`. Used at every site currently testing `b.type === 'muur'` for thin-AABB / vertical-orientation / drag behaviour. The schematic agent survey found ~10 such sites; routing them through this helper de-risks drift.

**UI — canvas (3D):**

- `src/components/canvas/Building.tsx:14-60` — add `if (building.type === 'dummy-wall') return <DummyWall />;` branch.
- `src/components/canvas/DummyWall.tsx` (new) — single `boxGeometry` at `[width, height, depth]`, hardcoded white `MeshStandardMaterial` (roughness 0.85, metalness 0), drei `<Edges>` in `#888` for silhouette. Reuses `useClickableObject` for selection / drag / keyboard handling.
- `src/components/canvas/BuildingInstance.tsx:29` — route `isVertWallLike` through `isWallLikePrimitive`.

**UI — schematic (2D):**

- `src/components/schematic/SchematicView.tsx`:
  - `getBuildingAABB` (line 116): thin-wall AABB path uses `isWallLikePrimitive`.
  - `normalBuildings` filter (lines 346–349): exclude dummy-wall.
  - Vertical-orientation predicates at 355, 511, 600–603, 768, 881, 924, 1012: route through helper.
  - Drag-gesture branch at 867–935: route through helper.
  - Copy/paste position branch at 1191–1213: route through helper.
  - New render branch: when `b.type === 'dummy-wall'`, draw with `stroke-dasharray="0.15 0.10"` and overlay a centred `<text>` element reading `t('schematic.dummyWall.label')` rotated to match the building's orientation.
- `src/components/schematic/SchematicWalls.tsx` — skip rendering openings/doors/windows when the building is a dummy-wall (it has no walls config). Should "just work" given `walls: {}` from the factory, but verify.

**UI — sidebar:**

- `src/components/ui/ConfigureTab.tsx`:
  - `WallsContent` (line 48): return `null` for dummy-wall.
  - `CornerBracesToggle` (line 127): return `null` for dummy-wall.
  - `DimensionsContent`: confirm the depth slider works correctly given `dimensions.depth: true` in the registry. Range 0.05 – 0.40 m.
  - Auto-filtering of sections via `BUILDING_KIND_META[type].sections` already hides structure/walls/middenlaag/quote when registry says so.

**Tray:**

- `src/components/ui/ObjectsTab.tsx:15-21` — add `'dummy-wall': { icon: '…' }` to `TRAY_VIEW`. Pick a distinguishing glyph (dashed-rectangle or `⬜`).
- `src/lib/tray.ts` — no manual change; `requiredCategories: []` makes the entry always available.

**i18n:**

- `src/lib/i18n.ts`:
  ```ts
  'buildingType.dummy-wall': 'Illustratie',
  'building.name.dummy-wall': 'Illustratie',
  'building.add.dummy-wall': 'Illustratie toevoegen',
  'schematic.dummyWall.label': 'Illustratie',
  ```

**Tests:**

- `tests/dummy-wall.test.ts` (new):
  - `calculateTotalQuote` returns identical totals with and without dummy-wall buildings present.
  - A scene containing only dummy-walls produces a quote with zero items and total 0.
  - `wallsForType('dummy-wall')` returns `{}`.
  - `migrateBuilding` round-trips a dummy-wall building unchanged.
  - `isWallLikePrimitive(dummy-wall) === true`, `isWallLikePrimitive(overkapping) === false`.
- `tests/snap.test.ts` (or new `tests/dummy-wall-snap.test.ts`): assert that when call-sites filter out dummy-walls before calling `detectSnap` / `detectPoleSnap` / `detectWallSnap`, no snap candidates reference dummy-wall buildings. (The functions themselves remain type-agnostic.)
- Add `dummy-wall` fixture to `tests/fixtures.ts` for reuse.

---

## Implementation phases

### Phase 1 — Domain + registry foundation
- [ ] Add `'dummy-wall'` to `BuildingType` union in `src/domain/building/types.ts`.
- [ ] Extend `BuildingKindMeta.snapKind` with `'none'` in `src/domain/building/kinds.ts`.
- [ ] Add `dummy-wall` registry entry. Mirror `muur` for tray/material shape; set `snapKind: 'none'`, `requiredCategories: []`, `dimensions.depth: true`, `sections: ['dimensions']`, `material: null`.
- [ ] Create `src/domain/building/predicates.ts` exporting `isWallLikePrimitive`. Re-export from `src/domain/building/index.ts`.
- [ ] `pnpm exec tsc --noEmit` clean.
- [ ] `pnpm test` clean (no behavioural change yet).

### Phase 2 — Factory + creation
- [ ] `wallsForType('dummy-wall')` returns `{}` in `mutations.ts`.
- [ ] `createBuilding` picks default dimensions for dummy-wall (W 4, H 2.6, D 0.15) and falls back to the same factory path as muur otherwise.
- [ ] Add a `tests/dummy-wall.test.ts` smoke test for the factory.

### Phase 3 — 3D canvas
- [ ] New `src/components/canvas/DummyWall.tsx` (white box + drei `<Edges>`, click handlers via `useClickableObject`).
- [ ] Add dispatch branch in `Building.tsx`.
- [ ] Route `BuildingInstance.tsx:29` through `isWallLikePrimitive`.
- [ ] Visual check: add a dummy-wall in dev, confirm it renders white with grey edges, is selectable + draggable, and rotates to vertical orientation.

### Phase 4 — 2D schematic
- [ ] Route every `b.type === 'muur'` / wall-like predicate in `SchematicView.tsx` and `schematic/dimensions.ts` through `isWallLikePrimitive`.
- [ ] Add the dummy-wall render branch: dashed stroke + centred `Illustratie` text label.
- [ ] Verify `SchematicWalls.tsx` doesn't crash on `walls: {}`.

### Phase 5 — Pricing skip
- [ ] `calculateBuildingQuote` early-return for dummy-wall.
- [ ] `postLineItem` skip list includes dummy-wall.
- [ ] Migrate `migrate.ts:74` structural filter.
- [ ] Tests: assert quote totals are identical with/without dummy-walls.

### Phase 6 — Snap skip
- [ ] Filter dummy-walls out at every call site of `detectSnap` / `detectPoleSnap` / `detectWallSnap` / `detectWallPoleSnap` in `SchematicView.tsx`. (Don't touch `snap.ts` itself.)
- [ ] Add a snap-skip test.

### Phase 7 — Sidebar config panel
- [ ] `WallsContent` early-return null for dummy-wall.
- [ ] `CornerBracesToggle` early-return null for dummy-wall.
- [ ] Confirm `DimensionsContent` exposes depth slider correctly (range 0.05 – 0.40 m).
- [ ] Manual check: select a dummy-wall, sidebar shows only the dimensions section.

### Phase 8 — i18n + tray + final polish
- [ ] Add the four i18n keys to `src/lib/i18n.ts`.
- [ ] Add `dummy-wall` entry to `TRAY_VIEW` in `ObjectsTab.tsx`. Pick a tray icon.
- [ ] Manual check: tray button is visible, click adds a dummy-wall, the building appears in both views with all markers, can be selected, dragged, resized, deleted.
- [ ] Confirm `pnpm test` and `pnpm exec tsc --noEmit` both pass.

---

## Risks & notes

- **Biggest surface area is Phase 4** (the schematic predicates). The `isWallLikePrimitive` helper is the de-risking move: without it, drift between the ~10 call sites is the most likely source of subtle bugs (dummy-wall sometimes treated as muur, sometimes not).
- **Snap exclusion at call sites vs in `snap.ts`:** I picked call-site filtering to keep `snap.ts` type-agnostic. If the call-sites multiply later (e.g. tooltip preview, future "smart snap" features), revisit and push the skip into `snap.ts`.
- **Pricing absence vs €0 line:** I picked absence. If the customer-facing quote PDF feels misleading ("where's the wall I drew?"), revisit and emit a labelled €0 line item via `pricing/calculate.ts` instead.
- **Visual marker tuning:** the dashed stroke + label is a first pass. If clients still misread dummy-walls as real walls, consider tinting the SVG fill a translucent grey, or adding a small badge icon in 3D.

**Estimate:** half a day for Phases 1–6 with a working dummy-wall in 2D + 3D + sidebar + zero pricing impact. Another 1–2 hours for visual polish, i18n, and tests.
