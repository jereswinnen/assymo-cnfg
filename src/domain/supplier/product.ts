import {
  SUPPLIER_ERROR_CODES,
  type DoorMeta,
  type SupplierProductKind,
  type WindowMeta,
} from './types';

const SUPPLIER_PRODUCT_KINDS: readonly SupplierProductKind[] = ['door', 'window'];
const DIM_MAX_MM = 10_000;

interface Validated<T> {
  value: T | null;
  errors: string[];
}

export interface SupplierProductCreateInput {
  supplierId: string;
  kind: SupplierProductKind;
  sku: string;
  name: string;
  heroImage: string | null;
  widthMm: number;
  heightMm: number;
  priceCents: number;
  meta: DoorMeta | WindowMeta;
  sortOrder: number;
}

export type SupplierProductPatchInput = Partial<Omit<SupplierProductCreateInput, 'supplierId' | 'kind'>>;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isKind(v: unknown): v is SupplierProductKind {
  return typeof v === 'string' && (SUPPLIER_PRODUCT_KINDS as readonly string[]).includes(v);
}

function isPositiveInt(v: unknown, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= max;
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

const DOOR_SWING_VALUES = ['inward', 'outward', 'none'] as const;
const DOOR_LOCK_VALUES = ['cylinder', 'multipoint', 'none'] as const;
const DOOR_GLAZING_VALUES = ['solid', 'glass-panel', 'half-glass'] as const;
const WINDOW_GLAZING_VALUES = ['double', 'triple', 'single'] as const;

const DOOR_META_KEYS = new Set(['swingDirection', 'lockType', 'glazing', 'rValue', 'leadTimeDays']);
const WINDOW_META_KEYS = new Set(['glazingType', 'uValue', 'frameMaterial', 'openable', 'leadTimeDays']);

export function validateDoorMeta(meta: unknown): Validated<DoorMeta> {
  if (!isObject(meta)) return { value: null, errors: [SUPPLIER_ERROR_CODES.metaInvalid] };
  const errors: string[] = [];
  const out: DoorMeta = {};

  for (const key of Object.keys(meta)) {
    if (!DOOR_META_KEYS.has(key)) {
      errors.push(SUPPLIER_ERROR_CODES.metaInvalid);
      return { value: null, errors };
    }
  }

  if ('swingDirection' in meta) {
    if (!(DOOR_SWING_VALUES as readonly unknown[]).includes(meta.swingDirection)) {
      errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:swingDirection`);
    } else {
      out.swingDirection = meta.swingDirection as DoorMeta['swingDirection'];
    }
  }
  if ('lockType' in meta) {
    if (!(DOOR_LOCK_VALUES as readonly unknown[]).includes(meta.lockType)) {
      errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:lockType`);
    } else {
      out.lockType = meta.lockType as DoorMeta['lockType'];
    }
  }
  if ('glazing' in meta) {
    if (!(DOOR_GLAZING_VALUES as readonly unknown[]).includes(meta.glazing)) {
      errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:glazing`);
    } else {
      out.glazing = meta.glazing as DoorMeta['glazing'];
    }
  }
  if ('rValue' in meta) {
    if (typeof meta.rValue !== 'number' || !Number.isFinite(meta.rValue) || meta.rValue < 0) {
      errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:rValue`);
    } else {
      out.rValue = meta.rValue;
    }
  }
  if ('leadTimeDays' in meta) {
    if (!isNonNegativeInt(meta.leadTimeDays)) {
      errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:leadTimeDays`);
    } else {
      out.leadTimeDays = meta.leadTimeDays as number;
    }
  }

  if (errors.length > 0) return { value: null, errors };
  return { value: out, errors: [] };
}

export function validateWindowMeta(meta: unknown): Validated<WindowMeta> {
  if (!isObject(meta)) return { value: null, errors: [SUPPLIER_ERROR_CODES.metaInvalid] };
  const errors: string[] = [];
  const out: WindowMeta = {};

  for (const key of Object.keys(meta)) {
    if (!WINDOW_META_KEYS.has(key)) {
      errors.push(SUPPLIER_ERROR_CODES.metaInvalid);
      return { value: null, errors };
    }
  }

  if ('glazingType' in meta) {
    if (!(WINDOW_GLAZING_VALUES as readonly unknown[]).includes(meta.glazingType)) {
      errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:glazingType`);
    } else {
      out.glazingType = meta.glazingType as WindowMeta['glazingType'];
    }
  }
  if ('uValue' in meta) {
    if (typeof meta.uValue !== 'number' || !Number.isFinite(meta.uValue) || meta.uValue < 0) {
      errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:uValue`);
    } else {
      out.uValue = meta.uValue;
    }
  }
  if ('frameMaterial' in meta) {
    if (typeof meta.frameMaterial !== 'string') {
      errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:frameMaterial`);
    } else {
      out.frameMaterial = meta.frameMaterial;
    }
  }
  if ('openable' in meta) {
    if (typeof meta.openable !== 'boolean') {
      errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:openable`);
    } else {
      out.openable = meta.openable;
    }
  }
  if ('leadTimeDays' in meta) {
    if (!isNonNegativeInt(meta.leadTimeDays)) {
      errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:leadTimeDays`);
    } else {
      out.leadTimeDays = meta.leadTimeDays as number;
    }
  }

  if (errors.length > 0) return { value: null, errors };
  return { value: out, errors: [] };
}

