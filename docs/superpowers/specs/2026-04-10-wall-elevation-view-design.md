# Wall Elevation View

## Overview

Add a front-on elevation view of individual walls, accessible by clicking a wall on the 2D schematic plan. The elevation view replaces the floor plan and lets users drag, resize, and vertically position doors and windows directly on the wall surface. Pressing Escape or clicking "Plattegrond" in the view toggle returns to the plan view.

## Data Model Changes

### WallWindow Expansion

```typescript
export interface WallWindow {
  id: string;
  position: number;    // 0.0–1.0 horizontal fraction (existing)
  sillHeight: number;  // meters from ground to bottom of window
  width: number;       // meters
  height: number;      // meters
}
```

Default values when adding a window: `width: 1.2`, `height: 1.0`, `sillHeight: 1.2`.

### Window Presets

A preset system for quick window size selection, designed to also support door presets in the future:

```typescript
export interface WindowPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const WINDOW_PRESETS: WindowPreset[] = [
  { id: 'standard', label: '120 × 100', width: 1.2, height: 1.0 },
  { id: 'small',    label: '80 × 80',   width: 0.8, height: 0.8 },
  { id: 'large',    label: '150 × 120',  width: 1.5, height: 1.2 },
];
```

### Constant Migration

`WIN_W`, `WIN_H`, `WIN_SILL` become default fallback values for windows without explicit dimensions (backwards compatibility). All rendering code reads dimensions from the `WallWindow` object, falling back to these constants.

## Wall Click → Elevation Transition

### Entering Elevation Mode

1. Wall segments in `SolidWall` (SchematicWalls.tsx) get click handlers
2. A click (not drag — use existing 5px deadzone) on a wall calls `selectElement({ type: 'wall', id: wallId, buildingId })`
3. `SchematicView` derives its mode from `selectedElement`: when a wall is selected, it switches to elevation mode
4. The SVG content switches from the floor plan to the `WallElevation` component
5. Existing plan-mode pointer handlers (building drag, resize, selection rect) are inactive in elevation mode

### Returning to Plan View

- **Escape key** — clears `selectedElement`, which triggers mode back to plan
- **"Plattegrond" button** — appears as the first item in the view toggle group when in elevation mode. Clicking it clears wall selection

### View Toggle Behavior

- Plan mode: `[2D] [Split] [3D]`
- Elevation mode: `[Plattegrond] [2D] [Split] [3D]`
- Clicking 2D/Split/3D while in elevation returns to plan first, then switches view mode

## WallElevation Component

New component: `src/components/schematic/WallElevation.tsx`

### Rendering

- Wall rectangle (full width × building height) with material-colored fill
- Door opening with panel, handle, and frame
- Window openings with glass fill, cross dividers, and frame
- Ground line below the wall
- Dimension labels (wall width, wall height)

### Selection

- Click an opening to select it — shows 8 resize handles (4 corners + 4 edge midpoints) and dimension labels (width × height, sill height)
- Click empty wall area to deselect
- One opening selected at a time

### Drag to Move

- Pointer-down on opening body starts move drag
- Free movement in X and Y, snapping to 10cm increments
- Horizontal position clamped via existing `clampOpeningPosition`
- Vertical position clamped: sill height ≥ 0 (ground level), top of opening ≤ wall height
- Opening gaps enforced (no overlapping openings)
- Live-updates the store during drag (pause undo on first move, update on each move, resume on pointer-up)

### Drag to Resize

- Pointer-down on resize handle starts resize drag
- Corner handles: resize both width and height
- Edge handles: resize one axis only
- Minimum size: 0.3m × 0.3m
- Snaps to 10cm increments
- Clamped: window stays within wall bounds, doesn't overlap other openings

### Props

```typescript
interface WallElevationProps {
  buildingId: string;
  wallId: WallId;
  wallLength: number;
  wallHeight: number;
}
```

Reads wall config from the store directly.

## Doors in Elevation View

Doors keep their current behavior — fixed height (2.1m), enkel/dubbel sizes, only horizontal positioning. The elevation view displays them but does not add vertical drag or resize for doors. The preset system is designed so door size presets can be added later without rework.

## Sidebar Changes

### WindowConfig

- The "+" button continues to add windows at the best available spot
- When a window is added, it appears in the elevation view with default dimensions
- Per-window size can be set via presets in the sidebar (dropdown or toggle group per window row), or by dragging resize handles in the elevation view

### DoorConfig

- No changes — preset position buttons (links/midden/rechts) and enkel/dubbel toggle work as before

## Impact on 3D Rendering

### WindowMesh

- Receives per-window `width`, `height`, `sillHeight` as props instead of using fixed constants
- Falls back to `WIN_W`, `WIN_H`, `WIN_SILL` for backwards compatibility

### wallGeometry.ts

- `createWallWithOpeningsGeo` uses per-window dimensions for wall cutouts instead of fixed `WIN_W`/`WIN_H`/`WIN_SILL`

### Live Update

The store is updated during elevation drag (same pattern as schematic drag), so the 3D view updates in real time.

## URL Serialization (configCode.ts)

Each window expands from 7 bits (position only) to 28 bits:
- 7 bits: position (0–100 → 0.0–1.0)
- 7 bits: width (0–100 → 0.0–10.0m, ×10 scale)
- 7 bits: height (0–100 → 0.0–10.0m, ×10 scale)
- 7 bits: sillHeight (0–100 → 0.0–10.0m, ×10 scale)

## Constants

```typescript
// Defaults for new windows
WIN_W_DEFAULT = 1.2      // default width (meters)
WIN_H_DEFAULT = 1.0      // default height (meters)
WIN_SILL_DEFAULT = 1.2   // default sill height (meters)

// Constraints
WIN_MIN_SIZE = 0.3       // minimum window dimension (meters)
SNAP_INCREMENT = 0.1     // snap grid for drag/resize (meters)
```

## What Doesn't Change

- Door rendering and behavior (enkel/dubbel, swing, material)
- Horizontal schematic drag (still works in plan view)
- Building drag, resize, snap connections
- Pricing calculations (use `window.width * window.height` instead of fixed area)
- Undo/redo (store-based, works automatically)
