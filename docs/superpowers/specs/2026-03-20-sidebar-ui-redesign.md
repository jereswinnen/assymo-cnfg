# Sidebar UI Redesign

Replace the floating CapsuleToolbar with a persistent right-side sidebar featuring two tabs (Objects / Configure), drag-and-drop object placement, and a mobile bottom sheet.

## Overview

The current UI uses a floating capsule toolbar with popover panels. This redesign consolidates everything into a single persistent sidebar that provides a more logical workflow: browse/add objects, then configure them.

## Component Architecture

```
Sidebar (new — replaces CapsuleToolbar)
├── Tab Bar: "Objects" | "Configure"
├── Objects Tab
│   ├── ObjectCatalog — 2×2 grid of draggable building types (Berging, Overkapping, Paal, Muur)
│   ├── PlacedObjectsList — scrollable list of placed objects (name, type icon, dimensions, delete button)
│   └── Sidebar footer — ConfigCodeDialog (import/export) + Reset button + Export button
├── Configure Tab
│   ├── Empty state: "Select an object to configure" placeholder (when nothing selected)
│   ├── Selected object header (type icon, auto-generated name, dimensions summary)
│   └── Accordion (one section open at a time):
│       ├── Dimensions — width, depth, height, roof pitch sliders
│       ├── Structure — roof covering, trim color, skylight, insulation, corner braces, floor material
│       ├── Walls & Openings — wall selector, wall material/finish, door config, window config
│       └── Quote — pricing breakdown
└── Collapse toggle (chevron on left edge of sidebar)
```

### Existing canvas overlays (unchanged)

- 2D/3D ViewToggle — stays as an absolutely-positioned overlay at top-left of the canvas (without Export button, which moves to sidebar footer)

### Components Removed

- `CapsuleToolbar.tsx` — replaced entirely by Sidebar
- `BuildingManager.tsx` — functionality split between ObjectCatalog and PlacedObjectsList

### Components Reused (moved from popovers into accordion sections)

- `DimensionsControl` — as-is in Dimensions section
- `RoofConfigSection` + `FloorConfigSection` — composed together in Structure section
- `WallSelector` + `SurfaceProperties` + `DoorConfig` + `WindowConfig` — composed in Walls & Openings section
- `QuoteSummary` — as-is in Quote section
- `ConfigCodeDialog` — moved to sidebar footer

## Drag and Drop

### Desktop (2D Plan View)

1. User drags an object type from the ObjectCatalog grid
2. A ghost preview (HTML div) is absolutely positioned over the canvas, tracking the cursor. The ghost is a simple semi-transparent rectangle matching the default footprint size of the building type, with a dashed border and the type name. Not rendered inside the SVG.
3. On drop, the mouse position is converted to SVG/world coordinates using `getScreenCTM().inverse()` on the SVG element, accounting for current pan/zoom transform
4. A new building is created via `addBuilding(type, position)` — the existing `addBuilding` is extended with an optional `position` parameter. When provided, the auto-offset logic is bypassed and the building is placed at the given coordinates.
5. After creation, snap detection runs (using existing `detectSnap` / `detectPoleSnap` / `detectWallSnap`) and adjusts position if a snap is found
6. The new object is auto-selected and the sidebar switches to the Configure tab

### Desktop (3D View)

3D view is view-only — no interaction, no drag-and-drop, no selection. Users switch to 2D to make changes. However, `cameraTargetWallId` still works: selecting a wall via the sidebar's Walls & Openings section while viewing 3D will animate the camera to face that wall.

### Mobile

Drag-and-drop is disabled on mobile. Users tap an object type in the catalog to create it at an auto-calculated offset position (same as current behavior).

## Selection & Highlighting

### Selection triggers

- Click an object on the 2D canvas
- Click an object in the PlacedObjectsList

### Selection behavior

- Selected object gets a pulse animation (subtle scale pulse 1.0 → 1.02 → 1.0 on loop in 2D; glow/emissive pulse on 3D mesh)
- Sidebar auto-switches to the Configure tab with that object's settings
- If sidebar is collapsed (desktop), selecting an object also expands the sidebar
- Click empty canvas area to deselect (stays on current tab)
- Clicking the Objects tab does not deselect the current object

## Keyboard Shortcuts

