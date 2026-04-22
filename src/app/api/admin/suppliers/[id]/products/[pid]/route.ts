import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { supplierProducts, suppliers } from '@/db/schema';
import { supplierProductDbRowToDomain } from '@/db/resolveTenant';
import { validateSupplierProductPatch } from '@/domain/supplier';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

type Ctx = { params: Promise<{ id: string; pid: string }> };

export const GET = withSession(async (session, _req: Request, ctx: Ctx) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const { id: supplierId, pid } = await ctx.params;

  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, supplierId))
    .limit(1);
  if (!supplier) return NextResponse.json({ error: 'supplier_not_found' }, { status: 404 });
  requireTenantScope(session, supplier.tenantId);

  const [row] = await db
    .select()
    .from(supplierProducts)
    .where(eq(supplierProducts.id, pid))
    .limit(1);
  if (!row || row.supplierId !== supplierId)
    return NextResponse.json({ error: 'product_not_found' }, { status: 404 });

  return NextResponse.json({ product: supplierProductDbRowToDomain(row) });
});

export const PATCH = withSession(async (session, req: Request, ctx: Ctx) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const { id: supplierId, pid } = await ctx.params;

  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, supplierId))
    .limit(1);
  if (!supplier) return NextResponse.json({ error: 'supplier_not_found' }, { status: 404 });
  requireTenantScope(session, supplier.tenantId);

  const [existing] = await db
    .select()
    .from(supplierProducts)
    .where(eq(supplierProducts.id, pid))
    .limit(1);
  if (!existing || existing.supplierId !== supplierId)
    return NextResponse.json({ error: 'product_not_found' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const result = validateSupplierProductPatch(body);
  if (result.errors.length > 0) {
    return NextResponse.json(
      { error: 'validation_failed', details: result.errors },
      { status: 422 },
    );
  }
  const patch = result.value!;

  try {
    const [updated] = await db
      .update(supplierProducts)
      .set({
        ...(patch.sku !== undefined && { sku: patch.sku }),
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.heroImage !== undefined && { heroImage: patch.heroImage ?? undefined }),
        ...(patch.widthMm !== undefined && { widthMm: patch.widthMm }),
        ...(patch.heightMm !== undefined && { heightMm: patch.heightMm }),
        ...(patch.priceCents !== undefined && { priceCents: patch.priceCents }),
        ...(patch.meta !== undefined && { meta: patch.meta }),
        ...(patch.sortOrder !== undefined && { sortOrder: patch.sortOrder }),
        updatedAt: sql`now()`,
      })
      .where(eq(supplierProducts.id, pid))
      .returning();
    return NextResponse.json({ product: supplierProductDbRowToDomain(updated) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('supplier_products_tenant_kind_sku_idx')) {
      return NextResponse.json(
        { error: 'validation_failed', details: [{ field: 'sku', code: 'sku_taken' }] },
        { status: 409 },
      );
    }
    throw err;
  }
});

/** Soft-delete: sets archived_at on the supplier product. */
export const DELETE = withSession(async (session, _req: Request, ctx: Ctx) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const { id: supplierId, pid } = await ctx.params;

  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, supplierId))
    .limit(1);
  if (!supplier) return NextResponse.json({ error: 'supplier_not_found' }, { status: 404 });
  requireTenantScope(session, supplier.tenantId);

  const [row] = await db
    .select()
    .from(supplierProducts)
    .where(eq(supplierProducts.id, pid))
    .limit(1);
  if (!row || row.supplierId !== supplierId)
    return NextResponse.json({ error: 'product_not_found' }, { status: 404 });

  const [updated] = await db
    .update(supplierProducts)
    .set({ archivedAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(supplierProducts.id, pid))
    .returning();
  return NextResponse.json({ product: supplierProductDbRowToDomain(updated) });
});
