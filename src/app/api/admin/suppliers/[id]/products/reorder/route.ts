import { NextResponse } from 'next/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { supplierProducts, suppliers } from '@/db/schema';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

/** Bulk-reorder supplier products: `{ orderedIds: string[] }`. Every id
 *  must belong to the same supplier (verified). Assigns sort_order = index
 *  in the array. Per-supplier scope enforced by path param. */
export const PATCH = withSession(
  async (session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id: supplierId } = await ctx.params;

    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, supplierId))
      .limit(1);
    if (!supplier) return NextResponse.json({ error: 'supplier_not_found' }, { status: 404 });
    requireTenantScope(session, supplier.tenantId);

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
      .select({ id: supplierProducts.id, supplierId: supplierProducts.supplierId })
      .from(supplierProducts)
      .where(inArray(supplierProducts.id, orderedIds as string[]));

    if (rows.length !== orderedIds.length) {
      return NextResponse.json({ error: 'product_not_found' }, { status: 404 });
    }
    const supplierIds = new Set(rows.map((r) => r.supplierId));
    if (supplierIds.size !== 1 || ([...supplierIds][0] !== supplierId)) {
      return NextResponse.json(
        { error: 'validation_failed', details: [{ field: 'orderedIds', code: 'supplier_mismatch' }] },
        { status: 422 },
      );
    }

    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(supplierProducts)
        .set({ sortOrder: i, updatedAt: sql`now()` })
        .where(
          and(
            eq(supplierProducts.id, orderedIds[i] as string),
            eq(supplierProducts.supplierId, supplierId),
          ),
        );
    }

    return NextResponse.json({ updated: orderedIds.length });
  },
);
