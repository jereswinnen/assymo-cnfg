import { describe, it, expect } from 'vite-plus/test';
import { resolveWindowControls } from '@/domain/openings';
import type { WallWindow } from '@/domain/building';
import type { SupplierProductRow, WindowMeta } from '@/domain/supplier';

function makeProduct(meta: WindowMeta): SupplierProductRow {
  return {
    id: 'p1', tenantId: 't1', supplierId: 's1', kind: 'window',
    sku: 'W1', name: 'Window 1', heroImage: null,
    widthMm: 2000, heightMm: 1500, priceCents: 10000,
    meta, sortOrder: 0, archivedAt: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

function makeWindow(extras: Partial<WallWindow> = {}): WallWindow {
  return { id: 'w1', position: 0.5, width: 2.0, height: 1.5, sillHeight: 0.9, ...extras };
}

describe('resolveWindowControls', () => {
  it('returns empty view when product is null', () => {
    const r = resolveWindowControls(makeWindow(), null);
    expect(r.segments.count).toBe(0);
    expect(r.schuifraam.enabled).toBe(false);
  });

  it('auto-derives count from product width when enabled', () => {
    const product = makeProduct({
      segments: { enabled: true, autoThresholdMm: 1500 },
    });
    const r = resolveWindowControls(makeWindow(), product);
    expect(r.segments.count).toBe(1);
  });

  it('override wins over auto', () => {
    const product = makeProduct({
      segments: { enabled: true, autoThresholdMm: 1500 },
    });
    const r = resolveWindowControls(makeWindow({ segmentCountOverride: 3 }), product);
    expect(r.segments.count).toBe(3);
  });

  it('zero override disables segments even when product enables them', () => {
    const product = makeProduct({
      segments: { enabled: true, autoThresholdMm: 1500 },
    });
    const r = resolveWindowControls(makeWindow({ segmentCountOverride: 0 }), product);
    expect(r.segments.count).toBe(0);
  });

  it('override is ignored when product disables segments', () => {
    const product = makeProduct({});
    const r = resolveWindowControls(makeWindow({ segmentCountOverride: 5 }), product);
    expect(r.segments.count).toBe(0);
  });

  it('clamps override against maxCount', () => {
    const product = makeProduct({
      segments: { enabled: true, autoThresholdMm: 1500, maxCount: 3 },
    });
    const r = resolveWindowControls(makeWindow({ segmentCountOverride: 10 }), product);
    expect(r.segments.count).toBe(3);
  });

  it('schuifraam.enabled mirrors product meta', () => {
    const product = makeProduct({ schuifraam: { enabled: true, surchargeCents: 25000 } });
    const r = resolveWindowControls(makeWindow(), product);
    expect(r.schuifraam.enabled).toBe(true);
    expect(r.schuifraam.surchargeCents).toBe(25000);
  });

  it('exposes segment per-divider surcharge from meta', () => {
    const product = makeProduct({
      segments: { enabled: true, autoThresholdMm: 1500, surchargeCentsPerDivider: 5000 },
    });
    const r = resolveWindowControls(makeWindow(), product);
    expect(r.segments.surchargeCentsPerDivider).toBe(5000);
  });

  it('returns empty view for non-window product kinds', () => {
    const product: SupplierProductRow = {
      ...makeProduct({}),
      kind: 'door',
    };
    const r = resolveWindowControls(makeWindow(), product);
    expect(r.segments.count).toBe(0);
    expect(r.schuifraam.enabled).toBe(false);
  });

  it('floors negative override to 0', () => {
    const product = makeProduct({
      segments: { enabled: true, autoThresholdMm: 1500 },
    });
    const r = resolveWindowControls(makeWindow({ segmentCountOverride: -2 }), product);
    expect(r.segments.count).toBe(0);
  });

  it('floors fractional override down', () => {
    const product = makeProduct({
      segments: { enabled: true, autoThresholdMm: 1500, maxCount: 5 },
    });
    const r = resolveWindowControls(makeWindow({ segmentCountOverride: 2.7 }), product);
    expect(r.segments.count).toBe(2);
  });
});
