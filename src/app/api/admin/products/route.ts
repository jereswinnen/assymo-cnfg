import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '@/db/client';
import { products, type ProductDbRow } from '@/db/schema';
import { productDbRowToDomain } from '@/db/resolveTenant';
import { validateProductCreate } from '@/domain/catalog';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';
import { checkProductMaterialReferences } from '@/lib/productRefCheck';

/** List products for a tenant. tenant_admin sees own scope; super_admin
 *  may pass `?tenantId=<id>` to target a specific tenant. Archived rows
 *  included — callers filter client-side. */
export const GET = withSession(async (session, req: Request) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const url = new URL(req.url);
  const queryTenantId = url.searchParams.get('tenantId');
  const tenantId = queryTenantId ?? session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'tenant_scope_required' }, { status: 400 });
  requireTenantScope(session, tenantId);

  const rows: ProductDbRow[] = await db
    .select()
    .from(products)
    .where(eq(products.tenantId, tenantId))
    .orderBy(asc(products.sortOrder), asc(products.name));

  return NextResponse.json({ products: rows.map(productDbRowToDomain) });
});

/** Create a product. Uniqueness on (tenantId, slug) is enforced at the
 *  DB layer and mapped to `slug_taken`. Cross-table material references
 *  are validated against the tenant's `materials` rows. */
export const POST = withSession(async (session, req: Request) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const result = validateProductCreate(body);
  if (!result.ok) {
    return NextResponse.json(
      { error: 'validation_failed', details: result.errors },
      { status: 422 },
    );
  }
  const input = result.value;

  const scopeTenantId = (body as { tenantId?: string }).tenantId ?? session.user.tenantId;
  if (!scopeTenantId)
    return NextResponse.json({ error: 'tenant_scope_required' }, { status: 400 });
  requireTenantScope(session, scopeTenantId);

  const refErrors = await checkProductMaterialReferences(
    scopeTenantId,
    input.defaults.materials,
    input.constraints.allowedMaterialsBySlot,
  );
  if (refErrors.length > 0) {
    return NextResponse.json(
      { error: 'validation_failed', details: refErrors },
      { status: 422 },
    );
  }

  const id = randomUUID();
  try {
    const [row] = await db
      .insert(products)
      .values({
        id,
        tenantId: scopeTenantId,
        kind: input.kind,
        slug: input.slug,
        name: input.name,
        description: input.description,
        heroImage: input.heroImage,
        defaults: input.defaults,
        constraints: input.constraints,
        basePriceCents: input.basePriceCents,
        sortOrder: input.sortOrder,
      })
      .returning();
    return NextResponse.json({ product: productDbRowToDomain(row) }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('products_tenant_slug_idx')) {
      return NextResponse.json(
        { error: 'validation_failed', details: [{ field: 'slug', code: 'slug_taken' }] },
        { status: 409 },
      );
    }
    throw err;
  }
});
