import { describe, it, expect } from 'vite-plus/test';
import { buildQuoteSnapshot } from '@/domain/orders';
import { DEFAULT_PRICE_BOOK } from '@/domain/pricing';
import { makeConfig } from './fixtures';

// Empty array: tests here don't exercise material-pricing; passing [] is fine.
const NO_MATERIALS = [] as const;

const SAMPLE_CODE = 'TEST_CODE_123';

describe('buildQuoteSnapshot', () => {
  it('wraps the priced quote in a snapshot envelope', () => {
    const config = makeConfig();
    const snap = buildQuoteSnapshot({
      code: SAMPLE_CODE,
      buildings: config.buildings,
      roof: config.roof,
      connections: config.connections,
      priceBook: DEFAULT_PRICE_BOOK,
      defaultHeight: config.defaultHeight,
      currency: 'EUR',
      materials: [...NO_MATERIALS],
      supplierProducts: [],
    });
    expect(snap.items).toHaveLength(1);
    expect(snap.items[0].code).toBe(SAMPLE_CODE);
    expect(snap.items[0].lineItems.length).toBeGreaterThan(0);
    expect(snap.totalCents).toBe(snap.items[0].subtotalCents);
    expect(snap.currency).toBe('EUR');
    expect(snap.priceBook).toEqual(DEFAULT_PRICE_BOOK);
    expect(typeof snap.snapshotAt).toBe('string');
    expect(new Date(snap.snapshotAt).toString()).not.toBe('Invalid Date');
  });

  it('converts euro totals to integer cents (no floats)', () => {
    const config = makeConfig();
    const snap = buildQuoteSnapshot({
      code: SAMPLE_CODE,
      buildings: config.buildings,
      roof: config.roof,
      connections: config.connections,
      priceBook: DEFAULT_PRICE_BOOK,
      defaultHeight: config.defaultHeight,
      currency: 'EUR',
      materials: [...NO_MATERIALS],
      supplierProducts: [],
    });
    expect(Number.isInteger(snap.totalCents)).toBe(true);
    for (const item of snap.items) {
      expect(Number.isInteger(item.subtotalCents)).toBe(true);
    }
  });

  it('captures the priceBook by deep clone (mutating the original does not leak)', () => {
    const config = makeConfig();
    const pb = structuredClone(DEFAULT_PRICE_BOOK);
    const snap = buildQuoteSnapshot({
      code: SAMPLE_CODE,
      buildings: config.buildings,
      roof: config.roof,
      connections: config.connections,
      priceBook: pb,
      defaultHeight: config.defaultHeight,
      currency: 'EUR',
      materials: [...NO_MATERIALS],
      supplierProducts: [],
    });
    pb.postPrice = 999_999;
    expect(snap.priceBook.postPrice).not.toBe(999_999);
  });
});
