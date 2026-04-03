# Anchor-Point Positioning & Drag-to-Resize

## Overview

Refactor the building position model from center-based to top-left-corner-based, and add drag-to-resize handles in the 2D schematic view. This enables intuitive edge-based resizing where the opposite edge stays fixed, and makes slider-based resizing naturally left/top-anchored.

## Decisions

- **Position anchor:** Top-left corner (min X, min Z in schematic coordinates)
- **Resize interaction:** Drag midpoint handles on edges in 2D schematic view
- **Resize anchor:** Dynamic — opposite edge stays fixed relative to the dragged edge
- **Slider anchor:** Left/top — position stays fixed, dimension extends right/down
- **Snap during resize:** Reuse existing 50cm threshold; dragged edges snap to opposing edges of other buildings
- **Scope:** 2D schematic only (no 3D drag-to-resize)
- **Handle style:** Midpoint circles on each edge, visible when selected, with cursor changes

## 1. Position Model Refactor

### Current Model

`position: [x, z]` represents the **center** of the building. Edge calculations use `position ± dimension/2` throughout:

- `snap.ts` — `getBuildingEdges()`, `detectSnap()`, `detectPoleSnap()`, `detectWallSnap()`
- `SchematicView.tsx` — rendering, hit targets, labels, dimension lines, `getConnectionEdges()`
- `BuildingInstance.tsx` — 3D group positioning
- `useConfigStore.ts` — `addBuilding` auto-positioning

### New Model

`position: [x, z]` represents the **top-left corner** (min X, min Z). Edge derivation:

| Edge   | Old                        | New                    |
|--------|----------------------------|------------------------|
| Left   | `position[0] - width/2`   | `position[0]`         |
| Right  | `position[0] + width/2`   | `position[0] + width` |
| Top    | `position[1] - depth/2`   | `position[1]`         |
| Bottom | `position[1] + depth/2`   | `position[1] + depth` |
| Center | `position`                 | `[position[0] + width/2, position[1] + depth/2]` |

### Migration

All consumers of `position` must be updated:

**`snap.ts` — `getBuildingEdges()`:**
Replace center-based edge computation with top-left-based. The `Edge` interface stays the same — only the value calculations change.

**`snap.ts` — `detectSnap()`:**
The snapped position offset logic stays the same (it operates on position deltas). The secondary alignment check uses center, which becomes `position + dimension/2`.

**`snap.ts` — `detectPoleSnap()` and `detectWallSnap()`:**
Update edge/corner/midpoint calculations from `cx ± hw` to `position[0]` / `position[0] + width`.

**`SchematicView.tsx`:**
All `ox - hw` becomes `ox`, all `ox + hw` becomes `ox + width`. Labels that reference center use `ox + width/2`. Same pattern for Z axis.

**`BuildingInstance.tsx` (3D rendering):**
Convert top-left position back to center for the Three.js group: `position={[pos[0] + width/2, 0, pos[1] + depth/2]}`.

**`useConfigStore.ts` — `addBuilding()`:**
Auto-positioning logic changes from `maxX + width/2 + gap` to `maxX + gap` (since position is already the left edge). `createBuilding` sets initial position as top-left rather than center.

**`useConfigStore.ts` — `loadState()`:**
Migration for existing saved configs: convert center-based positions to top-left by subtracting `width/2` and `depth/2`.

**Standalone walls (muur):**
For horizontal walls, position is the top-left of the wall's bounding box. For vertical walls, same principle — top-left of the oriented bounding box.

## 2. Resize Handles

### Rendering

When a building is selected in the 2D schematic, render 4 SVG circles at edge midpoints:

| Handle | Position (SVG coords) | Cursor |
|--------|----------------------|--------|
| Left   | `(x, y + depth/2)` | `ew-resize` |
| Right  | `(x + width, y + depth/2)` | `ew-resize` |
| Top    | `(x + width/2, y)` | `ns-resize` |
| Bottom | `(x + width/2, y + depth)` | `ns-resize` |

- Circle radius: ~0.12 in SVG units (scales with viewBox)
- Fill: `#3b82f6` (selection blue)
- Stroke: white, 0.03 width
- Only rendered for the selected building
- `pointerEvents="all"` — handles must intercept pointer events

### Interaction Priority

Handles sit on top of the building hit target. Their `onPointerDown` calls `e.stopPropagation()` to prevent the body drag handler from firing. This separates resize (handle drag) from move (body drag).

### Drag Behavior

Each handle controls one dimension and optionally adjusts position:

| Handle | Dimension change | Position change |
|--------|-----------------|-----------------|
| Right  | `width = mouseX - position[0]` | None |
| Bottom | `depth = mouseZ - position[1]` | None |
| Left   | `width = (position[0] + width) - mouseX`, `position[0] = mouseX` | X shifts |
| Top    | `depth = (position[1] + depth) - mouseZ`, `position[1] = mouseZ` | Z shifts |

For left/top handles, the right/bottom edge is computed first, then position and dimension are derived to keep that edge fixed.

### Dimension Clamping

During drag, clamp dimensions to the constraints defined in `DIMENSION_CONSTRAINTS` (see Section 7). When the dimension hits a limit, the handle stops. For left/top handles, this means the position also stops (the opposite edge remains fixed).

### Per-Type Behavior

- **Structural buildings:** 4 handles (all edges)
- **Walls (muur):** 2 handles on the length axis endpoints only. For a horizontal wall: left handle at `(x, y + depth/2)` and right handle at `(x + width, y + depth/2)`, both with `ew-resize` cursor. For a vertical wall: top handle at `(x + depth/2, y)` and bottom handle at `(x + depth/2, y + width)`, both with `ns-resize` cursor. Wall thickness (depth) is not resizable.
- **Poles (paal):** No handles — fixed size