- **Backspace / Delete** — remove selected object if deletion is allowed (store enforces "keep at least one structural building"). If deletion is blocked, no action is taken and the sidebar stays on the current tab. If deletion succeeds: cleans up connections, clears selection, sidebar switches to Objects tab.
- **[** — toggle sidebar collapsed/expanded. Suppressed when focus is inside an input, textarea, or contenteditable element.

## Sidebar Collapse (Desktop)

- Small chevron toggle button on the left edge of the sidebar
- Collapsed: sidebar slides out to the right (CSS transition, ~200ms ease), canvas takes full width; a small floating button remains at the right edge to re-open
- Expanded: slides back in, canvas resizes (CSS transition on width)
- Sidebar width: ~280px
- Toggle via `[` keyboard shortcut

## Mobile Bottom Sheet

- Activates on screens < 768px
- Collapsed state: grab handle bar + tab buttons visible at bottom
- Drag up to expand, showing full tab content (same Objects/Configure tabs, same accordion)
- Auto-expands when an object is selected on canvas
- Same functionality as desktop sidebar, just re-laid out for touch

## State Management Changes

### New store state

- `sidebarTab: 'objects' | 'configure'` — active tab
- `sidebarCollapsed: boolean` — collapsed state (desktop only)
- `activeConfigSection: 'dimensions' | 'structure' | 'walls' | 'quote' | null` — which accordion section is open
- `viewMode: 'plan' | '3d'` — moved from local state in `page.tsx` into the store. Keeps existing `'plan'` value (not renamed to `'2d'`) to avoid breaking ViewToggle and conditional logic throughout the codebase.

### Modified behavior

- `selectBuilding(id)` — now also sets `sidebarTab` to `'configure'`. If `sidebarCollapsed` is true, sets it to false.
- `removeBuilding(id)` — if deletion succeeds: sets `sidebarTab` to `'objects'`, sets `selectedBuildingId` to `null` (no longer auto-selects next building), and clears `selectedElement` to `{ type: null }`.
- `selectElement(element)` — updated to set `activeConfigSection` to `'walls'` (for wall selections) or `'structure'` (for roof selections) instead of numeric `activeAccordionSection` values. Still sets `cameraTargetWallId` for 3D camera animation.
- `addBuilding(type, position?)` — extended with optional position parameter. When provided, bypasses auto-offset and places at given coordinates.

### Removed state

- `activeAccordionSection: number` — replaced by `activeConfigSection`

## Page Layout Changes

### Desktop (≥ 768px)

```
┌─────────────────────────────┬──────────┐
│  [2D|3D]                    │ Sidebar  │
│                             │  280px   │
│       Canvas (2D/3D)        │          │
│       (flex: 1)             │          │
│                             │          │
└─────────────────────────────┴──────────┘
```

### Mobile (< 768px)

```
┌─────────────────────────────┐
│ [2D|3D]                     │
│       Canvas (2D/3D)        │
│       (full width)          │
│                             │
├─────────────────────────────┤
│    Bottom Sheet (overlay)   │
└─────────────────────────────┘
```

## Accordion Section Content

### Dimensions (per selected building)

- Width slider (0.5m increments) — hidden for Paal
- Depth slider (0.5m increments) — hidden for Paal and Muur
- Height slider (0.5m increments) — shown for all types
- Roof pitch slider — shown when pitched roof is selected (global setting)
- Content adapts per building type (e.g., Paal only shows height)

### Structure

- **Roof** (global — shared across all buildings):
  - Roof type toggle (flat/pitched)
  - Roof covering type selector
  - Trim color swatches
  - Skylight toggle
  - Insulation toggle
- **Per-building options:**
  - Corner braces toggle — shown for Berging and Overkapping only
  - Floor material selector — shown for Berging only (Muur is a standalone wall, no floor)

### Walls & Openings

Adapts per building type:

- **Berging:** Wall selector (front/back/left/right), wall material grid, finish toggle, door config, window config. Connected walls (from snap connections) show open/closed toggle.
- **Muur:** No wall selector needed — auto-selects front wall (existing `MuurWallAutoSelect` behavior preserved). Shows wall material, finish, door config, window config.
- **Overkapping:** No walls section (overkapping has no enclosed walls).
- **Paal:** No walls section (poles have no walls).

### Quote

- Per-building cost breakdown
- Total price summary

## PlacedObjectsList Details

- Object names are auto-generated (e.g., "Berging 1", "Overkapping 2") — not user-editable
- Each item shows: type icon, name, dimensions (W × D × H), delete button (✕)
- List scrolls independently when it exceeds available space
- Objects are not reorderable — listed in creation order
- Click on an item to select it (same as clicking on canvas)
