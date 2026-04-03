# Multi-Select & Undo/Redo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-to-select multiple buildings in the 2D schematic (with group move) and Cmd+Z / Cmd+Shift+Z undo/redo for all document mutations.

**Architecture:** Multi-select adds `selectedBuildingIds: string[]` to the Zustand store; `selectedBuildingId` becomes a derived getter returning the single ID when exactly one is selected. Undo/redo wraps the store with `zundo` temporal middleware, partializing to track only document state (`buildings`, `connections`, `roof`). The selection rectangle and group drag live in `SchematicView.tsx` as local React refs (transient interaction state).

**Tech Stack:** Zustand 5, zundo (temporal middleware), React 19, SVG

---

### Task 1: Install zundo

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install zundo**

```bash
pnpm add zundo
```

- [ ] **Step 2: Verify installation**

```bash
pnpm ls zundo
```

Expected: `zundo` appears in dependencies.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add zundo temporal middleware"
```

---

### Task 2: Add multi-select state to store

**Files:**
- Modify: `src/store/useConfigStore.ts`

This task replaces `selectedBuildingId` with `selectedBuildingIds` and adds a derived `selectedBuildingId` getter. It also adds `updateBuildingPositions` for batch group moves (so undo reverts the whole group in one step).

- [ ] **Step 1: Update the `ConfigState` interface**

In `src/store/useConfigStore.ts`, replace the `selectedBuildingId` field and add new fields/methods:

```typescript
// Replace this line:
selectedBuildingId: string | null;

// With:
selectedBuildingIds: string[];
```

Add these new methods to the interface:

```typescript
// Multi-select
selectBuildings: (ids: string[]) => void;
toggleBuildingSelection: (id: string) => void;

// Batch position update (for group move — single undo step)
updateBuildingPositions: (updates: { id: string; position: [number, number] }[]) => void;
```

Keep `selectBuilding` in the interface — it will set `selectedBuildingIds` to `[id]` or `[]`.

- [ ] **Step 2: Update the initial state and `selectBuilding`**

Replace the initial state field:

```typescript
// Replace:
selectedBuildingId: initialBuilding.id,

// With:
selectedBuildingIds: [initialBuilding.id],
```

Update `selectBuilding`:

```typescript
selectBuilding: (id) => set({
  selectedBuildingIds: id ? [id] : [],
  ...(id ? { sidebarTab: 'configure' as const, sidebarCollapsed: false } : {}),
}),
```

- [ ] **Step 3: Add new selection methods and batch position update**

```typescript
selectBuildings: (ids) => set({ selectedBuildingIds: ids }),

toggleBuildingSelection: (id) =>
  set((state) => {
    const ids = state.selectedBuildingIds;
    const exists = ids.includes(id);
    return {
      selectedBuildingIds: exists
        ? ids.filter(i => i !== id)
        : [...ids, id],
    };
  }),

updateBuildingPositions: (updates) =>
  set((state) => ({
    buildings: state.buildings.map(b => {
      const u = updates.find(u => u.id === b.id);
      return u ? { ...b, position: u.position } : b;
    }),
  })),
```

- [ ] **Step 4: Add derived `selectedBuildingId` getter**

Update `getSelectedBuilding` and add a standalone getter. Replace the existing `getSelectedBuilding`:

```typescript
getSelectedBuilding: () => {
  const { buildings, selectedBuildingIds } = get();
  if (selectedBuildingIds.length !== 1) return null;
  return buildings.find(b => b.id === selectedBuildingIds[0]) ?? null;
},
```

- [ ] **Step 5: Update `removeBuilding` to use `selectedBuildingIds`**

In the `removeBuilding` method, replace the references to `selectedBuildingId`:

```typescript
removeBuilding: (id) =>
  set((state) => {
    const target = state.buildings.find(b => b.id === id);
    const structuralCount = state.buildings.filter(b => b.type !== 'paal' && b.type !== 'muur').length;
    if (!target) return state;
    if (target.type !== 'paal' && target.type !== 'muur' && structuralCount <= 1) return state;
    const buildings = state.buildings.filter(b => b.id !== id);
    const connections = state.connections.filter(
      c => c.buildingAId !== id && c.buildingBId !== id,
    );
    const wasSelected = state.selectedBuildingIds.includes(id);
    const selectedBuildingIds = state.selectedBuildingIds.filter(i => i !== id);
    const selectedElement =
      wasSelected && selectedBuildingIds.length === 0 ? null : state.selectedElement;
    const sidebarTab =
      wasSelected && selectedBuildingIds.length === 0 ? 'objects' as const : state.sidebarTab;
    return { buildings, connections, selectedBuildingIds, selectedElement, sidebarTab };
  }),
