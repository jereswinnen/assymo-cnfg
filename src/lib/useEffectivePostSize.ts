'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { useTenant } from '@/lib/TenantProvider';

/** Returns the effective post / lumber cross-section IN METRES for the
 *  current scene. The scene's `postSizeMm` override (set via the sidebar's
 *  "Globaal → Paaldikte" picker) takes precedence over the tenant default
 *  (`tenant.geometry.postSizeMm`). One hook so every renderer / snap
 *  caller reads the same source of truth — no per-component re-resolution
 *  to keep in sync. */
export function useEffectivePostSize(): number {
  const sceneMm = useConfigStore((s) => s.postSizeMm);
  const { geometry } = useTenant();
  const mm = sceneMm ?? geometry.postSizeMm;
  return mm / 1000;
}
