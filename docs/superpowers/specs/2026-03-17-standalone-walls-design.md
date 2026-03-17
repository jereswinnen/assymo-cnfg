# Standalone Walls (Muren) — Design Spec

## Overview

Add standalone walls as independent canvas entities, following the same pattern as standalone poles. Walls are a new `BuildingType` of `'muur'` — axis-aligned rectangular panels that can be placed, moved, snapped, and configured with the full wall material/door/window system.

Additionally, introduce a height inheritance system so walls and poles automatically follow building height unless explicitly overridden.

## 1. Height Inheritance System

### Problem

Currently each building independently stores its height. When a user changes a building's height, poles and (future) walls don't follow — leading to inconsistent configurations.

### Design

- Add `defaultHeight: number` to the store (initially 3m)
- Add `heightOverride: number | null` to `BuildingEntity` (initially `null` for all entities)
- Effective height = `heightOverride ?? defaultHeight`
- When the user changes height in the Afmetingen panel for a building, it updates `defaultHeight` — all non-overridden entities follow
- Walls and poles can override their height individually via the Afmetingen panel
- Show a "reset to default" indicator when an entity has an override
- Changing `defaultHeight` never touches entities that have `heightOverride !== null`

### Removing `dimensions.height` as Source of Truth

With the introduction of `defaultHeight` + `heightOverride`, the `dimensions.height` field becomes vestigial for height. All code that currently reads `building.dimensions.height` must be updated to use `getEffectiveHeight(building, defaultHeight)` instead. The `dimensions.height` field remains in `BuildingDimensions` only for width/depth — height is always derived from the inheritance system.

### Migration

In `useConfigStore` initialization (or a `loadState` handler):
- Derive `defaultHeight` from the first non-pole, non-wall building's `dimensions.height` (or 3m if none exist)
- Set `heightOverride: null` on all existing entities
- Set `orientation: 'horizontal'` on all existing entities that lack the field
- `resetConfig()` must reset `defaultHeight` to 3m

### Persistence

`defaultHeight` is part of the serialized store state. `loadState` must handle configs that predate this field by falling back to 3m.

## 2. Muur Entity

### Data Model

New `BuildingType` value: `'muur'`

```typescript
// Added to BuildingType union
type BuildingType = 'overkapping' | 'berging' | 'paal' | 'muur';

// Orientation field added to BuildingEntity
interface BuildingEntity {
  // ...existing fields
  orientation: 'horizontal' | 'vertical'; // meaningful for 'muur'; defaults to 'horizontal' for all types
  heightOverride: number | null;
}
```

### Defaults

| Property | Value | Rationale |
|----------|-------|-----------|
| width | 3m | Matches `POST_SPACING`, aligns with structural grid |
| depth | 0.15m (`POST_SIZE`) | Same thickness as structural posts |
| height | inherited from `defaultHeight` | Consistent with buildings |
| orientation | `'horizontal'` | Width runs along X axis |
| walls | `{ front: defaultWallConfig }` | One configurable face |

### Constants

```typescript
export const WALL_DIMENSIONS: BuildingDimensions = {
  width: POST_SPACING, // 3m
  depth: POST_SIZE,    // 0.15m
  height: 3,           // initial value only; effective height comes from getEffectiveHeight()
};
```

Note: `height` in `BuildingDimensions` is kept for structural compatibility but is not the source of truth. All height reads go through `getEffectiveHeight()`.

### Wall Config

- `getDefaultWalls('muur')` returns `{ front: defaultWallConfig }`
- The front face supports the full `WallConfig`: material, finish, door, window
- The back face renders identically to the front — implemented as a single thin box geometry (0.15m deep) with the same material applied to both sides (double-sided material). No separate back face mesh needed.
- `getAvailableWallIds('muur')` returns `['front']`

## 3. Snapping

### New: `detectWallSnap()`

Follows the two-pass approach from `detectPoleSnap()`, adapted for a rectangular entity:

**Pass 1 — Edge slide:** The wall's long edge slides along building edges, snapping when within `SNAP_THRESHOLD` (0.5m). A horizontal wall slides along top/bottom building edges; a vertical wall along left/right edges.

**Pass 2 — Endpoint detent:** Wall endpoints (the two short ends) snap to:
- Building corners
- Pole positions
- Other wall endpoints

Uses `POLE_DETENT_THRESHOLD` (0.35m). Overrides edge slide when within threshold.

**Orientation awareness:** Snapping respects the wall's current orientation. The long axis determines which building edges are candidates.

**Return type:** Returns `[number, number]` (snapped position), same as `detectPoleSnap()`. No connection tracking — standalone walls don't participate in the `SnapConnection` system.

**Orientation toggle while snapped:** Toggling orientation clears any visual snap alignment. The wall stays at its current position but is no longer edge-locked. The user can then drag to re-snap in the new orientation.

**Poles snapping to walls:** Yes — muur entities are valid snap targets for `detectPoleSnap()`. Poles should be able to snap to wall edges and endpoints, just like they snap to building edges. No changes needed to `detectPoleSnap()` since it already iterates all non-pole buildings; muur entities will be included automatically.