```

- [ ] **Step 6: Update `selectElement` to use `selectedBuildingIds`**

```typescript
selectElement: (element) =>
  set((state) => ({
    selectedElement: element,
    selectedBuildingIds:
      element?.type === 'wall' ? [element.buildingId] : state.selectedBuildingIds,
    activeConfigSection:
      element?.type === 'wall' ? 'walls' : element?.type === 'roof' ? 'structure' : state.activeConfigSection,
    sidebarTab: 'configure' as const,
    sidebarCollapsed: false,
    cameraTargetWallId:
      element?.type === 'wall' ? element.id : state.cameraTargetWallId,
  })),
```

- [ ] **Step 7: Update `addBuilding` to use `selectedBuildingIds`**

In the `addBuilding` method, replace:

```typescript
selectedBuildingId: b.id,
```

With:

```typescript
selectedBuildingIds: [b.id],
```

- [ ] **Step 8: Update `clearSelection` to clear `selectedBuildingIds`**

```typescript
clearSelection: () => set({ selectedElement: null }),
```

This stays the same — `clearSelection` only clears the element selection (wall/roof), not the building selection.

- [ ] **Step 9: Update `resetConfig` and `loadState`**

In `resetConfig`, replace `selectedBuildingId: null` with `selectedBuildingIds: []`.

In `loadState`, replace `selectedBuildingId: migrated[0]?.id ?? null` with `selectedBuildingIds: migrated[0] ? [migrated[0].id] : []`.

- [ ] **Step 10: Verify the build compiles**

```bash
pnpm build
```

Expected: Build succeeds. There will be TypeScript errors in consumer components that still reference `selectedBuildingId` as a store field — we fix those in Task 3.

- [ ] **Step 11: Commit**

```bash
git add src/store/useConfigStore.ts
git commit -m "feat: replace selectedBuildingId with selectedBuildingIds array in store"
```

---

### Task 3: Update all consumers of `selectedBuildingId`

**Files:**
- Modify: `src/components/schematic/SchematicView.tsx`
- Modify: `src/components/ui/Sidebar.tsx`
- Modify: `src/components/ui/ObjectsTab.tsx`
- Modify: `src/components/ui/ConfigureTab.tsx`
- Modify: `src/components/ui/DimensionsControl.tsx`
- Modify: `src/components/ui/FloorConfigSection.tsx`
- Modify: `src/components/ui/WallSelector.tsx`
- Modify: `src/components/ui/MobileBottomSheet.tsx`
- Modify: `src/components/canvas/BuildingScene.tsx`
- Modify: `src/components/canvas/BuildingInstance.tsx`

Every component that reads `selectedBuildingId` from the store needs to derive it from `selectedBuildingIds`. The pattern is the same everywhere:

```typescript
// Replace:
const selectedBuildingId = useConfigStore((s) => s.selectedBuildingId);

