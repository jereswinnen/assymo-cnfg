# Inner/outer cladding auto-detect (with manual override) — design

## Problem

`materialIdInner` and `materialIdMiddenlaag` are persisted per wall, but which
of the wall's two large faces gets which material is decided by a static
geometric convention (`outerSign` per `wallId`). For `muur`
primitives placed freely in the scene this convention is arbitrary — the
"inner" face can end up facing the outside world depending on the muur's
orientation and placement, so the user sees the binnenbekleding from the
wrong side.

For closed structures (`overkapping`, `berging`) the inner face is
unambiguously the one pointing toward the building's centroid — the existing
convention is correct there and needs no change.

## Goal

Auto-detect the correct flip for `muur` walls based on the
surrounding scene, with a manual user override that sticks once toggled.

## Scope

In scope: `WallConfig` of any building whose `type` is `muur`.

Out of scope:

- Auto-detect for `overkapping` / `berging` walls (already correct
  geometrically).
- Detecting real-world orientation (street vs garden vs house) — the
  configurator doesn't have that information; only relative placement of
  scene buildings.
- Tie-breaking for equidistant neighbours (keep previous value).
- "Reset to auto" link in the panel (deferred to v1.1).
- Re-detection during a live drag (only at pointer-up).

## Data model

Add two optional fields to `WallConfig`:

```ts
export interface WallConfig {
  // …existing fields, including materialIdInner / materialIdMiddenlaag
  /** When true, the wall's outer / inner face assignment is flipped relative
   *  to the default geometric convention. Auto-set on muur creation
   *  and on snap-attachment changes; user can toggle it manually via the
   *  wall properties panel. */
  innerFlipped?: boolean;
  /** When true, the user has manually toggled `innerFlipped` — auto-detect
   *  events MUST NOT overwrite the value. Reset only by an explicit
   *  "reset to auto" affordance (deferred to v1.1). */
  innerFlippedManual?: boolean;
}
```

Both fields are optional. Existing scenes deserialize unchanged. No
`configVersion` bump, no migration.

## Auto-detect helper

Pure function in `src/domain/building/innerFlip.ts`:

```ts
import type { BuildingEntity } from '@/domain/building';

/** Radius (m) within which we look for structural neighbours. Walls outside
 *  this radius are treated as unrelated to the muur's placement. */
export const INNER_FLIP_DETECT_RADIUS = 5;

/** Whether the muur's default outer/inner face mapping should be flipped so
 *  the "inner" face points toward the centroid of nearby structural
 *  buildings.
 *
 *  Returns `false` (no flip needed) when:
 *  - The building isn't a muur (other kinds use the geometric
 *    convention as-is).
 *  - No structural neighbours sit within `INNER_FLIP_DETECT_RADIUS`.
 *  - The default-inner face is already closer to the neighbour centroid.
 *
 *  Otherwise returns `true`.
 */
export function detectInnerFlip(
  building: BuildingEntity,
  buildings: BuildingEntity[],
): boolean;
```

### Algorithm

1. If `building.type !== 'muur'` → return `false`.
2. Compute the muur's centre: `position[0] + dimensions.width / 2`,
   `position[1] + dimensions.depth / 2`.
3. Filter `buildings` to entries whose `type` is `'overkapping'` or
   `'berging'`, distance ≤ `INNER_FLIP_DETECT_RADIUS` from the muur centre,
   excluding the muur itself.
4. If the filtered list is empty → return `false`.
5. Compute the centroid average over the filtered list (mean of
   per-building centres).
6. Determine the default-outward direction for this muur in world coords:
   based on `orientation`, the perpendicular axis convention used by
   `getWallGeometries` / Wall.tsx. Express as a unit vector `[ox, oy]`.
7. Default-outer face world position: `muurCentre + (WALL_THICKNESS / 2) ·
   [ox, oy]`. Default-inner face: `muurCentre - (WALL_THICKNESS / 2) · [ox, oy]`.
8. Return `true` iff `distance(defaultOuterFace, centroidAverage) <
   distance(defaultInnerFace, centroidAverage)` — flip when the default
   outer is actually closer to the building centroid (i.e. the geometric
   convention picked the wrong side).

A `muur` has exactly one wall key (`'front'` per `wallsForType`); the
helper operates on the building as a whole, and the caller writes the
resulting flip into `wallCfg.innerFlipped` on that single key. For
`WallConfig` of a structural building, callers don't invoke this helper at
all (covered by the muur-only short-circuit above).

## Trigger events

`innerFlipped` is recomputed and written ONLY at these moments, and ONLY
when `innerFlippedManual` is not `true`:

1. **Wall creation** — when `addBuilding(...)` spawns a muur
   (`src/domain/config/mutations.ts`). Compute against the buildings that
   already exist in the scene at that moment.
2. **Drag end (`pointerup`)** — at the very end of a drag gesture in
   `SchematicView.tsx::onPointerUp`, after the muur's position has been
   committed. In this configurator, snapping happens AT the end of a drag
   (the new position is the snapped one), so this single trigger covers
   both "moved without snapping" and "snapped onto a new neighbour". NOT
   during the drag (would cause "wall keeps flipping" feedback).

Note: `BuildingEntity.attachedTo` is a paal-only field for material
inheritance; muurs don't carry it, so there's no separate
"snap-attachment changed" event to subscribe to.

`innerFlippedManual` is set by the user's explicit toggle in the wall
properties panel; auto-detect routines respect it as a write-lock.

## Manual override

Wall properties panel (`src/components/ui/SurfaceProperties.tsx`) gets a
small button shown when (a) the building's `type` is `muur`
AND (b) at least one of `materialIdInner` / `materialIdMiddenlaag` is set
on the selected wall (no flip is meaningful when only the outer cladding
is set):

