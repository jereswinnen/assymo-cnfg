# Anchor-Point Positioning & Drag-to-Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor building positions from center-based to top-left-corner-based, add drag-to-resize handles in the 2D schematic, and update dimension constraints to match business requirements.

**Architecture:** The position model changes from `[centerX, centerZ]` to `[left, top]` (min X, min Z). Internal components (SchematicWalls, SchematicPosts, SchematicOpenings, Wall, Roof, TimberFrame) all receive center-based offsets and don't need changes — only their parent callers do. A centralized `DIMENSION_CONSTRAINTS` config replaces hardcoded slider limits. Resize handles are SVG circles in SchematicView with drag-to-resize behavior.

**Tech Stack:** React, Zustand, Three.js/R3F, SVG, TypeScript

**Key insight:** Only 6 files use `building.position` directly and need migration:
- `snap.ts` — edge calculations
- `SchematicView.tsx` — rendering, bounding box, drag
- `BuildingInstance.tsx` — 3D group position
- `BuildingScene.tsx` — camera offset
- `useConfigStore.ts` — creation, auto-positioning, migration
- `configCode.ts` — serialization/deserialization

---

### Task 1: Add Dimension Constraints System

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/store/useConfigStore.ts`
- Modify: `src/components/ui/DimensionsControl.tsx`

- [ ] **Step 1: Add constraint types and config to constants.ts**

Add after the `WALL_DIMENSIONS` constant (~line 200):

```typescript
// ─── Dimension constraints per building type ────────────────────────
export interface DimensionConstraint {
  min: number;
  max: number;
  step: number;
}

export interface DimensionConstraints {
  width: DimensionConstraint;
  depth: DimensionConstraint;
  height: DimensionConstraint;
}

export const DIMENSION_CONSTRAINTS: Record<string, DimensionConstraints> = {
  structural: {
    width:  { min: 1,    max: 6,   step: 0.1 },
    depth:  { min: 1,    max: 40,  step: 0.1 },
    height: { min: 2.2,  max: 3,   step: 0.1 },
  },
  muur: {
    width:  { min: 1,    max: 10,  step: 0.5 },
    depth:  { min: 0.15, max: 0.15, step: 0 },
    height: { min: 2.2,  max: 3,   step: 0.1 },
  },
  paal: {
    width:  { min: 0.15, max: 0.15, step: 0 },
    depth:  { min: 0.15, max: 0.15, step: 0 },
    height: { min: 2.2,  max: 3,   step: 0.1 },
  },
};

export function getConstraints(type: BuildingType): DimensionConstraints {
  if (type === 'muur') return DIMENSION_CONSTRAINTS.muur;
  if (type === 'paal') return DIMENSION_CONSTRAINTS.paal;
  return DIMENSION_CONSTRAINTS.structural;
}

// ─── Width categories (future-ready) ────────────────────────────────
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

- [ ] **Step 2: Update default heights**

In `constants.ts`, change `DEFAULT_DIMENSIONS` height to `2.6`, `POLE_DIMENSIONS` height to `2.6`, `WALL_DIMENSIONS` height to `2.6`.

In `useConfigStore.ts`, change `defaultHeight: 3` to `defaultHeight: 2.6` in both the initial state (line ~130) and in `resetConfig` (line ~299).

- [ ] **Step 3: Update DimensionsControl to use constraints**

In `src/components/ui/DimensionsControl.tsx`:

Add import: `import { getConstraints } from '@/lib/constants';`

After `const effectiveHeight = ...` (line 88), add:
```typescript
const constraints = getConstraints(building.type);
```

Replace the two separate width slider blocks (structural + muur, lines 93-114) with one unified block:
```typescript
      {(isStructural || isMuur) && (
        <SliderRow
          label={t('dim.width')}
          value={dimensions.width}
          min={constraints.width.min}
          max={constraints.width.max}
          step={constraints.width.step}
          unit="m"
          onChange={(v) => updateBuildingDimensions(selectedBuildingId, { width: v })}
        />
      )}
```

Replace depth slider min/max/step (lines 116-126) with `constraints.depth.min`, `constraints.depth.max`, `constraints.depth.step`.

Replace all height slider min/max/step values (lines 128-149) with `constraints.height.min`, `constraints.height.max`, `constraints.height.step`.

- [ ] **Step 4: Verify sliders show new ranges**

Run `pnpm dev`. Select a building. Verify:
- Width max is 6m (not 15m)
- Depth max is 40m (not 20m)  
- Height range is 2.2–3m (not 2–6m)
- Step is 0.1 for all

- [ ] **Step 5: Commit**

```bash
git add src/lib/constants.ts src/store/useConfigStore.ts src/components/ui/DimensionsControl.tsx
git commit -m "feat: add centralized dimension constraints system

New ranges per business requirements:
- Height: 2.2-3m, Width: 1-6m, Depth: 1-40m
- Width categories (cat 1: ≤4m, cat 2: 4-6m) for future use"
```

---

### Task 2: Refactor Position Model — Store