// With:
const selectedBuildingId = useConfigStore((s) => s.selectedBuildingIds.length === 1 ? s.selectedBuildingIds[0] : null);
```

- [ ] **Step 1: Update `SchematicView.tsx`**

Replace the `selectedBuildingId` selector (line ~139):

```typescript
const selectedBuildingId = useConfigStore((s) => s.selectedBuildingIds.length === 1 ? s.selectedBuildingIds[0] : null);
```

Also add a new selector for the full array (we'll use it in Task 5):

```typescript
const selectedBuildingIds = useConfigStore((s) => s.selectedBuildingIds);
```

- [ ] **Step 2: Update all other components**

Apply the same selector replacement pattern in each file. For each file, find `useConfigStore((s) => s.selectedBuildingId)` and replace with `useConfigStore((s) => s.selectedBuildingIds.length === 1 ? s.selectedBuildingIds[0] : null)`.

Files: `Sidebar.tsx`, `ObjectsTab.tsx`, `ConfigureTab.tsx`, `DimensionsControl.tsx`, `FloorConfigSection.tsx`, `WallSelector.tsx`, `MobileBottomSheet.tsx`, `BuildingScene.tsx`, `BuildingInstance.tsx`.

- [ ] **Step 3: Verify the build compiles**

```bash
pnpm build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: derive selectedBuildingId from selectedBuildingIds in all consumers"
```

---

### Task 4: Wire up zundo temporal middleware

**Files:**
- Modify: `src/store/useConfigStore.ts`

- [ ] **Step 1: Add temporal middleware**

At the top of `useConfigStore.ts`, add the import:

```typescript
import { temporal } from 'zundo';
```

Wrap the `create` call with `temporal`. Replace:

```typescript
export const useConfigStore = create<ConfigState>((set, get) => ({
```

With:

```typescript
export const useConfigStore = create<ConfigState>()(
  temporal(
    (set, get) => ({
```

And close the `temporal()` wrapper at the end of the store definition (before the closing `);`). Add the `temporal` options:

```typescript
    }),
    {
      partialize: (state) => ({
        buildings: state.buildings,
        connections: state.connections,
        roof: state.roof,
      }),
    },
  ),
);
```

- [ ] **Step 2: Verify the build compiles**

```bash
pnpm build
```

Expected: Build succeeds. The temporal middleware is now tracking `buildings`, `connections`, and `roof` changes.

- [ ] **Step 3: Commit**

```bash
git add src/store/useConfigStore.ts
git commit -m "feat: wrap config store with zundo temporal middleware"
```

---

### Task 5: Add undo/redo keyboard handler

**Files:**
- Create: `src/hooks/useUndoRedo.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create the hook**

Create `src/hooks/useUndoRedo.ts`:

```typescript
'use client';

import { useEffect } from 'react';
import { useConfigStore } from '@/store/useConfigStore';

export function useUndoRedo() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when a text input is focused
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod || e.key.toLowerCase() !== 'z') return;

      e.preventDefault();

      const temporal = useConfigStore.temporal.getState();
      if (e.shiftKey) {
        temporal.redo();
      } else {
        temporal.undo();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
```

- [ ] **Step 2: Wire it into the page component**

In `src/app/page.tsx`, import and call the hook inside `Home`:

```typescript
import { useUndoRedo } from '@/hooks/useUndoRedo';
```

Add at the top of the `Home` component body:

```typescript
useUndoRedo();
```

- [ ] **Step 3: Verify the build compiles**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 4: Manual test**

```
1. Run `pnpm dev`, open the app
2. Add a building, move it, change a wall material
3. Press Cmd+Z — each action reverts one step
4. Press Cmd+Shift+Z — each action re-applies
5. Type in a dimension input field, press Cmd+Z — native text undo works (not app undo)
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useUndoRedo.ts src/app/page.tsx
git commit -m "feat: add Cmd+Z / Cmd+Shift+Z undo/redo"
```

---

### Task 6: Selection rectangle in SchematicView

**Files:**
- Modify: `src/components/schematic/SchematicView.tsx`

This is the core multi-select interaction: drag on empty SVG space to draw a marching-ants rectangle, live-highlight overlapping buildings, commit selection on pointer-up.

- [ ] **Step 1: Add selection rectangle refs and state**

In `SchematicView`, after the existing resize refs (~line 158), add:

```typescript
// Selection rectangle state
const selectRectAnchor = useRef<[number, number] | null>(null);
const [selectRect, setSelectRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
```

- [ ] **Step 2: Add AABB intersection helper**

Before the `SchematicView` component function, add:

```typescript
function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function getBuildingAABB(b: BuildingEntity): [number, number, number, number] {
  const isVertMuur = b.type === 'muur' && b.orientation === 'vertical';
  const w = isVertMuur ? b.dimensions.depth : b.dimensions.width;
  const d = isVertMuur ? b.dimensions.width : b.dimensions.depth;
  return [b.position[0], b.position[1], w, d];
}
```

- [ ] **Step 3: Update `onSvgPointerDown` to start selection rectangle**

Replace the existing `onSvgPointerDown`:

```typescript
const onSvgPointerDown = useCallback((e: React.PointerEvent) => {
  if (e.target !== svgRef.current) return;
  if (e.button !== 0) return;

  const svg = svgRef.current;
  if (!svg) return;

  pointerDownScreen.current = { x: e.clientX, y: e.clientY };
  selectRectAnchor.current = clientToWorld(svg, e.clientX, e.clientY);
  setFrozenViewBox(computedViewBox);
}, [computedViewBox]);
```

- [ ] **Step 4: Update `onPointerMove` to draw the selection rectangle**

At the **top** of the `onPointerMove` callback (before the resize handling), add:

```typescript
// --- Selection rectangle handling ---
if (selectRectAnchor.current) {
  const down = pointerDownScreen.current;
  if (down) {
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    if (dx * dx + dy * dy < 25) return; // 5px dead zone
  }

  const svg = svgRef.current;
  if (!svg) return;

  const [wx, wz] = clientToWorld(svg, e.clientX, e.clientY);
  const [ax, az] = selectRectAnchor.current;
  const rx = Math.min(ax, wx);
  const ry = Math.min(az, wz);
  const rw = Math.abs(wx - ax);
  const rh = Math.abs(wz - az);
  setSelectRect({ x: rx, y: ry, w: rw, h: rh });
  return;
}
```

- [ ] **Step 5: Update `onPointerUp` to commit the selection**

At the **top** of the `onPointerUp` callback (before the resize cleanup), add:

```typescript
// --- Selection rectangle commit ---
if (selectRectAnchor.current) {
  if (selectRect) {
    const { x, y, w, h } = selectRect;
    const allBuildings = useConfigStore.getState().buildings;
    const hits = allBuildings.filter(b => {
      const [bx, by, bw, bh] = getBuildingAABB(b);
      return rectsOverlap(x, y, w, h, bx, by, bw, bh);
    });
    if (hits.length > 0) {
      useConfigStore.getState().selectBuildings(hits.map(b => b.id));
    } else {
      useConfigStore.getState().selectBuildings([]);
    }
  } else {
    // Click on empty space (no drag) — deselect
    useConfigStore.getState().selectBuildings([]);
  }
  selectRectAnchor.current = null;
  pointerDownScreen.current = null;
  setSelectRect(null);
  setFrozenViewBox(null);
  return;
}
```

Add `selectRect` to the `onPointerUp` dependency array.

- [ ] **Step 6: Render the marching ants rectangle**

In the SVG, after the resize handles block and before the total dimension lines, add:

```tsx
{/* Selection rectangle — marching ants */}
{selectRect && (
  <rect
    x={selectRect.x}
    y={selectRect.y}
    width={selectRect.w}
    height={selectRect.h}
    fill="rgba(255,255,255,0.03)"
    stroke="#3b82f6"
    strokeWidth={0.04}
    strokeDasharray="0.12 0.12"
    pointerEvents="none"
  >
    <animate
      attributeName="stroke-dashoffset"
      from="0"
      to="0.24"
      dur="0.4s"
      repeatCount="indefinite"
    />
  </rect>
)}
```

- [ ] **Step 7: Add multi-select highlight to buildings**

Update the `isSelected` check in the normalBuildings, walls, and poles render blocks to also highlight buildings inside the active selection rectangle. After the `selectRect` state declaration, add a memo:

```typescript
const previewSelectedIds = useMemo(() => {
  if (!selectRect) return new Set<string>();
  const { x, y, w, h } = selectRect;
  return new Set(
    buildings
      .filter(b => {
        const [bx, by, bw, bh] = getBuildingAABB(b);
        return rectsOverlap(x, y, w, h, bx, by, bw, bh);
      })
      .map(b => b.id),
  );
}, [selectRect, buildings]);
```

Then update the `isSelected` logic in each building render. For normalBuildings:

```typescript
const isSelected = selectedBuildingIds.includes(b.id) || previewSelectedIds.has(b.id);
```

Apply the same pattern for walls (`w.id`) and poles (`p.id`).

- [ ] **Step 8: Verify the build compiles**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/components/schematic/SchematicView.tsx
git commit -m "feat: add selection rectangle with marching ants in 2D view"
```

---

### Task 7: Shift+click toggle and Escape to deselect

**Files:**
- Modify: `src/components/schematic/SchematicView.tsx`

- [ ] **Step 1: Update `onBuildingPointerDown` to track shift state**

We need to check `e.shiftKey` at pointer-up time (not pointer-down), because the user might release shift before releasing the mouse. Store it on pointerDown:

Add a new ref after the existing refs:

```typescript
const shiftOnDown = useRef(false);
```

In `onBuildingPointerDown`, after `e.stopPropagation();`, add:

```typescript
shiftOnDown.current = e.shiftKey;
```

- [ ] **Step 2: Update `onPointerUp` to handle shift-click**

In the existing `onPointerUp`, in the `else if (dragBuildingId.current)` branch (the click-without-drag case), replace:

```typescript
} else if (dragBuildingId.current) {
  selectBuilding(dragBuildingId.current);
}
```

With:

```typescript
} else if (dragBuildingId.current) {
  if (shiftOnDown.current) {
    useConfigStore.getState().toggleBuildingSelection(dragBuildingId.current);
  } else {
    selectBuilding(dragBuildingId.current);
  }
}
```

- [ ] **Step 3: Add Escape key handler**

In `src/components/schematic/SchematicView.tsx`, add a `useEffect` inside the component:

```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      useConfigStore.getState().selectBuildings([]);
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

