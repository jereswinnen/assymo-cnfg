import { describe, it, expect } from 'vite-plus/test';
import { PRICE_BOOK_MAX, validatePriceBookPatch } from '@/domain/pricing';

describe('validatePriceBookPatch', () => {
  it('accepts an empty patch with no errors', () => {
    const { priceBook, errors } = validatePriceBookPatch({});
    expect(priceBook).toEqual({});
    expect(errors).toEqual([]);
  });

  it('accepts valid scalar fields', () => {
    const { priceBook, errors } = validatePriceBookPatch({
      postPrice: 150,
      skylightFee: 900,
    });
    expect(priceBook).toEqual({ postPrice: 150, skylightFee: 900 });
    expect(errors).toEqual([]);
  });

  it('rejects negative numbers', () => {
    const { priceBook, errors } = validatePriceBookPatch({ postPrice: -1 });
    expect(priceBook.postPrice).toBeUndefined();
    expect(errors).toContain('postPrice');
  });

  it('rejects non-numeric values', () => {
    const { errors } = validatePriceBookPatch({ postPrice: '150' as unknown });
    expect(errors).toContain('postPrice');
  });

  it('rejects values over PRICE_BOOK_MAX', () => {
    const { errors } = validatePriceBookPatch({ postPrice: PRICE_BOOK_MAX + 1 });
    expect(errors).toContain('postPrice');
  });

  it('accepts boundary values 0 and PRICE_BOOK_MAX', () => {
    const { priceBook, errors } = validatePriceBookPatch({
      windowFee: 0,
      skylightFee: PRICE_BOOK_MAX,
    });
    expect(priceBook.windowFee).toBe(0);
    expect(priceBook.skylightFee).toBe(PRICE_BOOK_MAX);
    expect(errors).toEqual([]);
  });

  it('accepts nested doorBase updates', () => {
    const { priceBook, errors } = validatePriceBookPatch({
      doorBase: { enkel: 900 },
    });
    expect(priceBook.doorBase).toEqual({ enkel: 900 });
    expect(errors).toEqual([]);
  });

  it('rejects invalid values inside doorBase with a dotted path', () => {
    const { priceBook, errors } = validatePriceBookPatch({
      doorBase: { enkel: 900, dubbel: -5 },
    });
    expect(priceBook.doorBase).toEqual({ enkel: 900 });
    expect(errors).toContain('doorBase.dubbel');
  });

  it('flags the body when input is not an object', () => {
    expect(validatePriceBookPatch(null).errors).toEqual(['body']);
    expect(validatePriceBookPatch('nope').errors).toEqual(['body']);
    expect(validatePriceBookPatch(42).errors).toEqual(['body']);
  });

  it('silently drops unknown fields (PATCH semantics)', () => {
    const { priceBook, errors } = validatePriceBookPatch({
      postPrice: 150,
      unknownField: 999,
    });
    expect(priceBook).toEqual({ postPrice: 150 });
    expect(errors).toEqual([]);
  });
});
