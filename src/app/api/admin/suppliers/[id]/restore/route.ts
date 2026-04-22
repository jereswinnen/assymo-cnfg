import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { suppliers } from '@/db/schema';
import { supplierDbRowToDomain } from '@/db/resolveTenant';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

export const POST = withSession(
  async (session, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;
    const [row] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    if (!row) return NextResponse.json({ error: 'supplier_not_found' }, { status: 404 });
    requireTenantScope(session, row.tenantId);

    const [updated] = await db
      .update(suppliers)
      .set({ archivedAt: null, updatedAt: sql`now()` })
      .where(eq(suppliers.id, id))
      .returning();
    return NextResponse.json({ supplier: supplierDbRowToDomain(updated) });
  },
);
