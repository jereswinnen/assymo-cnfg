'use client';

import { useEffect } from 'react';

export type ShortcutMod = 'none' | 'cmdOrCtrl' | 'shift';

export interface Shortcut {
  /** Stable identifier; used for debugging and React key purposes. */
  id: string;
  /** Keys to match (KeyboardEvent.key). Any match fires the handler.
   *  Letter keys are matched case-insensitively. */
  keys: string[];
  /** Modifier requirement. `cmdOrCtrl` matches metaKey on macOS,
   *  ctrlKey elsewhere. Defaults to `'none'`. */
  mod?: ShortcutMod;
  /** Optional gate. Shortcut only fires when this returns true. */
  when?: () => boolean;
  /** Handler. The hook calls preventDefault() on the event after a match. */
  handler: (e: KeyboardEvent) => void;
}

// Input `type`s that don't accept text and shouldn't suppress shortcuts.
// Default to "text-editable" for unknown types — safer to skip the shortcut
// than to swallow text the user is typing.
const NON_TEXTUAL_INPUT_TYPES = new Set([
  'checkbox', 'radio', 'button', 'submit', 'reset',
  'color', 'file', 'image', 'range', 'hidden',
]);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.tagName === 'TEXTAREA') return true;
  if (target.tagName === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    return !NON_TEXTUAL_INPUT_TYPES.has(type);
  }
  return false;
}

function hasTextSelection(): boolean {
  if (typeof window === 'undefined') return false;
  const sel = window.getSelection();
  return !!sel && sel.toString().length > 0;
}

function modMatches(e: KeyboardEvent, mod: ShortcutMod): boolean {
  if (mod === 'cmdOrCtrl') return e.metaKey || e.ctrlKey;
  if (mod === 'shift') return e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey;
  return !e.metaKey && !e.ctrlKey && !e.altKey;
}

function keyMatches(e: KeyboardEvent, keys: string[]): boolean {
  const ek = e.key;
  for (const k of keys) {
    if (k.length === 1 && ek.length === 1) {
      if (k.toLowerCase() === ek.toLowerCase()) return true;
    } else if (k === ek) {
      return true;
    }
  }
  return false;
}

/** Pure matcher used by the hook and tests. Returns the matching shortcut
 *  (if any) for the given event. Skips when the target is editable. For
 *  cmdOrCtrl shortcuts, also skips when the user has selected text so the
 *  browser's native copy still works. */
export function matchShortcut(
  shortcuts: Shortcut[],
  e: KeyboardEvent,
  opts: { editable: boolean; textSelected: boolean },
): Shortcut | null {
  if (opts.editable) return null;
  for (const s of shortcuts) {
    const mod = s.mod ?? 'none';
    if (!modMatches(e, mod)) continue;
    if (!keyMatches(e, s.keys)) continue;
    if (mod === 'cmdOrCtrl' && opts.textSelected) continue;
    if (s.when && !s.when()) continue;
    return s;
  }
  return null;
}

/** Mounts a single window-level keydown listener that dispatches to the
 *  given shortcut list. The list is not memoised internally — pass a stable
 *  reference (useMemo or module-level array) to avoid re-binding on every
 *  render. */
export function useKeyboardShortcuts(shortcuts: Shortcut[]): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const match = matchShortcut(shortcuts, e, {
        editable: isEditableTarget(e.target),
        textSelected: hasTextSelection(),
      });
      if (!match) return;
      e.preventDefault();
      match.handler(e);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
}
