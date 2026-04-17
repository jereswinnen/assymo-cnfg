import { describe, it, expect } from 'vite-plus/test';
import { DEFAULT_TENANT_ID, candidateHostKeys } from '@/domain/tenant';

describe('candidateHostKeys', () => {
  it('returns the exact host as the first candidate', () => {
    expect(candidateHostKeys('assymo.be')).toEqual(['assymo.be']);
  });

  it('lowercases the input', () => {
    expect(candidateHostKeys('ASSYMO.BE')).toEqual(['assymo.be']);
  });

  it('adds a bare host fallback when the host includes a port', () => {
    expect(candidateHostKeys('localhost:3000')).toEqual(['localhost:3000', 'localhost']);
  });

  it('adds the leftmost subdomain label for 3+ part hosts', () => {
    expect(candidateHostKeys('partner.configurator.com')).toEqual([
      'partner.configurator.com',
      'partner',
    ]);
  });

  it('combines port + subdomain candidates', () => {
    expect(candidateHostKeys('partner.configurator.com:8080')).toEqual([
      'partner.configurator.com:8080',
      'partner.configurator.com',
      'partner',
    ]);
  });

  it('does NOT add a subdomain candidate for 2-part hosts', () => {
    // `assymo.be` has only two labels, so we never look up `assymo` as a key.
    expect(candidateHostKeys('assymo.be')).not.toContain('assymo');
  });

  it('returns an empty list for null / undefined / empty input', () => {
    expect(candidateHostKeys(null)).toEqual([]);
    expect(candidateHostKeys(undefined)).toEqual([]);
    expect(candidateHostKeys('')).toEqual([]);
  });

  it('deduplicates candidates that collapse onto the same key', () => {
    // `localhost` has no port and one label, so the bare + exact candidates match.
    expect(candidateHostKeys('localhost')).toEqual(['localhost']);
  });
});

describe('DEFAULT_TENANT_ID', () => {
  it('is the assymo slug', () => {
    expect(DEFAULT_TENANT_ID).toBe('assymo');
  });
});
