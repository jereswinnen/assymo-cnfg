import { describe, it, expect } from 'vite-plus/test';
import { matchShortcut, type Shortcut } from '@/lib/keyboardShortcuts';

// Vite+ runs in a node environment without DOM globals. matchShortcut only
// reads `key` and the four modifier flags from the event, so a structural
// stub matches what we need without spinning up jsdom for one test file.
function ev(init: { key: string; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean }): KeyboardEvent {
  return {
    key: init.key,
    metaKey: init.metaKey ?? false,
    ctrlKey: init.ctrlKey ?? false,
    shiftKey: init.shiftKey ?? false,
    altKey: init.altKey ?? false,
  } as KeyboardEvent;
}

describe('matchShortcut', () => {
  const calls: string[] = [];
  const shortcuts: Shortcut[] = [
    {
      id: 'sidebar.toggle',
      keys: ['['],
      handler: () => calls.push('sidebar'),
    },
    {
      id: 'selection.delete',
      keys: ['Delete', 'Backspace'],
      handler: () => calls.push('delete'),
    },
    {
      id: 'clipboard.copy',
      keys: ['c', 'C'],
      mod: 'cmdOrCtrl',
      handler: () => calls.push('copy'),
    },
    {
      id: 'clipboard.paste',
      keys: ['v', 'V'],
      mod: 'cmdOrCtrl',
      when: () => false, // gated off in this test
      handler: () => calls.push('paste'),
    },
  ];

  it('matches a no-modifier key', () => {
    const m = matchShortcut(shortcuts, ev({ key: '[' }), { editable: false, textSelected: false });
    expect(m?.id).toBe('sidebar.toggle');
  });

  it('matches Delete and Backspace literally', () => {
    expect(matchShortcut(shortcuts, ev({ key: 'Delete' }), { editable: false, textSelected: false })?.id).toBe('selection.delete');
    expect(matchShortcut(shortcuts, ev({ key: 'Backspace' }), { editable: false, textSelected: false })?.id).toBe('selection.delete');
  });

  it('matches cmdOrCtrl shortcut on metaKey (macOS)', () => {
    const m = matchShortcut(shortcuts, ev({ key: 'c', metaKey: true }), { editable: false, textSelected: false });
    expect(m?.id).toBe('clipboard.copy');
  });

  it('matches cmdOrCtrl shortcut on ctrlKey (Windows/Linux)', () => {
    const m = matchShortcut(shortcuts, ev({ key: 'c', ctrlKey: true }), { editable: false, textSelected: false });
    expect(m?.id).toBe('clipboard.copy');
  });

  it('matches letter case-insensitively', () => {
    const m = matchShortcut(shortcuts, ev({ key: 'C', metaKey: true }), { editable: false, textSelected: false });
    expect(m?.id).toBe('clipboard.copy');
  });

  it('skips no-modifier shortcut when modifier is held', () => {
    const m = matchShortcut(shortcuts, ev({ key: '[', metaKey: true }), { editable: false, textSelected: false });
    expect(m).toBeNull();
  });

  it('skips cmdOrCtrl shortcut when no modifier is held', () => {
    const m = matchShortcut(shortcuts, ev({ key: 'c' }), { editable: false, textSelected: false });
    expect(m).toBeNull();
  });

  it('skips everything when target is editable', () => {
    const m = matchShortcut(shortcuts, ev({ key: '[' }), { editable: true, textSelected: false });
    expect(m).toBeNull();
  });

  it('skips cmdOrCtrl shortcut when text is selected (lets native copy work)', () => {
    const m = matchShortcut(shortcuts, ev({ key: 'c', metaKey: true }), { editable: false, textSelected: true });
    expect(m).toBeNull();
  });

  it('still fires non-modifier shortcuts when text is selected', () => {
    const m = matchShortcut(shortcuts, ev({ key: '[' }), { editable: false, textSelected: true });
    expect(m?.id).toBe('sidebar.toggle');
  });

  it('respects the `when` gate', () => {
    const m = matchShortcut(shortcuts, ev({ key: 'v', metaKey: true }), { editable: false, textSelected: false });
    expect(m).toBeNull();
  });
});
