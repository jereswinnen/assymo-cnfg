# Wall Elevation View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a front-on wall elevation view accessible by clicking a wall on the 2D schematic, allowing users to drag, resize, and vertically position windows on the wall surface.

**Architecture:** `SchematicView` gains an internal elevation mode derived from `selectedElement`. When a wall is clicked on the schematic, it transitions to rendering a `WallElevation` component instead of the floor plan. `WallElevation` is a focused SVG component handling wall rendering, opening selection, drag-to-move, and resize handles. The view toggle gains a "Plattegrond" button for returning to the plan. Window data model expands with `width`, `height`, `sillHeight` fields.

**Tech Stack:** React, SVG, Zustand (with zundo temporal), Three.js (WindowMesh updated for per-window dimensions)

**Spec:** `docs/superpowers/specs/2026-04-10-wall-elevation-view-design.md`

---

### Task 1: Expand WallWindow Data Model

**Files:**
- Modify: `src/types/building.ts`
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Add fields to WallWindow**

In `src/types/building.ts`, expand the `WallWindow` interface (lines 27-30):

```typescript
export interface WallWindow {
  id: string;
  position: number;    // 0.0–1.0 horizontal fraction of usable wall length
  width: number;       // meters
  height: number;      // meters
  sillHeight: number;  // meters from ground to bottom of window
}
```

- [ ] **Step 2: Add window defaults and presets to constants**

In `src/lib/constants.ts`, add default window dimensions and presets near the existing `WIN_W` constant (line 184):

```typescript
// Default window dimensions (used when creating new windows)
export const WIN_W_DEFAULT = 1.2;
export const WIN_H_DEFAULT = 1.0;
export const WIN_SILL_DEFAULT = 1.2;
export const WIN_MIN_SIZE = 0.3;
export const SNAP_INCREMENT = 0.1;

export interface WindowPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const WINDOW_PRESETS: WindowPreset[] = [
  { id: 'standard', label: '120 × 100', width: 1.2, height: 1.0 },
  { id: 'small', label: '80 × 80', width: 0.8, height: 0.8 },
  { id: 'large', label: '150 × 120', width: 1.5, height: 1.2 },
];
```

- [ ] **Step 3: Update findBestNewPosition and WindowConfig to include new fields**

In `src/lib/constants.ts`, the `findBestNewPosition` function returns a fraction. No changes needed — it only deals with horizontal positioning.

In `src/components/ui/WindowConfig.tsx`, update `setWindowCount` (around line 55) so new windows include all fields:

```typescript
const win: WallWindow = {
  id: crypto.randomUUID(),
  position: pos,
  width: WIN_W_DEFAULT,
  height: WIN_H_DEFAULT,
  sillHeight: WIN_SILL_DEFAULT,
};
```

Update the import to include the new constants:
```typescript
import { WIN_W, WIN_W_DEFAULT, WIN_H_DEFAULT, WIN_SILL_DEFAULT, getWallLength, findBestNewPosition, DOOR_W, DOUBLE_DOOR_W } from '@/lib/constants';
```

- [ ] **Step 4: Verify and commit**

Run: `pnpm tsc --noEmit`

Expected: Clean compile. Existing windows without the new fields will show as `undefined` — consumers should fall back to defaults. We handle this in subsequent tasks.

```bash
git add -A
git commit -m "feat: expand WallWindow with width, height, sillHeight and add presets"
```

---

### Task 2: Update 3D Rendering for Per-Window Dimensions

**Files:**
- Modify: `src/components/canvas/WindowMesh.tsx`
- Modify: `src/components/canvas/wallGeometry.ts`
- Modify: `src/components/canvas/Wall.tsx`
- Modify: `src/lib/pricing.ts`

- [ ] **Step 1: Update WindowMesh to accept per-window dimensions**

In `src/components/canvas/WindowMesh.tsx`, change the component to accept `width`, `height`, and `sillHeight` props instead of using fixed constants:

