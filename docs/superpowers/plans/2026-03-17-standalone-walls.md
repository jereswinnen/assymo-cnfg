# Standalone Walls Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add standalone walls (`'muur'`) as draggable canvas entities with height inheritance, full wall configuration, snapping, and pricing.

**Architecture:** New `'muur'` building type following the existing pole pattern. A `defaultHeight` + `heightOverride` system replaces direct `dimensions.height` reads. Walls are axis-aligned with an `orientation` field, rendered in both 2D schematic and 3D canvas views.

**Tech Stack:** Next.js 16, React 19, Zustand 5, Three.js / R3F, SVG schematic rendering, TypeScript

---

## Chunk 1: Data Model & Height Inheritance

### Task 1: Update Type Definitions

**Files:**
- Modify: `src/types/building.ts:1` (BuildingType union)
- Modify: `src/types/building.ts:69-77` (BuildingEntity interface)

- [ ] **Step 1: Add `'muur'` to BuildingType and new fields to BuildingEntity**

```typescript
// src/types/building.ts line 1 — update the union:
export type BuildingType = 'overkapping' | 'berging' | 'paal' | 'muur';

// src/types/building.ts — add orientation type:
export type Orientation = 'horizontal' | 'vertical';

// src/types/building.ts lines 69-77 — update BuildingEntity:
export interface BuildingEntity {
  id: string;
  type: BuildingType;
  position: [number, number];
  dimensions: BuildingDimensions;
  walls: Record<string, WallConfig>;
  hasCornerBraces: boolean;
  floor: FloorConfig;
  orientation: Orientation;
  heightOverride: number | null;
}
```

- [ ] **Step 2: Verify TypeScript catches all exhaustive switches**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: Compile errors in `constants.ts` for `getDefaultWalls` and `getAvailableWallIds` exhaustive switches, and possibly in other files that don't set `orientation`/`heightOverride`. This confirms the type change propagated correctly.

- [ ] **Step 3: Commit**

```bash
git add src/types/building.ts
git commit -m "feat: add 'muur' to BuildingType, add orientation and heightOverride fields"
```

### Task 2: Update Constants

**Files:**
- Modify: `src/lib/constants.ts:122-156` (getDefaultWalls, getAvailableWallIds)
- Modify: `src/lib/constants.ts:182-187` (add WALL_DIMENSIONS after POLE_DIMENSIONS)

- [ ] **Step 1: Add WALL_DIMENSIONS constant**

Add after `POLE_DIMENSIONS` (line 187):

```typescript
// Standalone wall dimensions
export const WALL_DIMENSIONS: BuildingDimensions = {
  width: POST_SPACING, // 3m
  depth: POST_SIZE,    // 0.15m
  height: 3,
};
```

- [ ] **Step 2: Add `'muur'` cases to exhaustive switches**

In `getDefaultWalls` (line 122), add before the `default` case:
```typescript
    case 'muur':
      return {
        front: { ...DEFAULT_WALL },
      };
```

In `getAvailableWallIds` (line 143), add before the `default` case:
```typescript
    case 'muur':
      return ['front'];
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat: add WALL_DIMENSIONS and muur cases to wall helpers"
```

### Task 3: Update Store — Height Inheritance & Muur Creation

**Files:**
- Modify: `src/store/useConfigStore.ts`

- [ ] **Step 1: Add `getEffectiveHeight` helper**

Add at the top of the file, after imports:

```typescript
import { WALL_DIMENSIONS } from '@/lib/constants';
import type { Orientation } from '@/types/building';

/** Derive effective height from override or global default */
export function getEffectiveHeight(building: BuildingEntity, defaultHeight: number): number {
  return building.heightOverride ?? defaultHeight;
}
```

- [ ] **Step 2: Add `defaultHeight` to state interface and initial state**

Add to `ConfigState` interface:
```typescript
  defaultHeight: number;
  setDefaultHeight: (height: number) => void;
  setHeightOverride: (id: string, override: number | null) => void;
  setOrientation: (id: string, orientation: Orientation) => void;
```

Add to the store creation (after `cameraTargetWallId: null`):
```typescript
  defaultHeight: 3,
```

- [ ] **Step 3: Update `createBuilding` to include new fields and handle `'muur'`**

```typescript
function createBuilding(type: BuildingType, position: [number, number]): BuildingEntity {
  const dimensions = type === 'paal'
    ? { ...POLE_DIMENSIONS }
    : type === 'muur'
    ? { ...WALL_DIMENSIONS }
    : { ...DEFAULT_DIMENSIONS };

  return {
    id: crypto.randomUUID(),
    type,
    position,
    dimensions,
    walls: getDefaultWalls(type),
    hasCornerBraces: type === 'overkapping',
    floor: { ...DEFAULT_FLOOR },
    orientation: 'horizontal',
    heightOverride: null,
  };
}
```

- [ ] **Step 4: Add new store actions**

```typescript
  setDefaultHeight: (height) => set({ defaultHeight: height }),

  setHeightOverride: (id, override) =>
    set((state) => ({
      buildings: state.buildings.map(b =>
        b.id === id ? { ...b, heightOverride: override } : b,
      ),
    })),

  setOrientation: (id, orientation) =>
    set((state) => ({
      buildings: state.buildings.map(b =>
        b.id === id ? { ...b, orientation } : b,
      ),
    })),
```

- [ ] **Step 5: Update `removeBuilding` guard to exclude muur**

Change line 120 from:
```typescript
      const nonPoleCount = state.buildings.filter(b => b.type !== 'paal').length;
```
to:
```typescript
      const structuralCount = state.buildings.filter(b => b.type !== 'paal' && b.type !== 'muur').length;
```

And line 122 from:
```typescript
      if (target.type !== 'paal' && nonPoleCount <= 1) return state;
```
to:
```typescript
      if (target.type !== 'paal' && target.type !== 'muur' && structuralCount <= 1) return state;
```