## 4. UI Changes

### BuildingManager

- Add "+ Muur toevoegen" button in the entity grid
- Walls are freely removable (same as poles — no minimum count restriction). Update `removeBuilding` guard to exclude `'muur'` alongside `'paal'` from the "keep at least one building" check.
- Improve the overall panel layout and visual design of the building/entity grid

### Afmetingen Panel (Dimensions)

When a wall is selected:
- **Width** control: adjusts the long dimension (min 1m, max 10m)
- **Height** control: shows current effective height with "default" badge when using `defaultHeight`, allows override
- **Orientation toggle**: horizontal/vertical switch
- Depth is fixed at 0.15m, not shown

When a building is selected:
- Height control now updates `defaultHeight` (affects all non-overridden entities)
- Width/depth controls work as before

### Wanden Panel (Walls)

When a wall entity is selected:
- Skip the WallSelector (only one face)
- Show SurfaceProperties directly: material, finish, door config, window config
- Same controls as building walls

### General UI Polish

- Improve the capsule toolbar panels for clarity and visual consistency
- Better entity type icons/labels in BuildingManager
- Clean up the tool selector layout

## 5. 2D Rendering (Schematic)

### Visual

- Rendered as a thin filled rectangle
- Fill color based on wall material (follow SchematicWalls color logic)
- Stroke: `#666` default, `#3b82f6` when selected
- Door/window openings rendered as gaps (reuse SchematicWalls opening logic)

### Layer Order

Buildings (bottom) → Standalone walls → Poles (top)

### Interaction

- Click to select
- Drag to move (with snap detection via `detectWallSnap()`)
- Same dead-zone and drag behavior as buildings and poles

## 6. 3D Rendering (Canvas)

### Approach

Reuse the existing `Wall.tsx` component which already handles:
- Material texturing via `useWallTexture()`
- Door and window geometry cutouts via `createWallWithOpeningsGeo()`
- Glass wall special case (transparent with mullions/transoms)
- Selection highlighting

### Positioning

- Place wall mesh at entity position
- Rotate 90 degrees around Y axis when orientation is `'vertical'`
- Wall dimensions: width from entity dimensions, height from effective height, thickness = `POST_SIZE`

### Selection

- Selection outline with same margin as buildings (0.1m)

## 7. Pricing

- Update `wallGrossArea()` and `wallNetArea()` to accept an effective height parameter (or the `defaultHeight` from the store) instead of reading `building.dimensions.height` directly
- `calculateBuildingQuote()` must short-circuit for `'muur'` the same way it does for `'paal'` — no roof pricing for standalone walls. Instead, add a dedicated wall material + extras line item.
- Standalone walls appear as separate line items in the quote
- Material cost, door cost, window cost calculated the same as building walls

## 8. Store Changes

### New State

```typescript
interface ConfigState {
  // ...existing
  defaultHeight: number; // new
}
```

### New/Modified Actions

- `setDefaultHeight(height: number)` — updates `defaultHeight`, recalculates effective heights
- `addBuilding('muur')` — creates wall entity with `WALL_DIMENSIONS`, `orientation: 'horizontal'`, `heightOverride: null`
- `setOrientation(buildingId: string, orientation: 'horizontal' | 'vertical')` — toggle wall orientation
- `setHeightOverride(buildingId: string, override: number | null)` — set or clear height override
- Modified `addBuilding` for all types to include `heightOverride: null`

### Effective Height Helper

```typescript
function getEffectiveHeight(building: BuildingEntity, defaultHeight: number): number {
  return building.heightOverride ?? defaultHeight;
}
```

Used everywhere that currently reads `building.dimensions.height`.

## 9. Files to Modify

| File | Changes |
|------|---------|
| `src/types/building.ts` | Add `'muur'` to BuildingType, add `orientation` and `heightOverride` fields |
| `src/lib/constants.ts` | Add `WALL_DIMENSIONS`, add `'muur'` cases to `getDefaultWalls()`, `getAvailableWallIds()`, and wall ID maps |
| `src/lib/snap.ts` | Add `detectWallSnap()` |
| `src/lib/pricing.ts` | Handle standalone wall pricing |
| `src/store/useConfigStore.ts` | Add `defaultHeight`, height override actions, wall creation |
| `src/components/schematic/SchematicView.tsx` | Render standalone walls, drag with wall snap |
| `src/components/canvas/Building.tsx` | Handle `'muur'` type rendering |
| `src/components/ui/BuildingManager.tsx` | Add wall button, improve layout |
| `src/components/ui/DimensionsControl.tsx` | Height inheritance UI, orientation toggle, width for walls |
| `src/components/ui/CapsuleToolbar.tsx` | Adapt Wanden section for wall entities |
| `src/components/ui/WallSelector.tsx` | Skip selector for muur type |
| `src/components/ui/SurfaceProperties.tsx` | Work with standalone wall's single face |

## 10. Out of Scope

- Angled/rotated walls (future: could add rotation angle)
- Walls connecting to form enclosed spaces
- Automatic wall generation from building footprints
- Multi-face walls (front and back are always identical)
