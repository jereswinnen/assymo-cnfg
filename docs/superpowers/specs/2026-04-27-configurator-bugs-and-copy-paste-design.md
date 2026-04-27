# Configurator: bug fixes + copy/paste with shortcut registry

Date: 2026-04-27

## Goal

Fix three configurator bugs and add copy/paste of selected objects, behind a
small modular keyboard-shortcut registry that supersedes the scattered
`window.addEventListener('keydown', …)` handlers we have today.

## In scope

- **Bug 1**: muur dimension input rejects values that aren't on the 0.5 step
  (e.g. `0.8`).
- **Bug 2**: standalone `paal` / `muur` objects don't follow the active
  `berging`'s primary material.
- **Bug 3**: with multiple objects selected on the plattegrond, pressing the
  delete key only deletes one (single-select works).
- **Feature**: `Cmd/Ctrl+C` copies the current building selection;
  `Cmd/Ctrl+V` pastes a detached duplicate at a fixed offset.
- **Refactor**: extract a `useKeyboardShortcuts` registry, migrate the three
  existing in-tree handlers (`[`, `Delete`/`Backspace`, `Escape`) onto it.

## Out of scope (YAGNI)

- Cut (`Cmd/Ctrl+X`), Duplicate (`Cmd/Ctrl+D`).
- Cross-tab clipboard via `navigator.clipboard`.
- Paste-at-cursor positioning (fixed offset for v1).
- Copying snap connections between pasted entities.
- Toast notifications for copy/paste (silent, Figma-style).

## Bug 1 — muur dimension input rejects 0.8

### Root cause

`DIMENSION_CONSTRAINTS.muur.width.step = 0.5`
(`src/domain/building/constants.ts:137`). `SliderRow.commitValue` in
`src/components/ui/DimensionsControl.tsx:39-46` snaps the typed value to that
step:

```ts
const stepped = step > 0 ? Math.round(clamped / step) * step : clamped;
```

`0.8 / 0.5 = 1.6 → round → 2 → 2 * 0.5 = 1.0`, so `0.8` silently becomes `1.0`.
Canvas drag uses a different code path that bypasses the step, hence the
inconsistency.

### Fix

Drop the step-snap inside `commitValue`. Typed input clamps to `[min, max]`
only; the slider keeps its `step` for tactile dragging. This matches the
existing canvas-drag behaviour and gives power users precise control without
churning the slider UX.

```ts
const commitValue = () => {
  setEditing(false);
  const parsed = parseFloat(inputValue.replace(',', '.'));
  if (isNaN(parsed)) return;
  const clamped = Math.min(max, Math.max(min, parsed));
  onChange(clamped);
};
```

### Verification

- Manual: select a muur, type `0.8` → muur becomes 0.8 m wide.
- Manual: structural width input still works (no regression).
- Existing `tests/configStore.test.ts` and `tests/mutations.test.ts` continue
  to pass — these don't touch the input component, but `clampDimensions`
  + `updateBuildingDimensions` are already step-agnostic so the value
  survives.

## Bug 2 — standalone paal/muur don't inherit berging primary material

### Root cause (hypothesis, to be confirmed by reproducing test)

`getEffectivePrimaryMaterial` in `src/domain/materials/resolve.ts` looks
correct: a `paal`/`muur` with no `attachedTo` falls back to
`getAmbientHost(buildings)?.primaryMaterialId` — the first non-paal/non-muur
in the scene.

The render-side audit shows three call sites that **drop** the `buildings`
argument, which forces resolution to fall back to the entity's own
`primaryMaterialId`:

- `src/components/ui/DoorConfig.tsx:35,156,165` —
  `getEffectiveDoorMaterial(wallCfg, building)` (UI sidebar).
- `src/components/ui/SurfaceProperties.tsx:25,48` —
  `getEffectiveWallMaterial(..., selectedBuilding)` (UI sidebar).
- `src/components/canvas/TimberFrame.tsx:48` —
  `getEffectivePoleMaterial(building)` (3D canvas; only used for structural
  buildings, so it shouldn't affect standalone paal/muur — keeping it on the
  audit list anyway).

