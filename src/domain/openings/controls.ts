import type { WindowMeta } from '@/domain/supplier';

/** Opening-side kinds the registry knows about. */
export type OpeningKind = 'window' | 'door';

/** Auto-derive-from-dimension control. Today's only entry: `segments`. */
export interface OpeningAutoControl {
  id: 'segments';
  /** Which opening kinds this control can apply to. */
  applicableKinds: readonly OpeningKind[];
  /** Which dimension drives the auto count. */
  axis: 'width' | 'height';
}

export const OPENING_AUTO_CONTROLS: readonly OpeningAutoControl[] = [
  { id: 'segments', applicableKinds: ['window', 'door'], axis: 'width' },
] as const;

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
    return Math.min(1, max);
  }
  const raw = 1 + Math.floor(
    (widthMm - cfg.autoThresholdMm) / cfg.perAdditionalThresholdMm,
  );
  return Math.min(raw, max);
}
