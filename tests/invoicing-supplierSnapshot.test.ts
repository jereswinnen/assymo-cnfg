import { describe, it, expect } from 'vite-plus/test';
import { buildSupplierSnapshot } from '@/domain/invoicing';
import { DEFAULT_ASSYMO_BRANDING, DEFAULT_ASSYMO_INVOICING } from '@/domain/tenant';

describe('buildSupplierSnapshot', () => {
  it('merges branding footer + invoicing into a flat snapshot', () => {
    const snap = buildSupplierSnapshot({
      displayName: 'Assymo',
      branding: DEFAULT_ASSYMO_BRANDING,
      invoicing: {
        ...DEFAULT_ASSYMO_INVOICING,
        bankIban: 'BE68 5390 0754 7034',
      },
    });
    expect(snap).toEqual({
      displayName: 'Assymo',
      address: DEFAULT_ASSYMO_BRANDING.footer.address,
      vatNumber: DEFAULT_ASSYMO_BRANDING.footer.vatNumber,
      contactEmail: DEFAULT_ASSYMO_BRANDING.footer.contactEmail,
      bankIban: 'BE68 5390 0754 7034',
      bankBic: null,
      paymentTermDays: 30,
    });
  });
  it('is a pure deep-clone (no shared references with inputs)', () => {
    const branding = { ...DEFAULT_ASSYMO_BRANDING };
    const snap = buildSupplierSnapshot({
      displayName: 'Partner',
      branding,
      invoicing: { ...DEFAULT_ASSYMO_INVOICING, bankIban: 'X' },
    });
    expect(snap.address).toBe(branding.footer.address);
    // Mutating the source after snapshotting must not affect the snapshot.
    branding.footer = { ...branding.footer, address: 'MUTATED' };
    expect(snap.address).not.toBe('MUTATED');
  });
});
