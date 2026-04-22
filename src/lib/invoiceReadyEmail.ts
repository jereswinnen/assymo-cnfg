import { Resend } from 'resend';
import type { Branding } from '@/domain/tenant';
import type { InvoiceRow } from '@/db/schema';
import { t } from './i18n';

const resendClient = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('nl-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

interface RenderInput {
  branding: Pick<Branding, 'displayName' | 'primaryColor'>;
  invoice: Pick<
    InvoiceRow,
    'id' | 'number' | 'totalCents' | 'issuedAt' | 'dueAt' | 'customerName'
  >;
  magicLinkUrl: string;
}

/** Pure HTML renderer for the "your invoice is ready" email. Mirrors the
 *  shape of `orderConfirmationEmail` so both templates stay visually
 *  consistent across the customer's inbox. */
export function renderInvoiceReadyEmail({
  branding,
  invoice,
  magicLinkUrl,
}: RenderInput): { subject: string; html: string } {
  const safeBrand = branding.displayName.replace(/[\r\n]/g, '');
  const safeBrandHtml = escapeHtml(safeBrand);
  const safeCustomer = escapeHtml(invoice.customerName);
  const safeNumber = escapeHtml(invoice.number);
  const safeUrl = encodeURI(magicLinkUrl);

  const subject = t('email.invoiceReady.subject', {
    brand: safeBrand,
    number: invoice.number,
  });
  const greeting = t('email.invoiceReady.greeting', { name: safeCustomer });
  const intro = t('email.invoiceReady.intro', { number: safeNumber });
  const summary = t('email.invoiceReady.summary');
  const numberLabel = t('email.invoiceReady.number');
  const issuedAtLabel = t('email.invoiceReady.issuedAt');
  const dueAtLabel = t('email.invoiceReady.dueAt');
  const totalLabel = t('email.invoiceReady.total');
  const claimIntro = t('email.invoiceReady.claimIntro');
  const claimCta = t('email.invoiceReady.claimCta');
  const footer = t('email.invoiceReady.footer');

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
        <td style="padding: 6px 0;">${numberLabel}</td>
        <td style="padding: 6px 0; text-align: right; font-weight: 600;">${safeNumber}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0;">${issuedAtLabel}</td>
        <td style="padding: 6px 0; text-align: right;">${formatDate(invoice.issuedAt)}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0;">${dueAtLabel}</td>
        <td style="padding: 6px 0; text-align: right;">${formatDate(invoice.dueAt)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">${totalLabel}</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600; border-top: 1px solid #e5e7eb;">${formatCents(invoice.totalCents)}</td>
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
 *  URL to the console. */
export async function sendInvoiceReadyEmail(input: SendInput): Promise<void> {
  const { subject, html } = renderInvoiceReadyEmail(input);
  const from =
    input.fromAddress ?? process.env.AUTH_EMAIL_FROM ?? 'Assymo <auth@assymo.be>';

  if (!resendClient) {
    console.log(
      `[dev] Invoice-ready email for ${input.toEmail}: ${input.magicLinkUrl}`,
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
