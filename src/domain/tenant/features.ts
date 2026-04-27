/** Per-tenant configurator feature flags. Stored as jsonb on the tenants
 *  row and surfaced on `TenantContext.features`. Add new flags by appending
 *  a key here, defaulting it in `DEFAULT_TENANT_FEATURES`, and validating
 *  it in `validateFeaturesPatch`. The resolver merges DB rows over the
 *  defaults so older rows with `{}` (or `null`) keep working. */
export interface TenantFeatures {
  /** When true, single-clicking a wall in the schematic enters wall
   *  elevation view (front-on render with door/window placement).
   *  Off by default — most tenants don't want this surfaced. */
  wallElevationView: boolean;
}

export const DEFAULT_TENANT_FEATURES: TenantFeatures = {
  wallElevationView: false,
};

/** Merge a (possibly partial / possibly null) stored value over defaults
 *  so the runtime context is always fully populated. */
export function resolveTenantFeatures(stored: Partial<TenantFeatures> | null | undefined): TenantFeatures {
  if (!stored) return { ...DEFAULT_TENANT_FEATURES };
  return { ...DEFAULT_TENANT_FEATURES, ...stored };
}

export interface ValidatedFeaturesPatch {
  features: Partial<TenantFeatures>;
  errors: string[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Validate a partial features update. Returns the cleaned partial plus a
 *  list of field paths that failed. Empty errors == safe to merge. */
export function validateFeaturesPatch(input: unknown): ValidatedFeaturesPatch {
  if (!isObject(input)) return { features: {}, errors: ['body'] };
  const out: Partial<TenantFeatures> = {};
  const errors: string[] = [];

  if ('wallElevationView' in input) {
    if (typeof input.wallElevationView === 'boolean') {
      out.wallElevationView = input.wallElevationView;
    } else {
      errors.push('wallElevationView');
    }
  }

  return { features: out, errors };
}