```typescript
'use client';

import { frameMat, glassMat } from './DoorMesh';
import { WIN_DEPTH, FRAME_T, FRAME_D } from './wallGeometry';
import { WIN_W_DEFAULT, WIN_H_DEFAULT, WIN_SILL_DEFAULT } from '@/lib/constants';

interface WindowMeshProps {
  x: number;
  width?: number;
  height?: number;
  sillHeight?: number;
}

export default function WindowMesh({
  x,
  width = WIN_W_DEFAULT,
  height = WIN_H_DEFAULT,
  sillHeight = WIN_SILL_DEFAULT,
}: WindowMeshProps) {
  const winY = sillHeight + height / 2;

  return (
    <group position={[x, winY, 0]}>
      {/* Glass pane */}
      <mesh material={glassMat}>
        <boxGeometry args={[width, height, WIN_DEPTH]} />
      </mesh>
      {/* Top */}
      <mesh position={[0, height / 2 + FRAME_T / 2, 0]} material={frameMat}>
        <boxGeometry args={[width + FRAME_T * 2, FRAME_T, FRAME_D]} />
      </mesh>
      {/* Bottom */}
      <mesh position={[0, -height / 2 - FRAME_T / 2, 0]} material={frameMat}>
        <boxGeometry args={[width + FRAME_T * 2, FRAME_T, FRAME_D]} />
      </mesh>
      {/* Left */}
      <mesh position={[-width / 2 - FRAME_T / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T, height + FRAME_T * 2, FRAME_D]} />
      </mesh>
      {/* Right */}
      <mesh position={[width / 2 + FRAME_T / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T, height + FRAME_T * 2, FRAME_D]} />
      </mesh>
      {/* Cross dividers - vertical */}
      <mesh material={frameMat}>
        <boxGeometry args={[FRAME_T * 0.7, height, FRAME_D]} />
      </mesh>
      {/* Cross dividers - horizontal */}
      <mesh material={frameMat}>
        <boxGeometry args={[width, FRAME_T * 0.7, FRAME_D]} />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 2: Update wallGeometry.ts to accept per-window dimensions**

In `src/components/canvas/wallGeometry.ts`, update `createWallWithOpeningsGeo` to accept window dimensions. Change the function signature to accept an array of window objects instead of just X positions:

```typescript
interface WindowHole {
  x: number;
  width: number;
  height: number;
  sillHeight: number;
}
```

Update the function signature:
```typescript
export function createWallWithOpeningsGeo(
  wallLength: number,
  wallHeight: number,
  thickness: number,
  wallId: string,
  doorX: number | null,
  doorSize: DoorSize,
  windowHoles: WindowHole[],
): ExtrudeGeometry
```

Replace the window hole loop (lines 55-67):
```typescript
for (const win of windowHoles) {
  const ww = win.width / 2;
  const winBottom = -hh + win.sillHeight;
  const winTop = winBottom + win.height;
  if (winTop > winBottom && ww > 0) {
    const hole = new Path();
    hole.moveTo(win.x - ww, winBottom);
    hole.lineTo(win.x + ww, winBottom);
    hole.lineTo(win.x + ww, winTop);
    hole.lineTo(win.x - ww, winTop);
    hole.closePath();
    shape.holes.push(hole);
  }
}
```

- [ ] **Step 3: Update Wall.tsx to pass per-window dimensions**

In `src/components/canvas/Wall.tsx`, update the calls to `createWallWithOpeningsGeo` and `WindowMesh` to pass per-window dimensions.

For the wall geometry call, build a `WindowHole[]` from the wall config:

```typescript
const windowHoles = computedWindowXs.map((wx, i) => {
  const win = (wallCfg.windows ?? [])[i];
  return {
    x: wx,
    width: win?.width ?? WIN_W_DEFAULT,
    height: win?.height ?? WIN_H_DEFAULT,
    sillHeight: win?.sillHeight ?? WIN_SILL_DEFAULT,
  };
});
```

Pass `windowHoles` instead of `computedWindowXs` to `createWallWithOpeningsGeo`.

For WindowMesh rendering, pass the per-window props:

```typescript
{windowXs.map((wx, i) => {
  const win = (wallCfg.windows ?? [])[i];
  return (
    <WindowMesh
      key={i}
      x={wx}
      width={win?.width}
      height={win?.height}
      sillHeight={win?.sillHeight}
    />
  );
})}
```

Import `WIN_W_DEFAULT, WIN_H_DEFAULT, WIN_SILL_DEFAULT` from `@/lib/constants`.

- [ ] **Step 4: Update pricing to use per-window area**

In `src/lib/pricing.ts`, replace the fixed `WINDOW_AREA_CUTOUT` per window with actual per-window area (line 66):

```typescript
// Replace: area -= WINDOW_AREA_CUTOUT * (wallCfg.windows ?? []).length;
// With:
for (const win of wallCfg.windows ?? []) {
  area -= (win.width ?? WIN_W_DEFAULT) * (win.height ?? WIN_H_DEFAULT);
}
```

Import `WIN_W_DEFAULT, WIN_H_DEFAULT` from `@/lib/constants`. Remove `WINDOW_AREA_CUTOUT` if no longer used.

Also update the extras cost calculation (line 105) — window fee is still per-window, no change needed there.

- [ ] **Step 5: Verify and commit**

Run: `pnpm tsc --noEmit`

Expected: Clean compile.

```bash
git add -A
git commit -m "feat: update 3D rendering and pricing for per-window dimensions"
```

---

### Task 3: Make Walls Clickable on Schematic

**Files:**
- Modify: `src/components/schematic/SchematicWalls.tsx`
- Modify: `src/components/schematic/SchematicView.tsx`

- [ ] **Step 1: Add click handler prop to SchematicWalls**

In `src/components/schematic/SchematicWalls.tsx`, add an `onWallClick` prop to both `SchematicWalls` and `SolidWall`:

```typescript
interface SchematicWallsProps {
  dimensions: BuildingDimensions;
  walls: Record<string, WallConfig>;
  selectedElement: SelectedElement;
  buildingId: string;
  offsetX: number;
  offsetY: number;
  onWallClick?: (wallId: WallId, buildingId: string) => void;
}
```

Pass it through to `SolidWall`:

```typescript
<SolidWall
  key={g.wallId}
  geom={g}
  cfg={cfg}
  isSelected={isSelected}
  onWallClick={onWallClick ? () => onWallClick(g.wallId, buildingId) : undefined}
