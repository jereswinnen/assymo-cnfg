'use client';

import { useRef, useState, useCallback } from 'react';

const DRAG_THRESHOLD_SQ = 16; // 4px²

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ThreePointerEvent = any;

/**
 * Shared hook for 3D objects that need hover highlighting and click-vs-drag
 * detection. Returns pointer event handlers and hover state.
 */
export function useClickableObject(onClick: () => void) {
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);

  const onPointerOver = useCallback((e: ThreePointerEvent) => {
    if (e.nativeEvent.buttons > 0) return;
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  }, []);

  const onPointerOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  }, []);

  const onPointerDown = useCallback((e: ThreePointerEvent) => {
    pointerDownPos.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
  }, []);

  const handleClick = useCallback((e: ThreePointerEvent) => {
    const down = pointerDownPos.current;
    if (down) {
      const dx = e.nativeEvent.clientX - down.x;
      const dy = e.nativeEvent.clientY - down.y;
      if (dx * dx + dy * dy > DRAG_THRESHOLD_SQ) return;
    }
    e.stopPropagation();
    onClick();
  }, [onClick]);

  return {
    hovered,
    handlers: {
      onPointerOver,
      onPointerOut,
      onPointerDown,
      onClick: handleClick,
    },
  };
}