## 3. Snap During Resize

### New Function: `detectResizeSnap()`

```
detectResizeSnap(
  draggedEdgeValue: number,
  draggedEdgeAxis: 'x' | 'z',
  draggedEdgeSide: WallSide,
  draggedEdgePerpStart: number,
  draggedEdgePerpEnd: number,
  buildingId: string,
  otherBuildings: BuildingEntity[]
): { snappedValue: number; connection: SnapConnection | null }
```

**Algorithm:**
1. Compute the candidate edge position from mouse coordinates
2. Get all edges from other buildings via `getBuildingEdges()`
3. For each opposing edge on the same axis, check if distance < `SNAP_THRESHOLD` (0.5m) and perpendicular ranges overlap
4. Return the closest matching edge value (snapped), or the original if no match
5. If snapped, return a `SnapConnection` linking the two buildings

### Connection Management

- When a resize-snap creates a connection, update the store's `connections` array
- When the edge is dragged away from the snap (distance > threshold), remove the connection
- This mirrors the existing move-snap connection behavior

## 4. Slider Behavior

No code changes needed in `DimensionsControl.tsx`. With top-left positioning:

- Increasing width via slider → `position` stays fixed → right edge extends right
- Increasing depth via slider → `position` stays fixed → bottom edge extends down
- Height slider → unaffected (vertical axis, not part of 2D position model)

The `updateBuildingDimensions` store action continues to only update dimension values. The anchoring is an emergent property of the position model.

## 5. State & Store Changes

### New Store Actions

**`resizeBuilding(id, side, newEdgeValue)`** — Unified resize action that handles both dimension update and position adjustment based on which side is being dragged. Used by both drag handles and could be used by future resize mechanisms.

### Updated Actions

**`updateBuildingDimensions(id, dims)`** — Unchanged. Sliders call this directly. With top-left positioning, this naturally anchors left/top.

**`updateBuildingPosition(id, pos)`** — Unchanged. Used for drag-to-move.

## 7. Dimension Constraints

### New Ranges (from business requirements)

Replace the current hardcoded slider min/max values with a centralized constraints config in `constants.ts`:

```typescript
export interface DimensionConstraints {
  width: { min: number; max: number; step: number };
  depth: { min: number; max: number; step: number };
  height: { min: number; max: number; step: number };
}

export const DIMENSION_CONSTRAINTS: Record<string, DimensionConstraints> = {
  structural: {
    width:  { min: 1,   max: 6,  step: 0.1 },
    depth:  { min: 1,   max: 40, step: 0.1 },
    height: { min: 2.2, max: 3,  step: 0.1 },
  },
  muur: {
    width:  { min: 1,   max: 10, step: 0.5 },
    depth:  { min: 0.15, max: 0.15, step: 0 }, // fixed thickness
    height: { min: 2.2, max: 3,  step: 0.1 },
  },
  paal: {
    width:  { min: 0.15, max: 0.15, step: 0 }, // fixed
    depth:  { min: 0.15, max: 0.15, step: 0 }, // fixed
    height: { min: 2.2, max: 3,  step: 0.1 },
  },
};
```

### Changes from current values

| Dimension | Old | New | Reason |
|-----------|-----|-----|--------|
| Structural width | 3–15m, step 0.5 | 1–6m, step 0.1 | Business requirement: max 6m |
| Structural depth | 3–20m, step 0.5 | 1–40m, step 0.1 | Business: length up to 40m |
| Height (all) | 2–6m, step 0.25 | 2.2–3m, step 0.1 | Business: between 2.2 and 3m |
| Wall width | 1–10m, step 0.5 | 1–10m, step 0.5 | Unchanged |

### Width Categories (future-ready)

The business distinguishes two width categories. These are stored for future use (e.g., pricing, structural requirements) but don't affect functionality yet:

```typescript
export interface WidthCategory {
  id: number;
  label: string;
  maxWidth: number;
}

export const WIDTH_CATEGORIES: WidthCategory[] = [
  { id: 1, label: 'Categorie 1', maxWidth: 4 },
  { id: 2, label: 'Categorie 2', maxWidth: 6 },
];

export function getWidthCategory(width: number): WidthCategory | null {
  return WIDTH_CATEGORIES.find(c => width <= c.maxWidth) ?? null;
}
```

### Consumers

- **`DimensionsControl.tsx`** — Replace hardcoded min/max/step with lookups from `DIMENSION_CONSTRAINTS`
- **Resize drag clamping** — Use same constraints during drag
- **`DEFAULT_DIMENSIONS`** — Update to `{ width: 4, depth: 4, height: 2.6 }` (midpoint of new height range)
- **`WALL_DIMENSIONS`** — Height updated to match
- **`POLE_DIMENSIONS`** — Height updated to match

### Helper function

```typescript
export function getConstraints(type: BuildingType): DimensionConstraints {
  if (type === 'muur') return DIMENSION_CONSTRAINTS.muur;
  if (type === 'paal') return DIMENSION_CONSTRAINTS.paal;
  return DIMENSION_CONSTRAINTS.structural;
}
```

This is used by both sliders and resize handles to get the appropriate limits.

## 8. Edge Cases

- **Connected buildings:** If two buildings are snapped together and one is resized, the connection should be re-evaluated. If the shared edge moves apart, the connection is removed. If a resize creates a new edge alignment, a new connection is created.
- **Overlapping buildings:** No collision prevention — buildings can overlap, same as current move behavior.
- **Very small drags:** The existing 5px dead zone for move applies to resize handles too, preventing accidental resize on click.
- **Simultaneous move + resize:** Not supported. A pointer interaction is either a move (body drag) or a resize (handle drag), never both.
