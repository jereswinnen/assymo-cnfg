import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { Resend } from 'resend';
import { db } from '@/db/client';

const resendClient = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_ADDRESS = process.env.AUTH_EMAIL_FROM ?? 'Assymo <auth@assymo.be>';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,

  emailAndPassword: {
    enabled: true,
    // Admins create accounts; signUp via client is still open for bootstrap
    // but tenantId is assigned server-side, not by the caller.
  },

  user: {
    additionalFields: {
      /** Which tenant this user belongs to. Nullable during initial
       *  signup/invite, filled in by the admin API. `input: false`
       *  means clients cannot set this directly. */
      tenantId: {
        type: 'string',
        required: false,
        input: false,
      },
      /** Role within the tenant (or system-wide for super_admin). */
      role: {
        type: ['super_admin', 'tenant_admin', 'staff'] as const,
        required: false,
        defaultValue: 'staff',
        input: false,
      },
    },
  },

  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        if (!resendClient) {
          console.log(`[dev] Magic link for ${email}: ${url}`);
          return;
        }
        await resendClient.emails.send({
          from: FROM_ADDRESS,
          to: email,
          subject: 'Je inlog-link voor Assymo',
          html: `
            <p>Klik op de onderstaande link om in te loggen. De link verloopt binnen 5 minuten.</p>
            <p><a href="${url}">Inloggen bij Assymo</a></p>
            <p>Heb je deze link niet aangevraagd? Dan kun je deze e-mail negeren.</p>
          `,
        });
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