**Files:**
- Modify: `src/types/building.ts`
- Modify: `src/store/useConfigStore.ts`

- [ ] **Step 1: Add doc comment to position field**

In `src/types/building.ts`, update the position field (line 73):
```typescript
  /** Top-left corner in world coords [x, z] — left edge, front edge (min X, min Z) */
  position: [number, number];
```

- [ ] **Step 2: Update addBuilding auto-positioning**

In `useConfigStore.ts`, the `addBuilding` method (lines 136-142) computes where to place a new building. Change from center-based to top-left:

```typescript
    if (!position) {
      const existing = get().buildings;
      if (existing.length > 0) {
        const maxX = Math.max(...existing.map(e => e.position[0] + e.dimensions.width));
        b.position = [maxX + 2, 0];
      }
    }
```

Old: `maxX = position[0] + width/2`, `newPos = [maxX + width/2 + 2, 0]`
New: `maxX = position[0] + width`, `newPos = [maxX + 2, 0]`

- [ ] **Step 3: Update makeInitialBuilding**

Change the initial position so a 4×4 building is roughly centered around origin:

```typescript
function makeInitialBuilding(): BuildingEntity {
  return createBuilding('berging', [-2, -2]);
}
```

- [ ] **Step 4: Update loadState position migration**

In `loadState` (line 306), convert center-based saved positions to top-left. Add position conversion in the migration map:

```typescript
  loadState: (buildings, connections, roof) => {
    const migrated = buildings.map(b => ({
      ...b,
      orientation: (b as any).orientation ?? ('horizontal' as Orientation),
      heightOverride: (b as any).heightOverride ?? null,
      // Convert center-based position to top-left
      position: [
        b.position[0] - b.dimensions.width / 2,
        b.position[1] - b.dimensions.depth / 2,
      ] as [number, number],
    }));
```

- [ ] **Step 5: Commit**

```bash
git add src/types/building.ts src/store/useConfigStore.ts
git commit -m "refactor: change position model from center to top-left corner"
```

---

### Task 3: Migrate snap.ts

**Files:**
- Modify: `src/lib/snap.ts`

All three snap functions compute edges from `position`. The pattern: replace `cx ± hw` with `lx` / `lx + w`, and `cz ± hd` with `tz` / `tz + d`. Where center is needed (alignment, midpoints), derive it as `lx + w/2`.

- [ ] **Step 1: Update getBuildingEdges**

Replace lines 16-26:

```typescript
export function getBuildingEdges(b: BuildingEntity): Edge[] {
  const [lx, tz] = b.position;
  const w = b.dimensions.width;
  const d = b.dimensions.depth;
  return [
    { axis: 'x', value: lx + w, perpStart: tz, perpEnd: tz + d, side: 'right' },
    { axis: 'x', value: lx,     perpStart: tz, perpEnd: tz + d, side: 'left' },
    { axis: 'z', value: tz + d, perpStart: lx, perpEnd: lx + w, side: 'back' },
    { axis: 'z', value: tz,     perpStart: lx, perpEnd: lx + w, side: 'front' },
  ];
}
```

- [ ] **Step 2: Update detectSnap secondary alignment**

The secondary alignment (lines ~100-122) aligns building centers. Replace `other.position[1]` with `other.position[1] + other.dimensions.depth / 2` and similar for X:

```typescript
    if (primaryEdge.axis === 'x') {
      for (const other of others) {
        if (other.id !== conn.buildingBId) continue;
        const otherCenterZ = other.position[1] + other.dimensions.depth / 2;
        const draggedCenterZ = nz + dragged.dimensions.depth / 2;
        const dz = otherCenterZ - draggedCenterZ;
        if (Math.abs(dz) < SNAP_ALIGN_THRESHOLD) {
          nz += dz;
        }
      }
    } else {
      for (const other of others) {
        if (other.id !== conn.buildingBId) continue;
        const otherCenterX = other.position[0] + other.dimensions.width / 2;
        const draggedCenterX = nx + dragged.dimensions.width / 2;
        const dx = otherCenterX - draggedCenterX;
        if (Math.abs(dx) < SNAP_ALIGN_THRESHOLD) {
          nx += dx;
        }
      }
    }
```

- [ ] **Step 3: Update detectPoleSnap**

Replace the Pass 1 edge computation (lines ~143-177). Pattern: `[cx, cz]` → `[lx, tz]`, `hw` → `w`, `hd` → `d`, `cx - hw` → `lx`, `cx + hw` → `lx + w`, etc:

```typescript
  for (const b of buildings) {
    if (b.type === 'paal') continue;

    const [lx, tz] = b.position;
    const w = b.dimensions.width;
    const d = b.dimensions.depth;

    const edges: { fixed: 'x' | 'z'; val: number; min: number; max: number }[] = [
      { fixed: 'z', val: tz,     min: lx, max: lx + w },
      { fixed: 'z', val: tz + d, min: lx, max: lx + w },
      { fixed: 'x', val: lx,     min: tz, max: tz + d },
      { fixed: 'x', val: lx + w, min: tz, max: tz + d },
    ];
```

