import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '@/db/client';
import { supplierProducts, suppliers, type SupplierProductDbRow } from '@/db/schema';
import { supplierProductDbRowToDomain } from '@/db/resolveTenant';
import { validateSupplierProductCreate } from '@/domain/supplier';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

/** List supplier products for a specific supplier. tenant_admin sees own scope;
 *  super_admin must match tenant scope. Archived rows included — callers
 *  filter client-side. */
export const GET = withSession(
  async (session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id: supplierId } = await ctx.params;

    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, supplierId))
      .limit(1);
    if (!supplier) return NextResponse.json({ error: 'supplier_not_found' }, { status: 404 });
    requireTenantScope(session, supplier.tenantId);

    const rows: SupplierProductDbRow[] = await db
      .select()
      .from(supplierProducts)
      .where(eq(supplierProducts.supplierId, supplierId))
      .orderBy(asc(supplierProducts.sortOrder), asc(supplierProducts.name));

    return NextResponse.json({ products: rows.map(supplierProductDbRowToDomain) });
  },
);

/** Create a supplier product. Uniqueness on (tenantId, kind, sku) is enforced
 *  at the DB layer and mapped to `sku_taken`. */
export const POST = withSession(
  async (session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id: supplierId } = await ctx.params;

    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, supplierId))
      .limit(1);
    if (!supplier) return NextResponse.json({ error: 'supplier_not_found' }, { status: 404 });
    requireTenantScope(session, supplier.tenantId);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    // Force supplierId to match the path parameter
    const bodyWithSupplierId = { ...(body as Record<string, unknown>), supplierId };
    const result = validateSupplierProductCreate(bodyWithSupplierId);
    if (result.errors.length > 0) {
      return NextResponse.json(
        { error: 'validation_failed', details: result.errors },
        { status: 422 },
      );
    }
    const input = result.value!;

    // Verify supplierId matches
    if (input.supplierId !== supplierId) {
      return NextResponse.json(
        { error: 'validation_failed', details: [{ field: 'supplierId', code: 'mismatch' }] },
        { status: 422 },
      );
    }

    const id = randomUUID();
    try {
      const [row] = await db
        .insert(supplierProducts)
        .values({
          id,
          tenantId: supplier.tenantId,
          supplierId,
          kind: input.kind,
          sku: input.sku,
          name: input.name,
          heroImage: input.heroImage ?? undefined,
          widthMm: input.widthMm,
          heightMm: input.heightMm,
          priceCents: input.priceCents,
          meta: input.meta,
          sortOrder: input.sortOrder,
        })
        .returning();
      return NextResponse.json({ product: supplierProductDbRowToDomain(row) }, { status: 201 });
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
  },
);
