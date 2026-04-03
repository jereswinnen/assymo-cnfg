# Plan: Move Drag Interaction from 3D Canvas to Plattegrond SVG

## 1. Architecture Overview

### Current Flow
```
User drags on 3D Canvas
  -> BuildingInstance.onPointerDown captures pointer
  -> Raycaster intersects ground plane to get world [x, z]
  -> Delta applied to starting position
  -> detectSnap / detectPoleSnap called with world coords
  -> store.updateBuildingPosition updates [x, z]
  -> Both 3D canvas and SchematicView re-render from store
```

### New Flow
```
User drags on Plattegrond SVG
  -> SVG pointer event on building shape (rect / pole square)
  -> clientX/clientY converted to SVG coords via getScreenCTM().inverse()
  -> SVG coords ARE world coords (the SVG uses world coords directly in its viewBox)
  -> Delta applied to starting position
  -> detectSnap / detectPoleSnap called with world coords (unchanged)
  -> store.updateBuildingPosition updates [x, z]
  -> Both 3D canvas and SchematicView re-render from store
```

### Key Insight: SVG Coordinates = World Coordinates
The SchematicView maps `building.position[0]` to SVG x and `building.position[1]` to SVG y. The viewBox is defined directly in world units:
```
viewBox = `${minX - pad} ${minZ - pad} ${totalW + 2*pad} ${totalD + 2*pad}`
```
This means converting a pointer event to SVG coordinates gives us world `[x, z]` directly. No additional transform layer is needed beyond the screen-to-SVG conversion.

### Coordinate Conversion Method
Use `SVGSVGElement.getScreenCTM()` for robust conversion:
```ts
function clientToWorld(svgEl: SVGSVGElement, clientX: number, clientY: number): [number, number] {
  const pt = svgEl.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return [0, 0];
  const svgPt = pt.matrixTransform(ctm.inverse());
  return [svgPt.x, svgPt.y]; // These ARE world [x, z]
}
```
This handles all CSS transforms, flex layout offsets, padding, and viewBox scaling automatically.

---

## 2. File-by-File Changes

### 2.1 `src/components/schematic/SchematicView.tsx` -- MAJOR CHANGES

**Goal**: Transform from read-only display to the primary interaction surface for positioning.

#### Changes:

**A. Add SVG ref for coordinate conversion**
```tsx
const svgRef = useRef<SVGSVGElement>(null);
```
Add `ref={svgRef}` to the `<svg>` element.

**B. Extract viewBox computation into a stable ref/memo**

The viewBox currently recomputes every render based on building positions. During drag, this causes the coordinate system to shift as the dragged building moves. This is the single biggest gotcha.

**Solution**: Freeze the viewBox at drag-start, restore on drag-end.

```tsx
const [frozenViewBox, setFrozenViewBox] = useState<string | null>(null);

// Use frozen viewBox during drag, computed viewBox otherwise
const activeViewBox = frozenViewBox ?? computedViewBox;
```

On drag start: `setFrozenViewBox(computedViewBox)`
On drag end: `setFrozenViewBox(null)`

**C. Add coordinate conversion utility**
```tsx
function clientToWorld(
  svgEl: SVGSVGElement,
  clientX: number,
  clientY: number,
): [number, number] {
  const pt = svgEl.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return [0, 0];
  const svgPt = pt.matrixTransform(ctm.inverse());
  return [svgPt.x, svgPt.y];
}
```

**D. Add drag handler hook or inline logic**

Create a `useSchematicDrag` hook (can live in the same file or a new file -- see 2.2). Attach pointer handlers to each building group and pole rect.

For each building `<g>` and pole `<rect>`, add:
```tsx
onPointerDown={(e) => onBuildingPointerDown(e, b.id)}
style={{ cursor: 'grab' }}
```

**E. Add visual feedback during drag**

- Apply `cursor: grabbing` on the SVG during active drag
- Render a selection highlight (blue stroke) around the dragged building
- Optionally render snap indicator lines when snap is active (thin blue dashed lines at snap edges)

**F. Add click-to-select on building shapes**

Use the same dead-zone pattern as the current 3D implementation (5px screen-space threshold) to distinguish click from drag. On click (no drag), call `selectBuilding(id)` and `setAccordionSection(2)`.

**G. Handle pointer events on the SVG container**