/>
```

In `SolidWall`, add the click handler to each wall segment rect. Add `cursor="pointer"` and an `onClick` handler. For the single rect (no openings) case AND for each segment rect:

```typescript
<rect
  ...existing props...
  cursor={onWallClick ? 'pointer' : undefined}
  pointerEvents={onWallClick ? 'auto' : 'none'}
  onClick={(e) => {
    e.stopPropagation();
    onWallClick?.();
  }}
/>
```

- [ ] **Step 2: Wire up wall click in SchematicView**

In `src/components/schematic/SchematicView.tsx`, add a wall click handler:

```typescript
const onWallClick = useCallback((wallId: WallId, buildingId: string) => {
  useConfigStore.getState().selectElement({ type: 'wall', id: wallId, buildingId });
}, []);
```

Pass it to both `SchematicWalls` render sites:

```typescript
<SchematicWalls
  dimensions={b.dimensions}
  walls={b.walls}
  selectedElement={selectedElement}
  buildingId={b.id}
  offsetX={ox + width / 2}
  offsetY={oz + depth / 2}
  onWallClick={onWallClick}
/>
```

The wall click needs to NOT fire during building drag. Since wall rects now have `onClick` with `e.stopPropagation()`, and the building drag uses `onPointerDown` → deadzone → actual drag, the click handler on the wall only fires on clean clicks (no drag movement). This is the correct behavior — a click selects the wall, a drag moves the building.

- [ ] **Step 3: Verify and commit**

Run: `pnpm tsc --noEmit`

Manual test: click a wall segment on the schematic. The wall should become selected (blue highlight, sidebar switches to wall config).

```bash
git add -A
git commit -m "feat: make walls clickable on schematic for wall selection"
```

---

### Task 4: Elevation Mode Switching + Back Button

**Files:**
- Modify: `src/components/schematic/SchematicView.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add elevation mode to SchematicView**

