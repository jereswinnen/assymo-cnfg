import { describe, it, expect } from 'vite-plus/test';
import { deriveSegmentCount } from '@/domain/openings';

describe('deriveSegmentCount', () => {
  it('returns 0 when config absent', () => {
    expect(deriveSegmentCount(2000, undefined)).toBe(0);
  });

  it('returns 0 when disabled', () => {
    expect(deriveSegmentCount(2000, { enabled: false, autoThresholdMm: 1500 })).toBe(0);
  });

  it('returns 0 when width below threshold', () => {
    expect(deriveSegmentCount(1499, { enabled: true, autoThresholdMm: 1500 })).toBe(0);
  });

  it('returns 1 at threshold without perAdditional', () => {
    expect(deriveSegmentCount(1500, { enabled: true, autoThresholdMm: 1500 })).toBe(1);
  });

  it('returns 1 well past threshold without perAdditional', () => {
    expect(deriveSegmentCount(5000, { enabled: true, autoThresholdMm: 1500 })).toBe(1);
  });

  it('adds one divider per perAdditionalThresholdMm', () => {
    const cfg = { enabled: true as const, autoThresholdMm: 1500, perAdditionalThresholdMm: 1000 };
    expect(deriveSegmentCount(1500, cfg)).toBe(1);
    expect(deriveSegmentCount(2499, cfg)).toBe(1);
    expect(deriveSegmentCount(2500, cfg)).toBe(2);
    expect(deriveSegmentCount(3500, cfg)).toBe(3);
  });

  it('caps at maxCount', () => {
    const cfg = {
      enabled: true as const,
      autoThresholdMm: 1500,
      perAdditionalThresholdMm: 500,
      maxCount: 3,
    };
    expect(deriveSegmentCount(10000, cfg)).toBe(3);
  });

  it('without perAdditional but with maxCount=0 returns 0', () => {
    expect(deriveSegmentCount(2000, { enabled: true, autoThresholdMm: 1500, maxCount: 0 })).toBe(0);
  });

  it('clamps perAdditional ladder at maxCount boundary', () => {
    const cfg = {
      enabled: true as const,
      autoThresholdMm: 1500,
      perAdditionalThresholdMm: 500,
      maxCount: 3,
    };
    // raw count would be 4 (1500=1, 2000=2, 2500=3, 3000=4) — capped to 3
    expect(deriveSegmentCount(3000, cfg)).toBe(3);
    expect(deriveSegmentCount(2999, cfg)).toBe(3);
    expect(deriveSegmentCount(2500, cfg)).toBe(3);
    expect(deriveSegmentCount(2499, cfg)).toBe(2);
  });
});