(Keep the inner for-loop that checks distance/clamping — it uses `e.val`/`e.min`/`e.max` which are now correct.)

Replace the Pass 2 targets (lines ~182-207). Derive corners from top-left, midpoints from center:

```typescript
  let detentDist = POLE_DETENT_THRESHOLD;
  for (const b of buildings) {
    if (b.type === 'paal') continue;

    const [lx, tz] = b.position;
    const w = b.dimensions.width;
    const d = b.dimensions.depth;
    const cx = lx + w / 2;
    const cz = tz + d / 2;

    const targets: [number, number][] = [
      [lx, tz], [lx + w, tz],
      [lx, tz + d], [lx + w, tz + d],
      [cx, tz], [cx, tz + d],
      [lx, cz], [lx + w, cz],
    ];
```

- [ ] **Step 4: Update detectWallSnap**

Same pattern for Pass 1 edge computation and Pass 2 targets. Additionally, update pole and muur snap targets to use top-left:

For poles, snap target is center of the tiny square:
```typescript
    if (b.type === 'paal') {
      targets.push([b.position[0] + b.dimensions.width / 2, b.position[1] + b.dimensions.depth / 2]);
      continue;
    }
```

For muur endpoints, compute from top-left:
```typescript
    if (b.type === 'muur') {
      if (b.orientation === 'horizontal') {
        const cy = b.position[1] + b.dimensions.depth / 2;
        targets.push([b.position[0], cy]);
        targets.push([b.position[0] + b.dimensions.width, cy]);
      } else {
        const cx = b.position[0] + b.dimensions.depth / 2;
        targets.push([cx, b.position[1]]);
        targets.push([cx, b.position[1] + b.dimensions.width]);
      }
      continue;
    }
```

For building corners/midpoints, same as detectPoleSnap Pass 2.

- [ ] **Step 5: Commit**

```bash
git add src/lib/snap.ts
git commit -m "refactor: migrate snap.ts to top-left position model"
```

---

### Task 4: Migrate SchematicView

**Files:**
- Modify: `src/components/schematic/SchematicView.tsx`

**Key principle:** SchematicWalls, SchematicPosts, and SchematicOpenings receive `offsetX`/`offsetY` as a center point and work with `hw`/`hd` internally. They DON'T need changes. We pass them `position[0] + width/2`, `position[1] + depth/2` as their center offsets.

For SVG rects, labels, and dimension lines rendered directly in SchematicView, replace `ox - hw` → `ox`, `ox + hw` → `ox + width`, same for Z.

- [ ] **Step 1: Update getConnectionEdges**

Replace lines 35-42 (edge computation from position):

```typescript
    const aLeft = a.position[0];
    const aRight = a.position[0] + a.dimensions.width;
    const aTop = a.position[1];
    const aBottom = a.position[1] + a.dimensions.depth;
    const bLeft = b.position[0];
    const bRight = b.position[0] + b.dimensions.width;
    const bTop = b.position[1];
    const bBottom = b.position[1] + b.dimensions.depth;
```

The rest of the function (lines 44-60) uses these variables — no changes needed.

- [ ] **Step 2: Update bounding box computation**

Replace lines 107-120:

```typescript
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const b of buildings) {
    const [lx, lz] = b.position;
    const isVertMuur = b.type === 'muur' && b.orientation === 'vertical';
    const bw = isVertMuur ? b.dimensions.depth : b.dimensions.width;
    const bd = isVertMuur ? b.dimensions.width : b.dimensions.depth;
    const pad2 = b.type === 'paal' ? 0.3 : 0;
    minX = Math.min(minX, lx - pad2);
    maxX = Math.max(maxX, lx + bw + pad2);
    minZ = Math.min(minZ, lz - pad2);
    maxZ = Math.max(maxZ, lz + bd + pad2);
  }
```

- [ ] **Step 3: Update normal building rendering**

In the `normalBuildings.map()` callback (line ~306), remove the `hw`/`hd` variables:

```typescript
            const [ox, oz] = b.position;
            const { width, depth } = b.dimensions;
```

Replace all rect positions from `ox - hw` → `ox`, `oz - hd` → `oz`:

Hit target, fill, and outline rects all become:
```typescript
x={ox} y={oz} width={width} height={depth}
```

Pass center coordinates to child components:
```typescript
<SchematicPosts width={width} depth={depth} offsetX={ox + width / 2} offsetY={oz + depth / 2} />
<SchematicWalls ... offsetX={ox + width / 2} offsetY={oz + depth / 2} />
<SchematicOpenings ... offsetX={ox + width / 2} offsetY={oz + depth / 2} />
```

Width dimension line:
```typescript
<DimensionLine x1={ox} y1={oz + depth} x2={ox + width} y2={oz + depth} ... />
```

Building type label (centered):
```typescript
<text x={ox + width / 2} y={oz + depth / 2} ...>
```