- [ ] **Step 4: Verify the build compiles**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/schematic/SchematicView.tsx
git commit -m "feat: add shift+click toggle and Escape to deselect"
```

---

### Task 8: Group drag

**Files:**
- Modify: `src/components/schematic/SchematicView.tsx`

When multiple buildings are selected and the user drags one of them, all selected buildings move together. Snap detection runs on the dragged building only.

- [ ] **Step 1: Add group drag refs**

After the existing drag refs, add:

```typescript
const groupDragStartPositions = useRef<Map<string, [number, number]>>(new Map());
```

- [ ] **Step 2: Update `onBuildingPointerDown` to capture group positions**

At the end of `onBuildingPointerDown` (after `setFrozenViewBox`), add:

```typescript
// Capture start positions for all selected buildings (for group drag)
const state = useConfigStore.getState();
if (state.selectedBuildingIds.includes(buildingId) && state.selectedBuildingIds.length > 1) {
  const posMap = new Map<string, [number, number]>();
  for (const id of state.selectedBuildingIds) {
    const b = state.buildings.find(b => b.id === id);
    if (b) posMap.set(id, [...b.position]);
  }
  groupDragStartPositions.current = posMap;
} else {
  groupDragStartPositions.current = new Map();
}
```

- [ ] **Step 3: Update move handling in `onPointerMove`**

In the move handling section of `onPointerMove` (the `// --- Existing move handling ---` section), replace the block after `if (!dragging.current) return;` (from `const svg = svgRef.current;` to the end of the move section) with:

