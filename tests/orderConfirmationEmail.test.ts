import { describe, it, expect } from 'vite-plus/test';
import { renderOrderConfirmationEmail } from '@/lib/orderConfirmationEmail';

describe('renderOrderConfirmationEmail', () => {
  it('escapes HTML in branding.displayName + order.contactName', () => {
    const { html, subject } = renderOrderConfirmationEmail({
      branding: { displayName: 'Acme <b>Bold</b>', primaryColor: '#112233' },
      order: { id: 'abcd1234efgh5678', contactName: '<script>alert(1)</script>', totalCents: 12345 },
      magicLinkUrl: 'https://example.com/api/auth/magic?t=abc',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Acme &lt;b&gt;Bold&lt;/b&gt;');
    // Subject is plaintext; brand goes through unescaped (only CR/LF stripped).
    expect(subject).toContain('Acme <b>Bold</b>');
    expect(subject).toContain('abcd1234');
  });

  it('strips CR/LF from displayName to defeat email-header injection', () => {
    const { subject } = renderOrderConfirmationEmail({
      branding: { displayName: 'Acme\r\nBcc: evil@example.com', primaryColor: '#112233' },
      order: { id: 'abc', contactName: 'X', totalCents: 0 },
      magicLinkUrl: 'https://example.com/',
    });
    expect(subject).not.toContain('\r');
    expect(subject).not.toContain('\n');
    expect(subject).toContain('AcmeBcc: evil@example.com');
  });

  it('URL-encodes the magic link inside href', () => {
    const { html } = renderOrderConfirmationEmail({
      branding: { displayName: 'A', primaryColor: '#112233' },
      order: { id: 'x', contactName: 'X', totalCents: 0 },
      magicLinkUrl: 'https://example.com/path with space?x="bad"',
    });
    // Spaces become %20, double quotes become %22 — no raw quote in the href.
    expect(html).toContain('href="https://example.com/path%20with%20space?x=%22bad%22"');
  });
});