For a standalone muur, the visual canvas already passes `buildings` through
`Wall.tsx:62`, so the muur's wall *should* render the berging's material.
Bug 2 is real per the user — so either the assumption fails in some path
or there's a subtle data issue (e.g. a stray `attachedTo` pointing at a
deleted building, leaving the chain broken differently than expected).

### Fix plan

1. Write a failing unit test in `tests/materials.test.ts`:
   `getEffectivePrimaryMaterial(standalone-muur, [berging, muur])` should
   return the berging's primary. Same for paal.
2. If the test passes (resolve logic is fine), the bug must be in a render
   path. Add a render-level integration check by:
   - Greping every call to `getEffective*Material(` and confirming the
     `buildings` arg is supplied where the result feeds the canvas/schematic.
   - Fixing any caller that drops it.
3. Tighten resolve callers in the sidebar (`DoorConfig`, `SurfaceProperties`)
   to pass `buildings` so the picker UI shows the actually-rendered colour.
   This is correctness even if it's not the user-visible bug.
4. If the resolve test fails, the bug is in the domain — tighten
   `getEffectivePrimaryMaterial` so a broken `attachedTo` chain still falls
   through to the ambient host instead of the entity's own primary, and add
   coverage.

### Verification

- New test: standalone paal/muur with a berging present resolves to the
  berging's material.
- Manual: drop a berging, change its primary material to `brick`, drag a
  standalone paal next to it → paal renders `brick`. Same for muur.
- Manual: same scene with overkapping → standalone paal renders the
  overkapping's material (existing behaviour, no regression).

## Bug 3 — multi-select delete only deletes one

### Root cause

`src/components/ui/ConfiguratorSidebar.tsx:40-47`:

```ts
if (e.key === 'Delete' || e.key === 'Backspace') {
  const ids = useUIStore.getState().selectedBuildingIds;
  const sid = ids.length === 1 ? ids[0] : null;  // ← guard rejects multi
  if (sid) {
    e.preventDefault();
    useConfigStore.getState().removeBuilding(sid);
  }
}
```

### Fix

Iterate over every selected id. Delete each via the existing
`removeBuilding` mutation; the store already clears each id from the
selection inside `removeBuilding`.

```ts
if (e.key === 'Delete' || e.key === 'Backspace') {
  const ids = useUIStore.getState().selectedBuildingIds;
  if (ids.length === 0) return;
  e.preventDefault();
  const remove = useConfigStore.getState().removeBuilding;
  for (const id of ids) remove(id);
}
```

This handler moves into the new shortcut registry as part of the refactor —
the body above is what the registered handler runs.

### Verification

- New `useUIStore` + `useConfigStore` test or extend `configStore.test.ts`:
  select two buildings, dispatch removeBuilding twice via the same code
  path; both go away.
- Manual: ⌘-click two objects on the plattegrond, press Delete → both
  disappear; selection becomes empty.

## Feature — copy/paste

### User-facing behaviour

- Click object → `Cmd/Ctrl+C`. Selection is silently snapshotted into a
  clipboard slice on `useUIStore`. (No toast.)
- `Cmd/Ctrl+V`. Each clipboard entity is appended to the scene with a fresh
  id, no `attachedTo`, and an offset of `(+1m, +1m)` on `(x, z)`. Multi-paste
  preserves relative positions and offsets the whole group.
- The pasted entities become the new selection so the user can immediately
  drag them.
- Multiple `Cmd+V` presses paste from the same clipboard each time. Each
  press offsets relative to the **clipboard origin**, not the previous
  paste, so spamming `V` doesn't drift indefinitely — it stacks on top of
  the previous paste, mimicking Figma. (This is simpler and predictable;
  alternative "drift on each paste" is a nice-to-have we can add later.)
- Browser conflict: shortcuts only fire when (a) target isn't an
  `<input>`/`<textarea>`/contentEditable, **and** (b)
  `window.getSelection()?.toString()` is empty. Otherwise native copy/paste
  runs untouched. This is the same heuristic Figma/Excalidraw use.