- [ ] **Step 6: Update `resetConfig` to include `defaultHeight`**

Add `defaultHeight: 3` to the `set()` call in `resetConfig`.

- [ ] **Step 7: Update `loadState` to handle migration**

```typescript
  loadState: (buildings, connections, roof) => {
    // Migration: add orientation and heightOverride for legacy configs
    const migrated = buildings.map(b => ({
      ...b,
      orientation: (b as any).orientation ?? 'horizontal' as Orientation,
      heightOverride: (b as any).heightOverride ?? null,
    }));
    // Derive defaultHeight from first structural building
    const structural = migrated.find(b => b.type !== 'paal' && b.type !== 'muur');
    const defaultHeight = structural?.dimensions.height ?? 3;

    set({
      buildings: migrated,
      connections,
      roof,
      defaultHeight,
      selectedBuildingId: migrated[0]?.id ?? null,
      selectedElement: null,
      activeAccordionSection: 1,
    });
  },
```

- [ ] **Step 8: Verify the app compiles**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: Errors in components that read `dimensions.height` but don't yet use `getEffectiveHeight`. That's expected — we'll fix those in later tasks.

- [ ] **Step 9: Commit**

```bash
git add src/store/useConfigStore.ts
git commit -m "feat: add defaultHeight, heightOverride, orientation to store with muur support"
```

### Task 4: Add i18n Strings

**Files:**
- Modify: `src/lib/i18n.ts`

- [ ] **Step 1: Add all muur-related translation strings**

Add to the `nl` object:

```typescript
  // Building types — muur
  'buildingType.muur': 'Muur',
  'building.add.muur': 'Muur toevoegen',
  'building.name.muur': 'Muur',

  // Dimensions — orientation
  'dim.orientation': 'Oriëntatie',
  'dim.orientation.horizontal': 'Horizontaal',
  'dim.orientation.vertical': 'Verticaal',

  // Height
  'dim.height.default': 'Standaard',
  'dim.height.override': 'Aangepast',
  'dim.height.reset': 'Reset naar standaard',

  // Quote
  'quote.wall': 'Muur',

  // Walls section
  'walls.disabled.muur': 'Configureer de wand hieronder',
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/i18n.ts
git commit -m "feat: add Dutch translations for muur entity and height inheritance"
```

---

## Chunk 2: Pricing & Snapping

### Task 5: Update Pricing for Height Inheritance and Muur

**Files:**
- Modify: `src/lib/pricing.ts`

- [ ] **Step 1: Update `wallGrossArea` to accept effective height**

Change the function signature and body:

```typescript
export function wallGrossArea(wallId: WallId, building: BuildingEntity, effectiveHeight: number): number {
  const wallLength = getWallLength(wallId, building.dimensions);
  return wallLength * effectiveHeight;
}

export function wallNetArea(wallId: WallId, building: BuildingEntity, wallCfg: WallConfig, effectiveHeight: number): number {
  let area = wallGrossArea(wallId, building, effectiveHeight);
  if (wallCfg.hasDoor) {
    const doorW = wallCfg.doorSize === 'dubbel' ? DOUBLE_DOOR_W : DOOR_AREA_CUTOUT / 2.1;
    area -= doorW * 2.1;
  }
  if (wallCfg.hasWindow) area -= WINDOW_AREA_CUTOUT * wallCfg.windowCount;
  return Math.max(0, area);
}
```

- [ ] **Step 2: Update `wallLineItem` to pass effective height**

Change the function signature:

```typescript
function wallLineItem(wallId: WallId, building: BuildingEntity, effectiveHeight: number): LineItem {
  const wallCfg = building.walls[wallId];
  if (!wallCfg) {
    return { label: t(WALL_LABELS[wallId] ?? wallId), area: 0, materialCost: 0, insulationCost: 0, extrasCost: 0, total: 0 };
  }
  const area = wallNetArea(wallId, building, wallCfg, effectiveHeight);
  // ... rest unchanged
```

- [ ] **Step 3: Update `calculateBuildingQuote` to accept `defaultHeight` and handle muur**

```typescript
export function calculateBuildingQuote(building: BuildingEntity, roof: RoofConfig, defaultHeight: number): {
  lineItems: LineItem[];
  total: number;
} {
  const effectiveHeight = building.heightOverride ?? defaultHeight;

  // Pole: single post price
  if (building.type === 'paal') {
    const item: LineItem = {
      label: t('quote.pole'),
      area: 0,
      materialCost: POST_PRICE,
      insulationCost: 0,
      extrasCost: 0,
      total: POST_PRICE,
    };
    return { lineItems: [item], total: POST_PRICE };
  }

  // Muur: wall material + extras only (no roof, floor, posts)
  if (building.type === 'muur') {
    const lineItems: LineItem[] = [];
    const wallIds = Object.keys(building.walls) as WallId[];
    for (const id of wallIds) {
      const item = wallLineItem(id, building, effectiveHeight);
      if (item.total > 0) lineItems.push(item);
    }
    const total = lineItems.reduce((sum, item) => sum + item.total, 0);
    return { lineItems, total };
  }

  const lineItems: LineItem[] = [];

  const posts = postLineItem(building);
  if (posts) lineItems.push(posts);

  const braces = braceLineItem(building);
  if (braces) lineItems.push(braces);

  const wallIds = Object.keys(building.walls) as WallId[];
  for (const id of wallIds) {
    const item = wallLineItem(id, building, effectiveHeight);
    if (item.total > 0) lineItems.push(item);
  }

  const floor = floorLineItem(building);
  if (floor) lineItems.push(floor);

  lineItems.push(roofLineItem(building, roof));

  const total = lineItems.reduce((sum, item) => sum + item.total, 0);
  return { lineItems, total };
}
```

- [ ] **Step 4: Update `calculateTotalQuote` to pass defaultHeight**

