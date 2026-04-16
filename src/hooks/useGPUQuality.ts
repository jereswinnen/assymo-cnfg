'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/store/useUIStore';

/** Detect GPU tier once on mount and write the derived quality tier into
 *  the UI store. Used by the 3D canvas to pick texture/shader detail. */
export function useGPUQuality() {
  useEffect(() => {
    let cancelled = false;
    import('detect-gpu').then(({ getGPUTier }) =>
      getGPUTier().then((result) => {
        if (cancelled) return;
        const tier = (result.tier ?? 0) >= 3 ? 'high' : 'low';
        useUIStore.getState().setQualityTier(tier);
      }),
    );
    return () => {
      cancelled = true;
    };
  }, []);
}
