import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import {
  validateOrderTransition,
  type OrderStatus,
} from '@/domain/orders';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

interface PatchBody {
  status?: unknown;
}

/** Move an order to a new status. The transition is validated in the
 *  pure domain layer (`validateOrderTransition`) — the route is a thin
 *  wrapper that loads the row, scopes it, and persists the change. */
export const PATCH = withSession(
  async (session, req, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;

    let body: PatchBody;
    try {
      body = (await req.json()) as PatchBody;
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }
    if (typeof body.status !== 'string') {
      return NextResponse.json(
        { error: 'validation_failed', details: ['status'] },
        { status: 422 },
      );
    }

    const [row] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!row) return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
    requireTenantScope(session, row.tenantId);

    // The cast on body.status is type-only; validateOrderTransition's
    // internal isOrderStatus guard returns `unknown_status` for bad
    // values, so runtime safety is preserved.
    const transitionErrors = validateOrderTransition(
      row.status as OrderStatus,
      body.status as OrderStatus,
    );
    if (transitionErrors.length > 0) {
      return NextResponse.json(
        { error: 'invalid_transition', details: transitionErrors },
        { status: 422 },
      );
    }

    const [updated] = await db
      .update(orders)
      .set({ status: body.status as OrderStatus, updatedAt: sql`now()` })
      .where(eq(orders.id, id))
      .returning();

    return NextResponse.json({ order: updated });
  },
);
