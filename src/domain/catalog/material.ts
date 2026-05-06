import { isValidSlug } from './slugs';
import {
  MATERIAL_CATEGORIES,
  type MaterialCategory,
  type MaterialCreateInput,
  type MaterialFlags,
  type MaterialPatchInput,
  type MaterialPricing,
  type MaterialTextures,
  type ValidationFieldError,
  type ValidationResult,
} from './types';

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const URL_RE = /^https?:\/\//;
const NAME_MAX = 100;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isCategory(v: unknown): v is MaterialCategory {
  return typeof v === 'string' && (MATERIAL_CATEGORIES as readonly string[]).includes(v);
}

function validateCategories(
  value: unknown,
  errors: ValidationFieldError[],
): MaterialCategory[] | undefined {
  if (!Array.isArray(value)) {
    errors.push({ field: 'categories', code: 'categories_invalid' });
    return undefined;
  }
  if (value.length === 0) {
    errors.push({ field: 'categories', code: 'categories_empty' });
    return undefined;
  }
  if (!value.every(isCategory)) {
    errors.push({ field: 'categories', code: 'categories_invalid' });
    return undefined;
  }
  // De-dup while preserving order.
  const seen = new Set<string>();
  const out: MaterialCategory[] = [];
  for (const c of value) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

function validateTextures(
  value: unknown,
  errors: ValidationFieldError[],
): MaterialTextures | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!isObject(value)) {
    errors.push({ field: 'textures', code: 'textures_invalid' });
    return undefined;
  }
  const { color, normal, roughness } = value as Record<string, unknown>;
  if (
    typeof color !== 'string' || !URL_RE.test(color) ||
    typeof normal !== 'string' || !URL_RE.test(normal) ||
    typeof roughness !== 'string' || !URL_RE.test(roughness)
  ) {
    errors.push({ field: 'textures', code: 'textures_invalid' });
    return undefined;
  }
  return { color, normal, roughness };
}

function validateTileSize(
  value: unknown,
  errors: ValidationFieldError[],
): [number, number] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    typeof value[0] !== 'number' ||
    typeof value[1] !== 'number' ||
    value[0] <= 0.1 || value[0] > 10 ||
    value[1] <= 0.1 || value[1] > 10
  ) {
    errors.push({ field: 'tileSize', code: 'tile_size_invalid' });
    return undefined;
  }
  return [value[0], value[1]];
}

/** Validate the `pricing` map against the categories the material claims.
 *  A material only prices the categories it's sold under. `roof-trim`
 *  pricing is optional — empty/missing means the fascia uses no
 *  per-m² cost. */
function validatePricing(
  categories: readonly MaterialCategory[],
  value: unknown,
  errors: ValidationFieldError[],
): MaterialPricing | undefined {
  if (!isObject(value)) {
    errors.push({ field: 'pricing', code: 'pricing_invalid' });
    return undefined;
  }
  const out: MaterialPricing = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isCategory(key)) {
      errors.push({ field: `pricing.${key}`, code: 'pricing_invalid' });
      return undefined;
    }
    if (!categories.includes(key)) {
      errors.push({ field: `pricing.${key}`, code: 'pricing_category_mismatch' });
      return undefined;
    }
    if (!isObject(entry)) {
      errors.push({ field: `pricing.${key}`, code: 'pricing_invalid' });
      return undefined;
    }
    const entryKeys = Object.keys(entry);
    if (key === 'door') {
      const s = (entry as Record<string, unknown>).surcharge;
      if (typeof s !== 'number' || s < 0 || !Number.isFinite(s) || entryKeys.some((k) => k !== 'surcharge')) {
        errors.push({ field: `pricing.${key}`, code: 'pricing_invalid' });
        return undefined;
      }
      out.door = { surcharge: s };
      continue;
    }
    // wall / roof-cover / floor / gate: expect { perSqm: number }
    const p = (entry as Record<string, unknown>).perSqm;
    if (typeof p !== 'number' || p < 0 || !Number.isFinite(p) || entryKeys.some((k) => k !== 'perSqm')) {
      errors.push({ field: `pricing.${key}`, code: 'pricing_invalid' });
      return undefined;
    }
    (out as Record<string, unknown>)[key] = { perSqm: p };
  }
  // Every pricing-bearing category in `categories` must have an entry —
  // except roof-trim, which has optional pricing (empty → free fascia).
  for (const c of categories) {
    if (c === 'roof-trim') continue;
    if (!(c in out)) {
      errors.push({ field: `pricing.${c}`, code: 'pricing_invalid' });
      return undefined;
    }
  }
  return out;
}

/** Validate `flags`. Flags are category-gated: `clearsOpenings` requires
 *  the material to be a wall; `isVoid` requires it to be a floor. Unknown
 *  keys are rejected. */
function validateFlags(
  categories: readonly MaterialCategory[],
  value: unknown,
  errors: ValidationFieldError[],
): MaterialFlags | undefined {
  if (value === undefined) return {};
  if (!isObject(value)) {
    errors.push({ field: 'flags', code: 'flags_invalid' });
    return undefined;
  }
  const out: MaterialFlags = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === 'clearsOpenings') {
      if (!categories.includes('wall') || typeof v !== 'boolean') {
        errors.push({ field: 'flags', code: 'flags_invalid' });
        return undefined;
      }
      if (v) out.clearsOpenings = true;
      continue;
    }
    if (k === 'isVoid') {
      if (!categories.includes('floor') || typeof v !== 'boolean') {
        errors.push({ field: 'flags', code: 'flags_invalid' });
        return undefined;
      }
      if (v) out.isVoid = true;
      continue;
    }
    errors.push({ field: 'flags', code: 'flags_invalid' });
    return undefined;
  }
  return out;
}

