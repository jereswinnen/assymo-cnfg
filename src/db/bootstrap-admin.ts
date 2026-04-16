/**
 * Bootstrap the first super-admin for a tenant.
 *
 * Usage:
 *   EMAIL=you@example.com pnpm db:bootstrap-admin
 *   EMAIL=you@example.com TENANT_ID=partner pnpm db:bootstrap-admin
 *
 * Creates (or promotes) the user row with role=super_admin + a tenantId,
 * then sends a magic-link email so you can sign in. In dev (no
 * RESEND_API_KEY) the magic link prints to the Next terminal — but this
 * script only talks to Better Auth's server API, so run it while
 * `pnpm dev` is up *or* rely on the direct DB promotion and use the
 * regular sign-in flow from the browser.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { user } from '@/db/auth-schema';
import { tenants } from '@/db/schema';
import { auth } from '@/lib/auth';

const email = process.env.EMAIL?.trim();
const tenantId = process.env.TENANT_ID?.trim() ?? 'assymo';
const nameOverride = process.env.NAME?.trim();

if (!email) {
  console.error('Usage: EMAIL=you@example.com pnpm db:bootstrap-admin');
  process.exit(1);
}

async function main() {
  const tenant = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!tenant[0]) {
    console.error(
      `Tenant "${tenantId}" not found. Run \`pnpm db:seed\` first or set TENANT_ID.`,
    );
    process.exit(1);
  }

  const existing = await db
    .select()
    .from(user)
    .where(eq(user.email, email!))
    .limit(1);

  if (existing[0]) {
    await db
      .update(user)
      .set({ tenantId, role: 'super_admin', emailVerified: true })
      .where(eq(user.id, existing[0].id));
    console.log(`Promoted existing user ${email} → super_admin in tenant "${tenantId}"`);
  } else {
    const id = crypto.randomUUID();
    const name = nameOverride ?? (email!.split('@')[0] ?? 'Admin');
    await db.insert(user).values({
      id,
      email: email!,
      name,
      emailVerified: true,
      tenantId,
      role: 'super_admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`Created user ${email} (${name}) → super_admin in tenant "${tenantId}"`);
  }

  // Trigger a magic-link email so the user can sign in right away.
  try {
    await auth.api.signInMagicLink({
      body: { email: email!, callbackURL: '/' },
      headers: new Headers(),
    });
    console.log('Magic link dispatched. Check your inbox (or the Next dev terminal).');
  } catch (err) {
    console.warn(
      'Direct auth.api.signInMagicLink failed — that is OK if the Next dev server is the one wired to Resend. Hit /api/auth/sign-in/magic-link from the UI instead.',
    );
    console.warn(err instanceof Error ? err.message : err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
