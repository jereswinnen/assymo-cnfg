import type { WallWindow } from '@/domain/building';
import type { SupplierProductRow, WindowMeta } from '@/domain/supplier';
import { deriveSegmentCount, DEFAULT_NAKED_WINDOW_SEGMENTS } from './controls';

export interface ResolvedWindowControls {
  segments: {
    /** Final divider count after auto-derive + override. Always ≥ 0. */
    count: number;
    /** From product meta. Defaults to 0 (no surcharge). */
    surchargeCentsPerDivider: number;
  };
  schuifraam: {
    enabled: boolean;
    surchargeCents: number;
  };
}

export const EMPTY_WINDOW_CONTROLS: ResolvedWindowControls = {
  segments: { count: 0, surchargeCentsPerDivider: 0 },
  schuifraam: { enabled: false, surchargeCents: 0 },
};

export function resolveWindowControls(
  window: WallWindow,
  product: SupplierProductRow | null,
): ResolvedWindowControls {
  // Naked-window path: no product (or non-window product) → use default
  // segments config; no schuifraam.
  if (!product || product.kind !== 'window') {
    const segCfg = DEFAULT_NAKED_WINDOW_SEGMENTS;
    let segCount = 0;
    if (window.segmentCountOverride !== undefined) {
      segCount = Math.max(0, Math.floor(window.segmentCountOverride));
      if (segCfg.maxCount != null) segCount = Math.min(segCount, segCfg.maxCount);
    } else {
      segCount = deriveSegmentCount(window.width * 1000, segCfg);
    }
    return {
      segments: { count: segCount, surchargeCentsPerDivider: 0 },
      schuifraam: { enabled: false, surchargeCents: 0 },
    };
  }

  const meta = product.meta as WindowMeta;
  const segCfg = meta.segments;
  let segCount = 0;
  if (segCfg?.enabled) {
    if (window.segmentCountOverride !== undefined) {
      segCount = Math.max(0, Math.floor(window.segmentCountOverride));
      if (segCfg.maxCount != null) segCount = Math.min(segCount, segCfg.maxCount);
    } else {
      segCount = deriveSegmentCount(product.widthMm, segCfg);
    }
  }

  return {
    segments: {
      count: segCount,
      surchargeCentsPerDivider: segCfg?.surchargeCentsPerDivider ?? 0,
    },
    schuifraam: {
      enabled: meta.schuifraam?.enabled ?? false,
      surchargeCents: meta.schuifraam?.surchargeCents ?? 0,
    },
  };
}
