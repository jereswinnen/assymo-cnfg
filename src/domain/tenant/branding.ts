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