Wall labels — compute positions from edges:
```typescript
{!connected.has('front') && (
  <text x={ox + width / 2} y={oz + depth + 0.3}>{t('wall.front')}</text>
)}
{!connected.has('back') && (
  <text x={ox + width / 2} y={oz - 0.3}>{t('wall.back')}</text>
)}
{!connected.has('left') && (
  <text x={ox - 0.3} y={oz + depth / 2}
    transform={`rotate(-90, ${ox - 0.3}, ${oz + depth / 2})`}>
    {t('wall.left')}
  </text>
)}
{!connected.has('right') && (
  <text x={ox + width + 0.3} y={oz + depth / 2}
    transform={`rotate(90, ${ox + width + 0.3}, ${oz + depth / 2})`}>
    {t('wall.right')}
  </text>
)}
```

- [ ] **Step 4: Update standalone wall rendering**

For walls (lines ~451-561), `[ox, oz]` is now top-left. The visual dimensions `wallW`/`wallD` stay the same. Compute center for child components:

```typescript
            // Center coords for SchematicWalls/SchematicOpenings  
            const wallOffsetX = isHorizontal ? ox + w.dimensions.width / 2 : ox + w.dimensions.depth;
            const wallOffsetY = isHorizontal ? oz : oz + w.dimensions.width / 2;
```

Why these formulas: SchematicWalls' `getWallGeometries` places front wall at `(offsetX, offsetY + depth/2)`. For horizontal muur we want that at the wall center, so `offsetX = ox + width/2` and `offsetY = oz` (since `oz + depth/2` hits the wall center vertically). For vertical muur (swapped dims), we want the left wall at center of the oriented bounding box, which requires `offsetX = ox + depth` and `offsetY = oz + width/2`.

Hit target rect:
```typescript
const hitH = Math.max(wallD, 0.5);
const hitOffsetY = (hitH - wallD) / 2;
```
```typescript
<rect x={ox} y={oz - hitOffsetY} width={wallW} height={hitH} ... />
```

Dimension lines:
```typescript
// Horizontal
<DimensionLine x1={ox} y1={oz + wallD / 2} x2={ox + w.dimensions.width} y2={oz + wallD / 2} offset={0.5} ... />

// Vertical
<DimensionLine x1={ox + wallW} y1={oz} x2={ox + wallW} y2={oz + w.dimensions.width} offset={-0.5} ... />
```

Wall type label:
```typescript
<text x={ox + wallW / 2} y={isHorizontal ? oz + wallD / 2 - 0.25 : oz + wallD / 2} ...>
```

- [ ] **Step 5: Update pole rendering**

Poles (lines ~564-580) — position is top-left of the tiny 0.15×0.15 box. The visual square `s=0.18` should be centered on the pole:

```typescript
const cx = p.position[0] + p.dimensions.width / 2;
const cz = p.position[1] + p.dimensions.depth / 2;
```

```typescript
<rect x={cx - s / 2} y={cz - s / 2} width={s} height={s} ... />
```

- [ ] **Step 6: Commit**

```bash
git add src/components/schematic/SchematicView.tsx
git commit -m "refactor: migrate SchematicView to top-left position model"
```

---

### Task 5: Migrate 3D Rendering & Config Serialization

**Files:**
- Modify: `src/components/canvas/BuildingInstance.tsx`
- Modify: `src/components/canvas/BuildingScene.tsx`
- Modify: `src/lib/configCode.ts`

- [ ] **Step 1: Update BuildingInstance**

The Three.js group needs center-based position. Change line 31:

```typescript
<group
  position={[
    building.position[0] + building.dimensions.width / 2,
    0,
    building.position[1] + building.dimensions.depth / 2,
  ]}
  onClick={handleClick}
>
```

For muur with vertical orientation, the dimensions are swapped visually but stored as `width` (length) and `depth` (thickness). The position is always top-left of the oriented bounding box, so the center calculation accounts for that:

```typescript
const isVertMuur = building.type === 'muur' && building.orientation === 'vertical';
const bw = isVertMuur ? building.dimensions.depth : building.dimensions.width;
const bd = isVertMuur ? building.dimensions.width : building.dimensions.depth;
```

```typescript
<group
  position={[
    building.position[0] + bw / 2,
    0,
    building.position[1] + bd / 2,
  ]}
  onClick={handleClick}
>
```

- [ ] **Step 2: Update BuildingScene camera offset**

In `BuildingScene.tsx` line ~100, the camera offset uses building position (was center). Derive center:

```typescript
const building = buildings.find(b => b.id === selectedBuildingId);
const offset = building
  ? [building.position[0] + building.dimensions.width / 2, building.position[1] + building.dimensions.depth / 2]
  : [0, 0];
```

- [ ] **Step 3: Update configCode.ts encoding**

Position is now top-left. The bit encoding stores position as-is. For backward compatibility, we keep the same encoding format — decode converts center→top-left at read time.

In `encodeState` (~lines 255-279), convert top-left to center before encoding:

