import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { supplierProducts } from '@/db/schema';
import { supplierProductDbRowToDomain } from '@/db/resolveTenant';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

export const POST = withSession(
  async (session, _req: Request, ctx: { params: Promise<{ pid: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { pid } = await ctx.params;
    const [row] = await db
      .select()
      .from(supplierProducts)
      .where(eq(supplierProducts.id, pid))
      .limit(1);
    if (!row) return NextResponse.json({ error: 'product_not_found' }, { status: 404 });
    requireTenantScope(session, row.tenantId);

    const [updated] = await db
      .update(supplierProducts)
      .set({ archivedAt: null, updatedAt: sql`now()` })
      .where(eq(supplierProducts.id, pid))
      .returning();
    return NextResponse.json({ product: supplierProductDbRowToDomain(updated) });
  },
);