Add `onPointerDown` to individual building shapes (not the SVG root) so that pointer events on empty space don't trigger drag. The SVG root can handle `onPointerMissed` equivalent -- clicking empty space deselects.

#### Pseudocode for drag logic in SchematicView:

```tsx
const svgRef = useRef<SVGSVGElement>(null);
const dragging = useRef(false);
const dragBuildingId = useRef<string | null>(null);
const dragStartWorld = useRef<[number, number] | null>(null);
const dragStartPos = useRef<[number, number]>([0, 0]);
const pointerDownScreen = useRef<{ x: number; y: number } | null>(null);

function onBuildingPointerDown(e: React.PointerEvent, buildingId: string) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.currentTarget.setPointerCapture(e.pointerId); // Capture for reliable move/up

  const svg = svgRef.current;
  if (!svg) return;

  const building = useConfigStore.getState().buildings.find(b => b.id === buildingId);
  if (!building) return;

  pointerDownScreen.current = { x: e.clientX, y: e.clientY };
  dragStartWorld.current = clientToWorld(svg, e.clientX, e.clientY);
  dragStartPos.current = [...building.position];
  dragBuildingId.current = buildingId;

  // Freeze the viewBox to prevent coordinate shifts during drag
  setFrozenViewBox(computedViewBox);
}

function onPointerMove(e: React.PointerEvent) {
  if (!dragBuildingId.current || !dragStartWorld.current) return;

  const down = pointerDownScreen.current;
  if (down && !dragging.current) {
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    if (dx * dx + dy * dy < 25) return; // 5px dead zone
    dragging.current = true;
    setDraggedBuildingId(dragBuildingId.current);
  }
  if (!dragging.current) return;

  const svg = svgRef.current;
  if (!svg) return;

  const [wx, wz] = clientToWorld(svg, e.clientX, e.clientY);
  const dx = wx - dragStartWorld.current[0];
  const dz = wz - dragStartWorld.current[1];
  const newPos: [number, number] = [
    dragStartPos.current[0] + dx,
    dragStartPos.current[1] + dz,
  ];

  const allBuildings = useConfigStore.getState().buildings;
  const building = allBuildings.find(b => b.id === dragBuildingId.current);
  if (!building) return;

  if (building.type === 'paal') {
    const snapped = detectPoleSnap(newPos, allBuildings.filter(b => b.id !== building.id));
    updateBuildingPosition(building.id, snapped);
  } else {
    const others = allBuildings.filter(b => b.id !== building.id && b.type !== 'paal');
    const tempBuilding = { ...building, position: newPos };
    const { snappedPosition, newConnections } = detectSnap(tempBuilding, others);
    updateBuildingPosition(building.id, snappedPosition);
    setConnections(newConnections);
  }
}

function onPointerUp(e: React.PointerEvent) {
  if (dragging.current) {
    setDraggedBuildingId(null);
  } else if (dragBuildingId.current) {
    // Click (no drag) -- select building
    selectBuilding(dragBuildingId.current);
    setAccordionSection(2);
  }
  dragging.current = false;
  dragBuildingId.current = null;
  dragStartWorld.current = null;
  pointerDownScreen.current = null;
  setFrozenViewBox(null);
}
```

Attach `onPointerMove` and `onPointerUp` to the `<svg>` element (not individual shapes) so they continue to fire even when the pointer leaves the building shape during drag.

---

### 2.2 NEW FILE: `src/components/schematic/useSchematicDrag.ts` (optional extraction)

If the drag logic becomes too large for SchematicView, extract into a custom hook:

```ts
export function useSchematicDrag(svgRef: RefObject<SVGSVGElement>) {
  // All the drag state refs and handlers
  // Returns: { onBuildingPointerDown, onSvgPointerMove, onSvgPointerUp, frozenViewBox }
}
```

**Decision**: Start inline in SchematicView. Extract only if the file exceeds ~200 lines of drag logic.

---

### 2.3 `src/components/canvas/BuildingInstance.tsx` -- STRIP DRAG, KEEP CLICK

