import { describe, it, expect } from 'vite-plus/test';
import {
  contactFormSchema,
  mapShopOrdersErrorCode,
  type ContactFormValues,
} from '@/domain/orders/contactForm';

describe('contactFormSchema', () => {
  it('accepts a fully populated payload', () => {
    const input: ContactFormValues = {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '+32 1234',
      notes: 'Graag in de voormiddag.',
    };
    const parsed = contactFormSchema.parse(input);
    expect(parsed).toEqual(input);
  });

  it('accepts a minimal payload (phone + notes omitted)', () => {
    const parsed = contactFormSchema.parse({
      name: 'Ada',
      email: 'ada@example.com',
    });
    expect(parsed.phone).toBeUndefined();
    expect(parsed.notes).toBeUndefined();
  });

  it('trims whitespace from all string fields', () => {
    const parsed = contactFormSchema.parse({
      name: '  Ada  ',
      email: '  ada@example.com  ',
      phone: '  +32  ',
      notes: '  hi  ',
    });
    expect(parsed.name).toBe('Ada');
    expect(parsed.email).toBe('ada@example.com');
    expect(parsed.phone).toBe('+32');
    expect(parsed.notes).toBe('hi');
  });

  it('lowercases the email', () => {
    const parsed = contactFormSchema.parse({
      name: 'Ada',
      email: 'ADA@Example.COM',
    });
    expect(parsed.email).toBe('ada@example.com');
  });

  it('rejects an empty name with the i18n key', () => {
    const result = contactFormSchema.safeParse({ name: '', email: 'a@b.c' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameIssue = result.error.issues.find((i) => i.path[0] === 'name');
      expect(nameIssue?.message).toBe('configurator.submit.validation.name.required');
    }
  });

  it('rejects a missing email with the i18n key', () => {
    const result = contactFormSchema.safeParse({ name: 'Ada', email: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailIssue = result.error.issues.find((i) => i.path[0] === 'email');
      expect(emailIssue?.message).toBe(
        'configurator.submit.validation.email.required',
      );
    }
  });

  it('rejects a malformed email with the i18n key', () => {
    const result = contactFormSchema.safeParse({ name: 'Ada', email: 'not-an-email' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailIssue = result.error.issues.find((i) => i.path[0] === 'email');
      expect(emailIssue?.message).toBe('configurator.submit.validation.email.format');
    }
  });

  it('rejects notes over 1000 chars with the i18n key', () => {
    const result = contactFormSchema.safeParse({
      name: 'Ada',
      email: 'a@b.c',
      notes: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const notesIssue = result.error.issues.find((i) => i.path[0] === 'notes');
      expect(notesIssue?.message).toBe(
        'configurator.submit.validation.notes.tooLong',
      );
    }
  });

  it('normalises empty optional strings to undefined', () => {
    const parsed = contactFormSchema.parse({
      name: 'Ada',
      email: 'a@b.c',
      phone: '   ',
      notes: '',
    });
    expect(parsed.phone).toBeUndefined();
    expect(parsed.notes).toBeUndefined();
  });
});

describe('mapShopOrdersErrorCode', () => {
  it('maps every documented public error code', () => {
    const cases: Array<{ code: string; i18nKey: string }> = [
      { code: 'validation_failed', i18nKey: 'configurator.submit.error.validation_failed' },
      { code: 'config_not_found', i18nKey: 'configurator.submit.error.config_not_found' },
      { code: 'config_invalid', i18nKey: 'configurator.submit.error.config_invalid' },
      { code: 'email_in_use_by_business', i18nKey: 'configurator.submit.error.email_in_use_by_business' },
      { code: 'unknown_tenant', i18nKey: 'configurator.submit.error.unknown_tenant' },
      { code: 'invalid_code', i18nKey: 'configurator.submit.error.invalid_code' },
    ];
    for (const { code, i18nKey } of cases) {
      expect(mapShopOrdersErrorCode(code).i18nKey).toBe(i18nKey);
    }
  });

  it('maps validation_failed details to per-field error keys', () => {
    const mapped = mapShopOrdersErrorCode('validation_failed', [
      'contact.email',
      'contact.name',
      'code',
    ]);
    expect(mapped.i18nKey).toBe('configurator.submit.error.validation_failed');
    expect(mapped.fieldErrors).toEqual({
      email: 'configurator.submit.validation.email.format',
      name: 'configurator.submit.validation.name.required',
    });
  });

  it('falls back to the unknown key for unrecognised codes', () => {
    expect(mapShopOrdersErrorCode('something_weird').i18nKey).toBe(
      'configurator.submit.error.unknown',
    );
  });

  it('maps the client-synthesised "network" sentinel', () => {
    expect(mapShopOrdersErrorCode('network').i18nKey).toBe(
      'configurator.submit.error.network',
    );
  });
});
