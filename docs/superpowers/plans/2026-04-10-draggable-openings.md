# Draggable Door & Window Positioning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace discrete door position toggles and auto-distributed windows with free-form dragging on the 2D schematic plan.

**Architecture:** Change `doorPosition` from enum to 0–1 fraction, replace `hasWindow`/`windowCount` with a `windows: WallWindow[]` array. Add a `resolveOpeningPositions()` function that converts fractions to meters. Add drag handlers to `SchematicOpenings` SVG elements, following the existing building-drag pattern in `SchematicView`.

**Tech Stack:** React, Zustand (with zundo temporal), SVG pointer events, Three.js (unchanged, just receives new positions)

**Spec:** `docs/superpowers/specs/2026-04-10-draggable-openings-design.md`

---

### Task 1: Update Types & Constants

**Files:**
- Modify: `src/types/building.ts`
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Update type definitions**

In `src/types/building.ts`, remove the `DoorPosition` type and add `WallWindow`. Change `WallConfig` to use numeric position and windows array:

```typescript
// REMOVE this line (line 25):
// export type DoorPosition = 'links' | 'midden' | 'rechts';

// ADD after the DoorSwing type:
export interface WallWindow {
  id: string;
  position: number; // 0.0–1.0 fraction of usable wall length
}

// In WallConfig, change these fields:
//   doorPosition: DoorPosition;  →  doorPosition: number;
//   hasWindow: boolean;           →  REMOVE
//   windowCount: number;          →  windows: WallWindow[];
```

The full updated `WallConfig` should be:
```typescript
export interface WallConfig {
  materialId: string;
  finish: string;
  hasDoor: boolean;
  doorMaterialId: DoorMaterialId;
  doorSize: DoorSize;
  doorHasWindow: boolean;
  doorPosition: number;
  doorSwing: DoorSwing;
  windows: WallWindow[];
}
```

- [ ] **Step 2: Update DEFAULT_WALL and add opening constants**

In `src/lib/constants.ts`, update `DEFAULT_WALL` (lines 78–89):

```typescript
export const DEFAULT_WALL: WallConfig = {
  materialId: 'wood',
  finish: 'Mat',
  hasDoor: false,
  doorMaterialId: 'wood',
  doorSize: 'enkel',
  doorHasWindow: false,
  doorPosition: 0.5,
  doorSwing: 'dicht',
  windows: [],
};
```

Add the clearance constants (near existing `DOOR_W`/`WIN_W` around line 185):

```typescript
export const EDGE_CLEARANCE = 0.5;  // min meters from wall corner to opening edge
export const OPENING_GAP = 0.3;     // min meters between opening edges
```

- [ ] **Step 3: Replace `computeOpeningPositions` with `resolveOpeningPositions`**

In `src/lib/constants.ts`, replace `computeDoorX` (lines 263–276) and `computeOpeningPositions` (lines 278–333) with:

```typescript
/** Convert a 0–1 fraction to meters from wall center */
export function fractionToX(wallLength: number, fraction: number): number {
  const usableStart = -wallLength / 2 + EDGE_CLEARANCE;
  const usableEnd = wallLength / 2 - EDGE_CLEARANCE;
  return usableStart + fraction * (usableEnd - usableStart);
}

/** Convert meters from wall center to 0–1 fraction */
export function xToFraction(wallLength: number, x: number): number {
  const usableStart = -wallLength / 2 + EDGE_CLEARANCE;
  const usableEnd = wallLength / 2 - EDGE_CLEARANCE;
  const usableLen = usableEnd - usableStart;
  if (usableLen <= 0) return 0.5;
  return Math.max(0, Math.min(1, (x - usableStart) / usableLen));
}

/** Resolve fractional positions to meters from wall center */
export function resolveOpeningPositions(
  wallLength: number,
  doorPosition: number | null,
  doorSize: DoorSize,
  windows: { position: number }[],
): { doorX: number | null; windowXs: number[] } {
  const doorX = doorPosition !== null
    ? fractionToX(wallLength, doorPosition)
    : null;
  const windowXs = windows.map(w => fractionToX(wallLength, w.position));
  return { doorX, windowXs };
}
```

Keep the `doorWidth` helper function — it's still needed. Remove or keep `computeOpeningPositions` temporarily (other files still reference it — we'll update them in subsequent tasks). Actually, keep it for now and mark it deprecated with a comment. We'll remove it once all consumers are migrated.

- [ ] **Step 4: Add the clamping function**

