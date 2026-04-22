import { SUPPLIER_ERROR_CODES, type SupplierContact } from './types';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\//;
const NAME_MAX = 100;

export interface SupplierCreateInput {
  name: string;
  slug: string;
  logoUrl: string | null;
  contact: SupplierContact;
  notes: string | null;
}

export type SupplierPatchInput = Partial<SupplierCreateInput>;

interface Validated<T> {
  value: T | null;
  errors: string[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Normalise a free-form string into a slug-candidate: lowercase, replace
 *  non-[a-z0-9] runs with a single hyphen, collapse repeats, strip edges. */
export function slugify(name: string): string {
  const lower = name.toLowerCase().trim();
  const hyphenated = lower.replace(/\s+/g, '-');
  const stripped = hyphenated.replace(/[^a-z0-9-]/g, '');
  const collapsed = stripped.replace(/-+/g, '-');
  return collapsed.replace(/^-+|-+$/g, '');
}

function isValidSlug(slug: string): boolean {
  if (slug.length < 1 || slug.length > 48) return false;
  return SLUG_RE.test(slug);
}

function validateContact(value: unknown, errors: string[]): SupplierContact | undefined {
  if (!isObject(value)) {
    errors.push(SUPPLIER_ERROR_CODES.contactInvalid);
    return undefined;
  }
  const out: SupplierContact = {};
  if ('email' in value) {
    if (typeof value.email !== 'string' || !EMAIL_RE.test(value.email)) {
      errors.push(SUPPLIER_ERROR_CODES.contactInvalid);
      return undefined;
    }
    out.email = value.email;
  }
  if ('phone' in value) {
    if (typeof value.phone !== 'string') {
      errors.push(SUPPLIER_ERROR_CODES.contactInvalid);
      return undefined;
    }
    out.phone = value.phone;
  }
  if ('website' in value) {
    if (typeof value.website !== 'string' || !URL_RE.test(value.website)) {
      errors.push(SUPPLIER_ERROR_CODES.contactInvalid);
      return undefined;
    }
    out.website = value.website;
  }
  return out;
}

export function validateSupplierCreate(input: unknown): Validated<SupplierCreateInput> {
  if (!isObject(input)) return { value: null, errors: ['body'] };
  const errors: string[] = [];

  const { name, slug, logoUrl, contact, notes } = input as Record<string, unknown>;

  if (typeof name !== 'string' || name.trim().length === 0 || name.length > NAME_MAX) {
    errors.push(SUPPLIER_ERROR_CODES.nameRequired);
  }
  if (typeof slug !== 'string' || !isValidSlug(slug)) {
    errors.push(SUPPLIER_ERROR_CODES.slugInvalid);
  }
  if (logoUrl !== null && logoUrl !== undefined && typeof logoUrl !== 'string') {
    errors.push(SUPPLIER_ERROR_CODES.contactInvalid);
  }
  const contactOut = validateContact(contact ?? {}, errors);
  if (notes !== null && notes !== undefined && typeof notes !== 'string') {
    errors.push(SUPPLIER_ERROR_CODES.contactInvalid);
  }

  if (errors.length > 0) return { value: null, errors };

  return {
    value: {
      name: (name as string).trim(),
      slug: slug as string,
      logoUrl: typeof logoUrl === 'string' ? logoUrl : null,
      contact: contactOut!,
      notes: typeof notes === 'string' ? notes : null,
    },
    errors: [],
  };
}

export function validateSupplierPatch(input: unknown): Validated<SupplierPatchInput> {
  if (!isObject(input)) return { value: null, errors: ['body'] };
  const errors: string[] = [];
  const out: SupplierPatchInput = {};

  if ('name' in input) {
    const n = input.name;
    if (typeof n !== 'string' || n.trim().length === 0 || n.length > NAME_MAX) {
      errors.push(SUPPLIER_ERROR_CODES.nameRequired);
    } else {
      out.name = n.trim();
    }
  }
  if ('slug' in input) {
    const s = input.slug;
    if (typeof s !== 'string' || !isValidSlug(s)) {
      errors.push(SUPPLIER_ERROR_CODES.slugInvalid);
    } else {
      out.slug = s;
    }
  }
  if ('logoUrl' in input) {
    const l = input.logoUrl;
    if (l === null) {
      out.logoUrl = null;
    } else if (typeof l !== 'string') {
      errors.push(SUPPLIER_ERROR_CODES.contactInvalid);
    } else {
      out.logoUrl = l;
    }
  }
  if ('contact' in input) {
    const c = validateContact(input.contact, errors);
    if (c !== undefined) out.contact = c;
  }
  if ('notes' in input) {
    const n = input.notes;
    if (n === null) {
      out.notes = null;
    } else if (typeof n !== 'string') {
      errors.push(SUPPLIER_ERROR_CODES.contactInvalid);
    } else {
      out.notes = n;
    }
  }

  if (errors.length > 0) return { value: null, errors };
  return { value: out, errors: [] };
}
