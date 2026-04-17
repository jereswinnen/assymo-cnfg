import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';
import type { Session } from '@/lib/auth';

/** Read a single tenant. super_admin reads any; tenant_admin reads
 *  only its own. */
export const GET = withSession(
  async (session: Session, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;
    requireTenantScope(session, id);

    const [row] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    if (!row) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });
    return NextResponse.json({ tenant: row });
  },
);
