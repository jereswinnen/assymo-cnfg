import { MATERIALS_REGISTRY } from '@/domain/materials/atoms';

/** Per-tenant material allow-list. `null` = unrestricted; any array
 *  (including empty) is interpreted literally. */
export type EnabledMaterials = string[] | null;

export interface ValidatedEnabledMaterialsPatch {
  enabledMaterials: EnabledMaterials | undefined;
  errors: string[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Validate a PATCH body for the enabled-materials endpoint. Mirrors
 *  the shape of validateBrandingPatch / validatePriceBookPatch:
 *  returns the cleaned value plus a list of field paths that failed.
 *  Empty errors == safe to store. Slugs must exist in the registry
 *  to catch typos early; the tenant can't enable a material that
 *  doesn't exist yet. */
export function validateEnabledMaterialsPatch(
  input: unknown,
): ValidatedEnabledMaterialsPatch {
  if (!isObject(input)) {
    return { enabledMaterials: undefined, errors: ['body'] };
  }

  if (!('enabledMaterials' in input)) {
    return { enabledMaterials: undefined, errors: ['enabledMaterials'] };
  }

  const raw = input.enabledMaterials;

  if (raw === null) {
    return { enabledMaterials: null, errors: [] };
  }

  if (!Array.isArray(raw)) {
    return { enabledMaterials: undefined, errors: ['enabledMaterials'] };
  }

  const errors: string[] = [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const slug = raw[i];
    if (typeof slug !== 'string' || slug.length === 0) {
      errors.push(`enabledMaterials[${i}]`);
      continue;
    }
    if (!(slug in MATERIALS_REGISTRY)) {
      errors.push(`enabledMaterials[${i}]`);
      continue;
    }
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }

  if (errors.length > 0) {
    return { enabledMaterials: undefined, errors };
  }
  return { enabledMaterials: out, errors: [] };
}
