import { describe, it, expect } from 'vite-plus/test';
import { t } from '@/lib/i18n';

describe('t()', () => {
  it('returns the translated string for a known key', () => {
    expect(t('quote.total')).toBe('Totaal');
  });

  it('returns the key unchanged when the string is missing', () => {
    expect(t('this.key.does.not.exist')).toBe('this.key.does.not.exist');
  });

  it('substitutes {name} placeholders with params', () => {
    expect(t('quote.posts', { count: 3 })).toBe('Staanders (3\u00D7)');
  });

  it('leaves placeholders intact when the param is missing', () => {
    expect(t('quote.posts')).toContain('{count}');
  });

  it('exposes configurator.submit.* keys used by the submit modal', () => {
    expect(t('configurator.submit.cta')).toBe('In winkelmandje');
    expect(t('configurator.submit.dialog.title')).toBe('Bestelling plaatsen');
    expect(
      t('configurator.submit.success.emailHint', { email: 'a@b.c' }),
    ).toContain('a@b.c');
  });
});
