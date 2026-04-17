import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { validatePriceBookPatch, type PriceBook } from '@/domain/pricing';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

/** PATCH the tenant's priceBook. super_admin can touch any tenant;
 *  tenant_admin can only touch its own. Business users only; client users are denied. The body is
 *  a partial priceBook; fields are merged over the stored jsonb. */
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

  const { priceBook, errors } = validatePriceBookPatch(body);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: 'validation_failed', details: errors },
      { status: 422 },
    );
  }
  if (Object.keys(priceBook).length === 0) {
    return NextResponse.json({ error: 'empty_patch' }, { status: 400 });
  }

  const rows = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  const current = rows[0];
  if (!current) {
    return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });
  }

  // doorBase is nested, so merge that key deep; everything else is scalar.
  const merged: PriceBook = {
    ...current.priceBook,
    ...priceBook,
    doorBase: {
      ...current.priceBook.doorBase,
      ...(priceBook.doorBase ?? {}),
    },
  };

  const [updated] = await db
    .update(tenants)
    .set({ priceBook: merged, updatedAt: sql`now()` })
    .where(and(eq(tenants.id, id)))
    .returning();

  return NextResponse.json({ tenant: updated });
});
