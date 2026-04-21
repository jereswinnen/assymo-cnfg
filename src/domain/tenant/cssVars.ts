import type { Branding } from './branding';

/** Extract tenant brand colours as CSS custom properties. Consumed by
 *  `<BrandedShell>` which injects the return value into an inline
 *  `<style>` tag on the server. Pure; safe to import from anywhere. */
export function brandingToCssVars(branding: Branding): Record<string, string> {
  return {
    '--brand-primary': branding.primaryColor,
    '--brand-accent': branding.accentColor,
  };
}

/** Render a CSS var map as a :root declaration block. The caller is
 *  expected to pass only trusted, validated input (branding values are
 *  admin-written and pass through `validateBrandingPatch`); we do not
 *  escape CSS tokens here. */
export function cssVarsToInlineBlock(vars: Record<string, string>): string {
  const body = Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join('');
  return `:root{${body}}`;
}