In `src/components/schematic/SchematicView.tsx`, derive elevation mode from `selectedElement`:

```typescript
const selectedElement = useConfigStore((s) => s.selectedElement);
const isElevationMode = selectedElement?.type === 'wall';
```

Wrap the existing SVG content (buildings, walls, poles, connections, resize handles — everything inside the `<svg>`) in a conditional:

```typescript
{!isElevationMode && (
  <>
    {/* All existing plan content: defs, normalBuildings.map(...), walls.map(...), poles.map(...), etc. */}
  </>
)}

{isElevationMode && selectedElement.type === 'wall' && (
  <WallElevationPlaceholder
    buildingId={selectedElement.buildingId}
    wallId={selectedElement.id}
  />
)}
```

For now, create a simple placeholder component inline:

```typescript
function WallElevationPlaceholder({ buildingId, wallId }: { buildingId: string; wallId: WallId }) {
  return (
    <text x="0" y="0" textAnchor="middle" dominantBaseline="central" fontSize="0.3" fill="#888">
      Elevation: {wallId}
    </text>
  );
}
```

The viewBox in elevation mode should be different — compute it from the wall dimensions:

```typescript
const elevationViewBox = useMemo(() => {
  if (!isElevationMode || selectedElement?.type !== 'wall') return '';
  const building = buildings.find(b => b.id === selectedElement.buildingId);
  if (!building) return '';
  const wallLength = getWallLength(selectedElement.id, building.dimensions);
  const wallHeight = getEffectiveHeight(building, defaultHeight);
  const pad = 0.8;
  return `${-pad} ${-pad} ${wallLength + 2 * pad} ${wallHeight + 2 * pad}`;
}, [isElevationMode, selectedElement, buildings, defaultHeight]);
```

Use `elevationViewBox` when in elevation mode:

```typescript
viewBox={isElevationMode ? elevationViewBox : activeViewBox}
```

Import `getWallLength` from constants and `getEffectiveHeight` from the store.

- [ ] **Step 2: Disable plan pointer handlers in elevation mode**

In `onPointerMove`, add an early return at the top:

```typescript
if (isElevationMode) return;
```

Same for building drag start, resize start, selection rect — they should not activate in elevation mode. The `onSvgPointerDown` handler should also early-return in elevation mode.

- [ ] **Step 3: Add Plattegrond button to ViewToggle**

In `src/app/page.tsx`, update the `ViewToggle` component to show a "Plattegrond" button when in elevation mode:

```typescript
function ViewToggle() {
  const viewMode = useConfigStore((s) => s.viewMode);
  const setViewMode = useConfigStore((s) => s.setViewMode);
  const selectedElement = useConfigStore((s) => s.selectedElement);
  const selectElement = useConfigStore((s) => s.selectElement);
  const isElevationMode = selectedElement?.type === 'wall';

  return (
    <div className="flex gap-1 bg-background/80 backdrop-blur-xl rounded-xl shadow-md ring-1 ring-black/[0.08] p-1">
      {isElevationMode && (
        <button
          onClick={() => selectElement(null)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all bg-foreground text-background shadow-sm"
        >
          Plattegrond
        </button>
      )}
      <button
        onClick={() => {
          if (isElevationMode) selectElement(null);
          setViewMode('plan');
        }}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          viewMode === 'plan' && !isElevationMode
            ? 'bg-foreground text-background shadow-sm'
            : 'text-foreground/60 hover:text-foreground/80'
        }`}
      >
        2D
      </button>
      {/* Split and 3D buttons — add same isElevationMode clear on click */}
      <button
        onClick={() => {
          if (isElevationMode) selectElement(null);
          setViewMode('split');
        }}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          viewMode === 'split'
            ? 'bg-foreground text-background shadow-sm'
            : 'text-foreground/60 hover:text-foreground/80'
        }`}
      >
        Split
      </button>
      <button
        onClick={() => {
          if (isElevationMode) selectElement(null);
          setViewMode('3d');
        }}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          viewMode === '3d'
            ? 'bg-foreground text-background shadow-sm'
            : 'text-foreground/60 hover:text-foreground/80'
        }`}
      >
        3D
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Handle Escape key for elevation mode**

