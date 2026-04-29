import { isValidSlug } from './slugs';
import {
  PRODUCT_KINDS,
  PRODUCT_SLOT_TO_CATEGORY,
  PRODUCT_SLOTS,
  type MaterialRow,
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

// Poort dimension envelope (mirrors `getConstraints('poort')` from
// `@/domain/building/constants`, in millimeters). Inlined to avoid a
// circular import: `building/index` re-exports `kinds`, which already
// imports `catalog` types.
const POORT_PART_WIDTH_MIN_MM = 100;
const POORT_PART_WIDTH_MAX_MM = 6000;
const POORT_HEIGHT_MIN_MM = 100;
const POORT_HEIGHT_MAX_MM = 3500;
/** Visible centre seam between the two leaves of a 2-part gate. Zero is
 *  legal (touching leaves); upper bound a generous 500mm covers everything
 *  from a flush steel gate to a deliberately wide picket-style spacing. */
const POORT_PART_GAP_MIN_MM = 0;
const POORT_PART_GAP_MAX_MM = 500;
const POORT_SWING_DIRECTIONS = ['inward', 'outward', 'sliding'] as const;
type PoortSwing = (typeof POORT_SWING_DIRECTIONS)[number];

function isPoortSwing(v: unknown): v is PoortSwing {
  return typeof v === 'string' && (POORT_SWING_DIRECTIONS as readonly string[]).includes(v);
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

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
  if ('poort' in value) {
    const p = (value as Record<string, unknown>).poort;
    if (!isObject(p)) {
      errors.push({ field: 'defaults.poort', code: 'constraints_invalid' });
      return undefined;
    }
    const poort: NonNullable<ProductDefaults['poort']> = {};
    if ('partCount' in p) {
      const n = p.partCount;
      if (n !== 1 && n !== 2) {
        errors.push({ field: 'defaults.poort.partCount', code: 'poort_part_count_invalid' });
        return undefined;
      }
      poort.partCount = n;
    }
    if ('partWidthMm' in p) {
      const n = p.partWidthMm;
      if (!isPositiveInt(n) || n < POORT_PART_WIDTH_MIN_MM || n > POORT_PART_WIDTH_MAX_MM) {
        errors.push({ field: 'defaults.poort.partWidthMm', code: 'poort_part_width_invalid' });
        return undefined;
      }
      poort.partWidthMm = n;
    }
    if ('heightMm' in p) {
      const n = p.heightMm;
      if (!isPositiveInt(n) || n < POORT_HEIGHT_MIN_MM || n > POORT_HEIGHT_MAX_MM) {
        errors.push({ field: 'defaults.poort.heightMm', code: 'poort_height_invalid' });
        return undefined;
      }
      poort.heightMm = n;
    }
    if ('partGapMm' in p) {
      const n = p.partGapMm;
      if (
        typeof n !== 'number' ||
        !Number.isInteger(n) ||
        n < POORT_PART_GAP_MIN_MM ||
        n > POORT_PART_GAP_MAX_MM
      ) {
        errors.push({ field: 'defaults.poort.partGapMm', code: 'poort_part_gap_invalid' });
        return undefined;
      }
      poort.partGapMm = n;
    }
    if ('swingDirection' in p) {
      if (!isPoortSwing(p.swingDirection)) {
        errors.push({ field: 'defaults.poort.swingDirection', code: 'poort_swing_invalid' });
        return undefined;
      }
      poort.swingDirection = p.swingDirection;
    }
    if ('motorized' in p) {
      if (typeof p.motorized !== 'boolean') {
        errors.push({ field: 'defaults.poort.motorized', code: 'poort_motorized_invalid' });
        return undefined;
      }
      poort.motorized = p.motorized;
    }
    if ('materialId' in p) {
      const s = p.materialId;
      if (s !== undefined && s !== '') {
        if (typeof s !== 'string' || !isValidSlug(s)) {
          errors.push({ field: 'defaults.poort.materialId', code: 'poort_material_invalid' });
          return undefined;
        }
        poort.materialId = s;
      }
    }
    out.poort = poort;
  }
  return out;
}

// Product constraint dimensions (`minWidth` etc.) are bounded to [0, 40] —
// intentionally wider than the engine's per-type caps so tenants can ship
// larger kits without a schema change. Runtime dimension clamping still
// enforces the engine caps.
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
  if ('poort' in value) {
    const p = (value as Record<string, unknown>).poort;
    if (!isObject(p)) {
      errors.push({ field: 'constraints.poort', code: 'constraints_invalid' });
      return undefined;
    }
    const poort: NonNullable<ProductConstraints['poort']> = {};
    if ('partCountAllowed' in p) {
      const arr = p.partCountAllowed;
      if (!Array.isArray(arr) || arr.length === 0) {
        errors.push({ field: 'constraints.poort.partCountAllowed', code: 'poort_part_count_invalid' });
        return undefined;
      }
      const seen = new Set<number>();
      for (const v of arr) {
        if (v !== 1 && v !== 2) {
          errors.push({ field: 'constraints.poort.partCountAllowed', code: 'poort_part_count_invalid' });
          return undefined;
        }
        if (seen.has(v)) {
          errors.push({ field: 'constraints.poort.partCountAllowed', code: 'poort_part_count_invalid' });
          return undefined;
        }
        seen.add(v);
      }
      poort.partCountAllowed = [...seen] as (1 | 2)[];
    }
    for (const k of ['partWidthMinMm', 'partWidthMaxMm'] as const) {
      if (k in p) {
        const n = (p as Record<string, unknown>)[k];
        if (!isPositiveInt(n) || n < POORT_PART_WIDTH_MIN_MM || n > POORT_PART_WIDTH_MAX_MM) {
          errors.push({ field: `constraints.poort.${k}`, code: 'poort_part_width_invalid' });
          return undefined;
        }
        poort[k] = n;
      }
    }
    if (
      poort.partWidthMinMm !== undefined &&
      poort.partWidthMaxMm !== undefined &&
      poort.partWidthMinMm > poort.partWidthMaxMm
    ) {
      errors.push({ field: 'constraints.poort', code: 'constraints_invalid' });
      return undefined;
    }
    for (const k of ['heightMinMm', 'heightMaxMm'] as const) {
      if (k in p) {
        const n = (p as Record<string, unknown>)[k];
        if (!isPositiveInt(n) || n < POORT_HEIGHT_MIN_MM || n > POORT_HEIGHT_MAX_MM) {
          errors.push({ field: `constraints.poort.${k}`, code: 'poort_height_invalid' });
          return undefined;
        }
        poort[k] = n;
      }
    }
    if (
      poort.heightMinMm !== undefined &&
      poort.heightMaxMm !== undefined &&
      poort.heightMinMm > poort.heightMaxMm
    ) {
      errors.push({ field: 'constraints.poort', code: 'constraints_invalid' });
      return undefined;
    }
    if ('swingsAllowed' in p) {
      const arr = p.swingsAllowed;
      if (!Array.isArray(arr) || arr.length === 0) {
        errors.push({ field: 'constraints.poort.swingsAllowed', code: 'poort_swing_invalid' });
        return undefined;
      }
      const seen = new Set<PoortSwing>();
      for (const v of arr) {
        if (!isPoortSwing(v) || seen.has(v)) {
          errors.push({ field: 'constraints.poort.swingsAllowed', code: 'poort_swing_invalid' });
          return undefined;
        }
        seen.add(v);
      }
      poort.swingsAllowed = [...seen];
    }
    if ('motorizedAllowed' in p) {
      if (typeof p.motorizedAllowed !== 'boolean') {
        errors.push({ field: 'constraints.poort.motorizedAllowed', code: 'poort_motorized_invalid' });
        return undefined;
      }
      poort.motorizedAllowed = p.motorizedAllowed;
    }
    if ('allowedMaterialSlugs' in p) {
      const arr = p.allowedMaterialSlugs;
      if (!Array.isArray(arr)) {
        errors.push({ field: 'constraints.poort.allowedMaterialSlugs', code: 'poort_material_invalid' });
        return undefined;
      }
      const seen = new Set<string>();
      for (const s of arr) {
        if (typeof s !== 'string' || !isValidSlug(s)) {
          errors.push({ field: 'constraints.poort.allowedMaterialSlugs', code: 'poort_material_invalid' });
          return undefined;
        }
        seen.add(s);
      }
      poort.allowedMaterialSlugs = [...seen];
    }
    out.poort = poort;
  }
  return out;
}