For poles (lines 257-258):
```typescript
      w.writeSigned(clamp(Math.round((b.position[0] + b.dimensions.width / 2) / 0.5), -64, 63), 7);
      w.writeSigned(clamp(Math.round((b.position[1] + b.dimensions.depth / 2) / 0.5), -64, 63), 7);
```

For muur (lines 262-263):
```typescript
      w.writeSigned(clamp(Math.round((b.position[0] + b.dimensions.width / 2) / 0.5), -64, 63), 7);
      w.writeSigned(clamp(Math.round((b.position[1] + b.dimensions.depth / 2) / 0.5), -64, 63), 7);
```

Wait — muur has swapped visual dimensions for vertical orientation. The stored position is top-left of the oriented bounding box. For encoding, we need to convert to center of the entity regardless of orientation:

Actually, looking at the encode more carefully — muur encodes `b.position[0]` and `b.position[1]` directly (the center in old model). For the new model, we just add half-dims. For a muur, the position is always the top-left of the **stored** dims (width=length, depth=thickness), not the visual/oriented dims. The encoding doesn't care about orientation for position — it just stores the position value. So:

```typescript
// Pole
const poleCx = b.position[0] + b.dimensions.width / 2;
const poleCz = b.position[1] + b.dimensions.depth / 2;
w.writeSigned(clamp(Math.round(poleCx / 0.5), -64, 63), 7);
w.writeSigned(clamp(Math.round(poleCz / 0.5), -64, 63), 7);

// Muur  
const muurCx = b.position[0] + (b.orientation === 'vertical' ? b.dimensions.depth : b.dimensions.width) / 2;
const muurCz = b.position[1] + (b.orientation === 'vertical' ? b.dimensions.width : b.dimensions.depth) / 2;
w.writeSigned(clamp(Math.round(muurCx / 0.5), -64, 63), 7);
w.writeSigned(clamp(Math.round(muurCz / 0.5), -64, 63), 7);
```

Hmm, actually the old model stored center of the entity, period. It didn't distinguish orientation for position storage. The position was always the geometric center. With the new model, position is top-left of the **visual** bounding box (after orientation). So for encoding back to center:

For all building types, the visual dimensions in schematic are:
```
isVertMuur = type === 'muur' && orientation === 'vertical'
visualW = isVertMuur ? depth : width
visualD = isVertMuur ? width : depth
center = [position[0] + visualW/2, position[1] + visualD/2]
```

Let me simplify the encode/decode by adding a helper. Actually, the cleanest approach: in the encoder, convert position to center before writing. In the decoder, convert center to top-left after reading. Use a consistent helper.

For overkapping/berging (lines 278-279):
```typescript
      const cx = b.position[0] + b.dimensions.width / 2;
      const cz = b.position[1] + b.dimensions.depth / 2;
      w.writeSigned(clamp(Math.round(cx / 0.5), -64, 63), 7);
      w.writeSigned(clamp(Math.round(cz / 0.5), -64, 63), 7);
```

For overkapping/berging, visual dims = stored dims (no orientation swap), so this is correct.

- [ ] **Step 4: Update configCode.ts decoding**

In `decodeState`, after reading `posX`/`posZ` (which are center values), convert to top-left.

For poles (lines 380-393), after reading posX/posZ:
```typescript
      const posX = r.readSigned(7) * 0.5;
      const posZ = r.readSigned(7) * 0.5;
      buildings.push({
        ...
        position: [posX - 0.15 / 2, posZ - 0.15 / 2],  // center to top-left
        ...
      });
```

For muur (lines 396-419):
```typescript
      const posX = r.readSigned(7) * 0.5;
      const posZ = r.readSigned(7) * 0.5;
      // Convert center to top-left based on orientation
      const isVert = orientation === 'vertical';
      const visualW = isVert ? 0.2 : width;
      const visualD = isVert ? width : 0.2;
      ...
      position: [posX - visualW / 2, posZ - visualD / 2],
```

For overkapping/berging (lines 422-448):
```typescript
      const posX = r.readSigned(7) * 0.5;
      const posZ = r.readSigned(7) * 0.5;
      ...
      position: [posX - width / 2, posZ - depth / 2],
```

- [ ] **Step 5: Verify everything works end-to-end**

Run `pnpm dev`. Verify:
1. Buildings render correctly in both 2D and 3D views
2. Drag-to-move works in the schematic
3. Snap connections work when dragging buildings together
4. Dimension lines show correct values
5. Save/load config codes work (create a config, copy code, reload — should restore correctly)

- [ ] **Step 6: Commit**

```bash
git add src/components/canvas/BuildingInstance.tsx src/components/canvas/BuildingScene.tsx src/lib/configCode.ts
git commit -m "refactor: migrate 3D rendering and serialization to top-left position model"
```

---

### Task 6: Add Resize Handles to SchematicView

**Files:**
- Modify: `src/components/schematic/SchematicView.tsx`

- [ ] **Step 1: Add resize state refs**

Add new refs alongside the existing drag refs (after line ~93):