Add below `resolveOpeningPositions` in `src/lib/constants.ts`:

```typescript
/** Clamp an opening position to avoid edges and other openings */
export function clampOpeningPosition(
  wallLength: number,
  openingWidth: number,
  proposedFraction: number,
  otherOpenings: { position: number; width: number }[],
): number {
  const usableLen = wallLength - 2 * EDGE_CLEARANCE;
  if (usableLen <= 0) return 0.5;

  // Clamp to edges (opening must fit within usable zone)
  const halfW = openingWidth / 2;
  const minFrac = halfW / usableLen;
  const maxFrac = 1 - halfW / usableLen;
  let frac = Math.max(minFrac, Math.min(maxFrac, proposedFraction));

  // Push away from other openings
  const others = otherOpenings
    .map(o => ({
      frac: o.position,
      halfW: o.width / 2,
    }))
    .sort((a, b) => a.frac - b.frac);

  for (const o of others) {
    const minGapFrac = (halfW + o.halfW + OPENING_GAP) / usableLen;
    const dist = frac - o.frac;
    if (Math.abs(dist) < minGapFrac) {
      // Push to whichever side is closer
      if (dist >= 0) {
        frac = Math.max(frac, o.frac + minGapFrac);
      } else {
        frac = Math.min(frac, o.frac - minGapFrac);
      }
    }
  }

  // Re-clamp to edges after push
  frac = Math.max(minFrac, Math.min(maxFrac, frac));
  return frac;
}

/** Find the best position for a new opening (largest gap) */
export function findBestNewPosition(
  wallLength: number,
  openingWidth: number,
  existingOpenings: { position: number; width: number }[],
): number {
  const usableLen = wallLength - 2 * EDGE_CLEARANCE;
  if (usableLen <= 0) return 0.5;

  const halfW = openingWidth / 2;
  const minFrac = halfW / usableLen;
  const maxFrac = 1 - halfW / usableLen;

  if (existingOpenings.length === 0) return 0.5;

  // Build sorted list of occupied zones as fraction ranges
  const zones = existingOpenings
    .map(o => ({
      start: o.position - (o.width / 2 + OPENING_GAP) / usableLen,
      end: o.position + (o.width / 2 + OPENING_GAP) / usableLen,
    }))
    .sort((a, b) => a.start - b.start);

  // Find the largest gap
  let bestCenter = 0.5;
  let bestGap = 0;

  // Gap before first zone
  const gapBefore = zones[0].start - minFrac;
  if (gapBefore > bestGap) {
    bestGap = gapBefore;
    bestCenter = minFrac + gapBefore / 2;
  }

  // Gaps between zones
  for (let i = 0; i < zones.length - 1; i++) {
    const gap = zones[i + 1].start - zones[i].end;
    if (gap > bestGap) {
      bestGap = gap;
      bestCenter = zones[i].end + gap / 2;
    }
  }

  // Gap after last zone
  const gapAfter = maxFrac - zones[zones.length - 1].end;
  if (gapAfter > bestGap) {
    bestGap = gapAfter;
    bestCenter = zones[zones.length - 1].end + gapAfter / 2;
  }

  return Math.max(minFrac, Math.min(maxFrac, bestCenter));
}
```

- [ ] **Step 5: Verify TypeScript compiles (expect errors in consumers)**

Run: `pnpm tsc --noEmit 2>&1 | head -40`

Expected: Type errors in files still using the old `DoorPosition` type, `hasWindow`, `windowCount`. This is expected — we'll fix them in subsequent tasks. Note the list of erroring files to confirm it matches what we expect.

- [ ] **Step 6: Commit**

```bash
git add src/types/building.ts src/lib/constants.ts
git commit -m "feat: update types and constants for fractional opening positions"
```

---

### Task 2: Update All Consumers of Old Data Model

**Files:**
- Modify: `src/components/schematic/SchematicOpenings.tsx`
- Modify: `src/components/schematic/SchematicWalls.tsx`
- Modify: `src/components/canvas/Wall.tsx`
- Modify: `src/lib/pricing.ts`
- Modify: `src/lib/configCode.ts`
- Modify: `src/components/schematic/exportFloorPlan.ts`
- Modify: `src/components/ui/SurfaceProperties.tsx`
- Modify: `src/components/schematic/SchematicView.tsx`

- [ ] **Step 1: Update SchematicOpenings.tsx**

Replace the `computeOpeningPositions` call (lines 36–42) with `resolveOpeningPositions`:

```typescript
// Change import: replace computeOpeningPositions with resolveOpeningPositions
import {
  WALL_THICKNESS,
  DOUBLE_DOOR_W,
  DOOR_W,
  WIN_W,
  resolveOpeningPositions,
} from '@/lib/constants';
```

Replace lines 35–42:
```typescript
const ds = cfg.doorSize ?? 'enkel';
const { doorX, windowXs } = resolveOpeningPositions(
  g.length,
  cfg.hasDoor ? (cfg.doorPosition ?? 0.5) : null,
  ds,
  cfg.windows ?? [],
);
```

- [ ] **Step 2: Update SchematicWalls.tsx**

Replace the `computeOpeningPositions` import and call (lines 130–136):

```typescript
// Change import
import { WALL_THICKNESS, DOUBLE_DOOR_W, DOOR_W, WIN_W, resolveOpeningPositions } from '@/lib/constants';
```

Replace lines 129–136:
```typescript
const ds = cfg.doorSize ?? 'enkel';
const { doorX, windowXs } = resolveOpeningPositions(
  length,
  cfg.hasDoor ? (cfg.doorPosition ?? 0.5) : null,
  ds,
  cfg.windows ?? [],
);
```

- [ ] **Step 3: Update Wall.tsx (3D rendering)**

Replace the `computeOpeningPositions` import and call (lines 101–110):

```typescript
// Change import
import { ..., resolveOpeningPositions } from '@/lib/constants';
```

Replace the useMemo (lines 101–110):
```typescript
const { doorX: computedDoorX, windowXs: computedWindowXs } = useMemo(
  () =>
    resolveOpeningPositions(
      wallLength,
      wallCfg.hasDoor ? (wallCfg.doorPosition ?? 0.5) : null,
      ds,
      wallCfg.windows ?? [],
    ),
  [wallLength, wallCfg.hasDoor, wallCfg.doorPosition, ds, wallCfg.windows],
);
```

Also update `hasOpenings` check (line 99):
```typescript
const hasOpenings = wallCfg.hasDoor || (wallCfg.windows ?? []).length > 0;
```

And the `WallOpenings` null check (line 197):
```typescript
if (!wallCfg.hasDoor && (wallCfg.windows ?? []).length === 0) return null;
```

And the `WallOpenings` opening positions call (around line 227):
```typescript
// Replace the computeOpeningPositions call with resolveOpeningPositions
const { doorX, windowXs } = resolveOpeningPositions(
  wallLength,
  wallCfg.hasDoor ? (wallCfg.doorPosition ?? 0.5) : null,
  wallCfg.doorSize ?? 'enkel',
  wallCfg.windows ?? [],
);
```

- [ ] **Step 4: Update pricing.ts**

In `src/lib/pricing.ts`, replace references to `hasWindow`/`windowCount` (lines 66, 105):

```typescript
// Line 66: replace
if (wallCfg.hasWindow) area -= WINDOW_AREA_CUTOUT * wallCfg.windowCount;
// with:
area -= WINDOW_AREA_CUTOUT * (wallCfg.windows ?? []).length;

// Line 105: replace
if (wallCfg.hasWindow) extrasCost += WINDOW_FLAT_FEE * wallCfg.windowCount;
// with:
extrasCost += WINDOW_FLAT_FEE * (wallCfg.windows ?? []).length;
```

- [ ] **Step 5: Update configCode.ts (serialization)**

In `src/lib/configCode.ts`, update the encoding/decoding to handle the new format. This is the URL config serializer.

For encoding (around line 175), replace the door position and window serialization:

```typescript
// Replace: w.write(indexOf(DOOR_POSITIONS, wall.doorPosition), 2);
// With: encode position as 7-bit integer (0–100 mapped from 0.0–1.0)
w.write(Math.round((wall.doorPosition ?? 0.5) * 100), 7);

// Replace: w.write(wall.hasWindow ? 1 : 0, 1); + window count block
// With:
const winCount = (wall.windows ?? []).length;
w.write(Math.min(winCount, 7), 3);
for (let i = 0; i < Math.min(winCount, 7); i++) {
  w.write(Math.round((wall.windows![i].position) * 100), 7);
}
```

For decoding (around line 191), replace:

```typescript
// Replace: doorPosition = DOOR_POSITIONS[clamp(r.read(2), 0, 2)];
// With:
const doorPosition = r.read(7) / 100;

// Replace: const hasWindow = r.read(1) === 1;
//          const windowCount = hasWindow ? clamp(r.read(3), 0, 7) : 0;
// With:
const windowCount = clamp(r.read(3), 0, 7);
const windows: WallWindow[] = [];
for (let i = 0; i < windowCount; i++) {
  windows.push({ id: crypto.randomUUID(), position: r.read(7) / 100 });
}
```

Update the return to use `doorPosition` (number) and `windows` array instead of `hasWindow`/`windowCount`. Remove the `DoorPosition` import and `DOOR_POSITIONS` array.

- [ ] **Step 6: Update exportFloorPlan.ts**

In `src/components/schematic/exportFloorPlan.ts`, replace lines 73–74:

```typescript
// Replace:
// if (w.hasWindow && w.windowCount > 0) {
//   parts.push(`${w.windowCount}× ${t('surface.windows').toLowerCase()}`);
// }
// With:
if ((w.windows ?? []).length > 0) {
  parts.push(`${w.windows.length}× ${t('surface.windows').toLowerCase()}`);
}
```

- [ ] **Step 7: Update SurfaceProperties.tsx**

In `src/components/ui/SurfaceProperties.tsx`, replace lines 57–58:

```typescript
// Replace:
// handleChange('hasWindow', false);
// handleChange('windowCount', 0);
// With:
handleChange('windows', []);
```

- [ ] **Step 8: Update SchematicView.tsx outwardArcR**

The `outwardArcR` function (line 681) references `w.hasDoor` and `w.doorSwing` which still exist — no changes needed there. But check it doesn't reference `hasWindow` or `windowCount`. It doesn't, so no changes needed.

- [ ] **Step 9: Verify TypeScript compiles cleanly**

Run: `pnpm tsc --noEmit`

Expected: No errors. All consumers now use the new data model.

- [ ] **Step 10: Remove deprecated old functions**

In `src/lib/constants.ts`, remove `computeDoorX`, `computeOpeningPositions`, and the `DoorPosition` type import if it's imported there. Clean up unused imports.

Run: `pnpm tsc --noEmit`

Expected: Clean compile.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor: migrate all consumers to fractional opening positions"
```

---

### Task 3: Update Sidebar UI (DoorConfig + WindowConfig)

**Files:**
- Modify: `src/components/ui/DoorConfig.tsx`
- Modify: `src/components/ui/WindowConfig.tsx`

- [ ] **Step 1: Update DoorConfig position toggle to use fractions**

In `src/components/ui/DoorConfig.tsx`, change the position toggle group (lines 94–114) to use numeric values as presets:

```typescript
<div className="space-y-1.5">
  <SectionLabel>{t('surface.doorPosition')}</SectionLabel>
  <ToggleGroup
    type="single"
    value={
      wallCfg.doorPosition === 0 ? 'links'
        : wallCfg.doorPosition === 1 ? 'rechts'
        : wallCfg.doorPosition === 0.5 ? 'midden'
        : ''
    }
    onValueChange={(v) => {
      if (v === 'links') handleChange('doorPosition', 0);
      else if (v === 'midden') handleChange('doorPosition', 0.5);
      else if (v === 'rechts') handleChange('doorPosition', 1);
    }}
    className="w-full"
    variant="outline"
    size="sm"
  >
    <ToggleGroupItem value="links" className="flex-1 text-xs">
      {t('surface.doorPosition.links')}
    </ToggleGroupItem>
    <ToggleGroupItem value="midden" className="flex-1 text-xs">
      {t('surface.doorPosition.midden')}
    </ToggleGroupItem>
    <ToggleGroupItem value="rechts" className="flex-1 text-xs">
      {t('surface.doorPosition.rechts')}
    </ToggleGroupItem>
  </ToggleGroup>
</div>
```

- [ ] **Step 2: Rewrite WindowConfig with add/remove list**

Replace the entire `WindowConfig` component in `src/components/ui/WindowConfig.tsx`:

```typescript
'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { t } from '@/lib/i18n';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import SectionLabel from '@/components/ui/SectionLabel';
import { Plus, X } from 'lucide-react';
import {
  EDGE_CLEARANCE,
  OPENING_GAP,
  WIN_W,
  DOOR_W,
  DOUBLE_DOOR_W,
  getWallLength,
  findBestNewPosition,
} from '@/lib/constants';
import type { WallId, WallWindow } from '@/types/building';

interface WindowConfigProps {
  wallId: WallId;
  buildingId: string;
}