```typescript
const svg = svgRef.current;
if (!svg) return;

const [wx, wz] = clientToWorld(svg, e.clientX, e.clientY);
const dx = wx - dragStartWorld.current[0];
const dz = wz - dragStartWorld.current[1];

const allBuildings = useConfigStore.getState().buildings;
const building = allBuildings.find(b => b.id === dragBuildingId.current);
if (!building) return;

// Group drag: move all selected buildings
if (groupDragStartPositions.current.size > 1) {
  const draggedStartPos = groupDragStartPositions.current.get(dragBuildingId.current!);
  if (!draggedStartPos) return;

  const newDraggedPos: [number, number] = [draggedStartPos[0] + dx, draggedStartPos[1] + dz];

  // Snap only the dragged building
  let snappedDx = dx;
  let snappedDz = dz;

  if (building.type === 'paal') {
    const snapped = detectPoleSnap(newDraggedPos, allBuildings.filter(b => !groupDragStartPositions.current.has(b.id)));
    snappedDx = snapped[0] - draggedStartPos[0];
    snappedDz = snapped[1] - draggedStartPos[1];
  } else if (building.type === 'muur') {
    const snapped = detectWallSnap(
      newDraggedPos,
      building.dimensions.width,
      building.orientation,
      allBuildings.filter(b => !groupDragStartPositions.current.has(b.id)),
    );
    snappedDx = snapped[0] - draggedStartPos[0];
    snappedDz = snapped[1] - draggedStartPos[1];
  } else {
    const others = allBuildings.filter(b => !groupDragStartPositions.current.has(b.id) && b.type !== 'paal' && b.type !== 'muur');
    const tempBuilding = { ...building, position: newDraggedPos };
    const { snappedPosition } = detectSnap(tempBuilding, others);
    snappedDx = snappedPosition[0] - draggedStartPos[0];
    snappedDz = snappedPosition[1] - draggedStartPos[1];
  }

  // Apply snapped delta to all selected buildings
  const updates: { id: string; position: [number, number] }[] = [];
  for (const [id, startPos] of groupDragStartPositions.current) {
    updates.push({ id, position: [startPos[0] + snappedDx, startPos[1] + snappedDz] });
  }
  useConfigStore.getState().updateBuildingPositions(updates);
} else {
  // Single building drag (existing behavior)
  const newPos: [number, number] = [
    dragStartPos.current[0] + dx,
    dragStartPos.current[1] + dz,
  ];

  if (building.type === 'paal') {
    const snapped = detectPoleSnap(newPos, allBuildings.filter(b => b.id !== building.id));
    updateBuildingPosition(building.id, snapped);
  } else if (building.type === 'muur') {
    const snapped = detectWallSnap(
      newPos,
      building.dimensions.width,
      building.orientation,
      allBuildings.filter(b => b.id !== building.id),
    );
    updateBuildingPosition(building.id, snapped);
  } else {
    const others = allBuildings.filter(b => b.id !== building.id && b.type !== 'paal' && b.type !== 'muur');
    const tempBuilding = { ...building, position: newPos };
    const { snappedPosition, newConnections } = detectSnap(tempBuilding, others);
    updateBuildingPosition(building.id, snappedPosition);
    setConnections(newConnections);
  }
}
```