```typescript
export function calculateTotalQuote(buildings: BuildingEntity[], roof: RoofConfig, defaultHeight: number): {
  lineItems: LineItem[];
  total: number;
} {
  const lineItems: LineItem[] = [];
  for (const building of buildings) {
    const { lineItems: items } = calculateBuildingQuote(building, roof, defaultHeight);
    lineItems.push(...items);
  }
  const total = lineItems.reduce((sum, item) => sum + item.total, 0);
  return { lineItems, total };
}
```

- [ ] **Step 5: Update all callers of `calculateBuildingQuote` and `calculateTotalQuote`**

Search for callers and pass `defaultHeight` from the store. The main caller is `QuoteSummary.tsx`.

- [ ] **Step 6: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: Remaining errors should be in rendering components (Building.tsx, DimensionsControl.tsx), not pricing.

- [ ] **Step 7: Commit**

```bash
git add src/lib/pricing.ts src/components/ui/QuoteSummary.tsx
git commit -m "feat: update pricing for height inheritance and muur short-circuit"
```

### Task 6: Add `detectWallSnap` to Snap System

**Files:**
- Modify: `src/lib/snap.ts`

- [ ] **Step 1: Add `detectWallSnap` function**

Add after `detectPoleSnap`:

```typescript
/** Snap a standalone wall to building edges, poles, and other wall endpoints.
 *  Pass 1: edge slide (long edge along building edges).
 *  Pass 2: endpoint detent (short ends snap to corners/poles/wall ends). */
export function detectWallSnap(
  wallPos: [number, number],
  wallWidth: number,
  orientation: 'horizontal' | 'vertical',
  buildings: BuildingEntity[],
): [number, number] {
  const [wx, wz] = wallPos;
  let bestDist = SNAP_THRESHOLD;
  let snapX = wx;
  let snapZ = wz;

  // Half-dimensions of the wall entity based on orientation
  const halfLong = wallWidth / 2;
  const halfShort = POST_SIZE / 2;

  // Pass 1: edge slide — wall's long edge slides along building edges
  for (const b of buildings) {
    if (b.type === 'paal' || b.type === 'muur') continue;

    const [cx, cz] = b.position;
    const hw = b.dimensions.width / 2;
    const hd = b.dimensions.depth / 2;

    if (orientation === 'horizontal') {
      // Wall runs along X — snap Z to top/bottom edges of buildings
      const edges = [
        { z: cz - hd, xMin: cx - hw, xMax: cx + hw }, // front edge
        { z: cz + hd, xMin: cx - hw, xMax: cx + hw }, // back edge
      ];
      for (const e of edges) {
        const dist = Math.abs(wz - e.z);
        // Check overlap: wall X range overlaps building X range
        const wallLeft = wx - halfLong;
        const wallRight = wx + halfLong;
        if (dist < bestDist && wallRight > e.xMin - SNAP_THRESHOLD && wallLeft < e.xMax + SNAP_THRESHOLD) {
          bestDist = dist;
          snapZ = e.z;
          snapX = wx; // keep X, only snap Z
        }
      }
    } else {
      // Wall runs along Z — snap X to left/right edges of buildings
      const edges = [
        { x: cx - hw, zMin: cz - hd, zMax: cz + hd }, // left edge
        { x: cx + hw, zMin: cz - hd, zMax: cz + hd }, // right edge
      ];
      for (const e of edges) {
        const dist = Math.abs(wx - e.x);
        const wallTop = wz - halfLong;
        const wallBottom = wz + halfLong;
        if (dist < bestDist && wallBottom > e.zMin - SNAP_THRESHOLD && wallTop < e.zMax + SNAP_THRESHOLD) {
          bestDist = dist;
          snapX = e.x;
          snapZ = wz;
        }
      }
    }
  }

  // Pass 2: endpoint detent — wall endpoints snap to corners, poles, other wall endpoints
  const wallEndpoints: [number, number][] = orientation === 'horizontal'
    ? [[snapX - halfLong, snapZ], [snapX + halfLong, snapZ]]
    : [[snapX, snapZ - halfLong], [snapX, snapZ + halfLong]];

  let detentDist = POLE_DETENT_THRESHOLD;
  let detentDx = 0;
  let detentDz = 0;
  let detentFound = false;

  // Collect all target points
  const targets: [number, number][] = [];

  for (const b of buildings) {
    if (b.type === 'paal') {
      targets.push([...b.position]);
      continue;
    }
    if (b.type === 'muur') {
      // Other wall endpoints
      const oHalfLong = b.dimensions.width / 2;
      if (b.orientation === 'horizontal') {
        targets.push([b.position[0] - oHalfLong, b.position[1]]);
        targets.push([b.position[0] + oHalfLong, b.position[1]]);
      } else {
        targets.push([b.position[0], b.position[1] - oHalfLong]);
        targets.push([b.position[0], b.position[1] + oHalfLong]);
      }
      continue;
    }
    // Building corners
    const [cx, cz] = b.position;
    const hw = b.dimensions.width / 2;
    const hd = b.dimensions.depth / 2;
    targets.push(
      [cx - hw, cz - hd], [cx + hw, cz - hd],
      [cx - hw, cz + hd], [cx + hw, cz + hd],
    );
  }

  for (const ep of wallEndpoints) {
    for (const [tx, tz] of targets) {
      const d = Math.hypot(ep[0] - tx, ep[1] - tz);
      if (d < detentDist) {
        detentDist = d;
        detentDx = tx - ep[0];
        detentDz = tz - ep[1];
        detentFound = true;
      }
    }
  }

  if (detentFound) {
    snapX += detentDx;
    snapZ += detentDz;
  }

  return [snapX, snapZ];
}
```

- [ ] **Step 2: Export `POLE_DETENT_THRESHOLD` (currently local const)**

