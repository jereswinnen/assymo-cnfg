import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { supplierProducts, suppliers } from '@/db/schema';
import { supplierProductDbRowToDomain } from '@/db/resolveTenant';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

type Ctx = { params: Promise<{ id: string; pid: string }> };

export const POST = withSession(async (session, _req: Request, ctx: Ctx) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const { id: supplierId, pid } = await ctx.params;

  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, supplierId))
    .limit(1);
  if (!supplier) return NextResponse.json({ error: 'supplier_not_found' }, { status: 404 });
  requireTenantScope(session, supplier.tenantId);

  const [row] = await db
    .select()
    .from(supplierProducts)
    .where(eq(supplierProducts.id, pid))
    .limit(1);
  if (!row || row.supplierId !== supplierId)
    return NextResponse.json({ error: 'product_not_found' }, { status: 404 });

  const [updated] = await db
    .update(supplierProducts)
    .set({ archivedAt: null, updatedAt: sql`now()` })
    .where(eq(supplierProducts.id, pid))
    .returning();
  return NextResponse.json({ product: supplierProductDbRowToDomain(updated) });
});
