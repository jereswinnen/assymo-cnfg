import {
  SUPPLIER_ERROR_CODES,
  type DoorMeta,
  type GateMeta,
  type GateMetaOption,
  type SupplierProductKind,
  type WindowMeta,
  type WindowMetaSegments,
  type WindowMetaSchuifraam,
} from './types';
import { isObject, isNonNegativeInt, isPositiveInt } from './_validation';

const SUPPLIER_PRODUCT_KINDS: readonly SupplierProductKind[] = ['door', 'window', 'gate'];
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
  meta: DoorMeta | WindowMeta | GateMeta;
  sortOrder: number;
}

export type SupplierProductPatchInput = Partial<Omit<SupplierProductCreateInput, 'supplierId' | 'kind'>> & {
  meta?: DoorMeta | WindowMeta | GateMeta;
};

function isKind(v: unknown): v is SupplierProductKind {
  return typeof v === 'string' && (SUPPLIER_PRODUCT_KINDS as readonly string[]).includes(v);
}

const DOOR_SWING_VALUES = ['inward', 'outward', 'none'] as const;
const DOOR_LOCK_VALUES = ['cylinder', 'multipoint', 'none'] as const;
const DOOR_GLAZING_VALUES = ['solid', 'glass-panel', 'half-glass'] as const;
const WINDOW_GLAZING_VALUES = ['double', 'triple', 'single'] as const;

const DOOR_META_KEYS = new Set(['swingDirection', 'lockType', 'glazing', 'rValue', 'leadTimeDays']);
const WINDOW_META_KEYS = new Set([
  'glazingType', 'uValue', 'frameMaterial', 'openable', 'leadTimeDays',
  'segments', 'schuifraam',
]);

const GATE_SWING_VALUES = ['inward', 'outward', 'sliding'] as const;
const GATE_GLAZING_VALUES = ['none', 'partial', 'full'] as const;
const GATE_PART_COUNT_VALUES = [1, 2, 'configurable'] as const;
const GATE_META_KEYS = new Set([
  'partCount',
  'motorized',
  'motorizedSurchargeCents',
  'swingDirections',
  'defaultDimensions',
  'maxDimensions',
  'glazing',
  'availableColors',
  'availableLocks',
  'availableHandles',
  'rValue',
  'leadTimeDays',
]);
const GATE_OPTION_KEYS = new Set(['sku', 'labelKey', 'label', 'ralCode', 'surchargeCents']);

function validateGateOptionList(
  list: unknown,
  fieldName: string,
  errors: string[],
): GateMetaOption[] | null {
  if (!Array.isArray(list)) {
    errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:${fieldName}`);
    return null;
  }
  const out: GateMetaOption[] = [];
  const seenSkus = new Set<string>();
  for (let i = 0; i < list.length; i++) {
    const opt = list[i];
    if (!isObject(opt)) {
      errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:${fieldName}[${i}]`);
      return null;
    }
    for (const k of Object.keys(opt)) {
      if (!GATE_OPTION_KEYS.has(k)) {
        errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:${fieldName}[${i}]`);
        return null;
      }
    }
    if (typeof opt.sku !== 'string' || opt.sku.trim().length === 0) {
      errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:${fieldName}[${i}].sku`);
      return null;
    }
    if (seenSkus.has(opt.sku)) {
      errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:${fieldName}[${i}].sku`);
      return null;
    }
    seenSkus.add(opt.sku);
    const o: GateMetaOption = { sku: opt.sku };
    if ('labelKey' in opt) {
      if (typeof opt.labelKey !== 'string') {
        errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:${fieldName}[${i}].labelKey`);
        return null;
      }
      o.labelKey = opt.labelKey;
    }
    if ('label' in opt) {
      if (typeof opt.label !== 'string') {
        errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:${fieldName}[${i}].label`);
        return null;
      }
      o.label = opt.label;
    }
    if (!o.labelKey && !o.label) {
      errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:${fieldName}[${i}].label`);
      return null;
    }
    if ('ralCode' in opt) {
      if (typeof opt.ralCode !== 'string') {
        errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:${fieldName}[${i}].ralCode`);
        return null;
      }
      o.ralCode = opt.ralCode;
    }
    if ('surchargeCents' in opt) {
      if (!isNonNegativeInt(opt.surchargeCents)) {
        errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:${fieldName}[${i}].surchargeCents`);
        return null;
      }
      o.surchargeCents = opt.surchargeCents as number;
    }
    out.push(o);
  }
  return out;
}