```typescript
  // Resize state
  const resizing = useRef(false);
  const resizeBuildingId = useRef<string | null>(null);
  const resizeEdge = useRef<'left' | 'right' | 'top' | 'bottom' | null>(null);
  const resizeStartWorld = useRef<[number, number] | null>(null);
  const resizeStartDims = useRef<{ width: number; depth: number }>({ width: 0, depth: 0 });
  const resizeStartPos = useRef<[number, number]>([0, 0]);
```

Also import `getConstraints` from `@/lib/constants` and `updateBuildingDimensions` from the store:

```typescript
  const updateBuildingDimensions = useConfigStore((s) => s.updateBuildingDimensions);
```

- [ ] **Step 2: Add resize pointer handlers**

Add a `onResizePointerDown` handler:

```typescript
  const onResizePointerDown = useCallback((
    e: React.PointerEvent,
    buildingId: string,
    edge: 'left' | 'right' | 'top' | 'bottom',
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    const svg = svgRef.current;
    if (!svg) return;

    const building = useConfigStore.getState().buildings.find(b => b.id === buildingId);
    if (!building) return;

    pointerDownScreen.current = { x: e.clientX, y: e.clientY };
    resizeStartWorld.current = clientToWorld(svg, e.clientX, e.clientY);
    resizeStartDims.current = { width: building.dimensions.width, depth: building.dimensions.depth };
    resizeStartPos.current = [...building.position];
    resizeBuildingId.current = buildingId;
    resizeEdge.current = edge;

    setFrozenViewBox(computedViewBox);
  }, [computedViewBox]);
```

- [ ] **Step 3: Update onPointerMove for resize**

At the top of `onPointerMove`, add resize handling before the existing move logic:

```typescript
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    // --- Resize handling ---
    if (resizeBuildingId.current && resizeEdge.current && resizeStartWorld.current) {
      const down = pointerDownScreen.current;
      if (down && !resizing.current) {
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (dx * dx + dy * dy < 25) return; // 5px dead zone
        resizing.current = true;
      }
      if (!resizing.current) return;

      const svg = svgRef.current;
      if (!svg) return;

      const [wx, wz] = clientToWorld(svg, e.clientX, e.clientY);
      const edge = resizeEdge.current;
      const startPos = resizeStartPos.current;
      const startDims = resizeStartDims.current;
      const buildingId = resizeBuildingId.current;

      const allBuildings = useConfigStore.getState().buildings;
      const building = allBuildings.find(b => b.id === buildingId);
      if (!building) return;

      const constraints = getConstraints(building.type);

      let newWidth = startDims.width;
      let newDepth = startDims.depth;
      let newPosX = startPos[0];
      let newPosZ = startPos[1];

      // Compute candidate edge position, then snap
      const others = allBuildings.filter(b => b.id !== buildingId && b.type !== 'paal' && b.type !== 'muur');

      if (edge === 'right') {
        let candidateRight = wx;
        candidateRight = snapEdge(candidateRight, 'x', 'right', startPos[1], startPos[1] + startDims.depth, others);
        newWidth = Math.max(constraints.width.min, Math.min(constraints.width.max, candidateRight - startPos[0]));
      } else if (edge === 'left') {
        let candidateLeft = wx;
        candidateLeft = snapEdge(candidateLeft, 'x', 'left', startPos[1], startPos[1] + startDims.depth, others);
        const rightEdge = startPos[0] + startDims.width;
        newWidth = Math.max(constraints.width.min, Math.min(constraints.width.max, rightEdge - candidateLeft));
        newPosX = rightEdge - newWidth;
      } else if (edge === 'bottom') {
        let candidateBottom = wz;
        candidateBottom = snapEdge(candidateBottom, 'z', 'back', startPos[0], startPos[0] + startDims.width, others);
        newDepth = Math.max(constraints.depth.min, Math.min(constraints.depth.max, candidateBottom - startPos[1]));
      } else if (edge === 'top') {
        let candidateTop = wz;
        candidateTop = snapEdge(candidateTop, 'z', 'front', startPos[0], startPos[0] + startDims.width, others);
        const bottomEdge = startPos[1] + startDims.depth;
        newDepth = Math.max(constraints.depth.min, Math.min(constraints.depth.max, bottomEdge - candidateTop));
        newPosZ = bottomEdge - newDepth;
      }

      updateBuildingDimensions(buildingId, { width: newWidth, depth: newDepth });
      updateBuildingPosition(buildingId, [newPosX, newPosZ]);
      return;
    }

    // --- Existing move handling below ---
    if (!dragBuildingId.current || !dragStartWorld.current) return;
    ...
```

- [ ] **Step 4: Update onPointerUp for resize**

Add resize cleanup at the top of `onPointerUp`:

```typescript
  const onPointerUp = useCallback(() => {
    // --- Resize cleanup ---
    if (resizeBuildingId.current) {
      if (!resizing.current) {
        // Click on handle without drag — select building
        selectBuilding(resizeBuildingId.current);
      }
      resizing.current = false;
      resizeBuildingId.current = null;
      resizeEdge.current = null;
      resizeStartWorld.current = null;
      pointerDownScreen.current = null;
      setFrozenViewBox(null);
      return;
    }

    // --- Existing move cleanup ---
    if (dragging.current) {
    ...
```

