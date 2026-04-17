import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { user } from '@/db/auth-schema';
import { auth } from '@/lib/auth';
import { AuthError, requireRole, type Role } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

const CREATABLE_ROLES: readonly Role[] = ['super_admin', 'tenant_admin', 'staff'];

interface CreateUserBody {
  email?: unknown;
  name?: unknown;
  role?: unknown;
  tenantId?: unknown;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/** super_admin creates any user; tenant_admin creates only within its
 *  own tenant and cannot promote to super_admin. Creates the row with
 *  emailVerified=true (admin vouched for it) and dispatches a magic
 *  link so the new user can start a session without a password. */
export const POST = withSession(async (session, req) => {
  requireRole(session, ['super_admin', 'tenant_admin']);
  const actorRole = session.user.role as Role;
  const actorTenantId = session.user.tenantId as string | null | undefined;

  let body: CreateUserBody;
  try {
    body = (await req.json()) as CreateUserBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const errors: string[] = [];
  if (!isNonEmptyString(body.email)) errors.push('email');
  if (!isNonEmptyString(body.name)) errors.push('name');
  if (!isNonEmptyString(body.role) || !CREATABLE_ROLES.includes(body.role as Role)) {
    errors.push('role');
  }
  if (body.tenantId !== undefined && body.tenantId !== null && !isNonEmptyString(body.tenantId)) {
    errors.push('tenantId');
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: 'validation_failed', details: errors }, { status: 422 });
  }

  const email = (body.email as string).toLowerCase();
  const name = body.name as string;
  const role = body.role as Role;
  const requestedTenantId =
    typeof body.tenantId === 'string' && body.tenantId.length > 0
      ? body.tenantId
      : null;

  // Authorization: tenant_admin can only act within its own tenant and
  // cannot grant super_admin. super_admin can do anything.
  let tenantId: string | null;
  if (actorRole === 'super_admin') {
    tenantId = requestedTenantId;
  } else {
    // tenant_admin
    if (role === 'super_admin') {
      throw new AuthError('forbidden_role', 403);
    }
    if (requestedTenantId !== null && requestedTenantId !== actorTenantId) {
      throw new AuthError('forbidden_tenant', 403);
    }
    tenantId = actorTenantId ?? null;
    if (!tenantId) {
      // tenant_admin with no tenant is a malformed account — bail.
      throw new AuthError('forbidden_tenant', 403);
    }
  }

  // Non-super_admin users must belong to a tenant.
  if (role !== 'super_admin' && !tenantId) {
    return NextResponse.json(
      { error: 'validation_failed', details: ['tenantId'] },
      { status: 422 },
    );
  }

  // Verify the tenant exists when one was resolved.
  if (tenantId) {
    const rows = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (!rows[0]) {
      return NextResponse.json(
        { error: 'validation_failed', details: ['tenantId'] },
        { status: 422 },
      );
    }
  }

  // Email uniqueness (global — see CLAUDE.md).
  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  if (existing[0]) {
    return NextResponse.json({ error: 'conflict' }, { status: 409 });
  }

  const now = new Date();
  const [inserted] = await db
    .insert(user)
    .values({
      id: crypto.randomUUID(),
      email,
      name,
      emailVerified: true,
      tenantId,
      role,
      createdAt: now,
      updatedAt: now,
    })
    .returning({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      createdAt: user.createdAt,
    });

  // Dispatch a magic link. Best-effort — we still return 201 if email
  // delivery flakes so the admin sees the user was created. They can
  // resend from the UI later.
  let magicLinkDispatched = true;
  try {
    await auth.api.signInMagicLink({
      body: { email, callbackURL: '/' },
      headers: new Headers(),
    });
  } catch {
    magicLinkDispatched = false;
  }

  return NextResponse.json(
    { user: inserted, magicLinkDispatched },
    { status: 201 },
  );
});
