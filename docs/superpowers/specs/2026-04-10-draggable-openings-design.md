# Draggable Door & Window Positioning

## Overview

Replace the discrete door position toggle (links/midden/rechts) and auto-distributed window count with free-form dragging on the 2D schematic. Doors and windows become individually positionable by dragging them along their wall axis, with collision detection and edge clearance preventing invalid placements.

## Data Model

### WallConfig Changes

```typescript
// BEFORE
doorPosition: DoorPosition;  // 'links' | 'midden' | 'rechts'
hasWindow: boolean;
windowCount: number;

// AFTER
doorPosition: number;         // 0.0–1.0 fraction of usable wall length
windows: WallWindow[];         // replaces hasWindow + windowCount
```

The `DoorPosition` enum type is removed. The `hasWindow` and `windowCount` fields are replaced by the `windows` array — `windows.length > 0` replaces `hasWindow`, `windows.length` replaces `windowCount`.

All other door fields remain unchanged: `hasDoor`, `doorSize`, `doorSwing`, `doorMaterialId`, `doorHasWindow`.

### New WallWindow Type

```typescript
interface WallWindow {
  id: string;        // stable key for React rendering and drag tracking
  position: number;  // 0.0–1.0 fraction of usable wall length
}
```

### Fraction Coordinate System

Positions are stored as normalized fractions (0.0–1.0) of the wall's **usable length** — the wall length minus edge clearance on both sides.

Conversion to meters (wall-center-relative, matching existing rendering coordinates):

```
EDGE_CLEARANCE = 0.5  // configurable, meters from wall corner
usableStart = -wallLength / 2 + EDGE_CLEARANCE
usableEnd   =  wallLength / 2 - EDGE_CLEARANCE
actualX     = usableStart + fraction * (usableEnd - usableStart)
```

Preset buttons map to: links = `0.0`, midden = `0.5`, rechts = `1.0`.

### DEFAULT_WALL Update

```typescript
doorPosition: 0.5,   // center (was 'midden')
windows: [],          // empty (was hasWindow: false, windowCount: 0)
```

## Collision & Clamping

A pure function constrains opening positions during drag, on add, and on building resize.

### Rules (priority order)

1. **Edge clearance** — opening can't be closer than `EDGE_CLEARANCE + halfWidth` from wall ends
2. **No overlap** — minimum `OPENING_GAP` (0.3m) between edges of any two openings
3. **Clamp, don't reject** — invalid positions slide to the nearest valid spot

### Core Function

```
clampOpeningPosition(
  wallLength: number,
  openingWidth: number,
  proposedFraction: number,
  otherOpenings: { position: number, width: number }[]
): number  // clamped valid fraction
```

### Building Resize Behavior

Fractions stay the same when the building resizes. If a wall shrinks so much that openings would overlap, positions are clamped on next interaction. No automatic repositioning — the user re-drags if needed.

## Drag Interaction (2D Schematic Only)

The 3D view reflects positions but has no drag interaction.

### Hooking Into SchematicView

1. Remove `pointerEvents="none"` from the openings `<g>` group
2. Add invisible wider hit-target rects behind each opening symbol for easy grabbing
3. Add `onPointerDown` on each hit target to start the drag
4. Drag state stored in refs on `SchematicView` (same pattern as building drag):
   ```
   draggingOpening.current = {
     buildingId, wallId,
     type: 'door' | 'window',
     windowIndex?: number,
     startFraction: number
   }
   ```
5. Existing `onPointerMove` / `onPointerUp` on the SVG root handles drag and release
6. Pause undo during drag (existing pattern from building drag/resize)

### Coordinate Conversion (pointer → fraction)

1. Get pointer position in SVG coordinates via `svgRef` + `getScreenCTM()`
2. Project onto wall axis using wall geometry (cx, cy, orientation, length from `WallGeom`)
3. Convert to local offset along wall, then to 0–1 fraction
4. Pass through `clampOpeningPosition` to enforce constraints

### Ghost Preview

During drag, `SchematicOpenings` receives an optional `dragPreview` prop:

```typescript
dragPreview?: {
  buildingId: string;
  wallId: WallId;
  type: 'door' | 'window';
  windowIndex?: number;
  fraction: number;  // clamped preview position
}
```

The opening renders at the preview position in blue, with the original position faded out.

### Commit

On pointer-up, call `updateBuildingWall()` with the final clamped fraction. This is a single store update = one undo step.

## Sidebar UI Changes

### DoorConfig

- Links/midden/rechts toggle **stays as preset buttons** — clicking sets `doorPosition` to `0.0`, `0.5`, or `1.0`
- When the current position doesn't match a preset, no button is highlighted (indicates custom position)
- All other door controls unchanged

### WindowConfig

- Remove the count slider
- Show a **list of windows** (e.g. "Raam 1", "Raam 2") — each row has a delete (×) button
- **"+ Raam" button** adds a window at the best available spot (largest gap between existing openings and edges)
- Max windows capped by physical fit: `Math.floor((wallLength - 2 * EDGE_CLEARANCE) / (WIN_W + OPENING_GAP))`
- No position controls in the sidebar — positioning is done by dragging on the schematic

## Position Resolution Function

Replaces `computeOpeningPositions`. Same output format so rendering code changes minimally.

```
resolveOpeningPositions(
  wallLength: number,
  doorPosition: number | null,  // fraction, null if no door
  doorSize: DoorSize,
  windows: WallWindow[],
): { doorX: number | null, windowXs: number[] }
```

Returns meters from wall center, matching the existing coordinate system used by:
- `SchematicOpenings.tsx` — 2D rendering
- `SchematicWalls.tsx` — wall segment gaps
- `Wall.tsx` — 3D rendering
- `wallGeometry.ts` — wall mesh holes

## Constants (configurable)

```typescript
EDGE_CLEARANCE = 0.5    // min distance from wall corner to opening edge (meters)
OPENING_GAP = 0.3       // min distance between opening edges (meters)
DOOR_W = 0.9            // single door width (existing)
DOUBLE_DOOR_W = 1.6     // double door width (existing)
WIN_W = 1.2             // window width (existing)
```

## What Doesn't Change

- 3D rendering pipeline (`Wall.tsx`, `DoorMesh.tsx`, `WindowMesh.tsx`, `wallGeometry.ts`) — just receives positions from the new resolution function
- Door arc rendering on schematic — fed from resolved position, same as before
- Dimension line clearance for naar_buiten arcs — unchanged
- Undo/redo — store-based, works automatically
- Door material, size, swing, window-in-door controls — all unchanged
