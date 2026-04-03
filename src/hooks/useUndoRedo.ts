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