- [ ] **Step 5: Add ResizeHandles component**

Add a component inside SchematicView.tsx (before the `SchematicView` export):

```typescript
function ResizeHandles({
  building,
  onResizePointerDown,
}: {
  building: BuildingEntity;
  onResizePointerDown: (e: React.PointerEvent, buildingId: string, edge: 'left' | 'right' | 'top' | 'bottom') => void;
}) {
  const [ox, oz] = building.position;
  const { width, depth } = building.dimensions;
  const r = 0.12; // handle radius
  const isMuur = building.type === 'muur';
  const isVertMuur = isMuur && building.orientation === 'vertical';

  // For muur: only 2 handles on the length axis endpoints
  // For structural: all 4 handles
  const handles: { cx: number; cy: number; edge: 'left' | 'right' | 'top' | 'bottom'; cursor: string }[] = [];

  if (isMuur) {
    if (isVertMuur) {
      // Vertical muur: length runs along Z
      const visualW = building.dimensions.depth;
      const visualD = building.dimensions.width;
      handles.push(
        { cx: ox + visualW / 2, cy: oz, edge: 'top', cursor: 'ns-resize' },
        { cx: ox + visualW / 2, cy: oz + visualD, edge: 'bottom', cursor: 'ns-resize' },
      );
    } else {
      // Horizontal muur: length runs along X
      handles.push(
        { cx: ox, cy: oz + depth / 2, edge: 'left', cursor: 'ew-resize' },
        { cx: ox + width, cy: oz + depth / 2, edge: 'right', cursor: 'ew-resize' },
      );
    }
  } else {
    handles.push(
      { cx: ox, cy: oz + depth / 2, edge: 'left', cursor: 'ew-resize' },
      { cx: ox + width, cy: oz + depth / 2, edge: 'right', cursor: 'ew-resize' },
      { cx: ox + width / 2, cy: oz, edge: 'top', cursor: 'ns-resize' },
      { cx: ox + width / 2, cy: oz + depth, edge: 'bottom', cursor: 'ns-resize' },
    );
  }

  return (
    <g>
      {handles.map((h) => (
        <circle
          key={h.edge}
          cx={h.cx}
          cy={h.cy}
          r={r}
          fill="#3b82f6"
          stroke="white"
          strokeWidth={0.03}
          style={{ cursor: h.cursor }}
          onPointerDown={(e) => onResizePointerDown(e, building.id, h.edge)}
        />
      ))}
    </g>
  );
}
```

- [ ] **Step 6: Render resize handles for selected building**

In the SVG, after rendering connection edges and before the depth dimension line, add:

```typescript
          {/* Resize handles on selected building */}
          {selectedBuildingId && (() => {
            const selected = buildings.find(b => b.id === selectedBuildingId);
            if (!selected || selected.type === 'paal') return null;
            return (
              <ResizeHandles
                building={selected}
                onResizePointerDown={onResizePointerDown}
              />
            );
          })()}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/schematic/SchematicView.tsx
git commit -m "feat: add drag-to-resize handles in 2D schematic"
```

---

### Task 7: Add Resize Snap Function

**Files:**
- Modify: `src/lib/snap.ts`
- Modify: `src/components/schematic/SchematicView.tsx`

- [ ] **Step 1: Add detectResizeSnap to snap.ts**

Add at the end of the file:

```typescript
/** Snap a single dragged edge to opposing edges of other buildings */
export function detectResizeSnap(
  edgeValue: number,
  edgeAxis: 'x' | 'z',
  edgeSide: WallSide,
  perpStart: number,
  perpEnd: number,
  otherBuildings: BuildingEntity[],
): number {
  let bestDist = SNAP_THRESHOLD;
  let snapped = edgeValue;

  const opposingSide: WallSide =
    edgeSide === 'left' ? 'right' :
    edgeSide === 'right' ? 'left' :
    edgeSide === 'front' ? 'back' : 'front';

  for (const other of otherBuildings) {
    const otherEdges = getBuildingEdges(other);

    for (const oe of otherEdges) {
      // Only snap to opposing edges on the same axis
      if (oe.axis !== edgeAxis) continue;
      if (oe.side !== opposingSide) continue;

      const dist = Math.abs(edgeValue - oe.value);
      if (dist >= bestDist) continue;

      // Check perpendicular overlap
      if (!rangesOverlap(perpStart, perpEnd, oe.perpStart, oe.perpEnd)) continue;

      bestDist = dist;
      snapped = oe.value;
    }
  }

  return snapped;
}
```

Note: `rangesOverlap` is already defined in snap.ts but is a local function. Make sure it's accessible — it's defined at line 35 and should be visible to `detectResizeSnap` since it's in the same file.

- [ ] **Step 2: Create snapEdge helper in SchematicView**

In SchematicView.tsx, add a helper that wraps `detectResizeSnap`. Add this import:

