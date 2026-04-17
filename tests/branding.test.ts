import { describe, it, expect } from 'vite-plus/test';
import { validateBrandingPatch } from '@/domain/tenant';

describe('validateBrandingPatch', () => {
  it('accepts a complete valid patch', () => {
    const { branding, errors } = validateBrandingPatch({
      displayName: 'Partner BV',
      logoUrl: '/logos/partner.svg',
      primaryColor: '#ff0000',
      accentColor: '#00ff00',
      footer: { contactEmail: 'hi@partner.be', address: 'X', vatNumber: 'BE0123' },
    });
    expect(errors).toEqual([]);
    expect(branding.displayName).toBe('Partner BV');
  });

  it('accepts a partial patch (only displayName)', () => {
    const { branding, errors } = validateBrandingPatch({ displayName: 'Just Name' });
    expect(errors).toEqual([]);
    expect(branding).toEqual({ displayName: 'Just Name' });
  });

  it('rejects invalid hex colors', () => {
    const { errors } = validateBrandingPatch({ primaryColor: 'red' });
    expect(errors).toContain('primaryColor');
  });

  it('rejects empty displayName', () => {
    const { errors } = validateBrandingPatch({ displayName: '' });
    expect(errors).toContain('displayName');
  });

  it('rejects non-object input', () => {
    const { errors } = validateBrandingPatch(null);
    expect(errors).toContain('body');
  });

  it('validates nested footer fields independently', () => {
    const { errors } = validateBrandingPatch({
      footer: { contactEmail: 'not-an-email', address: 'X', vatNumber: null },
    });
    expect(errors).toContain('footer.contactEmail');
  });
});
