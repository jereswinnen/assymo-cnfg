/** Per-tenant chrome around the configurator. The configurator UX itself
 *  is the product and stays unbranded; only the wrapper varies. */
export interface Branding {
  displayName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  footer: {
    contactEmail: string;
    address: string;
    vatNumber: string | null;
  };
}

export const DEFAULT_ASSYMO_BRANDING: Branding = {
  displayName: 'Assymo',
  logoUrl: '/logo-assymo.svg',
  primaryColor: '#1f2937',
  accentColor: '#0ea5e9',
  footer: {
    contactEmail: 'info@assymo.be',
    address: 'TBD',
    vatNumber: null,
  },
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidatedBrandingPatch {
  branding: Partial<Branding>;
  errors: string[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Validate a partial branding update. Mirrors the shape of
 *  validatePriceBookPatch — returns the cleaned partial plus a list
 *  of field paths that failed. Empty errors == safe to merge. */
export function validateBrandingPatch(input: unknown): ValidatedBrandingPatch {
  if (!isObject(input)) return { branding: {}, errors: ['body'] };

  const out: Partial<Branding> = {};
  const errors: string[] = [];

  if ('displayName' in input) {
    if (typeof input.displayName === 'string' && input.displayName.length > 0) {
      out.displayName = input.displayName;
    } else errors.push('displayName');
  }
  if ('logoUrl' in input) {
    if (typeof input.logoUrl === 'string' && input.logoUrl.length > 0) {
      out.logoUrl = input.logoUrl;
    } else errors.push('logoUrl');
  }
  for (const k of ['primaryColor', 'accentColor'] as const) {
    if (k in input) {
      if (typeof input[k] === 'string' && HEX_RE.test(input[k] as string)) {
        out[k] = input[k] as string;
      } else errors.push(k);
    }
  }
  if ('footer' in input) {
    if (!isObject(input.footer)) {
      errors.push('footer');
    } else {
      const f = input.footer;
      const footerOut: Partial<Branding['footer']> = {};
      if ('contactEmail' in f) {
        if (typeof f.contactEmail === 'string' && EMAIL_RE.test(f.contactEmail)) {
          footerOut.contactEmail = f.contactEmail;
        } else errors.push('footer.contactEmail');
      }
      if ('address' in f) {
        if (typeof f.address === 'string' && f.address.length > 0) {
          footerOut.address = f.address;
        } else errors.push('footer.address');
      }
      if ('vatNumber' in f) {
        if (f.vatNumber === null || typeof f.vatNumber === 'string') {
          footerOut.vatNumber = f.vatNumber as string | null;
        } else errors.push('footer.vatNumber');
      }
      // Caller must merge with the existing footer; we return only the touched keys.
      out.footer = footerOut as Branding['footer'];
    }
  }

  return { branding: out, errors };
}