```typescript
import { detectSnap, detectPoleSnap, detectWallSnap, detectResizeSnap } from '@/lib/snap';
```

Add a helper function inside the component (or outside, before it):

```typescript
function snapEdge(
  edgeValue: number,
  axis: 'x' | 'z',
  side: 'left' | 'right' | 'front' | 'back',
  perpStart: number,
  perpEnd: number,
  others: BuildingEntity[],
): number {
  return detectResizeSnap(edgeValue, axis, side, perpStart, perpEnd, others);
}
```

This is used by the resize handler in Task 6 Step 3. If you implemented Task 6 before Task 7, go back and verify the `snapEdge` calls work. The resize handler already calls `snapEdge` — this step provides the implementation.

- [ ] **Step 3: Verify resize with snap**

Run `pnpm dev`. Place two buildings side by side. Select one, drag its right edge toward the other. Verify the edge snaps to the other building's left edge at ~0.5m distance.

- [ ] **Step 4: Commit**

```bash
git add src/lib/snap.ts src/components/schematic/SchematicView.tsx
git commit -m "feat: add edge snapping during drag-to-resize"
```

---

### Task 8: Handle Muur Resize Edge Cases

**Files:**
- Modify: `src/components/schematic/SchematicView.tsx`

Standalone walls (muur) have an oriented bounding box — when vertical, width and depth swap visually. The resize handles need to resize the correct dimension.

- [ ] **Step 1: Update resize handler for muur orientation**

In the resize handler (from Task 6 Step 3), add muur-specific logic. For a vertical muur:
- "top"/"bottom" handles change `width` (the wall length, stored in `dimensions.width`)
- "left"/"right" shouldn't exist (only 2 handles rendered)

For a horizontal muur:
- "left"/"right" handles change `width`
- "top"/"bottom" shouldn't exist (only 2 handles rendered)

The existing resize logic already handles "left"/"right" changing width and "top"/"bottom" changing depth. For a vertical muur where "top"/"bottom" should change `width` instead of `depth`, add a mapping:

After getting the building in the resize handler, add:

```typescript
      const isMuur = building.type === 'muur';
      const isVertMuur = isMuur && building.orientation === 'vertical';

      // For vertical muur, top/bottom edges control width (wall length), not depth
      if (isVertMuur) {
        if (edge === 'bottom') {
          let candidateBottom = wz;
          const visualDepth = startDims.width; // wall length = visual depth when vertical
          candidateBottom = snapEdge(candidateBottom, 'z', 'back', startPos[0], startPos[0] + startDims.depth, others);
          const newLen = Math.max(constraints.width.min, Math.min(constraints.width.max, candidateBottom - startPos[1]));
          updateBuildingDimensions(buildingId, { width: newLen });
          return;
        } else if (edge === 'top') {
          let candidateTop = wz;
          candidateTop = snapEdge(candidateTop, 'z', 'front', startPos[0], startPos[0] + startDims.depth, others);
          const bottomEdge = startPos[1] + startDims.width; // visual bottom = pos + wall length
          const newLen = Math.max(constraints.width.min, Math.min(constraints.width.max, bottomEdge - candidateTop));
          updateBuildingDimensions(buildingId, { width: newLen });
          updateBuildingPosition(buildingId, [startPos[0], bottomEdge - newLen]);
          return;
        }
      }
```

Add this block right after the constraints lookup and before the normal resize logic.

- [ ] **Step 2: Verify muur resize**

Run `pnpm dev`. Add a horizontal wall, resize by dragging endpoints. Verify width changes. Double-click to make vertical, verify endpoints now resize vertically.

- [ ] **Step 3: Commit**

```bash
git add src/components/schematic/SchematicView.tsx
git commit -m "fix: handle muur orientation in drag-to-resize"
```

---

### Task 9: Final Verification & Cleanup

**Files:**
- All modified files

- [ ] **Step 1: Full regression test**

Run `pnpm dev` and verify all these scenarios:

1. **Building creation:** Add overkapping, berging, paal, muur from sidebar catalog
2. **Slider resize:** Width, depth, height sliders work. Verify left/top edge stays fixed (building grows right/down)
3. **Drag-to-move:** Drag buildings in 2D schematic. Snap still works
4. **Drag-to-resize:** Select building, drag edge handles. All 4 edges work. Opposite edge stays fixed
5. **Resize snap:** Drag edge near another building — snaps at 0.5m
6. **Muur resize:** Horizontal and vertical walls resize correctly from endpoints
7. **Dimension clamping:** Can't resize past min/max. Width max 6m, depth max 40m
8. **3D view:** Buildings render at correct positions. Selection outline correct
9. **Split view:** Both views show consistent state
10. **Config codes:** Save config, reload page, paste code — positions restore correctly

- [ ] **Step 2: Check TypeScript compilation**

Run: `pnpm build`
Expected: No TypeScript errors.

- [ ] **Step 3: Commit any fixes**

If any issues found, fix and commit with descriptive message.
