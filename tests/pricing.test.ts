import { describe, it, expect } from 'vite-plus/test';
import { calculateTotalQuote, DEFAULT_PRICE_BOOK } from '@/domain/pricing';
import { makeBuilding, makeConfig, makeRoof } from './fixtures';

describe('calculateTotalQuote', () => {
  it('returns a positive total for the default berging', () => {
    const cfg = makeConfig();
    const { total, lineItems } = calculateTotalQuote(
      cfg.buildings,
      cfg.roof,
      DEFAULT_PRICE_BOOK,
      cfg.defaultHeight,
    );
    expect(total).toBeGreaterThan(0);
    expect(lineItems.length).toBeGreaterThan(0);
  });

  it('emits structured line items with labelKey, never a pre-formatted label', () => {
    const cfg = makeConfig();
    const { lineItems } = calculateTotalQuote(
      cfg.buildings,
      cfg.roof,
      DEFAULT_PRICE_BOOK,
      cfg.defaultHeight,
    );
    for (const item of lineItems) {
      expect(item.labelKey).toMatch(/^[a-z]+\.[a-z]+$/);
      expect(item).not.toHaveProperty('label');
    }
  });

  it('charges a single post for a standalone pole', () => {
    const cfg = makeConfig({
      buildings: [makeBuilding({ id: 'p1', type: 'paal' })],
    });
    const { total, lineItems } = calculateTotalQuote(
      cfg.buildings,
      cfg.roof,
      DEFAULT_PRICE_BOOK,
      cfg.defaultHeight,
    );
    expect(total).toBe(DEFAULT_PRICE_BOOK.postPrice);
    expect(lineItems).toHaveLength(1);
    expect(lineItems[0].labelKey).toBe('quote.pole');
  });

  it('adding a door raises the total (door base exceeds the wall material credit)', () => {
    const withoutDoor = makeConfig();
    const withDoor = makeConfig({
      buildings: [
        makeBuilding({
          ...withoutDoor.buildings[0],
          id: withoutDoor.buildings[0].id,
          type: withoutDoor.buildings[0].type,
          walls: {
            ...withoutDoor.buildings[0].walls,
            front: { ...withoutDoor.buildings[0].walls.front, hasDoor: true },
          },
        }),
      ],
    });
    const a = calculateTotalQuote(withoutDoor.buildings, withoutDoor.roof, DEFAULT_PRICE_BOOK, withoutDoor.defaultHeight).total;
    const b = calculateTotalQuote(withDoor.buildings, withDoor.roof, DEFAULT_PRICE_BOOK, withDoor.defaultHeight).total;
    expect(b).toBeGreaterThan(a);
    expect(b - a).toBeLessThan(DEFAULT_PRICE_BOOK.doorBase.enkel);
  });

  it('adds skylight flat fee when roof has skylight', () => {
    const base = makeConfig();
    const withSkylight = makeConfig({ roof: makeRoof({ hasSkylight: true }) });
    const a = calculateTotalQuote(base.buildings, base.roof, DEFAULT_PRICE_BOOK, base.defaultHeight).total;
    const b = calculateTotalQuote(withSkylight.buildings, withSkylight.roof, DEFAULT_PRICE_BOOK, withSkylight.defaultHeight).total;
    expect(b - a).toBe(DEFAULT_PRICE_BOOK.skylightFee);
  });

  it('scales insulation cost with roof area and thickness', () => {
    const thin = makeConfig({
      roof: makeRoof({ insulation: true, insulationThickness: 100 }),
    });
    const thick = makeConfig({
      roof: makeRoof({ insulation: true, insulationThickness: 200 }),
    });
    const a = calculateTotalQuote(thin.buildings, thin.roof, DEFAULT_PRICE_BOOK, thin.defaultHeight).total;
    const b = calculateTotalQuote(thick.buildings, thick.roof, DEFAULT_PRICE_BOOK, thick.defaultHeight).total;
    expect(b).toBeGreaterThan(a);
  });

  it('uses a labelParams.count for post line items', () => {
    const cfg = makeConfig({
      buildings: [makeBuilding({ id: 'b1', type: 'overkapping', walls: {} })],
    });
    const { lineItems } = calculateTotalQuote(
      cfg.buildings,
      cfg.roof,
      DEFAULT_PRICE_BOOK,
      cfg.defaultHeight,
    );
    const posts = lineItems.find((i) => i.labelKey === 'quote.posts');
    expect(posts).toBeDefined();
    expect(posts?.labelParams?.count).toBeGreaterThan(0);
  });
});
