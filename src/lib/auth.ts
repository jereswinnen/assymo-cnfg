import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { Resend } from 'resend';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders, tenants } from '@/db/schema';
import { sendOrderConfirmationEmail } from './orderConfirmationEmail';

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
      tenantId: {
        type: 'string',
        required: false,
        input: false,
      },
      role: {
        type: ['super_admin', 'tenant_admin'] as const,
        required: false,
        defaultValue: 'tenant_admin',
        input: false,
      },
      userType: {
        type: ['business', 'client'] as const,
        required: true,
        defaultValue: 'business',
        input: false,
      },
    },
  },

  plugins: [
    magicLink({
      // Block session creation for emails that don't already have a user
      // row. Both onboarding flows (admin invite via POST /api/admin/users
      // and shop submit via POST /api/shop/orders) insert the user BEFORE
      // calling signInMagicLink, so disabling signup at the verify step is
      // safe. The request endpoint still 200s + sends an email for unknown
      // addresses (Better Auth's no-enumeration default); the verify
      // endpoint redirects with `?error=new_user_signup_disabled` instead
      // of creating a session for the unknown user.
      disableSignUp: true,
      sendMagicLink: async ({ email, url }) => {
        // Detect an order-confirmation context. The Better Auth magic-link
        // URL embeds `callbackURL` as a query param; parse it and route to
        // the order-aware template when applicable.
        let orderId: string | null = null;
        try {
          const parsed = new URL(url);
          const callback = parsed.searchParams.get('callbackURL') ?? '';
          const match = callback.match(/^\/shop\/account\/orders\/([^/?]+)/);
          if (match) orderId = match[1];
        } catch {
          // Fall through to the generic template.
        }

        if (orderId) {
          const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.id, orderId))
            .limit(1);
          if (order) {
            const [tenant] = await db
              .select()
              .from(tenants)
              .where(eq(tenants.id, order.tenantId))
              .limit(1);
            if (tenant) {
              await sendOrderConfirmationEmail({
                toEmail: email,
                branding: tenant.branding,
                order,
                magicLinkUrl: url,
              });
              return;
            }
          }
          // If the order/tenant lookup failed for any reason, fall through
          // to the generic template so the magic link still ships.
        }

        // Generic magic-link template (unchanged from Phase 1).
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
