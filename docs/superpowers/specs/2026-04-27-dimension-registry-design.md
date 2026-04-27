# Schematic dimension registry + opening-gap dimensions

Date: 2026-04-27

## Goal

Centralise the 5 ad-hoc `<DimensionLine>` render blocks scattered across
`SchematicView.tsx` and `WallElevation.tsx` behind a typed, code-level
registry. Add a new `wall.openingGaps` dimension type that shows the
chain of distances between a wall's edges and its openings (door,
windows). Trim defaults so single-building scenes don't show redundant
per-building + total lines.

The registry is the system; opening-gaps is its first new entry.

## In scope

- New package `src/domain/schematic/` containing pure-function dimension
  generators.
- Typed `DimensionConfig` constant — code-only, no admin UI, no DB.
- Two pure entry points: `computePlanDimensions` (top-down schematic) and
  `computeElevationDimensions` (front-on wall view).
- Context-aware defaults: per-building/total lines suppressed when there
  is only one structural building.
- New dimension type `wall.openingGaps`, split into `.plan` (alongside
  the wall on the schematic) and `.elevation` (under the wall in
  elevation view). Default ON for both.
- Refactor of `SchematicView.tsx` and `WallElevation.tsx` to consume the
  generator; deletion of the 5 inline blocks.
- Tests in `tests/schematic-dimensions.test.ts`.

## Out of scope (YAGNI)

- Per-tenant `DimensionConfig` overrides. Generators accept an optional
  `config` parameter so a future `getDimensionConfig(tenant)` is
  non-breaking, but the wiring is not part of this spec.
- Runtime UI toggles for end users (configurator-side checkboxes).
- Persisting dimension visibility per scene (no `ConfigData` changes).
- Dimension-line theming (colors, fonts, label backgrounds).
- Unit display variants (cm/mm) — fixed at meters.
- Total-line cleanup when 2+ structurals are disconnected (current
  bounding-box behaviour preserved).
- Invoice PDF (`renderInvoicePdf.tsx`) — does not show the floor plan.
- New dimension types beyond `wall.openingGaps`. Adding more is the
  registry's whole point, but each new type lands in its own change.

## Architecture

Single source of truth: a pure function takes scene data + config and
returns a flat list of `DimLine` records. `SchematicView` and
`WallElevation` map that list to `<DimensionLine>` elements.
`exportFloorPlan.ts` scrapes the schematic SVG (`outerHTML`), so the PDF
inherits whatever the schematic renders — no separate code path.

```
src/domain/schematic/
├── dimensions.ts           types + DIMENSION_CONFIG +
│                           computePlanDimensions +
│                           computeElevationDimensions
└── index.ts                re-exports

tests/schematic-dimensions.test.ts
```

`src/domain/schematic/` is the first non-DB sibling of `building/`,
`materials/`, `pricing/`, etc. Future schematic-specific pure helpers
land here (e.g. coordinate transforms currently inlined in
`exportFloorPlan.ts` could move later).

## Public API

