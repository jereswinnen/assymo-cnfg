import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { suppliers } from '@/db/schema';
import { supplierDbRowToDomain } from '@/db/resolveTenant';
import { validateSupplierCreate, validateSupplierPatch } from '@/domain/supplier';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

export const GET = withSession(
  async (session, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;
    const [row] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    if (!row) return NextResponse.json({ error: 'supplier_not_found' }, { status: 404 });
    requireTenantScope(session, row.tenantId);
    return NextResponse.json({ supplier: supplierDbRowToDomain(row) });
  },
);

export const PATCH = withSession(
  async (session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;
    const [existing] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: 'supplier_not_found' }, { status: 404 });
    requireTenantScope(session, existing.tenantId);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    const result = validateSupplierPatch(body);
    if (result.errors.length > 0) {
      return NextResponse.json(
        { error: 'validation_failed', details: result.errors },
        { status: 422 },
      );
    }

    // Merge patch onto existing and re-run the full create validator.
    const merged = {
      name: result.value!.name ?? existing.name,
      slug: result.value!.slug ?? existing.slug,
      logoUrl: result.value!.logoUrl !== undefined ? result.value!.logoUrl : existing.logoUrl,
      contact: result.value!.contact ?? existing.contact,
      notes: result.value!.notes !== undefined ? result.value!.notes : existing.notes,
    };
    const shape = validateSupplierCreate(merged);
    if (shape.errors.length > 0) {
      return NextResponse.json(
        { error: 'validation_failed', details: shape.errors },
        { status: 422 },
      );
    }

    try {
      const [updated] = await db
        .update(suppliers)
        .set({
          slug: shape.value!.slug,
          name: shape.value!.name,
          logoUrl: shape.value!.logoUrl ?? undefined,
          contact: shape.value!.contact,
          notes: shape.value!.notes ?? undefined,
          updatedAt: sql`now()`,
        })
        .where(eq(suppliers.id, id))
        .returning();
      return NextResponse.json({ supplier: supplierDbRowToDomain(updated) });
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
  },
);

/** Soft-delete: sets archived_at. Suppliers become unavailable for new
 *  supplier products; existing products freeze their supplier data at
 *  order snapshot time via the supplier row's immutable content hash. */
export const DELETE = withSession(
  async (session, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;
    const [row] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    if (!row) return NextResponse.json({ error: 'supplier_not_found' }, { status: 404 });
    requireTenantScope(session, row.tenantId);

    const [updated] = await db
      .update(suppliers)
      .set({ archivedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(suppliers.id, id))
      .returning();
    return NextResponse.json({ supplier: supplierDbRowToDomain(updated) });
  },
);
