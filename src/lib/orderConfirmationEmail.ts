import { Resend } from 'resend';
import type { Branding } from '@/domain/tenant';
import type { OrderRow } from '@/db/schema';
import { t } from './i18n';

const resendClient = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

/** Escape user-controlled values before interpolating into the HTML
 *  template. Tenant `displayName` comes from admin input;
 *  `contactName` comes from a public POST body — both must be
 *  escaped to avoid email-client HTML rendering of `<script>` /
 *  `<img onerror=…>` payloads. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format integer cents as a human EUR string ("€ 1.234,56" — Dutch). */
function formatCents(cents: number): string {
  const value = (cents / 100).toLocaleString('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value;
}

interface RenderInput {
  branding: Pick<Branding, 'displayName' | 'primaryColor'>;
  order: Pick<OrderRow, 'id' | 'contactName' | 'totalCents'>;
  magicLinkUrl: string;
}

/** Pure HTML renderer — no side effects, easy to snapshot-test if we
 *  ever feel the need. The brand color paints the CTA button so the
 *  email matches the admin's branding settings. */
export function renderOrderConfirmationEmail({
  branding,
  order,
  magicLinkUrl,
}: RenderInput): { subject: string; html: string } {
  // Strip CR/LF from header-bound brand to prevent email-header injection.
  const safeBrand = branding.displayName.replace(/[\r\n]/g, '');
  const safeContactName = escapeHtml(order.contactName);
  const safeBrandHtml = escapeHtml(safeBrand);
  const safeUrl = encodeURI(magicLinkUrl);

  const subject = t('email.orderConfirmation.subject', {
    brand: safeBrand,
    orderId: order.id.slice(0, 8),
  });
  const greeting = t('email.orderConfirmation.greeting', { name: safeContactName });
  const intro = t('email.orderConfirmation.intro');
  const summary = t('email.orderConfirmation.summary');
  const totalLabel = t('email.orderConfirmation.total');
  const claimIntro = t('email.orderConfirmation.claimIntro');
  const claimCta = t('email.orderConfirmation.claimCta');
  const footer = t('email.orderConfirmation.footer');

  const html = `
<!doctype html>
<html lang="nl">
  <body style="font-family: system-ui, -apple-system, sans-serif; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">${safeBrandHtml}</h1>
    <p>${greeting}</p>
    <p>${intro}</p>
    <h2 style="font-size: 14px; text-transform: uppercase; color: #6b7280; margin: 24px 0 8px;">${summary}</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr>
        <td style="padding: 8px 0;">${totalLabel}</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formatCents(order.totalCents)}</td>
      </tr>
    </table>
    <p style="margin-top: 24px;">${claimIntro}</p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="${safeUrl}"
         style="display: inline-block; background: ${branding.primaryColor}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        ${claimCta}
      </a>
    </p>
    <p style="font-size: 12px; color: #6b7280; margin-top: 32px;">${footer}</p>
  </body>
</html>`;
  return { subject, html };
}

interface SendInput extends RenderInput {
  toEmail: string;
  fromAddress?: string;
}

/** Dispatch via Resend. In dev (no RESEND_API_KEY) logs the magic-link
 *  URL to the console — same fallback as Better Auth's default. */
export async function sendOrderConfirmationEmail(input: SendInput): Promise<void> {
  const { subject, html } = renderOrderConfirmationEmail(input);
  const from = input.fromAddress ?? process.env.AUTH_EMAIL_FROM ?? 'Assymo <auth@assymo.be>';

  if (!resendClient) {
    console.log(
      `[dev] Order confirmation for ${input.toEmail}: ${input.magicLinkUrl}`,
    );
    return;
  }
  await resendClient.emails.send({
    from,
    to: input.toEmail,
    subject,
    html,
  });
}