**Remove:**
- `dragging` ref
- `dragStart` ref
- `startPos` ref
- `pointerDownScreen` ref
- `cleanupDrag` ref and cleanup effect
- `getGroundPoint` callback (raycaster + ground plane)
- `onPointerDown` callback (entire drag initiation)
- `groundPlane` constant at module level
- Imports: `Raycaster`, `Vector2`, `Vector3`, `Plane` (if no longer needed)
- Imports: `detectSnap`, `detectPoleSnap` from `@/lib/snap`
- Store selectors: `updateBuildingPosition`, `setDraggedBuildingId`, `setConnections`
- `useThree` hook (if only used for drag -- check if still needed for anything)

**Keep:**
- `handleClick` -- click-to-select still works on 3D
- `SelectionOutline` component
- `onClick` on the group
- `building`, `selectedBuildingId`, `selectBuilding` store selectors
- `BuildingProvider` wrapping
- `setAccordionSection` for opening config panel on click

**Simplified result:**
```tsx
export default function BuildingInstance({ buildingId }: BuildingInstanceProps) {
  const building = useConfigStore((s) => s.buildings.find(b => b.id === buildingId));
  const selectedBuildingId = useConfigStore((s) => s.selectedBuildingId);
  const selectBuilding = useConfigStore((s) => s.selectBuilding);
  const setAccordionSection = useConfigStore((s) => s.setAccordionSection);

  const handleClick = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    selectBuilding(buildingId);
    setAccordionSection(2);
  }, [buildingId, selectBuilding, setAccordionSection]);

  if (!building) return null;
  const isSelected = selectedBuildingId === buildingId;

  return (
    <BuildingProvider value={buildingId}>
      <group
        position={[building.position[0], 0, building.position[1]]}
        onClick={handleClick}
      >
        <Building />
        {isSelected && <SelectionOutline ... />}
      </group>
    </BuildingProvider>
  );
}
```

**Note**: The `onPointerDown` on the group is removed entirely. The `useClickableObject` hook in other components (Roof, walls) is unaffected since those handle selection, not position dragging.

---

### 2.4 `src/components/canvas/BuildingScene.tsx` -- MINOR CHANGES

**Remove:**
- `<DragPlane />` component usage (no longer needed)
- Import of `DragPlane`

**Modify:**
- `CameraAnimator`: The `enabled={!draggedBuildingId}` on `OrbitControls` can be simplified. Since drag no longer happens on the 3D canvas, orbit controls can always be enabled. However, keeping `draggedBuildingId` gating is harmless and provides a subtle UX benefit: if the user is dragging on the Plattegrond while 3D is visible (future split-view), orbit won't interfere. **Recommendation**: Keep as-is for forward compatibility.

**Consider:**
- Whether to remove `DragPlane.tsx` entirely or leave it unused. **Recommendation**: Remove the import and usage, delete the file.

---

### 2.5 `src/components/canvas/DragPlane.tsx` -- DELETE

This invisible plane existed solely as a raycast target for drag. No longer needed.

---

### 2.6 `src/lib/snap.ts` -- NO CHANGES

The snap functions operate purely on world `[x, z]` coordinates and `BuildingEntity` objects. The SVG drag system produces identical inputs. No modifications needed.

---

### 2.7 `src/store/useConfigStore.ts` -- NO CHANGES

The store already has all needed actions:
- `updateBuildingPosition(id, [x, z])` -- same call from SVG drag
- `setDraggedBuildingId(id | null)` -- same semantics
- `setConnections(conns)` -- same call after snap
- `selectBuilding(id)` -- used for click-to-select on SVG

No new state or actions are required.

---

### 2.8 `src/types/building.ts` -- NO CHANGES

`BuildingEntity.position` remains `[number, number]` representing world `[x, z]`.

---

### 2.9 `src/app/page.tsx` -- POTENTIAL MINOR CHANGES

Currently the 3D view and plan view are mutually exclusive (`viewMode === '3d'` vs `viewMode === 'plan'`). The plan view is rendered as a full-screen overlay with `bg-white`.

**No changes needed** for the basic migration. However, consider whether the Plattegrond should be visible alongside the 3D view (split/overlay) so users can drag while seeing the 3D result. This is an enhancement for later -- see Open Questions.

---

### 2.10 `src/lib/useClickableObject.ts` -- NO CHANGES

This hook is used by Roof.tsx and wall meshes for click/hover detection in 3D. It does not participate in drag logic. Unaffected.

---

### 2.11 Schematic sub-components -- MINOR CHANGES

Files: `SchematicPosts.tsx`, `SchematicWalls.tsx`, `SchematicOpenings.tsx`, `DimensionLine.tsx`

