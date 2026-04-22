import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { user } from '@/db/auth-schema';
import { requireBusiness, type BusinessKind } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

/** List client users in scope. super_admin sees all; tenant_admin sees
 *  only its own tenant. Mirrors the shape of GET /api/admin/users. */
export const GET = withSession(async (session) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const actorKind = session.user.kind as BusinessKind;
  const actorTenantId = session.user.tenantId as string | null;

  const fields = {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    tenantId: user.tenantId,
    createdAt: user.createdAt,
  } as const;

  const where =
    actorKind === 'super_admin'
      ? eq(user.kind, 'client')
      : and(eq(user.kind, 'client'), eq(user.tenantId, actorTenantId ?? '__none__'));

  const rows = await db
    .select(fields)
    .from(user)
    .where(where)
    .orderBy(desc(user.createdAt));

  return NextResponse.json({ clients: rows });
});
