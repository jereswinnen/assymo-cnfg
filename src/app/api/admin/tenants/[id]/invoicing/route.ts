import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { validateInvoicingPatch, type TenantInvoicing } from '@/domain/tenant';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

export const PATCH = withSession(async (session, req, ctx: { params: Promise<{ id: string }> }) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const { id } = await ctx.params;
  requireTenantScope(session, id);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { invoicing, errors } = validateInvoicingPatch(body);
  if (errors.length > 0) {
    return NextResponse.json({ error: 'validation_failed', details: errors }, { status: 422 });
  }
  if (Object.keys(invoicing).length === 0) {
    return NextResponse.json({ error: 'empty_patch' }, { status: 400 });
  }

  const [current] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!current) {
    return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });
  }

  const merged: TenantInvoicing = {
    ...current.invoicing,
    ...invoicing,
  };

  const [updated] = await db
    .update(tenants)
    .set({ invoicing: merged, updatedAt: sql`now()` })
    .where(eq(tenants.id, id))
    .returning();

  return NextResponse.json({ tenant: updated });
});