- [ ] **Step 4: Update `onPointerUp` for group drag connection re-evaluation**

In `onPointerUp`, after the `if (dragging.current)` block where `setDraggedBuildingId(null)` is called, add connection re-evaluation for group moves:

```typescript
if (dragging.current) {
  setDraggedBuildingId(null);

  // Re-evaluate snap connections after group move
  if (groupDragStartPositions.current.size > 1) {
    const allBuildings = useConfigStore.getState().buildings;
    // Rebuild all connections by checking each non-pole/non-muur building
    let allConnections: SnapConnection[] = [];
    const structuralBuildings = allBuildings.filter(b => b.type !== 'paal' && b.type !== 'muur');
    for (const building of structuralBuildings) {
      const others = structuralBuildings.filter(b => b.id !== building.id);
      const { newConnections } = detectSnap(building, others);
      // Merge without duplicates
      for (const nc of newConnections) {
        const exists = allConnections.some(
          c => (c.buildingAId === nc.buildingAId && c.sideA === nc.sideA && c.buildingBId === nc.buildingBId && c.sideB === nc.sideB) ||
               (c.buildingAId === nc.buildingBId && c.sideA === nc.sideB && c.buildingBId === nc.buildingAId && c.sideB === nc.sideA),
        );
        if (!exists) allConnections.push(nc);
      }
    }
    setConnections(allConnections);
  }

  groupDragStartPositions.current = new Map();
}
```

