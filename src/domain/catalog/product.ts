import { isValidSlug } from './slugs';
import {
  PRODUCT_KINDS,
  PRODUCT_SLOT_TO_CATEGORY,
  PRODUCT_SLOTS,
  type ProductConstraints,
  type ProductCreateInput,
  type ProductDefaults,
  type ProductKind,
  type ProductPatchInput,
  type ProductRow,
  type ProductSlot,
  type ProductValidationFieldError,
  type ProductValidationResult,
} from './types';

const URL_RE = /^https?:\/\//;
const NAME_MAX = 100;
const DESCRIPTION_MAX = 1000;
const DIM_MIN = 0.5;
const DIM_MAX = 40;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isKind(v: unknown): v is ProductKind {
  return typeof v === 'string' && (PRODUCT_KINDS as readonly string[]).includes(v);
}

function isSlot(v: unknown): v is ProductSlot {
  return typeof v === 'string' && (PRODUCT_SLOTS as readonly string[]).includes(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function validateDefaults(
  value: unknown,
  errors: ProductValidationFieldError[],
): ProductDefaults | undefined {
  if (value === undefined) return {};
  if (!isObject(value)) {
    errors.push({ field: 'defaults', code: 'dimensions_invalid' });
    return undefined;
  }
  const out: ProductDefaults = {};
  for (const k of ['width', 'depth', 'height'] as const) {
    if (k in value) {
      const n = (value as Record<string, unknown>)[k];
      if (!isFiniteNumber(n) || n < DIM_MIN || n > DIM_MAX) {
        errors.push({ field: `defaults.${k}`, code: 'dimensions_invalid' });
        return undefined;
      }
      out[k] = n;
    }
  }
  if ('materials' in value) {
    const m = (value as Record<string, unknown>).materials;
    if (!isObject(m)) {
      errors.push({ field: 'defaults.materials', code: 'default_material_not_found' });
      return undefined;
    }
    const mats: Partial<Record<ProductSlot, string>> = {};
    for (const [slot, slug] of Object.entries(m)) {
      if (!isSlot(slot)) {
        errors.push({ field: `defaults.materials.${slot}`, code: 'default_material_not_found' });
        return undefined;
      }
      if (typeof slug !== 'string' || !isValidSlug(slug as string)) {
        errors.push({ field: `defaults.materials.${slot}`, code: 'default_material_not_found' });
        return undefined;
      }
      mats[slot] = slug as string;
    }
    out.materials = mats;
  }
  return out;
}

// TODO(Phase 5.5.3): product constraint dimensions (`minWidth` etc.) are
// currently bounded to [0, 40]; this intentionally overrides the engine's
// stricter per-type limits in `@/domain/building`. If/when we re-align,
// clamp constraint values to the kind's engine max during validation.
function validateConstraints(
  value: unknown,
  errors: ProductValidationFieldError[],
): ProductConstraints | undefined {
  if (value === undefined) return {};
  if (!isObject(value)) {
    errors.push({ field: 'constraints', code: 'constraints_invalid' });
    return undefined;
  }
  const out: ProductConstraints = {};
  const pairs: Array<['minWidth', 'maxWidth'] | ['minDepth', 'maxDepth'] | ['minHeight', 'maxHeight']> = [
    ['minWidth', 'maxWidth'],
    ['minDepth', 'maxDepth'],
    ['minHeight', 'maxHeight'],
  ];
  for (const [minKey, maxKey] of pairs) {
    for (const key of [minKey, maxKey] as const) {
      if (key in value) {
        const n = (value as Record<string, unknown>)[key];
        if (!isFiniteNumber(n) || n < 0 || n > DIM_MAX) {
          errors.push({ field: `constraints.${key}`, code: 'dimensions_invalid' });
          return undefined;
        }
        out[key] = n;
      }
    }
    const min = out[minKey];
    const max = out[maxKey];
    if (min !== undefined && max !== undefined && min > max) {
      errors.push({ field: 'constraints', code: 'constraints_invalid' });
      return undefined;
    }
  }
  if ('allowedMaterialsBySlot' in value) {
    const a = (value as Record<string, unknown>).allowedMaterialsBySlot;
    if (!isObject(a)) {
      errors.push({ field: 'constraints', code: 'constraints_invalid' });
      return undefined;
    }
    const allow: Partial<Record<ProductSlot, string[]>> = {};
    for (const [slot, slugs] of Object.entries(a)) {
      if (!isSlot(slot)) {
        errors.push({ field: 'constraints', code: 'constraints_invalid' });
        return undefined;
      }
      if (!Array.isArray(slugs) || slugs.some((s) => typeof s !== 'string' || !isValidSlug(s as string))) {
        errors.push({ field: 'constraints', code: 'constraints_invalid' });
        return undefined;
      }
      allow[slot] = [...new Set(slugs as string[])];
    }
    void PRODUCT_SLOT_TO_CATEGORY; // kept for future cross-category checks
    out.allowedMaterialsBySlot = allow;
  }
  return out;
}

/** Create-body validator. Pure — does not check cross-table references
 *  to `materials` (that happens in the route handler, which has DB
 *  access). Uniqueness (`slug_taken`) is DB-enforced. */
export function validateProductCreate(
  input: unknown,
): ProductValidationResult<ProductCreateInput> {
  if (!isObject(input)) {
    return { ok: false, errors: [{ field: 'body', code: 'name_invalid' }] };
  }
  const errors: ProductValidationFieldError[] = [];
  const {
    kind, slug, name, description, heroImage,
    defaults, constraints, basePriceCents, sortOrder,
  } = input as Record<string, unknown>;

  if (!isKind(kind)) {
    errors.push({ field: 'kind', code: 'kind_invalid' });
  }
  if (typeof slug !== 'string' || !isValidSlug(slug)) {
    errors.push({ field: 'slug', code: 'slug_invalid' });
  }
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > NAME_MAX) {
    errors.push({ field: 'name', code: 'name_invalid' });
  }
  let descOut: string | null = null;
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string' || description.length > DESCRIPTION_MAX) {
      errors.push({ field: 'description', code: 'description_invalid' });
    } else {
      descOut = description;
    }
  }
  let heroOut: string | null = null;
  if (heroImage !== undefined && heroImage !== null) {
    if (typeof heroImage !== 'string' || !URL_RE.test(heroImage)) {
      errors.push({ field: 'heroImage', code: 'hero_image_invalid' });
    } else {
      heroOut = heroImage;
    }
  }
  const defaultsOut = validateDefaults(defaults, errors);
  const constraintsOut = validateConstraints(constraints, errors);

  let basePriceOut = 0;
  if (basePriceCents !== undefined) {
    if (!isFiniteNumber(basePriceCents) || basePriceCents < 0 || !Number.isInteger(basePriceCents)) {
      errors.push({ field: 'basePriceCents', code: 'base_price_invalid' });
    } else {
      basePriceOut = basePriceCents;
    }
  }
  let sortOrderOut = 0;
  if (sortOrder !== undefined) {
    if (!isFiniteNumber(sortOrder) || !Number.isInteger(sortOrder)) {
      errors.push({ field: 'sortOrder', code: 'sort_order_invalid' });
    } else {
      sortOrderOut = sortOrder;
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      kind: kind as ProductKind,
      slug: slug as string,
      name: (name as string).trim(),
      description: descOut,
      heroImage: heroOut,
      defaults: defaultsOut!,
      constraints: constraintsOut!,
      basePriceCents: basePriceOut,
      sortOrder: sortOrderOut,
    },
  };
}

