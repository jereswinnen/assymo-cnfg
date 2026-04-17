import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { tenantHosts } from '@/db/schema';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

export const DELETE = withSession(
  async (session, _req, ctx: { params: Promise<{ id: string; hostname: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id, hostname } = await ctx.params;
    requireTenantScope(session, id);

    const decoded = decodeURIComponent(hostname).toLowerCase();
    const result = await db
      .delete(tenantHosts)
      .where(and(eq(tenantHosts.tenantId, id), eq(tenantHosts.hostname, decoded)))
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: 'host_not_found' }, { status: 404 });
    }
    return NextResponse.json({ deleted: result[0] });
  },
);