export function validateSupplierProductCreate(
  input: unknown,
): Validated<SupplierProductCreateInput> {
  if (!isObject(input)) return { value: null, errors: ['body'] };
  const errors: string[] = [];

  const { supplierId, kind, sku, name, heroImage, widthMm, heightMm, priceCents, meta, sortOrder } =
    input as Record<string, unknown>;

  if (typeof supplierId !== 'string' || supplierId.trim().length === 0) {
    errors.push(SUPPLIER_ERROR_CODES.supplierIdRequired);
  }
  if (!isKind(kind)) {
    errors.push(SUPPLIER_ERROR_CODES.kindInvalid);
  }
  if (typeof sku !== 'string' || sku.trim().length === 0) {
    errors.push(SUPPLIER_ERROR_CODES.skuRequired);
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    errors.push(SUPPLIER_ERROR_CODES.nameMissing);
  }
  if (heroImage !== null && heroImage !== undefined && typeof heroImage !== 'string') {
    errors.push(SUPPLIER_ERROR_CODES.metaInvalid);
  }
  if (!isPositiveInt(widthMm, DIM_MAX_MM)) {
    errors.push(SUPPLIER_ERROR_CODES.widthInvalid);
  }
  if (!isPositiveInt(heightMm, DIM_MAX_MM)) {
    errors.push(SUPPLIER_ERROR_CODES.heightInvalid);
  }
  if (!isNonNegativeInt(priceCents)) {
    errors.push(SUPPLIER_ERROR_CODES.priceInvalid);
  }

  let metaOut: DoorMeta | WindowMeta | undefined;
  if (isKind(kind)) {
    const metaInput = meta ?? {};
    if (kind === 'door') {
      const r = validateDoorMeta(metaInput);
      if (r.value === null) {
        errors.push(...r.errors);
      } else {
        metaOut = r.value;
      }
    } else {
      const r = validateWindowMeta(metaInput);
      if (r.value === null) {
        errors.push(...r.errors);
      } else {
        metaOut = r.value;
      }
    }
  }

  let sortOrderOut = 0;
  if (sortOrder !== undefined) {
    if (!isNonNegativeInt(sortOrder)) {
      errors.push(SUPPLIER_ERROR_CODES.metaInvalid);
    } else {
      sortOrderOut = sortOrder as number;
    }
  }

  if (errors.length > 0) return { value: null, errors };

  return {
    value: {
      supplierId: (supplierId as string).trim(),
      kind: kind as SupplierProductKind,
      sku: (sku as string).trim(),
      name: (name as string).trim(),
      heroImage: typeof heroImage === 'string' ? heroImage : null,
      widthMm: widthMm as number,
      heightMm: heightMm as number,
      priceCents: priceCents as number,
      meta: metaOut!,
      sortOrder: sortOrderOut,
    },
    errors: [],
  };
}

export function validateSupplierProductPatch(
  input: unknown,
): Validated<SupplierProductPatchInput> {
  if (!isObject(input)) return { value: null, errors: ['body'] };
  const errors: string[] = [];
  const out: SupplierProductPatchInput = {};

  if ('sku' in input) {
    const s = input.sku;
    if (typeof s !== 'string' || s.trim().length === 0) {
      errors.push(SUPPLIER_ERROR_CODES.skuRequired);
    } else {
      out.sku = s.trim();
    }
  }
  if ('name' in input) {
    const n = input.name;
    if (typeof n !== 'string' || n.trim().length === 0) {
      errors.push(SUPPLIER_ERROR_CODES.nameMissing);
    } else {
      out.name = n.trim();
    }
  }
  if ('heroImage' in input) {
    const h = input.heroImage;
    if (h === null) {
      out.heroImage = null;
    } else if (typeof h !== 'string') {
      errors.push(SUPPLIER_ERROR_CODES.metaInvalid);
    } else {
      out.heroImage = h;
    }
  }
  if ('widthMm' in input) {
    if (!isPositiveInt(input.widthMm, DIM_MAX_MM)) {
      errors.push(SUPPLIER_ERROR_CODES.widthInvalid);
    } else {
      out.widthMm = input.widthMm as number;
    }
  }
  if ('heightMm' in input) {
    if (!isPositiveInt(input.heightMm, DIM_MAX_MM)) {
      errors.push(SUPPLIER_ERROR_CODES.heightInvalid);
    } else {
      out.heightMm = input.heightMm as number;
    }
  }
  if ('priceCents' in input) {
    if (!isNonNegativeInt(input.priceCents)) {
      errors.push(SUPPLIER_ERROR_CODES.priceInvalid);
    } else {
      out.priceCents = input.priceCents as number;
    }
  }
  if ('meta' in input) {
    if (!isObject(input.meta)) {
      errors.push(SUPPLIER_ERROR_CODES.metaInvalid);
    } else {
      const allMetaKeys = new Set([...DOOR_META_KEYS, ...WINDOW_META_KEYS]);
      const unknownKey = Object.keys(input.meta).find((k) => !allMetaKeys.has(k));
      if (unknownKey !== undefined) {
        errors.push(SUPPLIER_ERROR_CODES.metaInvalid);
      } else {
        out.meta = input.meta as DoorMeta | WindowMeta;
      }
    }
  }
  if ('sortOrder' in input) {
    if (!isNonNegativeInt(input.sortOrder)) {
      errors.push(SUPPLIER_ERROR_CODES.metaInvalid);
    } else {
      out.sortOrder = input.sortOrder as number;
    }
  }

  if (errors.length > 0) return { value: null, errors };
  return { value: out, errors: [] };
}
