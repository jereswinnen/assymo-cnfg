import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '@/db/client';
import { suppliers, type SupplierDbRow } from '@/db/schema';
import { supplierDbRowToDomain } from '@/db/resolveTenant';
import { validateSupplierCreate } from '@/domain/supplier';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

/** List suppliers for a tenant. tenant_admin sees own scope; super_admin
 *  may pass `?tenantId=<id>` to target a specific tenant. Archived rows
 *  included — callers filter client-side. */
export const GET = withSession(async (session, req: Request) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const url = new URL(req.url);
  const queryTenantId = url.searchParams.get('tenantId');
  const tenantId = queryTenantId ?? session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'tenant_scope_required' }, { status: 400 });
  requireTenantScope(session, tenantId);

  const rows: SupplierDbRow[] = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.tenantId, tenantId))
    .orderBy(asc(suppliers.name));

  return NextResponse.json({ suppliers: rows.map(supplierDbRowToDomain) });
});

/** Create a supplier. Uniqueness on (tenantId, slug) is enforced at the
 *  DB layer and mapped to `slug_taken`. */
export const POST = withSession(async (session, req: Request) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const result = validateSupplierCreate(body);
  if (result.errors.length > 0) {
    return NextResponse.json(
      { error: 'validation_failed', details: result.errors },
      { status: 422 },
    );
  }
  const input = result.value!;

  const scopeTenantId =
    (body as { tenantId?: string }).tenantId ?? session.user.tenantId;
  if (!scopeTenantId)
    return NextResponse.json({ error: 'tenant_scope_required' }, { status: 400 });
  requireTenantScope(session, scopeTenantId);

  const id = randomUUID();
  try {
    const [row] = await db
      .insert(suppliers)
      .values({
        id,
        tenantId: scopeTenantId,
        slug: input.slug,
        name: input.name,
        logoUrl: input.logoUrl ?? undefined,
        contact: input.contact,
        notes: input.notes ?? undefined,
      })
      .returning();
    return NextResponse.json({ supplier: supplierDbRowToDomain(row) }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('suppliers_tenant_slug_idx')) {
      return NextResponse.json(
        { error: 'validation_failed', details: [{ field: 'slug', code: 'slug_taken' }] },
        { status: 409 },
      );
    }
    throw err;
  }
});