Change line 6 from:
```typescript
const POLE_DETENT_THRESHOLD = 0.35;
```
to (or keep it local if `detectWallSnap` is in the same file — it is, so no change needed).

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -40`

- [ ] **Step 4: Commit**

```bash
git add src/lib/snap.ts
git commit -m "feat: add detectWallSnap for standalone wall snapping"
```

---

## Chunk 3: UI — BuildingManager, Dimensions, Walls Panel

### Task 7: Update BuildingManager — Add Muur Button

**Files:**
- Modify: `src/components/ui/BuildingManager.tsx`

- [ ] **Step 1: Add muur icon to `BuildingIcon` component**

Add a new case in the `BuildingIcon` function (after the paal case, before the default berging case):

```typescript
  if (type === 'muur') {
    return (
      <svg viewBox="0 0 48 48" className={cls} fill="none" stroke="currentColor" strokeWidth={2.5}>
        <rect x="6" y="16" width="36" height="3" rx="1" />
        <line x1="6" y1="22" x2="6" y2="36" />
        <line x1="42" y1="22" x2="42" y2="36" />
      </svg>
    );
  }
```

- [ ] **Step 2: Add "+ Muur toevoegen" button to the grid**

Change the grid from `grid-cols-3` to `grid-cols-2` and add the muur button. Update the add buttons section:

```typescript
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => addBuilding('berging')}
          className="rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-all"
        >
          + {t('building.add.berging')}
        </button>
        <button
          onClick={() => addBuilding('overkapping')}
          className="rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-all"
        >
          + {t('building.add.overkapping')}
        </button>
        <button
          onClick={() => addBuilding('muur')}
          className="rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-all"
        >
          + {t('building.add.muur')}
        </button>
        <button
          onClick={() => addBuilding('paal')}
          className="rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-all"
        >
          + {t('building.add.paal')}
        </button>
      </div>
```

- [ ] **Step 3: Update the dimension display in the building list for muur**

Update the dimension display (around line 79) to handle muur:

```typescript
                <span className="block text-[11px] text-muted-foreground tabular-nums">
                  {b.type === 'paal'
                    ? `${b.dimensions.height.toFixed(1)} m`
                    : b.type === 'muur'
                    ? `${b.dimensions.width.toFixed(1)} × ${b.dimensions.height.toFixed(1)} m`
                    : `${b.dimensions.width.toFixed(1)} × ${b.dimensions.depth.toFixed(1)} × ${b.dimensions.height.toFixed(1)} m`
                  }
                </span>