### Architecture

```
+-----------------------------+         +-----------------------------+
| domain/config/mutations.ts  |         | useConfigStore              |
| pasteBuildings(cfg, ents,   | <-----  | pasteBuildings (thin wrap)  |
|   offset) -> { cfg, ids }   |         +-----------------------------+
+-----------------------------+                    ^
            ^                                      | called by
            | pure                                 |
            |                          +-----------------------------+
            |                          | useUIStore                  |
            |                          | clipboard: BuildingEntity[] |
            |                          | copySelection()             |
            |                          | pasteClipboard()            |
            |                          +-----------------------------+
            |                                      ^
            |                                      | invoked from
            |                          +-----------------------------+
            |                          | configuratorShortcuts.ts    |
            |                          | declares all shortcuts      |
            |                          +-----------------------------+
            |                                      ^
            |                                      | mounted via
            |                          +-----------------------------+
            +------------------------- | useKeyboardShortcuts hook   |
                                       | (lib, generic)              |
                                       +-----------------------------+
```

### `pasteBuildings` (pure, in `src/domain/config/mutations.ts`)

```ts
export const PASTE_OFFSET: [number, number] = [1, 1]; // metres on (x, z)

export function pasteBuildings(
  cfg: ConfigData,
  entities: BuildingEntity[],
  offset: [number, number] = PASTE_OFFSET,
): { cfg: ConfigData; ids: string[] } {
  const ids: string[] = [];
  const next: BuildingEntity[] = entities.map((e) => {
    const id = crypto.randomUUID();
    ids.push(id);
    const { attachedTo: _a, sourceProductId: _s, ...rest } = e;
    return {
      ...rest,
      id,
      position: [e.position[0] + offset[0], e.position[1] + offset[1]],
    };
  });
  return {
    cfg: { ...cfg, buildings: [...cfg.buildings, ...next] },
    ids,
  };
}
```

- `attachedTo` and `sourceProductId` stripped — pasted entities are
  detached primitives.
- Snap connections are **not** copied. Pasted entities are independent.
- Walls, floors, dimensions, materials, orientation, height override are
  preserved exactly (deep clone is structural — `e.walls` already comes
  from a frozen state snapshot, so spreading the entity is enough; if not,
  fall back to `structuredClone`).

### `useUIStore` clipboard slice

```ts
clipboard: BuildingEntity[] | null;

copySelection: () => {
  const ids = get().selectedBuildingIds;
  if (ids.length === 0) return;
  const buildings = useConfigStore.getState().buildings;
  const picked = ids
    .map((id) => buildings.find((b) => b.id === id))
    .filter((b): b is BuildingEntity => b !== undefined);
  if (picked.length === 0) return;
  set({ clipboard: structuredClone(picked) });
};

pasteClipboard: () => {
  const clip = get().clipboard;
  if (!clip || clip.length === 0) return;
  const ids = useConfigStore.getState().pasteBuildings(clip);
  set({
    selectedBuildingIds: ids,
    selectedElement: null,
    sidebarTab: 'configure',
  });
};
```