These currently render SVG elements without pointer events. They may need `pointer-events: none` added to prevent them from intercepting drag events on the parent building `<g>`.

```tsx
// In each sub-component's root element:
<g pointerEvents="none">
  ...existing content...
</g>
```

Alternatively, set `pointer-events="all"` only on the building's main hit-target rect and `pointer-events="none"` on decorative children.

---

## 3. Migration Path (Implementation Order)

### Step 1: Add coordinate conversion utility
- Add `clientToWorld()` function to SchematicView (or a shared util)
- **Test**: Log converted coordinates on click to verify they match world positions
- **Rationale**: Foundation for all subsequent work; must be verified first

### Step 2: Add drag handlers to SchematicView
- Add `svgRef`, frozen viewBox state, pointer event handlers
- Make building rects and pole rects interactive (`onPointerDown`)
- Wire up `onPointerMove` and `onPointerUp` on the SVG element
- Import and call `detectSnap` / `detectPoleSnap`
- Add visual feedback: cursor changes, selection highlight on dragged building
- **Test**: Drag buildings on the Plattegrond, verify positions update, snap works, 3D view reflects changes (switch view modes)
- **Rationale**: Get the new system fully working before removing the old one

### Step 3: Add click-to-select on SchematicView
- Implement dead-zone click detection (distinguish from drag)
- Call `selectBuilding()` and `setAccordionSection(2)` on click
- Add selected-building highlight (blue outline rect) in SVG
- **Test**: Click buildings to select, verify config panel updates
- **Rationale**: Complete the interaction model before stripping the old one

### Step 4: Strip drag from BuildingInstance.tsx
- Remove all drag-related code (refs, callbacks, pointer handlers, imports)
- Keep click-to-select and selection outline
- Remove `onPointerDown` from the group element
- **Test**: Verify 3D click-to-select still works, no drag on 3D canvas
- **Rationale**: Only remove old code after new code is proven

### Step 5: Clean up BuildingScene and DragPlane
- Remove `<DragPlane />` from BuildingScene
- Delete `DragPlane.tsx`
- Optionally simplify OrbitControls `enabled` prop
- **Test**: Verify 3D orbit/pan still works, no regressions

### Step 6: Polish and edge cases
- Handle `pointer-events` on schematic sub-components
- Test pole snap behavior (edge slide, corner/midpoint detents)
- Test multi-building snap (berging + overkapping side-by-side)
- Test with different viewport sizes / zoom levels
- Verify export still works after changes

---

## 4. Risk Assessment

### Risk 1: ViewBox Shift During Drag (HIGH)
**Problem**: The viewBox is computed from all building positions. Moving a building changes the bounding box, which changes the viewBox, which changes the SVG-to-screen mapping, which invalidates the drag delta calculation mid-drag. This creates a feedback loop where the building jumps or oscillates.

**Mitigation**: Freeze the viewBox at drag-start (store the computed viewBox string in state). Restore it on drag-end. The `clientToWorld` conversion via `getScreenCTM()` will remain stable because the viewBox doesn't change.

**Note**: This means during drag, if the building moves outside the visible area, it clips. This is acceptable -- the viewBox will update on drag-end to accommodate the new position.

### Risk 2: Pointer Capture and Event Bubbling (MEDIUM)
**Problem**: SVG pointer events behave differently from DOM pointer events. If the pointer leaves the building shape during fast drag, events stop firing.

**Mitigation**: Use `element.setPointerCapture(pointerId)` on the building element at pointer-down. This ensures `pointermove` and `pointerup` continue to fire on that element regardless of pointer position. Alternatively, attach move/up listeners to the SVG root or `window`.

**Recommendation**: Use `setPointerCapture` on the `<svg>` element (not the building `<g>`) and handle all move/up there. This is more reliable for SVG.

### Risk 3: Sub-component Pointer Event Interception (LOW)
**Problem**: SchematicWalls, SchematicPosts, SchematicOpenings render SVG elements on top of the building rect. These could intercept pointer events.

**Mitigation**: Add `pointerEvents="none"` to decorative sub-component groups. Only the building's hit-target rect should have pointer events enabled.

### Risk 4: Click vs. Drag Distinction (LOW)
**Problem**: Must distinguish a click (select) from a drag (move). The 3D version uses a 5px dead zone.