function validateGateDimsObject(
  v: unknown,
  fieldName: string,
  errors: string[],
): { widthMm: number; heightMm: number } | null {
  if (!isObject(v)) {
    errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:${fieldName}`);
    return null;
  }
  const allowedKeys = new Set(['widthMm', 'heightMm']);
  for (const k of Object.keys(v)) {
    if (!allowedKeys.has(k)) {
      errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:${fieldName}`);
      return null;
    }
  }
  if (!isPositiveInt(v.widthMm, DIM_MAX_MM) || !isPositiveInt(v.heightMm, DIM_MAX_MM)) {
    errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:${fieldName}`);
    return null;
  }
  return { widthMm: v.widthMm as number, heightMm: v.heightMm as number };
}

export function validateGateMeta(meta: unknown): Validated<GateMeta> {
  if (!isObject(meta)) return { value: null, errors: [SUPPLIER_ERROR_CODES.metaInvalid] };
  const errors: string[] = [];
  const out: GateMeta = {};

  for (const key of Object.keys(meta)) {
    if (!GATE_META_KEYS.has(key)) {
      errors.push(SUPPLIER_ERROR_CODES.metaInvalid);
      return { value: null, errors };
    }
  }

  if ('partCount' in meta) {
    if (!(GATE_PART_COUNT_VALUES as readonly unknown[]).includes(meta.partCount)) {
      errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:partCount`);
    } else {
      out.partCount = meta.partCount as GateMeta['partCount'];
    }
  }
  if ('motorized' in meta) {
    if (meta.motorized !== true && meta.motorized !== false && meta.motorized !== 'optional') {
      errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:motorized`);
    } else {
      out.motorized = meta.motorized as GateMeta['motorized'];
    }
  }
  if ('motorizedSurchargeCents' in meta) {
    if (!isNonNegativeInt(meta.motorizedSurchargeCents)) {
      errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:motorizedSurchargeCents`);
    } else {
      out.motorizedSurchargeCents = meta.motorizedSurchargeCents as number;
    }
  }
  if ('swingDirections' in meta) {
    if (!Array.isArray(meta.swingDirections)) {
      errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:swingDirections`);
    } else {
      const dirs: GateMeta['swingDirections'] = [];
      let bad = false;
      for (const d of meta.swingDirections) {
        if (!(GATE_SWING_VALUES as readonly unknown[]).includes(d)) {
          bad = true;
          break;
        }
        dirs!.push(d as 'inward' | 'outward' | 'sliding');
      }
      if (bad) errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:swingDirections`);
      else out.swingDirections = dirs;
    }
  }
  if ('defaultDimensions' in meta) {
    const r = validateGateDimsObject(meta.defaultDimensions, 'defaultDimensions', errors);
    if (r) out.defaultDimensions = r;
  }
  if ('maxDimensions' in meta) {
    const r = validateGateDimsObject(meta.maxDimensions, 'maxDimensions', errors);
    if (r) out.maxDimensions = r;
  }
  if ('glazing' in meta) {
    if (!(GATE_GLAZING_VALUES as readonly unknown[]).includes(meta.glazing)) {
      errors.push(`${SUPPLIER_ERROR_CODES.metaInvalid}:glazing`);
    } else {
      out.glazing = meta.glazing as GateMeta['glazing'];
    }
  }
  if ('availableColors' in meta) {
    const r = validateGateOptionList(meta.availableColors, 'availableColors', errors);
    if (r) out.availableColors = r;
  }
  if ('availableLocks' in meta) {
    const r = validateGateOptionList(meta.availableLocks, 'availableLocks', errors);
    if (r) out.availableLocks = r;
  }
  if ('availableHandles' in meta) {
    const r = validateGateOptionList(meta.availableHandles, 'availableHandles', errors);
    if (r) out.availableHandles = r;
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

  if ('segments' in meta) {
    const s = meta.segments;
    if (!isObject(s) || typeof s.enabled !== 'boolean') {
      errors.push(SUPPLIER_ERROR_CODES.segmentsInvalid);
    } else if (s.enabled) {
      if (typeof s.autoThresholdMm !== 'number' || !Number.isFinite(s.autoThresholdMm) || s.autoThresholdMm < 0) {
        errors.push(SUPPLIER_ERROR_CODES.segmentsInvalid);
      } else {
        const seg: WindowMetaSegments = {
          enabled: true,
          autoThresholdMm: s.autoThresholdMm,
        };
        if ('perAdditionalThresholdMm' in s) {
          if (typeof s.perAdditionalThresholdMm !== 'number' || s.perAdditionalThresholdMm <= 0) {
            errors.push(SUPPLIER_ERROR_CODES.segmentsInvalid);
          } else {
            seg.perAdditionalThresholdMm = s.perAdditionalThresholdMm;
          }
        }
        if ('maxCount' in s) {
          if (!isPositiveInt(s.maxCount, 1000)) {
            errors.push(SUPPLIER_ERROR_CODES.segmentsInvalid);
          } else {
            seg.maxCount = s.maxCount;
          }
        }
        if ('surchargeCentsPerDivider' in s) {
          if (!isNonNegativeInt(s.surchargeCentsPerDivider)) {
            errors.push(SUPPLIER_ERROR_CODES.segmentsInvalid);
          } else {
            seg.surchargeCentsPerDivider = s.surchargeCentsPerDivider;
          }
        }
        out.segments = seg;
      }
    } else {
      out.segments = { enabled: false, autoThresholdMm: 0 };
    }
  }

  if ('schuifraam' in meta) {
    const s = meta.schuifraam;
    if (!isObject(s) || typeof s.enabled !== 'boolean') {
      errors.push(SUPPLIER_ERROR_CODES.schuifraamInvalid);
    } else {
      const sf: WindowMetaSchuifraam = { enabled: s.enabled };
      if ('surchargeCents' in s) {
        if (!isNonNegativeInt(s.surchargeCents)) {
          errors.push(SUPPLIER_ERROR_CODES.schuifraamInvalid);
        } else {
          sf.surchargeCents = s.surchargeCents;
        }
      }
      out.schuifraam = sf;
    }
  }

  if (errors.length > 0) return { value: null, errors };
  return { value: out, errors: [] };
}

