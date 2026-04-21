import { NextResponse } from 'next/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { products } from '@/db/schema';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

/** Bulk-reorder: `{ orderedIds: string[] }`. Every id must belong to
 *  the same tenant (verified). Assigns sort_order = index in the array.
 *  Drizzle's Neon HTTP client doesn't offer multi-row CASE upsert
 *  natively, so updates run sequentially — acceptable for tens of rows.
 *  If performance matters later, move to a SQL CASE chain. */
export const PATCH = withSession(async (session, req: Request) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const orderedIds = (body as { orderedIds?: unknown }).orderedIds;
  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== 'string')) {
    return NextResponse.json(
      { error: 'validation_failed', details: [{ field: 'orderedIds', code: 'invalid' }] },
      { status: 422 },
    );
  }
  if (orderedIds.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  const rows = await db
    .select({ id: products.id, tenantId: products.tenantId })
    .from(products)
    .where(inArray(products.id, orderedIds as string[]));

  if (rows.length !== orderedIds.length) {
    return NextResponse.json({ error: 'product_not_found' }, { status: 404 });
  }
  const tenantIds = new Set(rows.map((r) => r.tenantId));
  if (tenantIds.size !== 1) {
    return NextResponse.json(
      { error: 'validation_failed', details: [{ field: 'orderedIds', code: 'cross_tenant' }] },
      { status: 422 },
    );
  }
  const [tenantId] = tenantIds;
  requireTenantScope(session, tenantId);

  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(products)
      .set({ sortOrder: i, updatedAt: sql`now()` })
      .where(and(eq(products.id, orderedIds[i] as string), eq(products.tenantId, tenantId)));
  }

  return NextResponse.json({ updated: orderedIds.length });
});
