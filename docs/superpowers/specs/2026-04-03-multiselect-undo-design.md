# Multi-Select & Undo/Redo Design Spec

## Overview

Two features for the 2D schematic configurator:
1. **Multi-select**: drag a rectangle on empty space to select multiple buildings, then move them as a group
2. **Undo/redo**: Cmd+Z / Cmd+Shift+Z to undo/redo all document-level state changes

---

## Feature 1: Multi-Select

### State Changes (`useConfigStore`)

- Add `selectedBuildingIds: string[]` — the source of truth for selection
- `selectedBuildingId` becomes derived: returns the single ID when `selectedBuildingIds.length === 1`, otherwise `null`
- Existing components reading `selectedBuildingId` (sidebar, wall config, resize handles) continue working unchanged — they only activate for single selection

### Selection Rectangle (`SchematicView`)

- **Trigger**: `pointerdown` on empty SVG space (the root `<svg>` element itself)
- **Dead zone**: 5px screen-space movement before committing to rectangle mode. If released within dead zone, treat as click-to-deselect (existing behavior)
- **Rendering**: SVG `<rect>` with marching ants animation — `stroke-dasharray="4 4"` with animated `stroke-dashoffset`, blue stroke (`#3b82f6`), near-transparent fill (`rgba(255,255,255,0.03)`)
- **Coordinate space**: anchor point and current point stored in world coordinates (converted via `clientToWorld`). Rectangle drawn in world space within the SVG.
- **Live preview**: as the rectangle resizes during drag, buildings whose AABB overlaps the rectangle get a temporary selection highlight (blue fill overlay)
- **Commit**: on `pointerup`, all overlapping buildings become the new `selectedBuildingIds`

### Hit Testing

- AABB intersection: a building is selected if its bounding box `[position.x, position.z, position.x + width, position.z + depth]` overlaps the selection rectangle
- Applies to all building types: berging, overkapping, muur, paal

### Shift+Click

- Shift+click on a building toggles it in/out of `selectedBuildingIds`
- Without Shift: clicking a building replaces the entire selection with just that building (existing behavior, now setting `selectedBuildingIds` to `[id]`)

### Group Drag

- `pointerdown` on a building that is in `selectedBuildingIds` (and `selectedBuildingIds.length > 1`) initiates group drag
- All selected buildings move by the same world-space delta each frame
- Snap detection runs on the **dragged building only** — other selected buildings follow the same offset
- ViewBox freezes during group drag (existing behavior)
- On `pointerup`: snap connections re-evaluated for all moved buildings via existing `detectSnap` / `detectPoleSnap` / `detectWallSnap`

### Disabled During Multi-Select (`selectedBuildingIds.length > 1`)

- Resize handles: hidden
- Wall/door/window configuration in sidebar: disabled/greyed out
- `selectedElement`: cleared (no wall or roof selection active)
- Dimension input fields: disabled

### Deselection

- Click on empty space (no rectangle drag): clears `selectedBuildingIds`
- Click on a single building without Shift: replaces selection with `[thatBuilding]`
- Pressing Escape: clears selection

---

## Feature 2: Undo/Redo

### Integration

- Install `zundo` package (Zustand temporal middleware)
- Wrap `useConfigStore` with `temporal()` middleware
- Use `partialize` to track only document state, excluding transient UI:
  - **Tracked**: `buildings`, `connections`, `roof`
  - **Excluded**: `selectedBuildingIds`, `selectedElement`, `sidebarTab`, `sidebarCollapsed`, `activeConfigSection`, `viewMode`, `draggedBuildingId`, `hoveredBuildingId`, and any other UI-only state

### Keyboard Binding

- Global `keydown` event listener (in root page component)
- `Cmd+Z` (Mac) / `Ctrl+Z` (Win) → undo
- `Cmd+Shift+Z` (Mac) / `Ctrl+Shift+Z` (Win) → redo
- `e.preventDefault()` to suppress browser native undo
- **Input focus guard**: when an `<input>` or `<textarea>` is focused, do NOT intercept — let native text undo work. Only fire app-level undo when no text input is focused.

### Granularity

- Every Zustand state mutation = one undo step
- Move building (single `updateBuildingPosition` on `pointerup`) = 1 step
- Change wall material = 1 step
- Add/remove building = 1 step
- Drag operations only commit on `pointerup`, so mid-drag intermediate positions are not recorded

### History

- Unlimited depth
- Cleared on page refresh (no localStorage persistence)
- Redo stack clears when a new mutation occurs (standard behavior, handled by zundo)

### Edge Cases

- **Undo delete**: building reappears with all its properties. Selection state is NOT restored (excluded from history).
- **Undo snap**: position and connection array revert together if set in the same mutation.
- **Undo add**: building is removed. If it was selected, selection clears naturally since the ID no longer exists in `buildings`.
- **Group move undo**: if group move is a single mutation (batch update), it undoes all positions at once. If implemented as sequential updates, each building reverts one at a time (less ideal — implement as batch).

---

## Future Enhancements (Out of Scope)

- **Group snap (all selected buildings)**: snap detection on every selected building, nearest-snap-wins priority resolution
- **Undo grouping/debounce**: multiple rapid changes (e.g., slider drag) grouped into one undo step
- **Persistent undo history**: serialize to localStorage for cross-session undo