```ts
// src/domain/schematic/dimensions.ts

export type DimensionId =
  | 'building.width'
  | 'building.depth'
  | 'total.width'
  | 'total.depth'
  | 'muur.length'
  | 'wall.openingGaps.plan'
  | 'wall.openingGaps.elevation';

export interface DimensionConfig {
  building: { width: boolean; depth: boolean };
  total:    { width: boolean; depth: boolean };
  muur:     { length: boolean };
  wall:     {
    openingGaps: { plan: boolean; elevation: boolean };
  };
}

/** Code-level default. Edit this constant to flip dimension types
 *  on/off across the whole app. Context-aware suppression (e.g. hiding
 *  per-building lines when there's only one structural) is implemented
 *  inside the generator, not in the config. */
export const DIMENSION_CONFIG: DimensionConfig = {
  building: { width: true, depth: true },
  total:    { width: true, depth: true },
  muur:     { length: true },
  wall:     { openingGaps: { plan: true, elevation: true } },
};

export type DimSurface = 'plan' | 'elevation';

export interface DimLine {
  id: DimensionId;
  surface: DimSurface;
  /** World-space endpoints in the surface's coordinate system (metres). */
  x1: number; y1: number; x2: number; y2: number;
  /** Perpendicular offset in metres. Positive = away from the
   *  building/wall on the surface's outward axis. */
  offset: number;
  /** Pre-formatted, locale-aware label. i18n happens inside the
   *  generator so callers stay locale-agnostic. */
  label: string;
  /** Stable grouping key. Used by the schematic to apply post-process
   *  offset adjustments (door-swing arc clearance) only to
   *  matching lines. Format:
   *   - 'building:<id>'              → per-building width/depth
   *                                    (eligible for arc-clearance bump)
   *   - 'total'                      → total width/depth (already
   *                                    offset beyond arc reach)
   *   - 'wall:<buildingId>:<wallId>' → opening-gap segments
   *   - 'muur:<id>'                  → standalone muur length
   */
  groupKey?: string;
}

export interface PlanInputs {
  buildings: BuildingEntity[];
  connections: SnapConnection[];
  config?: DimensionConfig;
}

export interface ElevationInputs {
  building: BuildingEntity;
  wallId: WallId;
  defaultHeight: number;
  config?: DimensionConfig;
}

export function computePlanDimensions(input: PlanInputs): DimLine[];
export function computeElevationDimensions(input: ElevationInputs): DimLine[];
```

## Emission rules

| Id | Emitted when | Geometry | Base offset | Label |
|---|---|---|---|---|
| `building.width` | per structural, only when `structuralCount > 1` | along the building's back edge (max-Z) | `+1.0` | `"Breedte: 4.0 m"` |
| `building.depth` | per structural, only when `structuralCount > 1` | along the building's right edge (max-X) | `-1.0` | `"Diepte: 3.0 m"` |
| `total.width` | once, only when `structuralCount > 1` | along the back edge spanning all structurals | `+2.0` | `"Totale breedte: 7.5 m"` |
| `total.depth` | once, only when `structuralCount > 1` | along the right edge spanning all structurals | `-2.0` | `"Totale diepte: 4.0 m"` |
| `muur.length` | per muur, always when enabled | alongside the muur (orientation-aware) | `±0.5` | `"3.0 m"` |
| `wall.openingGaps.plan` | per wall with ≥1 opening | chain alongside the wall, on the outward side | `±0.5` | `"0.65 m"` per segment |
| `wall.openingGaps.elevation` | per wall with ≥1 opening, elevation surface only | chain along the wall's baseline, below the wall front-on | `+0.4` | `"0.65 m"` per segment |

`structuralCount` counts buildings whose `type` is neither `'paal'` nor
`'muur'`.

### Visual stacking — three tiers from the wall outward

1. **Tier 1 (closest, ~0.5):** opening-gap chains. They describe the
   wall they sit next to, so visual proximity matters.
2. **Tier 2 (~1.0):** per-building width / depth.
3. **Tier 3 (~2.0):** total width / depth.

This ordering keeps stacking tidy on the wall side that hosts both a
gap chain and a per-building line.

### Opening-gap chain emission

Given a wall of length `L` with sorted openings `[(x_i, w_i), …]` where
`x_i` is metres from wall centre (returned by
`resolveOpeningPositions`):

```
segments = []
cursor = -L/2
for each (x, w) in sorted order:
  segments.push((cursor, x - w/2))
  cursor = x + w/2
segments.push((cursor, +L/2))
```

Each segment becomes one `DimLine`. Segments shorter than 0.05 m are
dropped (avoids label clutter when an opening sits at the very edge of
`EDGE_CLEARANCE`). All segments for one wall share
`groupKey: "wall:<buildingId>:<wallId>"`.

For the plan surface, segment endpoints transform from wall-local 1D
coords to world coords using the wall's geometry:

