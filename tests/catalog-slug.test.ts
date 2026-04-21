import { describe, it, expect } from 'vite-plus/test';
import { normalizeSlug, isValidSlug } from '@/domain/catalog';

describe('normalizeSlug', () => {
  it('lowercases and trims', () => {
    expect(normalizeSlug('  WOOD ')).toBe('wood');
  });

  it('replaces whitespace with a single hyphen', () => {
    expect(normalizeSlug('smal profiel grenen')).toBe('smal-profiel-grenen');
  });

  it('collapses repeated hyphens', () => {
    expect(normalizeSlug('a--b---c')).toBe('a-b-c');
  });

  it('strips leading and trailing hyphens', () => {
    expect(normalizeSlug('-abc-')).toBe('abc');
  });

  it('removes characters outside [a-z0-9-]', () => {
    expect(normalizeSlug('zwart_smal/profiel')).toBe('zwartsmalprofiel');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeSlug('')).toBe('');
  });
});

describe('isValidSlug', () => {
  it('accepts lowercase alphanumeric and hyphens', () => {
    expect(isValidSlug('wood')).toBe(true);
    expect(isValidSlug('zwart-smal-profiel')).toBe(true);
    expect(isValidSlug('brick-3')).toBe(true);
  });

  it('rejects empty strings', () => {
    expect(isValidSlug('')).toBe(false);
  });

  it('rejects strings starting with a hyphen', () => {
    expect(isValidSlug('-wood')).toBe(false);
  });

  it('rejects strings ending with a hyphen', () => {
    expect(isValidSlug('wood-')).toBe(false);
  });

  it('rejects uppercase', () => {
    expect(isValidSlug('Wood')).toBe(false);
  });

  it('rejects underscores or other punctuation', () => {
    expect(isValidSlug('wood_pine')).toBe(false);
    expect(isValidSlug('wood/pine')).toBe(false);
  });

  it('rejects strings longer than 48 chars', () => {
    expect(isValidSlug('a'.repeat(49))).toBe(false);
    expect(isValidSlug('a'.repeat(48))).toBe(true);
  });
});
