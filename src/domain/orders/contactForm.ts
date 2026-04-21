import { z } from 'zod';

/** Zod schema for the in-dialog contact form. Error messages are i18n
 *  keys — the UI layer runs them through `t()`. Keeping messages as
 *  keys (not Dutch strings) means the schema stays framework-free and
 *  trivially testable. */
export const contactFormSchema = z.object({
  name: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, {
      message: 'configurator.submit.validation.name.required',
    }),
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .refine((v) => v.length > 0, {
      message: 'configurator.submit.validation.email.required',
    })
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: 'configurator.submit.validation.email.format',
    }),
  phone: z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      const trimmed = v.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    }),
  notes: z
    .string()
    .max(1000, { message: 'configurator.submit.validation.notes.tooLong' })
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      const trimmed = v.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    }),
});

export type ContactFormValues = z.input<typeof contactFormSchema>;
export type ContactFormValuesParsed = z.output<typeof contactFormSchema>;

/** Mapping from `POST /api/shop/orders` public error codes + the
 *  extra `invalid_code` code `POST /api/configs` can emit + a
 *  client-synthesised `network` sentinel to a user-facing i18n key. */
const ERROR_CODE_KEYS: Record<string, string> = {
  validation_failed: 'configurator.submit.error.validation_failed',
  config_not_found: 'configurator.submit.error.config_not_found',
  config_invalid: 'configurator.submit.error.config_invalid',
  email_in_use_by_business:
    'configurator.submit.error.email_in_use_by_business',
  unknown_tenant: 'configurator.submit.error.unknown_tenant',
  invalid_code: 'configurator.submit.error.invalid_code',
  network: 'configurator.submit.error.network',
};

/** Map a single `details[]` entry from the shop-orders validation
 *  response to a field-level i18n key. Returns null when the entry
 *  isn't mappable to one of our form fields (e.g. `code`, which is
 *  synthesised by the client hook and never user-input). */
function detailToFieldError(
  detail: string,
): { field: 'name' | 'email' | 'phone' | 'notes'; key: string } | null {
  switch (detail) {
    case 'contact.name':
      return { field: 'name', key: 'configurator.submit.validation.name.required' };
    case 'contact.email':
      // The server only emits contact.email when the address is either
      // missing or malformed — surface the format message (the stronger
      // of the two) so users always see something actionable.
      return { field: 'email', key: 'configurator.submit.validation.email.format' };
    case 'contact.phone':
      return { field: 'phone', key: 'configurator.submit.validation.email.format' };
    case 'contact.notes':
      return { field: 'notes', key: 'configurator.submit.validation.notes.tooLong' };
    default:
      return null;
  }
}

export interface MappedShopOrdersError {
  /** Top-level banner copy. */
  i18nKey: string;
  /** Field-level errors (only populated for `validation_failed`). */
  fieldErrors?: Partial<Record<'name' | 'email' | 'phone' | 'notes', string>>;
}

export function mapShopOrdersErrorCode(
  code: string,
  details?: string[],
): MappedShopOrdersError {
  const i18nKey =
    ERROR_CODE_KEYS[code] ?? 'configurator.submit.error.unknown';
  if (code !== 'validation_failed' || !details || details.length === 0) {
    return { i18nKey };
  }
  const fieldErrors: MappedShopOrdersError['fieldErrors'] = {};
  for (const d of details) {
    const mapped = detailToFieldError(d);
    if (mapped) fieldErrors[mapped.field] = mapped.key;
  }
  return Object.keys(fieldErrors).length > 0
    ? { i18nKey, fieldErrors }
    : { i18nKey };
}