- [ ] **Step 5: Hide resize handles during multi-select**

Update the resize handles rendering condition. Replace:

```tsx
{selectedBuildingId && (() => {
```

With:

```tsx
{selectedBuildingId && selectedBuildingIds.length === 1 && (() => {
```

- [ ] **Step 6: Verify the build compiles**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/schematic/SchematicView.tsx
git commit -m "feat: add group drag for multi-selected buildings"
```

---

### Task 9: Disable sidebar editing during multi-select

**Files:**
- Modify: `src/components/ui/Sidebar.tsx`

When multiple buildings are selected, the sidebar should indicate multi-select mode and disable editing controls.

- [ ] **Step 1: Read Sidebar.tsx to understand current structure**

Read `src/components/ui/Sidebar.tsx` to understand how it renders the configure tab.

- [ ] **Step 2: Add multi-select guard**

In `Sidebar.tsx`, add a selector for the count:

```typescript
const selectedCount = useConfigStore((s) => s.selectedBuildingIds.length);
```

When `selectedCount > 1`, show a brief message instead of the configure controls:

```tsx
{selectedCount > 1 ? (
  <div className="p-4 text-sm text-muted-foreground text-center">
    {selectedCount} objecten geselecteerd
  </div>
) : (
  /* existing configure tab content */
)}
```

The exact placement depends on Sidebar's current structure — wrap the configure tab content in this conditional.

- [ ] **Step 3: Verify the build compiles**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Sidebar.tsx
git commit -m "feat: show multi-select indicator in sidebar, disable editing"
```

---

### Task 10: Final integration test

**Files:** None (manual testing)

- [ ] **Step 1: Manual test — selection rectangle**

```
1. pnpm dev
2. Add 3 buildings to the schematic
3. Drag on empty space — marching ants rectangle appears
4. Release — buildings inside the rectangle are highlighted
5. Click empty space — deselects all
```

- [ ] **Step 2: Manual test — shift-click and Escape**

```
1. Click building A — selected
2. Shift+click building B — both selected
3. Shift+click building A — deselected (only B remains)
4. Press Escape — all deselected
```

- [ ] **Step 3: Manual test — group drag**

```
1. Select 2+ buildings via rectangle
2. Drag one — all move together
3. Move near an unselected building — snap works on the dragged one
4. Release — resize handles are hidden, sidebar shows "X objecten geselecteerd"
5. Click a single building — back to normal single-select mode with resize handles
```

- [ ] **Step 4: Manual test — undo/redo**

```
1. Move a building, press Cmd+Z — it moves back
2. Press Cmd+Shift+Z — it moves forward
3. Change wall material, Cmd+Z — reverts
4. Add a building, Cmd+Z — building removed
5. Group move, Cmd+Z — all buildings revert in one step
6. Focus a dimension input, type, Cmd+Z — native text undo (not app undo)
```

- [ ] **Step 5: Commit final state if any fixes were needed**

```bash
git add -A
git commit -m "fix: integration fixes for multi-select and undo/redo"
```
