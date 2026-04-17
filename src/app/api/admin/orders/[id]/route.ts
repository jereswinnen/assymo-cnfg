import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { user } from '@/db/auth-schema';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

/** Read one order. tenant_admin gets a 403 for orders outside its
 *  tenant; super_admin reads any. Joined to user for the customer
 *  display fields. */
export const GET = withSession(
  async (session, _req, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;

    const [row] = await db
      .select({
        order: orders,
        customer: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
        },
      })
      .from(orders)
      .leftJoin(user, eq(orders.customerId, user.id))
      .where(eq(orders.id, id))
      .limit(1);

    if (!row) return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
    requireTenantScope(session, row.order.tenantId);

    return NextResponse.json({ order: row.order, customer: row.customer });
  },
);