export default function WindowConfig({ wallId, buildingId }: WindowConfigProps) {
  const wallCfg = useConfigStore((s) => {
    const b = s.buildings.find(b => b.id === buildingId);
    return b?.walls[wallId] ?? null;
  });
  const dimensions = useConfigStore((s) => {
    const b = s.buildings.find(b => b.id === buildingId);
    return b?.dimensions ?? null;
  });
  const updateBuildingWall = useConfigStore((s) => s.updateBuildingWall);

  if (!wallCfg || !dimensions) return null;

  const windows = wallCfg.windows ?? [];
  const hasWindows = windows.length > 0;
  const wallLength = getWallLength(wallId, dimensions);

  // Compute max windows that physically fit
  const usableLen = wallLength - 2 * EDGE_CLEARANCE;
  const maxWindows = Math.max(0, Math.floor(usableLen / (WIN_W + OPENING_GAP)));

  function handleAddWindow() {
    const existingOpenings: { position: number; width: number }[] = windows.map(w => ({
      position: w.position,
      width: WIN_W,
    }));
    if (wallCfg!.hasDoor) {
      const dw = wallCfg!.doorSize === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W;
      existingOpenings.push({ position: wallCfg!.doorPosition ?? 0.5, width: dw });
    }

    const newPos = findBestNewPosition(wallLength, WIN_W, existingOpenings);
    const newWindow: WallWindow = {
      id: crypto.randomUUID(),
      position: newPos,
    };
    updateBuildingWall(buildingId, wallId, {
      windows: [...windows, newWindow],
    });
  }

  function handleRemoveWindow(id: string) {
    updateBuildingWall(buildingId, wallId, {
      windows: windows.filter(w => w.id !== id),
    });
  }

  function handleToggle(checked: boolean) {
    if (checked && windows.length === 0) {
      handleAddWindow();
    } else if (!checked) {
      updateBuildingWall(buildingId, wallId, { windows: [] });
    }
  }

  return (
    <div className={`rounded-lg transition-all ${hasWindows ? 'bg-muted/40 p-3 ring-1 ring-border/50' : ''}`}>
      <div className="flex items-center gap-2">
        <Checkbox
          id="wall-windows"
          checked={hasWindows}
          onCheckedChange={(checked) => handleToggle(!!checked)}
        />
        <Label htmlFor="wall-windows" className="cursor-pointer font-medium">
          {t('surface.windows')}
        </Label>
      </div>
      {hasWindows && (
        <div className="mt-3 space-y-2">
          <div className="flex justify-between items-center">
            <SectionLabel>{t('surface.windowCount')}</SectionLabel>
            <span className="text-sm font-semibold tabular-nums">{windows.length}</span>
          </div>
          <div className="space-y-1">
            {windows.map((w, i) => (
              <div key={w.id} className="flex items-center justify-between rounded border border-border/50 px-2 py-1">
                <span className="text-xs text-muted-foreground">
                  {t('surface.windows')} {i + 1}
                </span>
                <button
                  onClick={() => handleRemoveWindow(w.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          {windows.length < maxWindows && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={handleAddWindow}
            >
              <Plus className="h-3 w-3 mr-1" />
              {t('surface.windows')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles and test sidebar**

Run: `pnpm tsc --noEmit`

Expected: Clean compile. Manually test: open the app, select a wall, toggle door position presets, add/remove windows.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/DoorConfig.tsx src/components/ui/WindowConfig.tsx
git commit -m "feat: update sidebar UI for fractional door presets and window add/remove"
```

---

### Task 4: Add Drag Interaction to Schematic

**Files:**
- Modify: `src/components/schematic/SchematicOpenings.tsx`
- Modify: `src/components/schematic/SchematicView.tsx`

- [ ] **Step 1: Add hit targets and drag callbacks to SchematicOpenings**

In `src/components/schematic/SchematicOpenings.tsx`, update the component to accept drag callbacks and render hit targets.

Add new props to `SchematicOpenings`:

```typescript
interface SchematicOpeningsProps {
  dimensions: BuildingDimensions;
  walls: Record<string, WallConfig>;
  offsetX: number;
  offsetY: number;
  buildingId?: string;
  onOpeningPointerDown?: (
    e: React.PointerEvent,
    info: { buildingId: string; wallId: string; type: 'door' | 'window'; windowIndex?: number },
  ) => void;
  dragPreview?: {
    buildingId: string;
    wallId: string;
    type: 'door' | 'window';
    windowIndex?: number;
    fraction: number;
  } | null;
}
```

In the main render loop, add hit targets to door and window symbols. For each door, add an invisible rect behind the door symbol that's easy to click (approximately 0.3m wide along the wall thickness, full door width along the wall):

For horizontal walls, add a hit target rect centered on the door position:
```typescript
{cfg.hasDoor && (
  <g>
    {/* Invisible hit target for drag */}
    {onOpeningPointerDown && buildingId && (
      <rect
        x={g.orientation === 'h' ? g.cx + doorX * g.flipSign - dw / 2 : g.cx - 0.15}
        y={g.orientation === 'h' ? g.cy - 0.15 : g.cy + doorX * g.flipSign - dw / 2}
        width={g.orientation === 'h' ? dw : 0.3}
        height={g.orientation === 'h' ? 0.3 : dw}
        fill="transparent"
        cursor="grab"
        onPointerDown={(e) => {
          e.stopPropagation();
          onOpeningPointerDown(e, {
            buildingId,
            wallId: g.wallId,
            type: 'door',
          });
        }}
      />
    )}
    <DoorSymbol
      geom={g}
      localDoorX={doorX * g.flipSign}
      doorWidth={ds === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W}
      isDouble={ds === 'dubbel'}
      swing={cfg.doorSwing ?? 'dicht'}
    />
  </g>
)}
```

Similarly for each window:
```typescript
{windowXs.map((wx, i) => (
  <g key={i}>
    {onOpeningPointerDown && buildingId && (
      <rect
        x={g.orientation === 'h' ? g.cx + wx * g.flipSign - WIN_W / 2 : g.cx - 0.15}
        y={g.orientation === 'h' ? g.cy - 0.15 : g.cy + wx * g.flipSign - WIN_W / 2}
        width={g.orientation === 'h' ? WIN_W : 0.3}
        height={g.orientation === 'h' ? 0.3 : WIN_W}
        fill="transparent"
        cursor="grab"
        onPointerDown={(e) => {
          e.stopPropagation();
          onOpeningPointerDown(e, {
            buildingId,
            wallId: g.wallId,
            type: 'window',
            windowIndex: i,
          });
        }}
      />
    )}
    <WindowSymbol geom={g} localWinX={wx * g.flipSign} />
  </g>
))}
```

Also handle `dragPreview`: if the preview matches this building/wall/opening, render the opening at the preview position (in blue, `stroke="#3b82f6"`) and fade the original (`opacity={0.3}`).

Remove `pointerEvents="none"` from the openings `<g>` group in `SchematicView.tsx` so the hit targets are clickable.

- [ ] **Step 2: Add drag state and handlers to SchematicView**

In `src/components/schematic/SchematicView.tsx`, add refs for opening drag state near the existing drag refs:

```typescript
// Opening drag state
const draggingOpening = useRef<{
  buildingId: string;
  wallId: string;
  type: 'door' | 'window';
  windowIndex?: number;
  wallGeom: { cx: number; cy: number; orientation: 'h' | 'v'; length: number; flipSign: number };
} | null>(null);
const [openingDragPreview, setOpeningDragPreview] = useState<{
  buildingId: string;
  wallId: string;
  type: 'door' | 'window';
  windowIndex?: number;
  fraction: number;
} | null>(null);
```

Add the pointer-down handler:

```typescript
const onOpeningPointerDown = useCallback((
  e: React.PointerEvent,
  info: { buildingId: string; wallId: string; type: 'door' | 'window'; windowIndex?: number },
) => {
  e.stopPropagation();
  const svg = svgRef.current;
  if (!svg) return;

  // Find the wall geometry for coordinate projection
  const building = buildings.find(b => b.id === info.buildingId);
  if (!building) return;
  const [bx, bz] = building.position;
  const { width, depth } = building.dimensions;
  const geoms = getWallGeometries(building.dimensions, bx + width / 2, bz + depth / 2);
  const wallGeom = geoms.find(g => g.wallId === info.wallId);
  if (!wallGeom) return;

  pointerDownScreen.current = { x: e.clientX, y: e.clientY };
  draggingOpening.current = {
    ...info,
    wallGeom: {
      cx: wallGeom.cx,
      cy: wallGeom.cy,
      orientation: wallGeom.orientation,
      length: wallGeom.length,
      flipSign: wallGeom.flipSign,
    },
  };
  setFrozenViewBox(computedViewBox);
}, [buildings, computedViewBox]);
```

In the existing `onPointerMove` handler, add opening drag logic (before the building drag section). Check if `draggingOpening.current` is set:

```typescript
// --- Opening drag ---
if (draggingOpening.current) {
  const screenDx = e.clientX - pointerDownScreen.current.x;
  const screenDy = e.clientY - pointerDownScreen.current.y;
  if (Math.abs(screenDx) < 5 && Math.abs(screenDy) < 5) return;

  // Pause undo on first real move
  if (!openingDragPreview) {
    useConfigStore.temporal.getState().pause();
  }

  const svg = svgRef.current;
  if (!svg) return;
  const [wx, wz] = clientToWorld(svg, e.clientX, e.clientY);
  const { cx, cy, orientation, length, flipSign } = draggingOpening.current.wallGeom;

  // Project pointer onto wall axis
  const localOffset = orientation === 'h'
    ? (wx - cx) * flipSign
    : (wz - cy) * flipSign;

  // Convert to fraction
  let fraction = xToFraction(length, localOffset);

  // Get other openings for collision
  const building = buildings.find(b => b.id === draggingOpening.current!.buildingId);
  if (!building) return;
  const wallCfg = building.walls[draggingOpening.current!.wallId as WallId];
  if (!wallCfg) return;

  const openingWidth = draggingOpening.current.type === 'door'
    ? (wallCfg.doorSize === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W)
    : WIN_W;

  const otherOpenings: { position: number; width: number }[] = [];
  if (draggingOpening.current.type !== 'door' && wallCfg.hasDoor) {
    const dw = wallCfg.doorSize === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W;
    otherOpenings.push({ position: wallCfg.doorPosition ?? 0.5, width: dw });
  }
  (wallCfg.windows ?? []).forEach((w, i) => {
    if (draggingOpening.current!.type === 'window' && i === draggingOpening.current!.windowIndex) return;
    otherOpenings.push({ position: w.position, width: WIN_W });
  });

  fraction = clampOpeningPosition(length, openingWidth, fraction, otherOpenings);

  setOpeningDragPreview({
    buildingId: draggingOpening.current.buildingId,
    wallId: draggingOpening.current.wallId,
    type: draggingOpening.current.type,
    windowIndex: draggingOpening.current.windowIndex,
    fraction,
  });
  return;
}
```

In the existing `onPointerUp` handler, add opening drag commit (before the building drag section):

```typescript
// --- Opening drag commit ---
if (draggingOpening.current && openingDragPreview) {
  const { buildingId, wallId, type, windowIndex } = draggingOpening.current;
  const { fraction } = openingDragPreview;

  if (type === 'door') {
    useConfigStore.getState().updateBuildingWall(buildingId, wallId as WallId, {
      doorPosition: fraction,
    });
  } else if (type === 'window' && windowIndex !== undefined) {
    const building = buildings.find(b => b.id === buildingId);
    const wallCfg = building?.walls[wallId as WallId];
    if (wallCfg) {
      const newWindows = [...(wallCfg.windows ?? [])];
      newWindows[windowIndex] = { ...newWindows[windowIndex], position: fraction };
      useConfigStore.getState().updateBuildingWall(buildingId, wallId as WallId, {
        windows: newWindows,
      });
    }
  }

  useConfigStore.temporal.getState().resume();
  draggingOpening.current = null;
  setOpeningDragPreview(null);
  setFrozenViewBox(null);
  return;
}

// Also clear opening drag state on pointer-up without preview (click without drag)
if (draggingOpening.current) {
  draggingOpening.current = null;
  setFrozenViewBox(null);
}
```

- [ ] **Step 3: Pass props to SchematicOpenings**

In `SchematicView.tsx`, update the `SchematicOpenings` render calls to pass `buildingId`, `onOpeningPointerDown`, and `dragPreview`. There are two render sites — one for normal buildings (around line 766) and one for standalone walls (around line 927).

For normal buildings:
```typescript
<SchematicOpenings
  dimensions={b.dimensions}
  walls={b.walls}
  offsetX={ox + width / 2}
  offsetY={oz + depth / 2}
  buildingId={b.id}
  onOpeningPointerDown={onOpeningPointerDown}
  dragPreview={openingDragPreview}
/>
```

For standalone walls, pass the same props with the wall's buildingId.

Also remove `pointerEvents="none"` from the `<g>` wrapper around `SchematicOpenings`.

- [ ] **Step 4: Add necessary imports to SchematicView**

Add imports for the new functions and types:

```typescript
import { getWallGeometries } from './SchematicWalls';
import { xToFraction, clampOpeningPosition, DOUBLE_DOOR_W as DBL_DOOR_W, WIN_W as WIN_WIDTH } from '@/lib/constants';
```

Note: `DOOR_W` and `DOUBLE_DOOR_W` are already imported. Adjust import names if there are conflicts.

- [ ] **Step 5: Verify TypeScript compiles and test drag interaction**

Run: `pnpm tsc --noEmit`

Expected: Clean compile.

Manual test:
1. Open the app, add a building, select a wall
2. Add a door and a window
3. Hover over the door on the schematic — cursor should change to grab
4. Drag the door along the wall — ghost preview should follow
5. Release — door should snap to the dragged position
6. Drag a window — same behavior
7. Try dragging a door into a window — should be blocked by collision

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add drag interaction for doors and windows on schematic"
```

---

### Task 5: Polish & Edge Cases

**Files:**
- Modify: `src/components/schematic/SchematicOpenings.tsx` (ghost preview styling)
- Modify: `src/components/schematic/SchematicView.tsx` (cursor, edge cases)

- [ ] **Step 1: Implement ghost preview rendering in SchematicOpenings**

In the render loop of `SchematicOpenings`, when `dragPreview` matches the current building/wall, apply visual feedback:

- For the opening being dragged: render it at the preview position with `stroke="#3b82f6"` and the original position with `opacity={0.3}`
- Use `dragPreview.fraction` converted via `fractionToX` to get the preview X coordinate

Add this logic at the top of the wall rendering loop:

```typescript
const isDragging = dragPreview?.buildingId === buildingId && dragPreview?.wallId === g.wallId;

// Compute preview positions if dragging on this wall
let previewDoorX = doorX;
let previewWindowXs = windowXs;
if (isDragging && dragPreview) {
  if (dragPreview.type === 'door') {
    previewDoorX = fractionToX(g.length, dragPreview.fraction);
  } else if (dragPreview.type === 'window' && dragPreview.windowIndex !== undefined) {
    previewWindowXs = [...windowXs];
    previewWindowXs[dragPreview.windowIndex] = fractionToX(g.length, dragPreview.fraction);
  }
}
```

Then render both the faded original and the blue preview. For the door:

```typescript
{cfg.hasDoor && (
  <g>
    {/* Original position (faded if dragging) */}
    <g opacity={isDragging && dragPreview?.type === 'door' ? 0.3 : 1}>
      <DoorSymbol geom={g} localDoorX={doorX * g.flipSign} ... />
    </g>
    {/* Preview position (blue, only during drag) */}
    {isDragging && dragPreview?.type === 'door' && (
      <g stroke="#3b82f6">
        <DoorSymbol geom={g} localDoorX={previewDoorX * g.flipSign} ... />
      </g>
    )}
    {/* Hit target */}
    ...
  </g>
)}
```

Apply the same pattern for windows.

- [ ] **Step 2: Set cursor to grabbing during drag**

In `SchematicView.tsx`, the SVG already has `style={{ cursor: dragging.current ? 'grabbing' : undefined }}`. Extend this to include opening drag:

```typescript
style={{ cursor: (dragging.current || draggingOpening.current) ? 'grabbing' : undefined }}
```

- [ ] **Step 3: Handle edge case — building resize invalidates positions**

After a building resize, opening positions (as fractions) stay valid but may result in overlapping openings if the wall shrinks. The `clampOpeningPosition` function handles this during the next drag. No explicit re-validation is needed — the visual may show overlap temporarily, but the next interaction clamps it. This is acceptable per the spec.

No code changes needed — just documenting the behavior.

- [ ] **Step 4: Test everything end-to-end**

Manual test checklist:
1. Add a building, select each wall
2. Add a door → appears at center (midden preset)
3. Click "Links" preset → door snaps to left
4. Drag door to arbitrary position → preset deselects (no button highlighted)
5. Add 3 windows → appear at evenly distributed positions
6. Drag a window → moves smoothly, can't overlap door or other windows
7. Remove a window via × button → removed, others stay in place
8. Resize the building → openings stay at their fractional positions
9. Switch door between enkel/dubbel → collision zones update
10. Undo/redo works (Cmd+Z/Cmd+Shift+Z)
11. Door arc rendering (naar_binnen/naar_buiten) works at custom positions
12. 3D view reflects all position changes

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add ghost preview and polish for draggable openings"
```