The app likely already handles Escape for deselection. Check if pressing Escape when `selectedElement` is a wall already clears it via `selectElement(null)`. If so, no changes needed — the elevation mode will automatically exit when selectedElement clears.

If Escape handling doesn't exist in SchematicView, add a `useEffect` with a keydown listener:

```typescript
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isElevationMode) {
      useConfigStore.getState().selectElement(null);
    }
  }
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isElevationMode]);
```

- [ ] **Step 5: Verify and commit**

Run: `pnpm tsc --noEmit`

Manual test: click a wall on the schematic → should see "Elevation: front" placeholder text. "Plattegrond" button should appear in the toggle. Clicking it or pressing Escape should return to the plan.

```bash
git add -A
git commit -m "feat: add elevation mode switching with Plattegrond back button"
```

---

### Task 5: WallElevation Component — Rendering

**Files:**
- Create: `src/components/schematic/WallElevation.tsx`
- Modify: `src/components/schematic/SchematicView.tsx`

- [ ] **Step 1: Create WallElevation component with wall rendering**

Create `src/components/schematic/WallElevation.tsx`:

```typescript
'use client';

import { useConfigStore, getEffectiveHeight } from '@/store/useConfigStore';
import { WALL_MATERIALS, DOOR_W, DOUBLE_DOOR_W, WIN_W_DEFAULT, WIN_H_DEFAULT, WIN_SILL_DEFAULT, getWallLength, fractionToX } from '@/lib/constants';
import type { WallId, WallConfig, WallWindow } from '@/types/building';

interface WallElevationProps {
  buildingId: string;
  wallId: WallId;
}

export default function WallElevation({ buildingId, wallId }: WallElevationProps) {
  const building = useConfigStore((s) => s.buildings.find(b => b.id === buildingId));
  const defaultHeight = useConfigStore((s) => s.defaultHeight);

  if (!building) return null;

  const wallCfg = building.walls[wallId];
  if (!wallCfg) return null;

  const wallLength = getWallLength(wallId, building.dimensions);
  const wallHeight = getEffectiveHeight(building, defaultHeight);
  const mat = WALL_MATERIALS.find(m => m.id === wallCfg.materialId);
  const wallColor = mat?.color ?? '#d4c5a9';

  const windows = wallCfg.windows ?? [];

  // Door dimensions
  const doorW = wallCfg.doorSize === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W;
  const doorH = Math.min(2.1, wallHeight - 0.05);
  const doorX = wallCfg.hasDoor ? fractionToX(wallLength, wallCfg.doorPosition ?? 0.5) : null;

  return (
    <g>
      {/* Ground line */}
      <line
        x1={-0.2} y1={wallHeight}
        x2={wallLength + 0.2} y2={wallHeight}
        stroke="#ccc" strokeWidth={0.02} strokeDasharray="0.08 0.05"
      />

      {/* Wall rectangle */}
      <rect
        x={0} y={0}
        width={wallLength} height={wallHeight}
        fill={wallColor} fillOpacity={0.15}
        stroke="#888" strokeWidth={0.03}
        rx={0.02}
      />

      {/* Dimension labels */}
      <text x={wallLength / 2} y={-0.15} textAnchor="middle" fontSize={0.18} fill="#888" fontFamily="system-ui">
        {wallLength.toFixed(1)}m
      </text>
      <text
        x={-0.2} y={wallHeight / 2}
        textAnchor="middle" fontSize={0.18} fill="#888" fontFamily="system-ui"
        transform={`rotate(-90, ${-0.2}, ${wallHeight / 2})`}
      >
        {wallHeight.toFixed(1)}m
      </text>

      {/* Door */}
      {wallCfg.hasDoor && doorX !== null && (
        <g>
          <rect
            x={wallLength / 2 + doorX - doorW / 2}
            y={wallHeight - doorH}
            width={doorW} height={doorH}
            fill="#d4a574" fillOpacity={0.3}
            stroke="#8B6914" strokeWidth={0.025}
            rx={0.01}
          />
          {/* Door handle */}
          <rect
            x={wallLength / 2 + doorX + doorW / 2 - 0.15}
            y={wallHeight - doorH / 2 - 0.07}
            width={0.06} height={0.15}
            fill="#8B6914" rx={0.01}
          />
        </g>
      )}

      {/* Windows */}
      {windows.map((win) => {
        const winX = fractionToX(wallLength, win.position);
        const w = win.width ?? WIN_W_DEFAULT;
        const h = win.height ?? WIN_H_DEFAULT;
        const sill = win.sillHeight ?? WIN_SILL_DEFAULT;

        return (
          <g key={win.id}>
            {/* Window frame */}
            <rect
              x={wallLength / 2 + winX - w / 2}
              y={wallHeight - sill - h}
              width={w} height={h}
              fill="#d4eaf7" fillOpacity={0.3}
              stroke="#5BA3D9" strokeWidth={0.025}
              rx={0.01}
            />
            {/* Cross dividers */}
            <line
              x1={wallLength / 2 + winX} y1={wallHeight - sill - h}
              x2={wallLength / 2 + winX} y2={wallHeight - sill}
              stroke="#5BA3D9" strokeWidth={0.015}
            />
            <line
              x1={wallLength / 2 + winX - w / 2} y1={wallHeight - sill - h / 2}
              x2={wallLength / 2 + winX + w / 2} y2={wallHeight - sill - h / 2}
              stroke="#5BA3D9" strokeWidth={0.015}
            />
          </g>
        );
      })}
    </g>
  );
}
```

