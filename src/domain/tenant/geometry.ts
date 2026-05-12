/** Per-tenant structural geometry. One number for the post / lumber
 *  cross-section drives every visible structural element — corner posts,
 *  intermediate posts, the wall envelope thickness, fascia depth, and the
 *  upper bound for middenlaag beam depth. Brands that build with 140mm
 *  set 140; brands that build with 150mm set 150. */
export interface TenantGeometry {
  /** Post / lumber cross-section in millimetres. Tenant default; the
   *  configurator can override per-scene via `ConfigData.postSizeMm`. */
  postSizeMm: number;
  /** Presets the CONFIGURATOR's "Globaal → Paaldikte" picker exposes.
   *  Admin owns this list; the configurator can only pick from it (no
   *  free-form input). The tenant's `postSizeMm` should normally appear
   *  in this list so the default is always selectable. */
  postSizePresetsMm: number[];
}

const FALLBACK_PRESETS_MM = [120, 140, 150, 180, 200];

export const DEFAULT_TENANT_GEOMETRY: TenantGeometry = {
  postSizeMm: 150,
  postSizePresetsMm: [...FALLBACK_PRESETS_MM],
};

/** Merge a (possibly partial / possibly null) stored value over defaults
 *  so the runtime context is always fully populated. Mirrors
 *  `resolveTenantFeatures` — rows that predate the column resolve to
 *  `DEFAULT_TENANT_GEOMETRY`. */
export function resolveTenantGeometry(
  stored: Partial<TenantGeometry> | null | undefined,
): TenantGeometry {
  const base = { ...DEFAULT_TENANT_GEOMETRY };
  if (!stored) return base;
  return {
    ...base,
    ...stored,
    // Always end up with a non-empty preset list — defensive when older
    // rows have only `postSizeMm` (no presets column yet).
    postSizePresetsMm:
      Array.isArray(stored.postSizePresetsMm) && stored.postSizePresetsMm.length > 0
        ? stored.postSizePresetsMm
        : base.postSizePresetsMm,
  };
}

/** Convenience export — same list the default geometry seeds. */
export const POST_SIZE_PRESETS_MM = FALLBACK_PRESETS_MM;

const POST_SIZE_MIN_MM = 80;
const POST_SIZE_MAX_MM = 300;

export interface ValidatedGeometryPatch {
  geometry: Partial<TenantGeometry>;
  errors: string[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Validate a partial geometry update. Mirrors validateBrandingPatch /
 *  validateInvoicingPatch — returns the cleaned partial plus a list of
 *  field paths that failed. Empty `errors` == safe to merge. */
export function validateGeometryPatch(input: unknown): ValidatedGeometryPatch {
  if (!isObject(input)) return { geometry: {}, errors: ['body'] };
  const out: Partial<TenantGeometry> = {};
  const errors: string[] = [];

  if ('postSizeMm' in input) {
    const v = input.postSizeMm;
    if (
      typeof v === 'number' &&
      Number.isFinite(v) &&
      v >= POST_SIZE_MIN_MM &&
      v <= POST_SIZE_MAX_MM
    ) {
      out.postSizeMm = v;
    } else {
      errors.push('postSizeMm');
    }
  }
  if ('postSizePresetsMm' in input) {
    const v = input.postSizePresetsMm;
    if (
      Array.isArray(v) &&
      v.length > 0 &&
      v.every(
        (n) =>
          typeof n === 'number' &&
          Number.isFinite(n) &&
          n >= POST_SIZE_MIN_MM &&
          n <= POST_SIZE_MAX_MM,
      )
    ) {
      // De-dupe + sort ascending so the configurator's button row is
      // stable regardless of input order.
      out.postSizePresetsMm = Array.from(new Set(v as number[])).sort((a, b) => a - b);
    } else {
      errors.push('postSizePresetsMm');
    }
  }

  return { geometry: out, errors };
}
