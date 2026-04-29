import type { WindowMeta, WindowMetaSegments } from '@/domain/supplier';

/** Opening-side kinds the registry knows about. */
export type OpeningKind = 'window' | 'door';

/** Auto-derive-from-dimension control. Today's only entry: `segments`. */
export interface OpeningAutoControl {
  /** Stable string id. Today's only entry: `'segments'`. */
  id: string;
  /** Which opening kinds this control can apply to. */
  applicableKinds: readonly OpeningKind[];
  /** Which dimension drives the auto count. */
  axis: 'width' | 'height';
}

export const OPENING_AUTO_CONTROLS = [
  { id: 'segments', applicableKinds: ['window', 'door'], axis: 'width' },
] as const satisfies readonly OpeningAutoControl[];

/** Pure: compute the auto-derived segment count for a window width.
 *  Caller passes `widthMm` (millimetres) and the product's `segments` config.
 *  Returns 0 when config absent or disabled. */
export function deriveSegmentCount(
  widthMm: number,
  cfg: WindowMeta['segments'],
): number {
  if (!cfg || !cfg.enabled) return 0;
  if (widthMm < cfg.autoThresholdMm) return 0;
  const max = cfg.maxCount ?? Infinity;
  if (max <= 0) return 0;
  if (!cfg.perAdditionalThresholdMm) {
    return 1;
  }
  const raw = 1 + Math.floor(
    (widthMm - cfg.autoThresholdMm) / cfg.perAdditionalThresholdMm,
  );
  return Math.min(raw, max);
}

/** Default segment auto-config used by naked windows (no supplier product).
 *  Mirrors the shape a supplier product would carry. Tunable via a tenant
 *  priceBook field later if needed. */
export const DEFAULT_NAKED_WINDOW_SEGMENTS: WindowMetaSegments = {
  enabled: true,
  autoThresholdMm: 1500,
  perAdditionalThresholdMm: 1000,
};
