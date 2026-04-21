import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { requireClient } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

interface Ctx { params: Promise<{ id: string }> }

/** Fetch a single order by id, strictly scoped to the caller's own
 *  `customerId`. Returns 404 for both "not found" and "not yours" —
 *  don't leak the existence of another client's order. */
export const GET = withSession(async (session, _req, { params }: Ctx) => {
  requireClient(session);
  const { id } = await params;

  const [row] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.customerId, session.user.id)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ order: row });
});