**Mitigation**: Replicate the same 5px screen-space dead zone. Compare `clientX`/`clientY` deltas in screen pixels (not SVG units) before entering drag mode.

### Risk 5: Stale Closure Over Building Data (LOW)
**Problem**: The drag handler closures might capture stale building data if React re-renders during drag.

**Mitigation**: Read current building state from `useConfigStore.getState()` inside the move handler (same pattern as the current 3D implementation on line 75 of BuildingInstance.tsx). Do not rely on React state/props during the drag loop.

### Risk 6: Performance During Drag (LOW)
**Problem**: Each pointer-move triggers `updateBuildingPosition` -> Zustand state update -> React re-render of all subscribers. The SchematicView re-renders the entire SVG.

**Mitigation**: This is the same as the current 3D implementation and should perform fine. SVG rendering is lightweight compared to Three.js. If needed, memoize individual building groups with `React.memo`.

---

## 5. Open Questions

### Q1: Should 3D and Plattegrond be visible simultaneously?
Currently they are mutually exclusive (toggle). If the user drags on the Plattegrond, they cannot see the 3D result until switching views. A split view (3D on top/left, Plattegrond on bottom/right) would give immediate visual feedback in both views.

**Impact on plan**: None for the core migration. Split view is an additive layout change to `page.tsx`.

### Q2: Should the viewBox auto-pan during drag?
If a building is dragged to the edge of the visible SVG area, should the view scroll/pan to follow? The frozen viewBox prevents this.

**Options**:
- (A) No auto-pan. User drags within the visible area. ViewBox updates on drop. Simple.
- (B) Auto-pan: expand the frozen viewBox in the direction of drag when the pointer approaches the edge. More complex, potential for jitter.

**Recommendation**: Start with (A). Add (B) only if user testing reveals a need.

### Q3: Should snap indicators be rendered in the SVG?
The current 3D drag has no visual snap indicators -- the building just jumps to the snapped position. In the 2D Plattegrond, subtle snap guides (thin blue lines at snap edges) would be more intuitive since the floor plan is schematic.

**Impact**: Small additive feature. The `detectSnap` return value includes enough info to render guides. Can be added in Step 6 or as a follow-up.

### Q4: Should buildings be draggable from the 3D view via a "move mode" toggle?
Some users might expect to drag in 3D. A toggle button could re-enable drag on the 3D canvas.

**Recommendation**: Out of scope. The goal is to move all drag to Plattegrond. Revisit only if user feedback demands it.

### Q5: How should the selected-building highlight look in the Plattegrond?
Currently the 3D view shows a blue wireframe box (`SelectionOutline`). The SVG equivalent could be a blue stroke on the building rect, a subtle blue fill tint, or a dashed outline.

**Recommendation**: Blue stroke (2px, `#3b82f6`) on the building rect, matching the 3D selection color.

---

## Appendix: Files Inventory

| File | Action | Scope |
|------|--------|-------|
| `src/components/schematic/SchematicView.tsx` | Major rewrite | Add drag handlers, SVG ref, frozen viewBox, click-to-select, visual feedback |
| `src/components/schematic/useSchematicDrag.ts` | New (optional) | Extract drag hook if SchematicView gets too large |
| `src/components/canvas/BuildingInstance.tsx` | Strip drag code | Remove ~80 lines of drag logic, keep click + outline |
| `src/components/canvas/BuildingScene.tsx` | Minor cleanup | Remove DragPlane usage |
| `src/components/canvas/DragPlane.tsx` | Delete | No longer needed |
| `src/components/schematic/SchematicPosts.tsx` | Minor | Add `pointerEvents="none"` |
| `src/components/schematic/SchematicWalls.tsx` | Minor | Add `pointerEvents="none"` |
| `src/components/schematic/SchematicOpenings.tsx` | Minor | Add `pointerEvents="none"` |
| `src/components/schematic/DimensionLine.tsx` | Minor | Add `pointerEvents="none"` |
| `src/lib/snap.ts` | No changes | - |
| `src/store/useConfigStore.ts` | No changes | - |
| `src/types/building.ts` | No changes | - |
| `src/app/page.tsx` | No changes | - |
| `src/lib/useClickableObject.ts` | No changes | - |
| `src/lib/constants.ts` | No changes | - |