export function validateSupplierProductCreate(
  input: unknown,
): Validated<SupplierProductCreateInput> {
  if (!isObject(input)) return { value: null, errors: [SUPPLIER_ERROR_CODES.bodyInvalid] };
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
    errors.push(SUPPLIER_ERROR_CODES.heroImageInvalid);
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

  let metaOut: DoorMeta | WindowMeta | GateMeta | undefined;
  if (isKind(kind)) {
    const metaInput = meta ?? {};
    if (kind === 'door') {
      const r = validateDoorMeta(metaInput);
      if (r.value === null) {
        errors.push(...r.errors);
      } else {
        metaOut = r.value;
      }
    } else if (kind === 'window') {
      const r = validateWindowMeta(metaInput);
      if (r.value === null) {
        errors.push(...r.errors);
      } else {
        metaOut = r.value;
      }
    } else {
      const r = validateGateMeta(metaInput);
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
      errors.push(SUPPLIER_ERROR_CODES.sortOrderInvalid);
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
  if (!isObject(input)) return { value: null, errors: [SUPPLIER_ERROR_CODES.bodyInvalid] };
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
      errors.push(SUPPLIER_ERROR_CODES.heroImageInvalid);
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
      const allMetaKeys = new Set([...DOOR_META_KEYS, ...WINDOW_META_KEYS, ...GATE_META_KEYS]);
      const unknownKey = Object.keys(input.meta).find((k) => !allMetaKeys.has(k));
      if (unknownKey !== undefined) {
        errors.push(SUPPLIER_ERROR_CODES.metaInvalid);
      } else {
        out.meta = input.meta as DoorMeta | WindowMeta | GateMeta;
      }
    }
  }
  if ('sortOrder' in input) {
    if (!isNonNegativeInt(input.sortOrder)) {
      errors.push(SUPPLIER_ERROR_CODES.sortOrderInvalid);
    } else {
      out.sortOrder = input.sortOrder as number;
    }
  }

  if (errors.length > 0) return { value: null, errors };
  return { value: out, errors: [] };
}