Note: The coordinate system uses `(0, 0)` as the top-left of the wall, with Y increasing downward (SVG convention). The wall bottom (ground) is at `y = wallHeight`. Window `sillHeight` is meters from the ground, so the window top in SVG is at `y = wallHeight - sillHeight - windowHeight`.

- [ ] **Step 2: Replace the placeholder in SchematicView**

In `src/components/schematic/SchematicView.tsx`, replace the `WallElevationPlaceholder` with the real component:

```typescript
import WallElevation from './WallElevation';
```

Replace the placeholder usage:
```typescript
{isElevationMode && selectedElement.type === 'wall' && (
  <WallElevation
    buildingId={selectedElement.buildingId}
    wallId={selectedElement.id}
  />
)}
```

Remove the inline `WallElevationPlaceholder` function.

- [ ] **Step 3: Verify and commit**

Run: `pnpm tsc --noEmit`

Manual test: click a wall on the schematic → should see the wall drawn as a rectangle with door and windows rendered at their positions.

```bash
git add -A
git commit -m "feat: add WallElevation component with wall/door/window rendering"
```

---

### Task 6: WallElevation — Selection and Drag to Move

**Files:**
- Modify: `src/components/schematic/WallElevation.tsx`

- [ ] **Step 1: Add selection state and click handlers**

Add selection state to `WallElevation`:

```typescript
const [selectedOpening, setSelectedOpening] = useState<{
  type: 'door' | 'window';
  windowId?: string;
} | null>(null);
```

Make each opening clickable. Add `cursor="pointer"` and `onClick` to the door and window `<g>` groups. Add a transparent hit rect behind each to make clicking easier. Click on empty wall area clears selection.

For windows:
```typescript
<g
  key={win.id}
  cursor="grab"
  onClick={(e) => { e.stopPropagation(); setSelectedOpening({ type: 'window', windowId: win.id }); }}
>
  {/* existing window rendering */}
</g>
```

Add an `onClick` on the wall background rect to deselect:
```typescript
<rect
  ...wall rect props...
  onClick={() => setSelectedOpening(null)}
/>
```

- [ ] **Step 2: Add drag-to-move for openings**

Add drag state:

