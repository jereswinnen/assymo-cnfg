import { NextResponse } from 'next/server';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { materials } from '@/db/schema';
import { materialDbRowToDomain } from '@/db/resolveTenant';
import {
  validateMaterialCreate,
  validateMaterialPatch,
} from '@/domain/catalog';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

export const GET = withSession(
  async (session, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;
    const [row] = await db.select().from(materials).where(eq(materials.id, id)).limit(1);
    if (!row) return NextResponse.json({ error: 'material_not_found' }, { status: 404 });
    requireTenantScope(session, row.tenantId);
    return NextResponse.json({ material: materialDbRowToDomain(row) });
  },
);

export const PATCH = withSession(
  async (session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;
    const [existing] = await db.select().from(materials).where(eq(materials.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: 'material_not_found' }, { status: 404 });
    requireTenantScope(session, existing.tenantId);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    const result = validateMaterialPatch(body);
    if (!result.ok) {
      return NextResponse.json(
        { error: 'validation_failed', details: result.errors },
        { status: 422 },
      );
    }

    // Merge patch onto existing and re-run the full create validator so
    // pricing/flags get category-aware validation (the patch validator is
    // intentionally shape-only — see @/domain/catalog/material.ts).
    const merged = {
      category: existing.category,
      slug: result.value.slug ?? existing.slug,
      name: result.value.name ?? existing.name,
      color: result.value.color ?? existing.color,
      textures: result.value.textures !== undefined ? result.value.textures : existing.textures,
      tileSize: result.value.tileSize !== undefined ? result.value.tileSize : existing.tileSize,
      pricing: result.value.pricing ?? existing.pricing,
      flags: result.value.flags ?? existing.flags,
    };
    const shape = validateMaterialCreate(merged);
    if (!shape.ok) {
      return NextResponse.json(
        { error: 'validation_failed', details: shape.errors },
        { status: 422 },
      );
    }

    // Void-conflict: at most one active isVoid floor per tenant. Re-check
    // on PATCH because the admin can toggle the flag on an existing row.
    if (
      existing.category === 'floor' &&
      shape.value.flags?.isVoid === true
    ) {
      const competing = await db
        .select({ id: materials.id })
        .from(materials)
        .where(
          and(
            eq(materials.tenantId, existing.tenantId),
            eq(materials.category, 'floor'),
            isNull(materials.archivedAt),
            ne(materials.id, existing.id),
          ),
        );
      const conflict = competing.some((r) => r.id);
      // Only block if another ACTIVE row already has isVoid. We don't know
      // their flags from the id-only select, so fetch the full rows to check.
      if (conflict) {
        const others = await db
          .select()
          .from(materials)
          .where(
            and(
              eq(materials.tenantId, existing.tenantId),
              eq(materials.category, 'floor'),
              isNull(materials.archivedAt),
              ne(materials.id, existing.id),
            ),
          );
        if (others.some((r) => r.flags?.isVoid === true)) {
          return NextResponse.json(
            { error: 'validation_failed', details: [{ field: 'flags', code: 'void_conflict' }] },
            { status: 422 },
          );
        }
      }
    }

    try {
      const [updated] = await db
        .update(materials)
        .set({
          slug: shape.value.slug,
          name: shape.value.name,
          color: shape.value.color,
          textures: shape.value.textures ?? undefined,
          tileSize: shape.value.tileSize ?? undefined,
          pricing: shape.value.pricing,
          flags: shape.value.flags,
          updatedAt: sql`now()`,
        })
        .where(eq(materials.id, id))
        .returning();
      return NextResponse.json({ material: materialDbRowToDomain(updated) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('materials_tenant_category_slug_idx')) {
        return NextResponse.json(
          { error: 'validation_failed', details: [{ field: 'slug', code: 'slug_taken' }] },
          { status: 409 },
        );
      }
      throw err;
    }
  },
);

/** Soft-delete: sets archived_at. Historical orders reference materials
 *  by slug inside `configSnapshot` (frozen at submit time) — they stay
 *  renderable regardless of archive state. Referential checks against
 *  products land in Phase 5.5.2 when the products table arrives. */
export const DELETE = withSession(
  async (session, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;
    const [row] = await db.select().from(materials).where(eq(materials.id, id)).limit(1);
    if (!row) return NextResponse.json({ error: 'material_not_found' }, { status: 404 });
    requireTenantScope(session, row.tenantId);

    const [updated] = await db
      .update(materials)
      .set({ archivedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(materials.id, id))
      .returning();
    return NextResponse.json({ material: materialDbRowToDomain(updated) });
  },
);
