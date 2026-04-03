<objective>
Create a detailed implementation plan for moving all drag-and-place interaction (buildings, overkappingen, poles) from the 3D canvas to the Plattegrond (schematic floor plan) SVG view. The 3D canvas should become view-only — no more pointer-based dragging there.

The goal is a concrete, step-by-step plan with file-level changes that can be executed directly.
</objective>

<context>
This is a Next.js + React Three Fiber 3D building configurator. Users currently drag buildings on the 3D canvas via raycasting to a ground plane. The Plattegrond is a 2D SVG floor plan view rendered in `SchematicView.tsx`.

Read the CLAUDE.md for project conventions, then thoroughly examine these files to understand the current architecture:

- `src/components/canvas/BuildingInstance.tsx` — current drag logic (raycasting, pointer events, snap integration)
- `src/components/schematic/SchematicView.tsx` — current read-only SVG floor plan
- `src/lib/snap.ts` — snap logic (`detectSnap`, `detectPoleSnap`) that must work with new SVG coordinates
- `src/store/useConfigStore.ts` — state management (positions, connections, dragged building ID)
- `src/types/building.ts` — BuildingEntity with position as `[number, number]` (world X, Z)

Key constraints:
- Buildings use world coordinates `[x, z]` stored in the store. The SVG view maps these to SVG space. The new drag system must convert SVG pointer events back to world coordinates.
- Snap logic (`detectSnap`, `detectPoleSnap`) operates on world coordinates and should remain unchanged.
- The 3D canvas currently uses `Raycaster` + ground plane intersection for drag. The SVG approach will use pointer events + coordinate transforms instead.
- Poles have special snap behavior (edge slide, corner/midpoint detents) that must continue to work.
- The SchematicView currently computes its own viewBox with padding — drag coordinates must account for this transform.
</context>

<requirements>
Deeply consider the following aspects in your plan:

1. **SVG coordinate system**: How to convert SVG pointer events to world `[x, z]` coordinates, accounting for the dynamic viewBox, padding, and the SVG element's screen position/size. Consider using `SVGSVGElement.getScreenCTM()` or `createSVGPoint()` for robust coordinate conversion.

2. **Drag UX on the Plattegrond**: How drag-start, drag-move, and drag-end should work on SVG elements. Consider:
   - Click-to-select vs drag distinction (current 3D implementation uses a 5px dead zone)
   - Visual feedback during drag (cursor changes, ghost position, snap indicators)
   - How the viewBox/zoom should behave while dragging (should it auto-pan?)

3. **Snap integration**: The existing `detectSnap` and `detectPoleSnap` functions take world coordinates. Plan how to feed converted SVG coordinates into them and apply snapped positions back.

4. **Removing 3D drag**: What to strip from `BuildingInstance.tsx` while keeping click-to-select and the selection outline. The 3D view should still respond to clicks for selecting buildings/walls/roof.

5. **State management**: The store already has `draggedBuildingId` — plan how this integrates with SVG-based drag. Consider whether the drag state should trigger visual updates in both the 3D view and the Plattegrond simultaneously.

6. **Schematic view changes**: The SVG currently renders inside a flex container. Consider whether it needs to become interactive (pointer-events on building shapes) and how to handle the existing read-only rendering.

7. **Edge cases**: What happens when dragging a building causes the bounding box to change? The viewBox will shift mid-drag — this needs careful handling.
</requirements>

<output>
Produce a plan structured as:

1. **Architecture overview** — high-level description of the new interaction flow
2. **File-by-file changes** — for each file that needs modification:
   - What to add/remove/change
   - Key code patterns or approaches (pseudocode is fine)
   - Dependencies on other changes
3. **Migration path** — order of implementation steps with rationale
4. **Risk assessment** — potential gotchas and how to mitigate them
5. **Open questions** — decisions that need user input before implementation

Save the plan to: `./plans/move-drag-to-plattegrond.md`
</output>

<verification>
Before finalizing the plan, verify:
- Every file that currently handles drag is accounted for
- The coordinate conversion approach is mathematically sound
- Snap logic integration is preserved without modifications to snap.ts
- The 3D canvas retains click-to-select functionality
- The plan handles all entity types: berging, overkapping, and paal
</verification>