```typescript
const [dragState, setDragState] = useState<{
  type: 'door' | 'window';
  windowId?: string;
  startPointer: [number, number];
  startPosition: number;     // horizontal fraction
  startSillHeight: number;   // vertical position (meters)
} | null>(null);
```

On pointer-down on an opening:
1. Record start pointer position (SVG coords)
2. Record start position (fraction) and sill height
3. Set drag state

On pointer-move (on the SVG, delegated from SchematicView or handled locally):
1. Compute delta in SVG coords
2. Convert horizontal delta to fraction delta
3. Convert vertical delta to meters (direct, since SVG Y maps to meters in the elevation view)
4. Apply snap to 10cm increments: `Math.round(value / SNAP_INCREMENT) * SNAP_INCREMENT`
5. Clamp horizontal via `clampOpeningPosition`
6. Clamp vertical: `sillHeight >= 0` and `sillHeight + windowHeight <= wallHeight`
7. Live-update the store (pause undo on first move, resume on pointer-up)

On pointer-up:
1. Resume undo
2. Clear drag state

For doors: only allow horizontal movement (ignore vertical delta since doors are anchored to ground).

The drag handler should be a `useCallback` with `onPointerMove` and `onPointerUp` attached to `window` during drag (capture pattern — add listeners on pointer-down, remove on pointer-up).

- [ ] **Step 3: Show selection highlight**

When an opening is selected, render a blue border (`stroke="#3b82f6"`, `strokeWidth={0.04}`) around it instead of the default color.

- [ ] **Step 4: Verify and commit**

Run: `pnpm tsc --noEmit`

Manual test:
1. Enter elevation view
2. Click a window — blue highlight appears
3. Drag a window — moves freely with 10cm snap
4. Can't drag window outside wall bounds
5. Can't overlap windows with each other or door
6. Door only moves horizontally
7. Undo works after drag

```bash
git add -A
git commit -m "feat: add opening selection and drag-to-move in elevation view"
```

---

### Task 7: WallElevation — Resize Handles

**Files:**
- Modify: `src/components/schematic/WallElevation.tsx`

- [ ] **Step 1: Render resize handles when a window is selected**

When a window is selected (`selectedOpening.type === 'window'`), render 8 resize handles around it:

- 4 corner handles (nw, ne, sw, se resize)
- 4 edge midpoint handles (n, s, w, e resize — single axis)

Each handle is a small rect (e.g. 0.08m × 0.08m) with white fill, blue stroke, and appropriate cursor:

```typescript
function ResizeHandles({ x, y, w, h, onResizeStart }: {
  x: number; y: number; w: number; h: number;
  onResizeStart: (edge: string, e: React.PointerEvent) => void;
}) {
  const handleSize = 0.08;
  const hs = handleSize / 2;

  const handles = [
    { id: 'nw', cx: x, cy: y, cursor: 'nwse-resize' },
    { id: 'ne', cx: x + w, cy: y, cursor: 'nesw-resize' },
    { id: 'sw', cx: x, cy: y + h, cursor: 'nesw-resize' },
    { id: 'se', cx: x + w, cy: y + h, cursor: 'nwse-resize' },
    { id: 'n', cx: x + w / 2, cy: y, cursor: 'ns-resize' },
    { id: 's', cx: x + w / 2, cy: y + h, cursor: 'ns-resize' },
    { id: 'w', cx: x, cy: y + h / 2, cursor: 'ew-resize' },
    { id: 'e', cx: x + w, cy: y + h / 2, cursor: 'ew-resize' },
  ];

  return (
    <g>
      {handles.map(({ id, cx, cy, cursor }) => (
        <rect
          key={id}
          x={cx - hs} y={cy - hs}
          width={handleSize} height={handleSize}
          fill="white" stroke="#3b82f6" strokeWidth={0.02}
          rx={0.02}
          cursor={cursor}
          onPointerDown={(e) => { e.stopPropagation(); onResizeStart(id, e); }}
        />
      ))}
    </g>
  );
}
```

- [ ] **Step 2: Add resize drag logic**

Add resize state alongside drag state:

