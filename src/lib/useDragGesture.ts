'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** True when ANY pointing device on the system is coarse (touchscreen).
 *  Use `any-pointer: coarse` instead of `pointer: coarse` — iPad with the
 *  Magic Keyboard trackpad reports its primary pointer as fine after the
 *  user touches the trackpad once, but the touchscreen is always present.
 *  Module-scope: input modality is stable per session. */
export const IS_COARSE_POINTER =
  typeof window !== 'undefined' && window.matchMedia('(any-pointer: coarse)').matches;

/** Squared-pixel movement threshold before a tap escalates to a drag.
 *  Tighter for mouse, looser for touch (finger jitter on a tap shouldn't
 *  fire onMove). 9 px on coarse, 5 px on fine. */
export const DRAG_DEAD_ZONE_SQ = IS_COARSE_POINTER ? 81 : 25;

export interface UseDragGestureOpts<TState> {
  /** Called when pointerdown fires. Return non-null to enter the active
   *  state; return null to abort (the hook does nothing further for
   *  this gesture — useful for filtering by button, modifier, or
   *  hit-test logic the caller owns). The returned value is your
   *  per-gesture state — passed back to onMove and onEnd. */
  onStart: (e: React.PointerEvent, target: Element) => TState | null;
  /** Fires on every pointermove after the dead zone has been crossed.
   *  Receives the native PointerEvent and your gesture state. */
  onMove: (e: PointerEvent, state: TState) => void;
  /** Fires once when the gesture ends. `cancelled` is true on
   *  pointercancel (system interruption — incoming call, low battery,
   *  iOS deciding the touch became a scroll), false on a normal
   *  pointerup. The event is null if the gesture is force-ended via
   *  unmount or never produced an end event. */
  onEnd?: (e: PointerEvent | null, state: TState, cancelled: boolean) => void;
  /** Element to call setPointerCapture() on. MUST be stable across
   *  renders — React reconciles small SVG nodes mid-gesture, and
   *  capturing on a transient node loses the capture, breaking
   *  long drags on touch. Defaults to e.currentTarget which is fine
   *  for divs/buttons that don't re-render mid-drag. */
  captureTarget?: (e: React.PointerEvent) => Element | null;
  /** Override the dead-zone threshold (squared pixels). Defaults to
   *  DRAG_DEAD_ZONE_SQ which adapts to coarse vs fine pointers. */
  deadZoneSq?: number;
  /** Only react to gestures from this button. Defaults to 0 (primary).
   *  Touch always reports button 0. */
  button?: number;
}

export interface UseDragGestureResult {
  /** Bind to your element's onPointerDown. */
  onPointerDown: (e: React.PointerEvent) => void;
  /** True while a gesture is in flight. Useful for cursor styling. */
  isActive: boolean;
}

/** Reusable drag-gesture hook for React + SVG / DOM components.
 *
 *  Why this hook exists: touch reliability on iPad Safari requires
 *  three things that React's vanilla event delegation can't provide
 *  on its own:
 *
 *  1. setPointerCapture on a STABLE element. React's reconciler can
 *     unmount and reuse small SVG nodes during a drag, breaking
 *     capture mid-gesture. The hook captures on whatever element
 *     captureTarget points to (typically a top-level SVG ref).
 *  2. Window-level pointermove / pointerup / pointercancel listeners.
 *     React's delegated event system has been observed to drop
 *     pointermove deliveries when the subtree re-renders heavily on
 *     touch. Native window listeners fire regardless.
 *  3. touch-action: none on the gesture surface. Without it the
 *     browser claims the pointer stream as a pan/zoom gesture
 *     mid-drag. The CALLER is responsible for setting this — we
 *     can't infer the right element.
 *
 *  Usage:
 *
 *  ```tsx
 *  const svgRef = useRef<SVGSVGElement>(null);
 *  const { onPointerDown } = useDragGesture<{ x0: number; y0: number }>({
 *    captureTarget: () => svgRef.current,
 *    onStart: (e) => ({ x0: e.clientX, y0: e.clientY }),
 *    onMove: (e, s) => setOffset([e.clientX - s.x0, e.clientY - s.y0]),
 *    onEnd: () => commitPosition(),
 *  });
 *  return (
 *    <svg ref={svgRef} style={{ touchAction: 'none' }}>
 *      <rect onPointerDown={onPointerDown} ... />
 *    </svg>
 *  );
 *  ```
 *
 *  For SchematicView's pre-existing gesture stack we keep the
 *  hand-rolled implementation — it predates the hook and shares state
 *  across five gesture types. New drag UIs should use this hook.
 */
export function useDragGesture<TState>(
  opts: UseDragGestureOpts<TState>,
): UseDragGestureResult {
  // Refs to the latest opts so window listeners (bound once) see fresh
  // closures without re-binding. Re-binding would tear down the
  // listeners and lose any in-flight gesture.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // The current gesture's tracked state. Ref to avoid re-renders on
  // every move; the public `isActive` mirror flips only on start/end.
  const gestureRef = useRef<{
    state: TState;
    startX: number;
    startY: number;
    crossedDeadZone: boolean;
    pointerId: number;
  } | null>(null);

  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    function handleMove(e: PointerEvent) {
      const g = gestureRef.current;
      if (!g || e.pointerId !== g.pointerId) return;
      if (!g.crossedDeadZone) {
        const dx = e.clientX - g.startX;
        const dy = e.clientY - g.startY;
        const threshold = optsRef.current.deadZoneSq ?? DRAG_DEAD_ZONE_SQ;
        if (dx * dx + dy * dy < threshold) return;
        g.crossedDeadZone = true;
      }
      optsRef.current.onMove(e, g.state);
    }
    function endGesture(e: PointerEvent, cancelled: boolean) {
      const g = gestureRef.current;
      if (!g || e.pointerId !== g.pointerId) return;
      gestureRef.current = null;
      setIsActive(false);
      optsRef.current.onEnd?.(e, g.state, cancelled);
    }
    function handleUp(e: PointerEvent) { endGesture(e, false); }
    function handleCancel(e: PointerEvent) { endGesture(e, true); }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
      // If we unmount mid-gesture, give the caller a chance to clean up.
      const g = gestureRef.current;
      if (g) {
        gestureRef.current = null;
        optsRef.current.onEnd?.(null, g.state, true);
      }
    };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const button = optsRef.current.button ?? 0;
    if (e.button !== button) return;
    if (gestureRef.current) return;             // already gesturing

    const target = optsRef.current.captureTarget?.(e) ?? (e.currentTarget as Element);
    const initial = optsRef.current.onStart(e, target);
    if (initial === null) return;

    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // Some elements/browsers reject capture (e.g. multi-touch already
      // capturing another pointer). The window listeners still receive
      // the events — capture is a robustness boost, not a requirement.
    }

    gestureRef.current = {
      state: initial,
      startX: e.clientX,
      startY: e.clientY,
      crossedDeadZone: false,
      pointerId: e.pointerId,
    };
    setIsActive(true);
  }, []);

  return { onPointerDown, isActive };
}