/** Validate the body for `POST /api/admin/materials`. Pure — does not
 *  touch the DB. Uniqueness (`slug_taken`) is enforced at the DB layer
 *  and mapped to the error code in the route handler. Cross-row checks
 *  like `void_conflict` are enforced in the route handler with a
 *  lookup before insert. */
export function validateMaterialCreate(
  input: unknown,
): ValidationResult<MaterialCreateInput> {
  if (!isObject(input)) {
    return { ok: false, errors: [{ field: 'body', code: 'name_invalid' }] };
  }
  const errors: ValidationFieldError[] = [];
  const { categories, slug, name, color, textures, tileSize, pricing, flags } =
    input as Record<string, unknown>;

  const categoriesOut = validateCategories(categories, errors);
  if (typeof slug !== 'string' || !isValidSlug(slug)) {
    errors.push({ field: 'slug', code: 'slug_invalid' });
  }
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > NAME_MAX) {
    errors.push({ field: 'name', code: 'name_invalid' });
  }
  if (typeof color !== 'string' || !COLOR_RE.test(color)) {
    errors.push({ field: 'color', code: 'color_invalid' });
  }

  const texturesOut = validateTextures(textures, errors);
  const tileSizeOut = validateTileSize(tileSize, errors);

  let pricingOut: MaterialPricing | undefined;
  let flagsOut: MaterialFlags | undefined;
  if (categoriesOut) {
    pricingOut = validatePricing(categoriesOut, pricing, errors);
    flagsOut = validateFlags(categoriesOut, flags, errors);
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      categories: categoriesOut!,
      slug: slug as string,
      name: (name as string).trim(),
      color: (color as string).toLowerCase(),
      textures: texturesOut ?? null,
      tileSize: tileSizeOut ?? null,
      pricing: pricingOut!,
      flags: flagsOut ?? {},
    },
  };
}

/** Validate a PATCH body. All fields optional. When `categories` or
 *  `pricing` / `flags` change, the route handler should re-run the
 *  combined validation (via `validateMaterialPatchWithContext` below)
 *  to ensure the resulting (categories, pricing, flags) trio is coherent. */
export function validateMaterialPatch(
  input: unknown,
): ValidationResult<MaterialPatchInput> {
  if (!isObject(input)) {
    return { ok: false, errors: [{ field: 'body', code: 'name_invalid' }] };
  }
  const errors: ValidationFieldError[] = [];
  const out: MaterialPatchInput = {};

  if ('categories' in input) {
    const c = validateCategories((input as { categories: unknown }).categories, errors);
    if (c) out.categories = c;
  }
  if ('slug' in input) {
    const s = (input as { slug: unknown }).slug;
    if (typeof s !== 'string' || !isValidSlug(s)) {
      errors.push({ field: 'slug', code: 'slug_invalid' });
    } else {
      out.slug = s;
    }
  }
  if ('name' in input) {
    const n = (input as { name: unknown }).name;
    if (typeof n !== 'string' || n.trim().length === 0 || n.length > NAME_MAX) {
      errors.push({ field: 'name', code: 'name_invalid' });
    } else {
      out.name = n.trim();
    }
  }
  if ('color' in input) {
    const c = (input as { color: unknown }).color;
    if (typeof c !== 'string' || !COLOR_RE.test(c)) {
      errors.push({ field: 'color', code: 'color_invalid' });
    } else {
      out.color = c.toLowerCase();
    }
  }
  if ('textures' in input) {
    const t = validateTextures((input as { textures: unknown }).textures, errors);
    if (t !== undefined || (input as { textures: unknown }).textures === null) {
      out.textures = t ?? null;
    }
  }
  if ('tileSize' in input) {
    const t = validateTileSize((input as { tileSize: unknown }).tileSize, errors);
    if (t !== undefined || (input as { tileSize: unknown }).tileSize === null) {
      out.tileSize = t ?? null;
    }
  }
  // Pricing/flags patches need categories context — accept as raw objects
  // here; the route validates against the post-merge categories.
  if ('pricing' in input) {
    const p = (input as { pricing: unknown }).pricing;
    if (!isObject(p)) {
      errors.push({ field: 'pricing', code: 'pricing_invalid' });
    } else {
      out.pricing = p as MaterialPricing;
    }
  }
  if ('flags' in input) {
    const f = (input as { flags: unknown }).flags;
    if (!isObject(f)) {
      errors.push({ field: 'flags', code: 'flags_invalid' });
    } else {
      out.flags = f as MaterialFlags;
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: out };
}

/** Re-validate a PATCH body against the merged (pre-patch + patch) view
 *  — call this in the route handler after merging to check coherence of
 *  categories + pricing + flags. */
export function validatePatchCoherence(
  mergedCategories: MaterialCategory[],
  mergedPricing: unknown,
  mergedFlags: unknown,
): ValidationResult<{ pricing: MaterialPricing; flags: MaterialFlags }> {
  const errors: ValidationFieldError[] = [];
  const p = validatePricing(mergedCategories, mergedPricing, errors);
  const f = validateFlags(mergedCategories, mergedFlags, errors);
  if (errors.length > 0 || !p || !f) return { ok: false, errors };
  return { ok: true, value: { pricing: p, flags: f } };
}
