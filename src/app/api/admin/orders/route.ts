import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { user } from '@/db/auth-schema';
import { requireBusiness, type Role } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

/** List orders in scope, newest first. Joined to user.email/name so the
 *  admin table can render "claimed by" without a second round-trip. */
export const GET = withSession(async (session) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const actorRole = session.user.role as Role;
  const actorTenantId = session.user.tenantId as string | null;

  const fields = {
    id: orders.id,
    tenantId: orders.tenantId,
    code: orders.code,
    customerId: orders.customerId,
    contactEmail: orders.contactEmail,
    contactName: orders.contactName,
    status: orders.status,
    totalCents: orders.totalCents,
    currency: orders.currency,
    submittedAt: orders.submittedAt,
    createdAt: orders.createdAt,
    customerEmail: user.email,
    customerName: user.name,
  } as const;

  const rows =
    actorRole === 'super_admin'
      ? await db
          .select(fields)
          .from(orders)
          .leftJoin(user, eq(orders.customerId, user.id))
          .orderBy(desc(orders.createdAt))
      : await db
          .select(fields)
          .from(orders)
          .leftJoin(user, eq(orders.customerId, user.id))
          .where(eq(orders.tenantId, actorTenantId ?? '__none__'))
          .orderBy(desc(orders.createdAt));

  return NextResponse.json({ orders: rows });
});