```

- [ ] **Step 4: Update the removable check to include muur**

Update line 85 from:
```typescript
              {(b.type === 'paal' || buildings.filter(x => x.type !== 'paal').length > 1) && (
```
to:
```typescript
              {(b.type === 'paal' || b.type === 'muur' || buildings.filter(x => x.type !== 'paal' && x.type !== 'muur').length > 1) && (
```

- [ ] **Step 5: Update corner braces section to also exclude muur**

Update line 142 from:
```typescript
      {selectedBuilding && selectedBuilding.type !== 'paal' && (
```
to:
```typescript
      {selectedBuilding && selectedBuilding.type !== 'paal' && selectedBuilding.type !== 'muur' && (
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/BuildingManager.tsx
git commit -m "feat: add muur to BuildingManager with icon and add button"
```

### Task 8: Update DimensionsControl — Height Inheritance & Orientation

**Files:**
- Modify: `src/components/ui/DimensionsControl.tsx`

- [ ] **Step 1: Rewrite DimensionsControl to handle muur, height inheritance, and orientation**

```typescript
'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { getEffectiveHeight } from '@/store/useConfigStore';
import { t } from '@/lib/i18n';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Orientation } from '@/types/building';

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  badge?: string;
  onReset?: () => void;
}

function SliderRow({ label, value, min, max, step, unit, onChange, badge, onReset }: SliderRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Label>{label}</Label>
          {badge && (
            <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">
            {value.toFixed(step < 1 ? 1 : 0)} {unit}
          </span>
          {onReset && (
            <button
              onClick={onReset}
              className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
              title={t('dim.height.reset')}
            >
              ↺
            </button>
          )}
        </div>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

export default function DimensionsControl() {
  const selectedBuildingId = useConfigStore((s) => s.selectedBuildingId);
  const building = useConfigStore((s) => {
    if (!s.selectedBuildingId) return null;
    return s.buildings.find(b => b.id === s.selectedBuildingId) ?? null;
  });
  const defaultHeight = useConfigStore((s) => s.defaultHeight);
  const roofType = useConfigStore((s) => s.roof.type);
  const roofPitch = useConfigStore((s) => s.roof.pitch);
  const updateBuildingDimensions = useConfigStore((s) => s.updateBuildingDimensions);
  const updateRoof = useConfigStore((s) => s.updateRoof);
  const setDefaultHeight = useConfigStore((s) => s.setDefaultHeight);
  const setHeightOverride = useConfigStore((s) => s.setHeightOverride);
  const setOrientation = useConfigStore((s) => s.setOrientation);

  if (!building || !selectedBuildingId) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        Selecteer een gebouw
      </div>
    );
  }

  const { dimensions } = building;
  const isPole = building.type === 'paal';
  const isMuur = building.type === 'muur';
  const isStructural = !isPole && !isMuur;
  const effectiveHeight = getEffectiveHeight(building, defaultHeight);
  const hasHeightOverride = building.heightOverride !== null;

  return (
    <div className="space-y-4">
      {/* Width — buildings and walls */}
      {isStructural && (
        <SliderRow
          label={t('dim.width')}
          value={dimensions.width}
          min={3}
          max={15}
          step={0.5}
          unit="m"
          onChange={(v) => updateBuildingDimensions(selectedBuildingId, { width: v })}
        />
      )}
      {isMuur && (
        <SliderRow
          label={t('dim.width')}
          value={dimensions.width}
          min={1}
          max={10}
          step={0.5}
          unit="m"
          onChange={(v) => updateBuildingDimensions(selectedBuildingId, { width: v })}
        />
      )}

      {/* Depth — buildings only */}
      {isStructural && (
        <SliderRow
          label={t('dim.depth')}
          value={dimensions.depth}
          min={3}
          max={20}
          step={0.5}
          unit="m"
          onChange={(v) => updateBuildingDimensions(selectedBuildingId, { depth: v })}
        />
      )}

      {/* Height — all entities */}
      {isStructural ? (
        <SliderRow
          label={t('dim.height')}
          value={effectiveHeight}
          min={2}
          max={6}
          step={0.25}
          unit="m"
          onChange={(v) => setDefaultHeight(v)}
        />
      ) : (
        <SliderRow
          label={t('dim.height')}
          value={effectiveHeight}
          min={2}
          max={6}
          step={0.25}
          unit="m"
          onChange={(v) => setHeightOverride(selectedBuildingId, v)}
          badge={hasHeightOverride ? t('dim.height.override') : t('dim.height.default')}
          onReset={hasHeightOverride ? () => setHeightOverride(selectedBuildingId, null) : undefined}
        />
      )}

      {/* Orientation — walls only */}
      {isMuur && (
        <div className="space-y-2">
          <Label>{t('dim.orientation')}</Label>
          <ToggleGroup
            type="single"
            value={building.orientation}
            onValueChange={(v) => { if (v) setOrientation(selectedBuildingId, v as Orientation); }}
            className="w-full"
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="horizontal" className="flex-1 text-xs">
              {t('dim.orientation.horizontal')}
            </ToggleGroupItem>
            <ToggleGroupItem value="vertical" className="flex-1 text-xs">
              {t('dim.orientation.vertical')}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      {/* Roof pitch — structural buildings only */}
      {isStructural && roofType === 'pitched' && (
        <SliderRow
          label={t('dim.roofPitch')}
          value={roofPitch}
          min={5}
          max={55}
          step={1}
          unit="°"
          onChange={(v) => updateRoof({ pitch: v })}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/DimensionsControl.tsx
git commit -m "feat: rewrite DimensionsControl for height inheritance and wall orientation"
```

### Task 9: Update CapsuleToolbar Walls Panel for Muur

**Files:**
- Modify: `src/components/ui/CapsuleToolbar.tsx:49-65` (WallsContent)
- Modify: `src/components/ui/WallSelector.tsx`

- [ ] **Step 1: Update `WallsContent` in CapsuleToolbar to handle muur**

Add a `MuurWallAutoSelect` helper component and update `WallsContent`. `CapsuleToolbar.tsx` already imports `useEffect` (line 3).

Add this helper component before `WallsContent`:

```typescript
function MuurWallAutoSelect({ buildingId }: { buildingId: string }) {
  const selectElement = useConfigStore((s) => s.selectElement);
  const selectedElement = useConfigStore((s) => s.selectedElement);

  useEffect(() => {
    const isAlreadySelected = selectedElement?.type === 'wall' && selectedElement.buildingId === buildingId;
    if (!isAlreadySelected) {
      selectElement({ type: 'wall', id: 'front', buildingId });
    }
  }, [buildingId, selectElement, selectedElement]);

  return null;
}
```

Replace `WallsContent` with:

```typescript
function WallsContent() {
  const selectedBuilding = useConfigStore((s) => {
    const b = s.buildings.find(b => b.id === s.selectedBuildingId);
    return b ?? null;
  });

  if (selectedBuilding?.type === 'muur') {
    return (
      <div className="space-y-4">
        <MuurWallAutoSelect buildingId={selectedBuilding.id} />
        <SurfaceProperties />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <WallSelector />
      {selectedBuilding && selectedBuilding.type === 'berging' && (
        <>
          <Separator />
          <SurfaceProperties />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update WallSelector to handle muur gracefully**

In `WallSelector.tsx`, the existing code already handles `wallIds.length === 0` with a disabled message. For muur, `getAvailableWallIds('muur')` returns `['front']`, so it would show a single button. Since we auto-select in WallsContent, the WallSelector won't even render for muur. No changes needed.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/CapsuleToolbar.tsx
git commit -m "feat: auto-select front wall for muur in walls panel"
```

---

## Chunk 4: 2D & 3D Rendering

### Task 10: Render Standalone Walls in SchematicView (2D)

**Files:**
- Modify: `src/components/schematic/SchematicView.tsx`

- [ ] **Step 1: Add muur filtering alongside poles**

Update the filter variables (around line 98-99):

```typescript
  const normalBuildings = buildings.filter(b => b.type !== 'paal' && b.type !== 'muur');
  const walls = buildings.filter(b => b.type === 'muur');
  const poles = buildings.filter(b => b.type === 'paal');
```

- [ ] **Step 2: Add wall snap handling in `onPointerMove`**

Import `detectWallSnap` at the top:
```typescript
import { detectSnap, detectPoleSnap, detectWallSnap } from '@/lib/snap';
```

Update the drag handler (around line 175) to add a muur case:

```typescript
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
```

- [ ] **Step 3: Render standalone walls between buildings and poles**

Add after the `normalBuildings.map(...)` closing and before the poles section:

```typescript
          {/* Standalone walls — rendered between buildings and poles */}
          {walls.map((w) => {
            const [ox, oz] = w.position;
            const isHorizontal = w.orientation === 'horizontal';
            const wallW = isHorizontal ? w.dimensions.width : w.dimensions.depth;
            const wallD = isHorizontal ? w.dimensions.depth : w.dimensions.width;
            const hw = wallW / 2;
            const hd = wallD / 2;
            const isSelected = w.id === selectedBuildingId;

            // Wall material color
            const wallCfg = w.walls['front'];
            const materialColor = wallCfg?.materialId === 'brick' ? '#8B4513'
              : wallCfg?.materialId === 'render' ? '#F5F5DC'
              : wallCfg?.materialId === 'metal' ? '#708090'
              : wallCfg?.materialId === 'glass' ? '#B8D4E3'
              : '#c4956a'; // wood default

            return (
              <g key={w.id}>
                <rect
                  x={ox - hw}
                  y={oz - hd}
                  width={wallW}
                  height={wallD}
                  fill={materialColor}
                  stroke={isSelected ? '#3b82f6' : '#666'}
                  strokeWidth={isSelected ? 0.04 : 0.02}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => onBuildingPointerDown(e, w.id)}
                />
              </g>
            );
          })}
```

- [ ] **Step 4: Include muur in bounding box calculation**

The existing bounding box loop already iterates all `buildings`, including muur types, but uses `b.type === 'paal'` for padding. Update to also handle muur orientation for correct bounds:

No change needed — the existing loop correctly uses `b.dimensions.width` and `b.dimensions.depth` for bounds. For a muur, we need to swap them based on orientation. Update the bounding box loop:

```typescript
  for (const b of buildings) {
    const [cx, cz] = b.position;
    const isVertMuur = b.type === 'muur' && b.orientation === 'vertical';
    const bw = isVertMuur ? b.dimensions.depth : b.dimensions.width;
    const bd = isVertMuur ? b.dimensions.width : b.dimensions.depth;
    const hw = bw / 2;
    const hd = bd / 2;
    const pad2 = b.type === 'paal' ? 0.3 : 0;
    minX = Math.min(minX, cx - hw - pad2);
    maxX = Math.max(maxX, cx + hw + pad2);
    minZ = Math.min(minZ, cz - hd - pad2);
    maxZ = Math.max(maxZ, cz + hd + pad2);
  }
```

- [ ] **Step 5: Also exclude muur from building snap `others` filter**

In the drag handler (line 179), update to exclude muur from building-to-building snap:

Already done in step 2 above: `b.type !== 'muur'` added to the filter.

- [ ] **Step 6: Verify the app renders**

Run: `npm run dev` and check the 2D view.

- [ ] **Step 7: Commit**

```bash
git add src/components/schematic/SchematicView.tsx
git commit -m "feat: render and drag standalone walls in 2D schematic view"
```

### Task 11: Render Standalone Walls in 3D Canvas

**Files:**
- Modify: `src/components/canvas/Building.tsx`

- [ ] **Step 1: Add muur rendering case**

Import `getEffectiveHeight` at the top of `Building.tsx`:

```typescript
import { useConfigStore } from '@/store/useConfigStore';
import { getEffectiveHeight } from '@/store/useConfigStore';
```

Add a `defaultHeight` selector at the top of the `Building` component, **unconditionally** (React hooks must not be called inside conditionals):

```typescript
export default function Building() {
  const buildingId = useBuildingId();
  const building = useConfigStore((s) => s.buildings.find(b => b.id === buildingId));
  const defaultHeight = useConfigStore((s) => s.defaultHeight);
  const clearSelection = useConfigStore((s) => s.clearSelection);

  if (!building) return null;
```

Then add the muur case after the paal return block and before the main building return:

```typescript
  if (building.type === 'muur') {
    const h = getEffectiveHeight(building, defaultHeight);
    const wallCfg = building.walls['front'];
    const isVertical = building.orientation === 'vertical';

    return (
      <group rotation={isVertical ? [0, Math.PI / 2, 0] : [0, 0, 0]}>
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[building.dimensions.width, h, POST_SIZE]} />
          <meshStandardMaterial
            color={wallCfg?.materialId === 'glass' ? '#B8D4E3' : wallCfg?.materialId === 'brick' ? '#8B4513' : wallCfg?.materialId === 'render' ? '#F5F5DC' : wallCfg?.materialId === 'metal' ? '#708090' : '#8B6914'}
            transparent={wallCfg?.materialId === 'glass'}
            opacity={wallCfg?.materialId === 'glass' ? 0.4 : 1}
            side={2} // DoubleSide
          />
        </mesh>
      </group>
    );
  }
```

Also update the paal case to use height inheritance:

```typescript
  if (building.type === 'paal') {
    const h = getEffectiveHeight(building, defaultHeight);
    // ... rest unchanged but use h instead of building.dimensions.height
  }
```

Note: This is a simplified version. For full material/door/window rendering, integrate with the existing `Wall.tsx` component. This can be enhanced in a follow-up task.

- [ ] **Step 2: Update `BuildingInstance.tsx` for muur and height inheritance**

In `src/components/canvas/BuildingInstance.tsx`:

1. Import `getEffectiveHeight`:
```typescript
import { useConfigStore, getEffectiveHeight } from '@/store/useConfigStore';
```

2. Add `defaultHeight` selector (line 14 area):
```typescript
  const defaultHeight = useConfigStore((s) => s.defaultHeight);
```

3. Update the `SelectionOutline` height prop (line 40) to use effective height:
```typescript
            height={getEffectiveHeight(building, defaultHeight)}
```

4. Update the `isPole` prop to also handle muur (line 41):
```typescript
            isPole={building.type === 'paal'}
```

Muur uses the default 0.1m margin (same as buildings), which is already the non-pole case. No changes needed to `SelectionOutline` itself.

5. For muur with orientation, the `width` and `depth` passed to `SelectionOutline` should account for orientation. Update:
```typescript
        {isSelected && (
          <SelectionOutline
            width={building.type === 'muur' && building.orientation === 'vertical' ? building.dimensions.depth : building.dimensions.width}
            depth={building.type === 'muur' && building.orientation === 'vertical' ? building.dimensions.width : building.dimensions.depth}
            height={getEffectiveHeight(building, defaultHeight)}
            isPole={building.type === 'paal'}
          />
        )}
```

Note: The Building component handles rotation via a `<group rotation={...}>`, but the selection outline is a sibling, so it needs the swapped dimensions for vertical walls.

- [ ] **Step 3: Commit**

```bash
git add src/components/canvas/Building.tsx src/components/canvas/BuildingInstance.tsx
git commit -m "feat: render standalone walls in 3D canvas with material colors"
```

---

## Chunk 5: Height Inheritance Propagation & Final Integration

### Task 12: Update All `dimensions.height` Reads to Use `getEffectiveHeight`

**Files:**
- Modify: Various files that read `building.dimensions.height`

- [ ] **Step 1: Search for all `dimensions.height` reads**

Run: `grep -rn "dimensions\.height" src/ --include="*.tsx" --include="*.ts"`

Update each occurrence to use `getEffectiveHeight(building, defaultHeight)` where appropriate. Key files:

- `BuildingManager.tsx` — display height in the building list item
- `Building.tsx` — 3D rendering (paal uses `building.dimensions.height`)
- `TimberFrame.tsx` — timber frame rendering
- `BergingSection.tsx` — wall section heights
- `Wall.tsx` — wall mesh height
- `Roof.tsx` — roof height offset
- `Floor.tsx` — may reference height
- Any other canvas components

For each file: import `getEffectiveHeight` from the store, get `defaultHeight` from the store, and replace `building.dimensions.height` (or `dimensions.height`) with the effective height.

- [ ] **Step 2: Update BuildingManager dimension display**

Replace line 80's height display to use effective height:

```typescript
// At the top of the component:
const defaultHeight = useConfigStore((s) => s.defaultHeight);

// In the dimension display:
const effectiveH = (b.heightOverride ?? defaultHeight);
// Use effectiveH instead of b.dimensions.height
```

- [ ] **Step 3: Verify compilation and test**

Run: `npx tsc --noEmit`
Expected: No errors.

Run: `npm run dev` and verify:
1. Changing building height updates all non-overridden entities
2. Setting a height override on a pole/wall persists
3. Resetting override makes it follow the default again

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: propagate height inheritance to all dimension.height readers"
```

### Task 13: Update Config Code (Encode/Decode) for Muur & Height Inheritance

**Files:**
- Modify: `src/lib/configCode.ts`

This is critical — without this, the configuration code export/import feature breaks.

- [ ] **Step 1: Bump version and update lookup tables**

Update line 140 and version:
```typescript
const VERSION = 4; // was 3
const BUILDING_TYPES: BuildingType[] = ['overkapping', 'berging', 'paal', 'muur'];
```

Note: The type index uses 2 bits (values 0-3), which fits all 4 types exactly.

- [ ] **Step 2: Update `encodeState` to handle muur, orientation, heightOverride, defaultHeight**

The function signature needs `defaultHeight`:
```typescript
export function encodeState(
  buildings: BuildingEntity[],
  connections: SnapConnection[],
  roof: RoofConfig,
  defaultHeight: number,
): string {
```

After the roof encoding and before building count, add:
```typescript
  // Default height (v4+)
  w.write(clamp(Math.round((defaultHeight - 2) / 0.25), 0, 16), 5);
```

Update the per-building encoding. Replace the existing loop body with:
```typescript
  for (const b of buildings) {
    w.write(indexOf(BUILDING_TYPES, b.type), 2);

    // Height override flag + value (v4+)
    const hasOverride = b.heightOverride !== null;
    w.write(hasOverride ? 1 : 0, 1);
    if (hasOverride) {
      w.write(clamp(Math.round((b.heightOverride! - 2) / 0.25), 0, 16), 5);
    }

    if (b.type === 'paal') {
      // Poles: position only (height comes from override or default)
      w.writeSigned(clamp(Math.round(b.position[0] / 0.5), -64, 63), 7);
      w.writeSigned(clamp(Math.round(b.position[1] / 0.5), -64, 63), 7);
    } else if (b.type === 'muur') {
      // Wall: width, position, orientation
      w.write(clamp(Math.round((b.dimensions.width - 1) / 0.5), 0, 18), 5);
      w.writeSigned(clamp(Math.round(b.position[0] / 0.5), -64, 63), 7);
      w.writeSigned(clamp(Math.round(b.position[1] / 0.5), -64, 63), 7);
      w.write(b.orientation === 'vertical' ? 1 : 0, 1);

      // Wall config (single 'front' wall)
      const wallCfg = b.walls['front'];
      if (wallCfg) {
        w.write(1, 1); // has wall
        encodeWall(w, wallCfg);
      } else {
        w.write(0, 1);
      }
    } else {
      // Normal building (berging/overkapping): existing encoding
      w.write(clamp(Math.round((b.dimensions.width - 3) / 0.5), 0, 24), 5);
      w.write(clamp(Math.round((b.dimensions.depth - 3) / 0.5), 0, 34), 6);
      // Note: height is now from override or default, not dimensions.height
      // We still need to encode the building's width/depth/position

      w.writeSigned(clamp(Math.round(b.position[0] / 0.5), -64, 63), 7);
      w.writeSigned(clamp(Math.round(b.position[1] / 0.5), -64, 63), 7);

      w.write(indexOf(FLOOR_IDS, b.floor.materialId), 2);
      w.write(b.hasCornerBraces ? 1 : 0, 1);

      let mask = 0;
      for (let i = 0; i < WALL_SLOTS.length; i++) {
        if (b.walls[WALL_SLOTS[i]]) mask |= 1 << i;
      }
      w.write(mask, 4);
      for (let i = 0; i < WALL_SLOTS.length; i++) {
        if (!(mask & (1 << i))) continue;
        encodeWall(w, b.walls[WALL_SLOTS[i]]);
      }
    }
  }
```

- [ ] **Step 3: Update `decodeState` to handle v4 format**

Add `defaultHeight` to the return type:
```typescript
export function decodeState(code: string): {
  buildings: BuildingEntity[];
  connections: SnapConnection[];
  roof: RoofConfig;
  defaultHeight: number;
}
```

After roof decoding, for v4:
```typescript
  const isV4 = version === 4;
  let defaultHeight = 3;
  if (isV4) {
    defaultHeight = clamp(r.read(5) * 0.25 + 2, 2, 6);
  }
```

Update the building decode loop for v4. For each building, read height override:
```typescript
    // v4: height override
    let heightOverride: number | null = null;
    if (isV4) {
      const hasOverride = r.read(1) === 1;
      if (hasOverride) {
        heightOverride = clamp(r.read(5) * 0.25 + 2, 2, 6);
      }
    }
```

Add muur decoding branch (for v4):
```typescript
    if (isV4 && type === 'muur') {
      const width = clamp(r.read(5) * 0.5 + 1, 1, 10);
      const posX = r.readSigned(7) * 0.5;
      const posZ = r.readSigned(7) * 0.5;
      const orientation = r.read(1) === 1 ? 'vertical' : 'horizontal';
      const hasWall = r.read(1) === 1;
      const walls: Record<string, WallConfig> = {};
      if (hasWall) {
        walls['front'] = decodeWall(r);
      }
      buildings.push({
        id: crypto.randomUUID(),
        type: 'muur',
        position: [posX, posZ],
        dimensions: { width, depth: 0.15, height: defaultHeight },
        walls: Object.keys(walls).length > 0 ? walls : getDefaultWalls('muur'),
        hasCornerBraces: false,
        floor: { materialId: 'geen' },
        orientation,
        heightOverride,
      });
      continue;
    }
```

For paal and normal building decode, add `orientation: 'horizontal'` and `heightOverride` to the pushed entity.

Add backward compatibility: v2/v3 decoded buildings get `orientation: 'horizontal'` and `heightOverride: null`.

Return `defaultHeight` in the result.

- [ ] **Step 4: Update all callers of `encodeState` and `decodeState`**

**Callers of `encodeState`:**
- `src/components/schematic/exportFloorPlan.ts:90` — pass `defaultHeight`
- `src/components/ui/ConfigCodeDialog.tsx` — pass `defaultHeight` from store

**Callers of `decodeState`:**
- `src/components/ui/ConfigCodeDialog.tsx` — extract `defaultHeight` from result and pass to `loadState`

Update `loadState` signature if needed to accept `defaultHeight`, or set it separately after loading.

- [ ] **Step 5: Commit**

```bash
git add src/lib/configCode.ts src/components/schematic/exportFloorPlan.ts src/components/ui/ConfigCodeDialog.tsx
git commit -m "feat: update config code encode/decode for muur, orientation, heightOverride, defaultHeight (v4)"
```

### Task 14: Update exportFloorPlan for Muur and Height Inheritance

**Files:**
- Modify: `src/components/schematic/exportFloorPlan.ts`

- [ ] **Step 1: Update `buildSpecRows` to handle muur and use effective height**

The function needs `defaultHeight` parameter:
```typescript
function buildSpecRows(buildings: BuildingEntity[], roof: RoofConfig, defaultHeight: number): string {
```

Update line 43 to use effective height:
```typescript
    const effectiveH = b.heightOverride ?? defaultHeight;
    rows.push(row(t('dim.height'), `${effectiveH.toFixed(1)} m`));
```

For muur entities, skip the depth row and add orientation:
```typescript
    if (b.type === 'muur') {
      rows.push(row(t('dim.width'), `${b.dimensions.width.toFixed(1)} m`));
      rows.push(row(t('dim.height'), `${effectiveH.toFixed(1)} m`));
      rows.push(row(t('dim.orientation'), t(`dim.orientation.${b.orientation}`)));
    } else if (b.type !== 'paal') {
      rows.push(row(t('dim.width'), `${b.dimensions.width.toFixed(1)} m`));
      rows.push(row(t('dim.depth'), `${b.dimensions.depth.toFixed(1)} m`));
      rows.push(row(t('dim.height'), `${effectiveH.toFixed(1)} m`));
    } else {
      rows.push(row(t('dim.height'), `${effectiveH.toFixed(1)} m`));
    }
```

- [ ] **Step 2: Update `calculateTotalQuote` call to pass `defaultHeight`**

Line 74:
```typescript
  const { lineItems, total } = calculateTotalQuote(buildings, roof, defaultHeight);
```

- [ ] **Step 3: Update `exportFloorPlan` signature and `encodeState` call**

```typescript
export function exportFloorPlan(buildings: BuildingEntity[], connections: SnapConnection[], roof: RoofConfig, defaultHeight: number) {
  // ...
  const specRows = buildSpecRows(buildings, roof, defaultHeight);
  const configCode = encodeState(buildings, connections, roof, defaultHeight);
  // ...
}
```

Update the caller of `exportFloorPlan` (likely in the main page or a button component) to pass `defaultHeight`.

- [ ] **Step 4: Commit**

```bash
git add src/components/schematic/exportFloorPlan.ts
git commit -m "feat: update floor plan export for muur and height inheritance"
```

### Task 15: Final Integration Testing & Cleanup

- [ ] **Step 1: Manual testing checklist**

Test the following in the browser:
1. Add a muur from BuildingManager → appears in 2D and 3D
2. Drag muur in 2D → snaps to building edges
3. Toggle orientation → wall rotates in both views
4. Change wall width → updates in both views
5. Open Wanden panel with muur selected → shows material/door/window config
6. Change wall material → updates visual in 2D and 3D
7. Change building height → muur and pole heights follow
8. Override muur height → stays independent
9. Reset muur height → follows building again
10. Remove muur → works without restriction
11. Quote includes muur pricing
12. Reset config → clean state
13. Export/import config code → muur persists

- [ ] **Step 2: Fix any issues found**

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: standalone walls (muren) - complete implementation"
```
