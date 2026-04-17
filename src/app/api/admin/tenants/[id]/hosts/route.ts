import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { tenantHosts, tenants } from '@/db/schema';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

function normalizeHost(input: string): string {
  return input.trim().toLowerCase();
}

export const GET = withSession(
  async (session, _req, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;
    requireTenantScope(session, id);

    const rows = await db.select().from(tenantHosts).where(eq(tenantHosts.tenantId, id));
    return NextResponse.json({ hosts: rows });
  },
);

interface PostBody {
  hostname?: unknown;
}

export const POST = withSession(
  async (session, req, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;
    requireTenantScope(session, id);

    let body: PostBody;
    try {
      body = (await req.json()) as PostBody;
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    if (typeof body.hostname !== 'string' || body.hostname.trim().length === 0) {
      return NextResponse.json(
        { error: 'validation_failed', details: ['hostname'] },
        { status: 422 },
      );
    }
    const hostname = normalizeHost(body.hostname);

    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);
    if (!tenant) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });

    try {
      const [inserted] = await db
        .insert(tenantHosts)
        .values({ hostname, tenantId: id })
        .returning();
      return NextResponse.json({ host: inserted }, { status: 201 });
    } catch {
      return NextResponse.json({ error: 'conflict' }, { status: 409 });
    }
  },
);
