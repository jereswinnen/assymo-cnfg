import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { supplierProducts } from '@/db/schema';
import { supplierProductDbRowToDomain } from '@/db/resolveTenant';
import {
  validateSupplierProductCreate,
  validateSupplierProductPatch,
  validateDoorMeta,
  validateWindowMeta,
} from '@/domain/supplier';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

export const GET = withSession(
  async (session, _req: Request, ctx: { params: Promise<{ pid: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { pid } = await ctx.params;
    const [row] = await db
      .select()
      .from(supplierProducts)
      .where(eq(supplierProducts.id, pid))
      .limit(1);
    if (!row) return NextResponse.json({ error: 'product_not_found' }, { status: 404 });
    requireTenantScope(session, row.tenantId);
    return NextResponse.json({ product: supplierProductDbRowToDomain(row) });
  },
);

export const PATCH = withSession(
  async (session, req: Request, ctx: { params: Promise<{ pid: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { pid } = await ctx.params;
    const [existing] = await db
      .select()
      .from(supplierProducts)
      .where(eq(supplierProducts.id, pid))
      .limit(1);
    if (!existing) return NextResponse.json({ error: 'product_not_found' }, { status: 404 });
    requireTenantScope(session, existing.tenantId);

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

    // When patching meta, validate using kind-specific validator
    let metaOut = result.value!.meta !== undefined ? result.value!.meta : existing.meta;
    if (result.value!.meta !== undefined) {
      const kindToValidate = existing.kind; // kind cannot change
      const metaValidator = kindToValidate === 'door' ? validateDoorMeta : validateWindowMeta;
      const metaValidation = metaValidator(result.value!.meta);
      if (metaValidation.errors.length > 0) {
        return NextResponse.json(
          { error: 'validation_failed', details: metaValidation.errors },
          { status: 422 },
        );
      }
      metaOut = metaValidation.value!;
    }

    // Merge patch onto existing and re-run the full create validator.
    const merged = {
      supplierId: existing.supplierId,
      kind: existing.kind,
      sku: result.value!.sku ?? existing.sku,
      name: result.value!.name ?? existing.name,
      heroImage:
        result.value!.heroImage !== undefined ? result.value!.heroImage : existing.heroImage,
      widthMm: result.value!.widthMm ?? existing.widthMm,
      heightMm: result.value!.heightMm ?? existing.heightMm,
      priceCents: result.value!.priceCents ?? existing.priceCents,
      meta: metaOut,
      sortOrder: result.value!.sortOrder ?? existing.sortOrder,
    };
    const shape = validateSupplierProductCreate(merged);
    if (shape.errors.length > 0) {
      return NextResponse.json(
        { error: 'validation_failed', details: shape.errors },
        { status: 422 },
      );
    }

    try {
      const [updated] = await db
        .update(supplierProducts)
        .set({
          sku: shape.value!.sku,
          name: shape.value!.name,
          heroImage: shape.value!.heroImage ?? undefined,
          widthMm: shape.value!.widthMm,
          heightMm: shape.value!.heightMm,
          priceCents: shape.value!.priceCents,
          meta: shape.value!.meta,
          sortOrder: shape.value!.sortOrder,
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
  },
);

/** Soft-delete: sets archived_at. Supplier products become unavailable for
 *  selection in the configurator; existing orders freeze the product data
 *  at snapshot time. */
export const DELETE = withSession(
  async (session, _req: Request, ctx: { params: Promise<{ pid: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { pid } = await ctx.params;
    const [row] = await db
      .select()
      .from(supplierProducts)
      .where(eq(supplierProducts.id, pid))
      .limit(1);
    if (!row) return NextResponse.json({ error: 'product_not_found' }, { status: 404 });
    requireTenantScope(session, row.tenantId);

    const [updated] = await db
      .update(supplierProducts)
      .set({ archivedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(supplierProducts.id, pid))
      .returning();
    return NextResponse.json({ product: supplierProductDbRowToDomain(updated) });
  },
);
