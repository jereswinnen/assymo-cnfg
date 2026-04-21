import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { products } from '@/db/schema';
import { productDbRowToDomain } from '@/db/resolveTenant';
import { validateProductCreate, validateProductPatch } from '@/domain/catalog';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';
import { checkProductMaterialReferences } from '@/lib/productRefCheck';

export const GET = withSession(
  async (session, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;
    const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!row) return NextResponse.json({ error: 'product_not_found' }, { status: 404 });
    requireTenantScope(session, row.tenantId);
    return NextResponse.json({ product: productDbRowToDomain(row) });
  },
);

export const PATCH = withSession(
  async (session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;
    const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: 'product_not_found' }, { status: 404 });
    requireTenantScope(session, existing.tenantId);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    const result = validateProductPatch(body);
    if (!result.ok) {
      return NextResponse.json(
        { error: 'validation_failed', details: result.errors },
        { status: 422 },
      );
    }

    // Merge patch onto existing and re-run the full create validator so
    // constraints get cross-field validation (the patch validator is
    // intentionally shape-only — see @/domain/catalog/product.ts).
    const merged = {
      kind: existing.kind,
      slug: result.value.slug ?? existing.slug,
      name: result.value.name ?? existing.name,
      description:
        result.value.description !== undefined ? result.value.description : existing.description,
      heroImage:
        result.value.heroImage !== undefined ? result.value.heroImage : existing.heroImage,
      defaults: result.value.defaults ?? existing.defaults,
      constraints: result.value.constraints ?? existing.constraints,
      basePriceCents: result.value.basePriceCents ?? existing.basePriceCents,
      sortOrder: result.value.sortOrder ?? existing.sortOrder,
    };
    const shape = validateProductCreate(merged);
    if (!shape.ok) {
      return NextResponse.json(
        { error: 'validation_failed', details: shape.errors },
        { status: 422 },
      );
    }

    const refErrors = await checkProductMaterialReferences(
      existing.tenantId,
      shape.value.defaults.materials,
      shape.value.constraints.allowedMaterialsBySlot,
    );
    if (refErrors.length > 0) {
      return NextResponse.json(
        { error: 'validation_failed', details: refErrors },
        { status: 422 },
      );
    }

    try {
      const [updated] = await db
        .update(products)
        .set({
          slug: shape.value.slug,
          name: shape.value.name,
          description: shape.value.description,
          heroImage: shape.value.heroImage,
          defaults: shape.value.defaults,
          constraints: shape.value.constraints,
          basePriceCents: shape.value.basePriceCents,
          sortOrder: shape.value.sortOrder,
          updatedAt: sql`now()`,
        })
        .where(eq(products.id, id))
        .returning();
      return NextResponse.json({ product: productDbRowToDomain(updated) });
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
  },
);

/** Soft-delete: sets archived_at. Historical orders reference products
 *  via `sourceProductId` inside `configSnapshot` (frozen at submit time)
 *  — they stay re-renderable regardless of archive state. */
export const DELETE = withSession(
  async (session, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;
    const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!row) return NextResponse.json({ error: 'product_not_found' }, { status: 404 });
    requireTenantScope(session, row.tenantId);

    const [updated] = await db
      .update(products)
      .set({ archivedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(products.id, id))
      .returning();
    return NextResponse.json({ product: productDbRowToDomain(updated) });
  },
);
