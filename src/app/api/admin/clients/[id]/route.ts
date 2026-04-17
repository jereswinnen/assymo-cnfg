import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { user } from '@/db/auth-schema';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

/** Read one client + their orders. tenant_admin gets a 403 for clients
 *  outside its tenant. */
export const GET = withSession(
  async (session, _req, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;

    const [client] = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        userType: user.userType,
        tenantId: user.tenantId,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);

    if (!client || client.userType !== 'client') {
      return NextResponse.json({ error: 'client_not_found' }, { status: 404 });
    }
    if (!client.tenantId) {
      return NextResponse.json({ error: 'client_orphaned' }, { status: 500 });
    }
    requireTenantScope(session, client.tenantId);

    const clientOrders = await db
      .select({
        id: orders.id,
        code: orders.code,
        status: orders.status,
        totalCents: orders.totalCents,
        currency: orders.currency,
        createdAt: orders.createdAt,
        submittedAt: orders.submittedAt,
      })
      .from(orders)
      .where(eq(orders.customerId, id))
      .orderBy(desc(orders.createdAt));

    return NextResponse.json({ client, orders: clientOrders });
  },
);