- Clipboard lives in UI store: not undoable, not persisted to DB or
  localStorage, lost on reload (matches Figma's per-tab behaviour).
- `useConfigStore.pasteBuildings(clip)` returns the new ids and is a thin
  wrapper around the pure mutation.

### `useKeyboardShortcuts` hook (`src/lib/keyboardShortcuts.ts`)

```ts
export type Shortcut = {
  /** Stable id, for debugging only. */
  id: string;
  /** Keys to match (KeyboardEvent.key). Any match fires. */
  keys: string[];
  /** Modifier requirement. `cmdOrCtrl` matches metaKey on macOS,
   *  ctrlKey elsewhere. `none` (default) means no modifier required. */
  mod?: 'none' | 'cmdOrCtrl' | 'shift';
  /** Optional gate. Shortcut only fires when this returns true. */
  when?: () => boolean;
  /** Handler. Receives the raw event. The hook calls preventDefault
   *  iff the handler returns truthy or doesn't return at all. */
  handler: (e: KeyboardEvent) => void;
};

export function useKeyboardShortcuts(shortcuts: Shortcut[]): void;
```

Behaviour:

1. Skip when target is `<input>`, `<textarea>`, or `contentEditable`.
2. For shortcuts with `mod: 'cmdOrCtrl'`, additionally skip when the user
   has selected text (`window.getSelection()?.toString()` non-empty), so
   native browser copy/paste keeps working.
3. Match keys (case-insensitive on the letter; `Delete`/`Backspace`/
   `Escape`/`[` matched literally).
4. Run handler, preventDefault by default.

The hook owns the single `keydown` listener; consumers pass a stable
shortcut array (memoised by the caller).

### `configuratorShortcuts.ts`

A single declarative file under `src/lib/`:

```ts
export function useConfiguratorShortcuts() {
  const shortcuts = useMemo<Shortcut[]>(() => [
    { id: 'sidebar.toggle', keys: ['['], handler: () => /* toggle */ },
    { id: 'selection.delete', keys: ['Delete', 'Backspace'], handler: /* see Bug 3 */ },
    { id: 'selection.escape', keys: ['Escape'], handler: /* see SchematicView */ },
    { id: 'clipboard.copy', keys: ['c', 'C'], mod: 'cmdOrCtrl',
      when: () => useUIStore.getState().selectedBuildingIds.length > 0,
      handler: () => useUIStore.getState().copySelection() },
    { id: 'clipboard.paste', keys: ['v', 'V'], mod: 'cmdOrCtrl',
      handler: () => useUIStore.getState().pasteClipboard() },
  ], []);
  useKeyboardShortcuts(shortcuts);
}
```

Mounted once in `src/components/canvas/ConfiguratorClient.tsx` (or wherever
the configurator shell lives — to be confirmed at implementation time).
The existing `useEffect`s in `ConfiguratorSidebar.tsx` and
`SchematicView.tsx` are deleted.

### Verification

- Pure-domain tests in `tests/mutations.test.ts`:
  - Single-entity paste: ids regenerated, position offset applied,
    `attachedTo` stripped.
  - Multi-entity paste: relative positions preserved.
  - Snap connections in `cfg.connections` are unchanged.
- Store tests in `tests/configStore.test.ts`:
  - `copySelection` snapshots without aliasing (mutating the original
    config does not mutate the clipboard).
  - `pasteClipboard` selects the new ids.
- Hook tests in `tests/keyboardShortcuts.test.ts`:
  - Modifier matching across platforms.
  - Skips when target is `<input>`.
  - Skips ⌘C when there's a text selection.
- Manual:
  - Cmd+C, Cmd+V on a single object → duplicate appears offset.
  - Multi-select two objects, copy/paste → both appear, relative
    positions preserved.
  - Click into a sidebar input, type and Cmd+C → native copy works.
  - Select text in a label, Cmd+C → native copy works.
  - Repeated Cmd+V → each paste lands at clipboard origin + offset
    (stacks).

## Risks

- **Risk**: `structuredClone` not available in some test environments.
  *Mitigation*: domain code uses spread (entities are plain JSON-shaped
  data); only the UI-store snapshot uses `structuredClone`, which is
  present in jsdom 16+ and Node 17+. Vite+/vitest target Node 20+ per
  CLAUDE.md, so this is fine.
- **Risk**: pasted entity collides with an existing one at the offset
  position. *Mitigation*: accepted for v1 — the user can drag it.
  Auto-collision-avoidance is a follow-up.
- **Risk**: keyboard shortcut hook fires inside the OrderSubmitDialog
  (focus is in a form input → already skipped). The dialog's modal
  overlay also intercepts pointer events; keydown still bubbles, but
  the input-focus skip handles it.
- **Risk**: removing the existing `keydown` `useEffect` in
  `SchematicView.tsx` could regress the elevation-mode escape (deselects
  `selectedElement` instead of buildings). *Mitigation*: the new
  `selection.escape` shortcut preserves the elevation-mode branch.

## Open questions

None. All four pre-implementation questions resolved with the user on
2026-04-27.