/** Create-body validator. Pure — `materials` is the tenant's full
 *  material list (used for the `kind === 'poort'` tenant-feature-flag
 *  rule and for resolving gate-material slug references). Uniqueness
 *  (`slug_taken`) and cross-table material-slug refs for non-poort
 *  slots are DB-enforced in the route handler. */
export function validateProductCreate(
  input: unknown,
  materials: MaterialRow[],
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

  // Cross-kind contamination + poort tenant/material-availability rules.
  if (isKind(kind) && defaultsOut !== undefined && constraintsOut !== undefined) {
    if (kind === 'poort') {
      // Reject structural fields that don't apply to gate primitives.
      if (
        defaultsOut.width !== undefined ||
        defaultsOut.depth !== undefined ||
        defaultsOut.height !== undefined
      ) {
        errors.push({ field: 'defaults', code: 'kind_field_mismatch' });
      }
      if (defaultsOut.materials !== undefined) {
        errors.push({ field: 'defaults.materials', code: 'kind_field_mismatch' });
      }
      if (
        constraintsOut.minWidth !== undefined ||
        constraintsOut.maxWidth !== undefined ||
        constraintsOut.minDepth !== undefined ||
        constraintsOut.maxDepth !== undefined ||
        constraintsOut.minHeight !== undefined ||
        constraintsOut.maxHeight !== undefined ||
        constraintsOut.allowedMaterialsBySlot !== undefined
      ) {
        errors.push({ field: 'constraints', code: 'kind_field_mismatch' });
      }
      // Tenant feature-flag: at least one non-archived gate material.
      const gateMaterials = materials.filter(
        (m) => m.archivedAt === null && m.categories.includes('gate'),
      );
      if (gateMaterials.length === 0) {
        errors.push({ field: 'kind', code: 'kind_unsupported_for_tenant' });
      } else {
        const gateSlugs = new Set(gateMaterials.map((m) => m.slug));
        if (defaultsOut.poort?.materialId !== undefined && !gateSlugs.has(defaultsOut.poort.materialId)) {
          errors.push({ field: 'defaults.poort.materialId', code: 'poort_material_invalid' });
        }
        if (constraintsOut.poort?.allowedMaterialSlugs) {
          for (const s of constraintsOut.poort.allowedMaterialSlugs) {
            if (!gateSlugs.has(s)) {
              errors.push({ field: 'constraints.poort.allowedMaterialSlugs', code: 'poort_material_invalid' });
              break;
            }
          }
        }
      }
    } else {
      if (defaultsOut.poort !== undefined) {
        errors.push({ field: 'defaults.poort', code: 'kind_field_mismatch' });
      }
      if (constraintsOut.poort !== undefined) {
        errors.push({ field: 'constraints.poort', code: 'kind_field_mismatch' });
      }
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
  /** Only populated when `type === 'poort'`. Mirrors `Partial<GateConfig>`
   *  from `@/domain/building`; declared inline to keep `catalog` free of
   *  reverse-dependencies on `building`. The configurator's `addBuilding`
   *  spreads this into `createGateBuildingEntity`, so any field omitted
   *  here falls back to `defaultGateConfig()`. Dimensions for poort flow
   *  through the generic `dimensions` field above (translated from the
   *  product-authored `partWidthMm`/`heightMm` at apply time). */
  gateConfig?: {
    partCount?: 1 | 2;
    materialId?: string;
    swingDirection?: 'inward' | 'outward' | 'sliding';
    motorized?: boolean;
    /** Pinned onto the building's `gateConfig.partGapMm` at spawn so the
     *  rendered seam + pricing area subtraction reflect this product's
     *  spec. Only consulted when the hydrated `partCount === 2`. */
    partGapMm?: number;
  };
}

/** Build a partial BuildingEntity defaults payload from a product. */
export function applyProductDefaults(product: ProductRow): ProductBuildingDefaults {
  const out: ProductBuildingDefaults = {
    sourceProductId: product.id,
    type: product.kind,
    dimensions: {},
  };

  if (product.kind === 'poort') {
    const p = product.defaults.poort;
    if (p) {
      // Translate product-authored dimensions (partWidthMm × partCount, heightMm)
      // into the entity's `dimensions`. partWidthMm/heightMm don't survive into
      // runtime — `dimensions.width` and `effectiveHeight` are the source of truth.
      const partCount = p.partCount ?? 1;
      if (p.partWidthMm !== undefined) {
        out.dimensions.width = (partCount * p.partWidthMm) / 1000;
      }
      if (p.heightMm !== undefined) {
        out.dimensions.height = p.heightMm / 1000;
      }
      const gateConfig: NonNullable<ProductBuildingDefaults['gateConfig']> = {};
      if (p.partCount !== undefined) gateConfig.partCount = p.partCount;
      if (p.swingDirection !== undefined) gateConfig.swingDirection = p.swingDirection;
      if (p.motorized !== undefined) gateConfig.motorized = p.motorized;
      if (p.materialId !== undefined) gateConfig.materialId = p.materialId;
      if (p.partGapMm !== undefined) gateConfig.partGapMm = p.partGapMm;
      if (Object.keys(gateConfig).length > 0) out.gateConfig = gateConfig;
    }
    return out;
  }

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
