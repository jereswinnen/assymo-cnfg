import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { materials } from '@/db/schema';
import { materialDbRowToDomain } from '@/db/resolveTenant';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

export const POST = withSession(
  async (session, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;
    const [row] = await db.select().from(materials).where(eq(materials.id, id)).limit(1);
    if (!row) return NextResponse.json({ error: 'material_not_found' }, { status: 404 });
    requireTenantScope(session, row.tenantId);

    const [updated] = await db
      .update(materials)
      .set({ archivedAt: null, updatedAt: sql`now()` })
      .where(eq(materials.id, id))
      .returning();
    return NextResponse.json({ material: materialDbRowToDomain(updated) });
  },
);
