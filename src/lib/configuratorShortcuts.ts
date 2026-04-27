'use client';

import { useMemo } from 'react';
import { useConfigStore } from '@/store/useConfigStore';
import { useUIStore } from '@/store/useUIStore';
import { useKeyboardShortcuts, type Shortcut } from '@/lib/keyboardShortcuts';

/** Single declarative source of truth for every keyboard shortcut wired
 *  into the configurator. Mounted once at the top of <ConfiguratorClient />.
 *
 *  Adding a new shortcut: append a `Shortcut` to the memoised list. The
 *  registry handles target filtering (skip while typing in inputs),
 *  cmd-vs-ctrl mapping, and the text-selection escape hatch for ⌘C/⌘V.
 *
 *  Behavioural notes:
 *  - `[` toggles the sidebar (legacy keybind).
 *  - `Delete` / `Backspace` delete every selected building (multi-select
 *    aware — single-select used to be the only path).
 *  - `Escape` deselects: the wall element first if we're in elevation mode,
 *    otherwise the entire building selection.
 *  - `⌘/Ctrl + C` snapshots the current building selection into the
 *    clipboard. `⌘/Ctrl + V` pastes it at a fixed offset and selects the
 *    pasted entities. Both are skipped when the user has text selected so
 *    the browser's native copy/paste keeps working. */
export function useConfiguratorShortcuts(): void {
  const shortcuts = useMemo<Shortcut[]>(
    () => [
      {
        id: 'sidebar.toggle',
        keys: ['['],
        handler: () => {
          const ui = useUIStore.getState();
          ui.setSidebarCollapsed(!ui.sidebarCollapsed);
        },
      },
      {
        id: 'selection.delete',
        keys: ['Delete', 'Backspace'],
        handler: () => {
          const ids = useUIStore.getState().selectedBuildingIds;
          if (ids.length === 0) return;
          const remove = useConfigStore.getState().removeBuilding;
          // Snapshot ids — removeBuilding mutates the selection synchronously,
          // so iterating directly over the live array would skip entries.
          for (const id of [...ids]) remove(id);
        },
      },
      {
        id: 'selection.escape',
        keys: ['Escape'],
        handler: () => {
          const ui = useUIStore.getState();
          // Mirror the legacy SchematicView behaviour: only an active wall
          // selection (elevation mode) preempts deselecting all buildings.
          if (ui.selectedElement?.type === 'wall') {
            ui.selectElement(null);
          } else {
            ui.selectBuildings([]);
          }
        },
      },
      {
        id: 'clipboard.copy',
        keys: ['c', 'C'],
        mod: 'cmdOrCtrl',
        when: () => useUIStore.getState().selectedBuildingIds.length > 0,
        handler: () => useUIStore.getState().copySelection(),
      },
      {
        id: 'clipboard.paste',
        keys: ['v', 'V'],
        mod: 'cmdOrCtrl',
        when: () => {
          const clip = useUIStore.getState().clipboard;
          return !!clip && clip.length > 0;
        },
        handler: () => useUIStore.getState().pasteClipboard(),
      },
    ],
    [],
  );

  useKeyboardShortcuts(shortcuts);
}