```typescript
const [resizeState, setResizeState] = useState<{
  windowId: string;
  edge: string;
  startPointer: [number, number];
  startRect: { x: number; y: number; w: number; h: number }; // SVG coords
  startWindow: { position: number; width: number; height: number; sillHeight: number };
} | null>(null);
```

On resize pointer-move:
1. Compute delta from start pointer
2. Based on `edge`, adjust the appropriate dimensions:
   - `'e'`: increase width (move right edge)
   - `'w'`: decrease x, increase width (move left edge)
   - `'n'`: decrease y, increase height (move top edge)
   - `'s'`: increase height (move bottom edge)
   - `'ne'`, `'nw'`, `'se'`, `'sw'`: combine two axis adjustments
3. Snap to 10cm increments
4. Enforce minimums: `width >= WIN_MIN_SIZE`, `height >= WIN_MIN_SIZE`
5. Enforce wall bounds: window stays within wall rectangle
6. Convert back to model values (position fraction, width, height, sillHeight)
7. Live-update store

- [ ] **Step 3: Show dimension labels during resize**

When resizing, show the current width × height near the window:

```typescript
{(dragState || resizeState) && selectedOpening?.type === 'window' && (
  <text
    x={windowCenterX}
    y={windowTopY - 0.15}
    textAnchor="middle"
    fontSize={0.14}
    fill="#3b82f6"
    fontFamily="system-ui"
    fontWeight={600}
  >
    {currentWidth.toFixed(1)} × {currentHeight.toFixed(1)}m
  </text>
)}
```

- [ ] **Step 4: Verify and commit**

Run: `pnpm tsc --noEmit`

Manual test:
1. Select a window in elevation view
2. 8 handles appear around it
3. Drag a corner handle — resizes both axes
4. Drag an edge handle — resizes one axis
5. Minimum size enforced (0.3m)
6. Can't resize past wall bounds
7. Dimensions label shows during resize
8. 3D view updates live

```bash
git add -A
git commit -m "feat: add resize handles for windows in elevation view"
```

---

### Task 8: Serialization and Cleanup

**Files:**
- Modify: `src/lib/configCode.ts`
- Modify: `src/components/schematic/SchematicOpenings.tsx` (use per-window width for hit targets)

- [ ] **Step 1: Update configCode.ts for per-window dimensions**

In `src/lib/configCode.ts`, update window encoding to include width, height, sillHeight.

Encoding (replace window loop):
```typescript
const winCount = (wall.windows ?? []).length;
w.write(Math.min(winCount, 7), 3);
for (let i = 0; i < Math.min(winCount, 7); i++) {
  const win = wall.windows![i];
  w.write(Math.round((win.position) * 100), 7);
  w.write(Math.round((win.width ?? 1.2) * 10), 7);    // 0-100 → 0.0-10.0m
  w.write(Math.round((win.height ?? 1.0) * 10), 7);   // 0-100 → 0.0-10.0m
  w.write(Math.round((win.sillHeight ?? 1.2) * 10), 7); // 0-100 → 0.0-10.0m
}
```

Decoding (replace window loop):
```typescript
const windowCount = clamp(r.read(3), 0, 7);
const windows: WallWindow[] = [];
for (let i = 0; i < windowCount; i++) {
  windows.push({
    id: crypto.randomUUID(),
    position: r.read(7) / 100,
    width: r.read(7) / 10,
    height: r.read(7) / 10,
    sillHeight: r.read(7) / 10,
  });
}
```

- [ ] **Step 2: Update SchematicOpenings hit targets for per-window width**

In `src/components/schematic/SchematicOpenings.tsx`, the window hit targets currently use the fixed `WIN_W` constant for width. Update to use per-window width:

```typescript
const winWidth = (cfg.windows ?? [])[i]?.width ?? WIN_W;
```

Use `winWidth` instead of `WIN_W` in the hit target rect dimensions and in the `WindowSymbol` rendering.

- [ ] **Step 3: Verify and commit**

Run: `pnpm tsc --noEmit`

```bash
git add -A
git commit -m "feat: update serialization for per-window dimensions and cleanup"
```