/** Patch-body validator. All fields optional. `kind` cannot be changed. */
export function validateProductPatch(
  input: unknown,
): ProductValidationResult<ProductPatchInput> {
  if (!isObject(input)) {
    return { ok: false, errors: [{ field: 'body', code: 'name_invalid' }] };
  }
  const errors: ProductValidationFieldError[] = [];
  const out: ProductPatchInput = {};

  if ('kind' in input) {
    errors.push({ field: 'kind', code: 'kind_invalid' });
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
  if ('description' in input) {
    const d = (input as { description: unknown }).description;
    if (d === null) {
      out.description = null;
    } else if (typeof d !== 'string' || d.length > DESCRIPTION_MAX) {
      errors.push({ field: 'description', code: 'description_invalid' });
    } else {
      out.description = d;
    }
  }
  if ('heroImage' in input) {
    const h = (input as { heroImage: unknown }).heroImage;
    if (h === null) {
      out.heroImage = null;
    } else if (typeof h !== 'string' || !URL_RE.test(h)) {
      errors.push({ field: 'heroImage', code: 'hero_image_invalid' });
    } else {
      out.heroImage = h;
    }
  }
  if ('defaults' in input) {
    const d = validateDefaults((input as { defaults: unknown }).defaults, errors);
    if (d !== undefined) out.defaults = d;
  }
  if ('constraints' in input) {
    const c = validateConstraints((input as { constraints: unknown }).constraints, errors);
    if (c !== undefined) out.constraints = c;
  }
  if ('basePriceCents' in input) {
    const n = (input as { basePriceCents: unknown }).basePriceCents;
    if (!isFiniteNumber(n) || n < 0 || !Number.isInteger(n)) {
      errors.push({ field: 'basePriceCents', code: 'base_price_invalid' });
    } else {
      out.basePriceCents = n;
    }
  }
  if ('sortOrder' in input) {
    const n = (input as { sortOrder: unknown }).sortOrder;
    if (!isFiniteNumber(n) || !Number.isInteger(n)) {
      errors.push({ field: 'sortOrder', code: 'sort_order_invalid' });
    } else {
      out.sortOrder = n;
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: out };
}

/** Partial BuildingEntity-shape derived from a product's defaults. The
 *  configurator layer spreads this into a new entity, filling remaining
 *  fields (walls, roof, id, position, orientation, heightOverride) with
 *  its own engine defaults. Framework-free — no reverse-dependency on
 *  `@/domain/building`. */
export interface ProductBuildingDefaults {
  sourceProductId: string;
  type: ProductKind;
  dimensions: { width?: number; depth?: number; height?: number };
  primaryMaterialId?: string;
  floor?: { materialId: string };
  roof?: { coveringId?: string; trimMaterialId?: string };
  door?: { doorMaterialId?: string };
}

/** Build a partial BuildingEntity defaults payload from a product. */
export function applyProductDefaults(product: ProductRow): ProductBuildingDefaults {
  const out: ProductBuildingDefaults = {
    sourceProductId: product.id,
    type: product.kind,
    dimensions: {},
  };
  if (product.defaults.width !== undefined) out.dimensions.width = product.defaults.width;
  if (product.defaults.depth !== undefined) out.dimensions.depth = product.defaults.depth;
  if (product.defaults.height !== undefined) out.dimensions.height = product.defaults.height;

  const mats = product.defaults.materials;
  if (mats) {
    if (mats.wallCladding) out.primaryMaterialId = mats.wallCladding;
    if (mats.floor) out.floor = { materialId: mats.floor };
    if (mats.roofCovering || mats.roofTrim) {
      out.roof = {};
      if (mats.roofCovering) out.roof.coveringId = mats.roofCovering;
      if (mats.roofTrim) out.roof.trimMaterialId = mats.roofTrim;
    }
    if (mats.door) out.door = { doorMaterialId: mats.door };
  }
  return out;
}
