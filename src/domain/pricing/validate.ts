import type { PriceBook } from './priceBook';

/** Generous per-field cap — catches obvious typos (a 7-figure door
 *  price) without dictating real pricing policy. Admin UI is expected
 *  to surface ranges below this to users. */
export const PRICE_BOOK_MAX = 100_000;

const SCALAR_KEYS = [
  'insulationPerSqmPerMm',
  'doorWindowSurcharge',
  'windowFee',
  'skylightFee',
  'postPrice',
  'bracePrice',
] as const satisfies readonly (keyof PriceBook)[];

const DOOR_SIZES = ['enkel', 'dubbel'] as const;

const POORT_KEYS = [
  'motorSurcharge',
  'slidingSurcharge',
  'perLeafBase',
] as const satisfies readonly (keyof PriceBook['poort'])[];

export interface PriceBookValidationResult {
  /** The subset of the patch that validated cleanly — safe to spread
   *  onto the current priceBook. */
  priceBook: Partial<PriceBook>;
  /** Field paths that failed validation, e.g. `postPrice`,
   *  `doorBase.dubbel`, or `body`. */
  errors: string[];
}

function isValidNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= PRICE_BOOK_MAX;
}

/** Validate an admin-supplied partial priceBook body. Unknown or
 *  out-of-range fields are rejected with a stable `errors[]` list;
 *  valid fields flow through to `priceBook` for a merge. Missing
 *  fields are allowed (PATCH semantics). */
export function validatePriceBookPatch(body: unknown): PriceBookValidationResult {
  if (!body || typeof body !== 'object') {
    return { priceBook: {}, errors: ['body'] };
  }
  const patch = body as Record<string, unknown>;
  const priceBook: Partial<PriceBook> = {};
  const errors: string[] = [];

  for (const key of SCALAR_KEYS) {
    if (patch[key] === undefined) continue;
    if (isValidNumber(patch[key])) {
      priceBook[key] = patch[key] as number;
    } else {
      errors.push(key);
    }
  }

  if (patch.doorBase !== undefined) {
    if (!patch.doorBase || typeof patch.doorBase !== 'object') {
      errors.push('doorBase');
    } else {
      const db = patch.doorBase as Record<string, unknown>;
      const doorBase: Partial<PriceBook['doorBase']> = {};
      for (const size of DOOR_SIZES) {
        if (db[size] === undefined) continue;
        if (isValidNumber(db[size])) {
          doorBase[size] = db[size] as number;
        } else {
          errors.push(`doorBase.${size}`);
        }
      }
      if (Object.keys(doorBase).length > 0) {
        priceBook.doorBase = doorBase as PriceBook['doorBase'];
      }
    }
  }

  if (patch.poort !== undefined) {
    if (!patch.poort || typeof patch.poort !== 'object') {
      errors.push('poort');
    } else {
      const pp = patch.poort as Record<string, unknown>;
      const poort: Partial<PriceBook['poort']> = {};
      for (const key of POORT_KEYS) {
        if (pp[key] === undefined) continue;
        if (isValidNumber(pp[key])) {
          poort[key] = pp[key] as number;
        } else {
          errors.push(`poort.${key}`);
        }
      }
      if (Object.keys(poort).length > 0) {
        priceBook.poort = poort as PriceBook['poort'];
      }
    }
  }

  return { priceBook, errors };
}