- Front wall (horizontal, min-Z side): segments lie on `y = building.position[1]`,
  x runs across the wall. Outward direction is `−Y` (away from
  building's centre toward smaller z).
- Back wall: `y = building.position[1] + depth`; outward `+Y`.
- Left wall (vertical, min-X side): `x = building.position[0]`,
  y runs across the wall. Outward `−X`.
- Right wall: `x = building.position[0] + width`; outward `+X`.
- Standalone muur, horizontal: segments lie on `y = position[1] + depth/2`
  (muur centreline). Outward `+Y` (chain lands south of the muur for
  consistency).
- Standalone muur, vertical: segments on `x = position[0] + depth/2`,
  outward `+X` (chain east of the muur).

For the elevation surface, segment endpoints stay in 1D wall-local
coords (`x ∈ [0, L]`); the renderer places them under the wall's
baseline.

### Context-aware suppression

Implemented inside the generator (not in the config):

- `building.width` / `building.depth`: skip when `structuralCount <= 1`.
- `total.width` / `total.depth`: skip when `structuralCount <= 1`.
- `wall.openingGaps.plan`: emit only for walls with at least one opening
  (door OR ≥1 window). Empty walls produce zero segments.

`muur.length` always emits when enabled, regardless of structural count
— a muur is a primitive whose length is meaningful on its own.

## Rendering integration

### `SchematicView.tsx`

Replace the five existing inline `<DimensionLine>` blocks (per-building
width, per-building depth, per-muur length, total width, total depth)
with a single render loop:

```tsx
const planLines = useMemo(
  () => computePlanDimensions({ buildings, connections }),
  [buildings, connections],
);

const arcClearance = useMemo(() => computeArcClearance(buildings), [buildings]);

const adjusted = planLines.map(d => ({
  ...d,
  offset: d.offset + (arcClearance[d.groupKey ?? ''] ?? 0),
}));

// Inside the SVG, after wall/pole layers, before the selection rect:
<g pointerEvents="none">
  {adjusted.map((d) => (
    <DimensionLine
      key={`${d.id}:${d.groupKey ?? ''}:${d.x1},${d.y1}-${d.x2},${d.y2}`}
      x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2}
      offset={d.offset}
      label={d.label}
    />
  ))}
</g>
```

`computeArcClearance` is a small local helper in `SchematicView.tsx`
that walks each structural building, computes the existing
`outwardArcR(side)` value for `front`/`right`, and returns
`{ "building:<id>": max(arc) }`. Opening-gap groupKeys won't match any
key in that map, so their offsets stay at the base value the generator
emits.

### `WallElevation.tsx`

Wall length, wall height, door size labels, and window size labels
remain in their current locations — those are not gap chains and are
already correctly placed. The only new render is the elevation
opening-gap chain:

```tsx
const elevationLines = useMemo(
  () => computeElevationDimensions({ building, wallId, defaultHeight }),
  [building, wallId, defaultHeight],
);

<g pointerEvents="none">
  {elevationLines.map((d) => (
    <DimensionLine
      key={`${d.id}:${d.groupKey ?? ''}:${d.x1}-${d.x2}`}
      x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2}
      offset={d.offset}
      label={d.label}
    />
  ))}
</g>
```

The chain renders below the wall's baseline in elevation coords (`y =
0`).

### `exportFloorPlan.ts`

Zero changes. The PDF export captures
`document.querySelector('.schematic-svg').outerHTML`, so it inherits
whatever the schematic renders.

## Implementation order

Each step is independently verifiable.

1. Create `src/domain/schematic/dimensions.ts` with types,
   `DIMENSION_CONFIG`, and stub generators that return `[]`. Add
   `index.ts` re-export.
2. Write `tests/schematic-dimensions.test.ts` with all cases failing
   (TDD).
3. Implement `computePlanDimensions` until tests pass. Internal helpers
   (`computeBuildingDims`, `computeTotalDims`, `computeMuurDims`,
   `computeOpeningGaps`, `transformWallSegmentToPlan`) live as private
   functions in the same file.
4. Implement `computeElevationDimensions`.
5. Wire `SchematicView.tsx`: add `useMemo` + map; delete five inline
   blocks; add `computeArcClearance` post-process helper.
6. Wire `WallElevation.tsx`: add `useMemo` + map for elevation gap
   chain.
7. Verify: `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build`. Manual
   click-through covering single-building, multi-building, muur with
   door+windows, elevation view (with `wallElevationView` flag on for
   the assymo tenant during local dev).
8. Commit.

## Test coverage

`tests/schematic-dimensions.test.ts`, ~20–25 cases:

```
computePlanDimensions
  context-aware emission
    single structural → 0 building.width, 0 building.depth, 0 total.*
    two structurals → 2 building.width, 2 building.depth, 1 total.*
    standalone muur in scene → muur.length emitted regardless of structural count
    no buildings → returns []
  config gates
    config.building.width = false → no building.width emitted
    config.muur.length = false → no muur.length even with muurs present
    config.wall.openingGaps.plan = false → no plan gap chains
    omitting config uses DIMENSION_CONFIG defaults
  opening gaps
    wall with no openings → 0 segments
    wall with 1 door → 2 segments
    wall with 1 door + 2 windows (sorted) → 4 segments
    segment with length < 0.05 m dropped
    horizontal-front-wall geometry: y = building.front
    horizontal-back-wall geometry: y = building.back
    left-wall geometry: x = building.left
    right-wall geometry: x = building.right
    standalone-muur-horizontal geometry
    standalone-muur-vertical geometry
  groupKey
    per-building lines tagged 'building:<id>'
    total lines tagged 'total' (not 'building:<id>') so arc-clearance
      post-process leaves them alone
    opening-gap segments tagged 'wall:<buildingId>:<wallId>'
    muur length tagged 'muur:<id>'

computeElevationDimensions
  wall with no openings → 0 segments
  wall with door + window → 3 segments in 1D wall-local coords
  config.wall.openingGaps.elevation = false → returns []
  segment positions match resolveOpeningPositions output
```

All tests use `tests/fixtures.ts` builders. No DOM, no React.

## Risks + mitigations

- **Visual regression on existing dimensions** — five inline blocks
  delete in step 5. Their offset math (`Math.max(showTotalDimension ?
  1.0 : 0.8, frontArc + 0.5)`) splits: base offset (1.0 / 2.0) inside
  the generator, arc-clearance into the schematic post-process.
  *Mitigation*: side-by-side visual check pre/post on a scene with
  outward door swings and multiple buildings.
- **Door-swing arc clearance regression** — currently coupled to
  per-building width/depth offsets. The post-process only matches
  `groupKey === 'building:<id>'`, leaving opening-gap chains
  unaffected. *Mitigation*: snapshot a scene with a `naar_buiten`
  double door before/after.
- **Vertical muur opening-gaps** — wall-local 1D coords must transform
  correctly given the orientation-swapped dimensions. *Mitigation*:
  dedicated tests for both orientations.
- **PDF export** — `exportFloorPlan.ts` scrapes the schematic SVG. New
  `<g>` wrappers don't change the print stylesheet. *Mitigation*: open
  the print preview once during step 7's manual verification.
- **Future scope creep** — once the registry exists it's tempting to
  layer on per-tenant variants, runtime UI, etc. *Mitigation*: this
  spec explicitly excludes those; spec amendments required.

## Open questions

None. All four pre-implementation questions resolved with the user on
2026-04-27:

1. Visibility model → code-only, no admin UI.
2. Defaults → context-aware (per-building only when 2+ structural).
3. Opening-gap surfaces → both plan and elevation, only walls with
   openings.
4. Architecture → Approach B (pure-function generator + thin
   renderer).
