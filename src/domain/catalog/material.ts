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

function validatePricing(
  category: MaterialCategory,
  value: unknown,
  errors: ValidationFieldError[],
): MaterialPricing | undefined {
  if (!isObject(value)) {
    errors.push({ field: 'pricing', code: 'pricing_invalid' });
    return undefined;
  }
  const keys = Object.keys(value);
  const allowsPerSqm = category === 'wall' || category === 'roof-cover' || category === 'floor';
  const allowsSurcharge = category === 'door';
  const allowsEmpty = category === 'roof-trim';

  if (allowsPerSqm) {
    const p = (value as Record<string, unknown>).perSqm;
    if (typeof p !== 'number' || p < 0 || !Number.isFinite(p)) {
      errors.push({ field: 'pricing', code: 'pricing_invalid' });
      return undefined;
    }
    if (keys.some((k) => k !== 'perSqm')) {
      errors.push({ field: 'pricing', code: 'pricing_invalid' });
      return undefined;
    }
    return { perSqm: p };
  }
  if (allowsSurcharge) {
    const s = (value as Record<string, unknown>).surcharge;
    if (typeof s !== 'number' || s < 0 || !Number.isFinite(s)) {
      errors.push({ field: 'pricing', code: 'pricing_invalid' });
      return undefined;
    }
    if (keys.some((k) => k !== 'surcharge')) {
      errors.push({ field: 'pricing', code: 'pricing_invalid' });
      return undefined;
    }
    return { surcharge: s };
  }
  if (allowsEmpty) {
    if (keys.length !== 0) {
      errors.push({ field: 'pricing', code: 'pricing_invalid' });
      return undefined;
    }
    return {};
  }
  errors.push({ field: 'pricing', code: 'pricing_invalid' });
  return undefined;
}

function validateFlags(
  category: MaterialCategory,
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
      if (category !== 'wall' || typeof v !== 'boolean') {
        errors.push({ field: 'flags', code: 'flags_invalid' });
        return undefined;
      }
      if (v) out.clearsOpenings = true;
      continue;
    }
    if (k === 'isVoid') {
      if (category !== 'floor' || typeof v !== 'boolean') {
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
  const { category, slug, name, color, textures, tileSize, pricing, flags } =
    input as Record<string, unknown>;

  if (!isCategory(category)) {
    errors.push({ field: 'category', code: 'category_invalid' });
  }
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
  if (isCategory(category)) {
    pricingOut = validatePricing(category, pricing, errors);
    flagsOut = validateFlags(category, flags, errors);
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      category: category as MaterialCategory,
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

/** Validate a PATCH body. All fields optional. Category cannot be
 *  changed on an existing row. */
export function validateMaterialPatch(
  input: unknown,
): ValidationResult<MaterialPatchInput> {
  if (!isObject(input)) {
    return { ok: false, errors: [{ field: 'body', code: 'name_invalid' }] };
  }
  const errors: ValidationFieldError[] = [];
  const out: MaterialPatchInput = {};

  if ('category' in input) {
    errors.push({ field: 'category', code: 'category_invalid' });
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
  // Note: pricing/flags patches require knowing category to validate
  // per-category shape. Route handler fetches the row first, passes
  // category in as a second arg — modelled below as an overload once
  // route lands. Here we accept pricing/flags objects at face value
  // (shape-check only) and let the route re-validate against category.
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
