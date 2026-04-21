import { describe, it, expect } from 'vite-plus/test';
import {
  brandingToCssVars,
  cssVarsToInlineBlock,
} from '@/domain/tenant/cssVars';
import { DEFAULT_ASSYMO_BRANDING } from '@/domain/tenant';

describe('brandingToCssVars', () => {
  it('emits --brand-primary + --brand-accent from branding colors', () => {
    const vars = brandingToCssVars(DEFAULT_ASSYMO_BRANDING);
    expect(vars['--brand-primary']).toBe('#1f2937');
    expect(vars['--brand-accent']).toBe('#0ea5e9');
  });

  it('returns only brand colour vars (no displayName, logoUrl, or footer)', () => {
    const vars = brandingToCssVars(DEFAULT_ASSYMO_BRANDING);
    expect(Object.keys(vars).sort()).toEqual([
      '--brand-accent',
      '--brand-primary',
    ]);
  });

  it('preserves hex casing verbatim — no normalisation', () => {
    const vars = brandingToCssVars({
      ...DEFAULT_ASSYMO_BRANDING,
      primaryColor: '#AaBbCc',
      accentColor: '#11aaFF',
    });
    expect(vars['--brand-primary']).toBe('#AaBbCc');
    expect(vars['--brand-accent']).toBe('#11aaFF');
  });
});

describe('cssVarsToInlineBlock', () => {
  it('renders a :root block from a var map', () => {
    const block = cssVarsToInlineBlock({
      '--brand-primary': '#111',
      '--brand-accent': '#222',
    });
    expect(block).toBe(':root{--brand-primary:#111;--brand-accent:#222;}');
  });

  it('returns an empty :root block for an empty map', () => {
    expect(cssVarsToInlineBlock({})).toBe(':root{}');
  });

  it('does NOT escape characters — callers must pass trusted input', () => {
    // We never accept user-uploaded CSS; branding values are written
    // by admins and validated by validateBrandingPatch upstream.
    // This test pins the non-escape behaviour so a well-meaning future
    // contributor doesn't introduce half-escaping that breaks valid hex.
    const block = cssVarsToInlineBlock({ '--x': '#FFF' });
    expect(block).toContain('#FFF');
  });
});