```
[ ⇄ Binnen-/buitenkant omdraaien ]
```

Click handler:

```ts
updateBuildingWall(buildingId, wallId, {
  innerFlipped: !wallCfg.innerFlipped,
  innerFlippedManual: true,
});
```

Sticky from that point on. v1.1 may add a "reset to auto" link that clears
`innerFlippedManual` and re-runs detection.

## Rendering hook

Single change in both `Wall.tsx` (3D) and `SchematicWalls.tsx` (2D): wrap
the existing `outerSign` constant with the flip:

```ts
const baseOuterSign = /* …existing computation per wallId/orientation… */;
const effectiveOuterSign = (cfg.innerFlipped ? -1 : 1) * baseOuterSign;
// use effectiveOuterSign anywhere outerSign is currently multiplied into
// an offset
```

The strip/slab layout table (driven by `getWallLayerLayout`) does NOT
change — only the sign-of-offset application does.

## Validation

No new error codes. The boolean fields don't require slug-style validation.
The `validateConfig` path simply tolerates `innerFlipped` /
`innerFlippedManual` as optional booleans (or `undefined`).

## Pricing impact

None. Flipping which face is "inner" vs "outer" is purely visual — the
total m² of each material remains the same.

## Tests

New `tests/inner-flip-detect.test.ts`:

- Non-muur building → `detectInnerFlip` returns `false`.
- Muur with no structural neighbours → `false`.
- Muur snapped to an overkapping such that default outer faces the
  overkapping centroid → `true` (flip needed).
- Muur snapped such that default outer is already pointing AWAY from the
  overkapping centroid → `false` (no flip).
- Muur sitting between two buildings, closer to one → flip resolves toward
  the closer building's centroid.
- Muur far outside `INNER_FLIP_DETECT_RADIUS` → `false`.

New / extended `tests/configStore-inner-flip.test.ts` (or similar):

- `addBuilding(muur, position)` with an existing overkapping nearby writes
  `innerFlipped = true` when geometry dictates.
- `applyInnerFlipAutoDetect(cfg, muurId)` updates the muur's flip when the
  muur has been moved to a position where the default outer faces the
  building centroid.
- Once `innerFlippedManual = true`, `applyInnerFlipAutoDetect` is a no-op —
  both fields stay untouched.

Unit-test the rendering helper by extending the existing schematic / canvas
tests if they exist; otherwise verify via typecheck + manual smoke.

## File touch-list

Domain:

- `src/domain/building/types.ts` — add `innerFlipped` + `innerFlippedManual`
  to `WallConfig`.
- `src/domain/building/innerFlip.ts` (new) — `detectInnerFlip` + radius
  constant.
- `src/domain/building/index.ts` — re-export.
- `src/domain/config/mutations.ts` — wire `detectInnerFlip` into the
  `addBuilding` muur spawn path. Also add a small mutation
  `applyInnerFlipAutoDetect(cfg, buildingId)` that recomputes and writes
  the flip when called, respecting `innerFlippedManual`. UI calls it on
  drag end.

UI:

- `src/components/schematic/SchematicView.tsx` — on `pointerup` after a
  building drag, call `applyInnerFlipAutoDetect` for the moved muur (the
  helper internally respects `innerFlippedManual`, so the caller doesn't
  need to check).
- `src/components/canvas/Wall.tsx` — multiply `effectiveOuterSign` into the
  offset computation in the `layer()` helper.
- `src/components/schematic/SchematicWalls.tsx` — same `effectiveOuterSign`
  wrap.
- `src/components/ui/SurfaceProperties.tsx` — render the manual flip button
  when the wall belongs to a muur AND has middenlaag or inner set.

Glue:

- `src/lib/i18n.ts` — `wallProperties.flipInnerOuter` ("Binnen-/buitenkant
  omdraaien").

Tests: as listed above.

## Migration

None. Both fields are optional, default to undefined → behaves identically
to today. Existing share codes resolve correctly; orders snapshot the
ConfigData verbatim so historical orders stay intact.

## Out of scope (do NOT implement)

- Tie-breaking heuristic for perfectly equidistant neighbour buildings
  (leave previous `innerFlipped` value untouched).
- Auto-detect on overkapping / berging walls (their inner face is already
  geometrically correct).
- Detecting orientation relative to real-world reference (street, garden,
  house). Manual flip is the answer for "configurator picked the wrong
  side because it doesn't know the room is north-facing".
- Visualization affordance highlighting the auto-detected inner face
  (e.g. a small badge on the strip in the plattegrond).
- "Reset to auto" link that clears `innerFlippedManual` — defer to v1.1.
- Re-detection during a live drag (only at the drag end-event).
- Any pricing / quote-line change. The line items reflect material area,
  which is unaffected by the flip.

## Risks & mitigations

- **`outerSign` is referenced in multiple files** (Wall.tsx, SchematicWalls.tsx).
  Each site must read `effectiveOuterSign` instead. Mitigation: grep for
  `outerSign` after the touch-list edits and confirm every call site reads
  the flipped value. Single-line wrap in each spot.
- **Auto-detect at `pointerup` could thrash a user who just moved a muur
  slightly**. Mitigation: only recompute if the muur's distance to the
  nearest structural building changed by more than a small epsilon — or
  more simply, run unconditionally but accept that `innerFlippedManual`
  protects users who care.
- **Drag-end trigger order**. `applyInnerFlipAutoDetect` must run AFTER
  the position update is committed to the store. Mitigation: in
  `SchematicView.onPointerUp` call the position mutation first, then the
  flip-detect mutation, against the now-current `ConfigData`. Both are
  pure mutations; the second reads the post-update state.
