import { NextResponse } from 'next/server';
import { and, asc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '@/db/client';
import { materials, type MaterialDbRow } from '@/db/schema';
import { materialDbRowToDomain } from '@/db/resolveTenant';
import {
  validateMaterialCreate,
  type MaterialCategory,
} from '@/domain/catalog';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

/** List materials for a tenant. tenant_admin sees own scope; super_admin
 *  may pass `?tenantId=<id>` to target a specific tenant. Optional
 *  `?category=<wall|roof-cover|…>` filter narrows to materials that
 *  serve that category (a material may belong to multiple categories). */
export const GET = withSession(async (session, req: Request) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const url = new URL(req.url);
  const queryTenantId = url.searchParams.get('tenantId');
  const tenantId = queryTenantId ?? session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'tenant_scope_required' }, { status: 400 });
  requireTenantScope(session, tenantId);

  const category = url.searchParams.get('category') as MaterialCategory | null;
  const conds = [eq(materials.tenantId, tenantId)];
  if (category) {
    conds.push(sql`${category} = ANY(${materials.categories})`);
  }

  const rows: MaterialDbRow[] = await db
    .select()
    .from(materials)
    .where(and(...conds))
    .orderBy(asc(materials.name));

  return NextResponse.json({ materials: rows.map(materialDbRowToDomain) });
});

/** Create a material. Uniqueness on (tenantId, slug) is enforced at the
 *  DB layer and mapped to `catalog.material.slug_taken`. The `isVoid`
 *  floor-singleton check runs before insert. */
export const POST = withSession(async (session, req: Request) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const result = validateMaterialCreate(body);
  if (!result.ok) {
    return NextResponse.json(
      { error: 'validation_failed', details: result.errors },
      { status: 422 },
    );
  }
  const input = result.value;

  const scopeTenantId =
    (body as { tenantId?: string }).tenantId ?? session.user.tenantId;
  if (!scopeTenantId)
    return NextResponse.json({ error: 'tenant_scope_required' }, { status: 400 });
  requireTenantScope(session, scopeTenantId);

  // Void-conflict: at most one active isVoid floor per tenant. Only runs
  // when the incoming material claims 'floor' AND has isVoid set.
  if (input.categories.includes('floor') && input.flags?.isVoid) {
    const floorRows = await db
      .select()
      .from(materials)
      .where(
        and(
          eq(materials.tenantId, scopeTenantId),
          sql`'floor' = ANY(${materials.categories})`,
        ),
      );
    if (floorRows.some((r) => r.archivedAt === null && r.flags.isVoid)) {
      return NextResponse.json(
        { error: 'validation_failed', details: [{ field: 'flags', code: 'void_conflict' }] },
        { status: 422 },
      );
    }
  }

  const id = randomUUID();
  try {
    const [row] = await db
      .insert(materials)
      .values({
        id,
        tenantId: scopeTenantId,
        categories: input.categories,
        slug: input.slug,
        name: input.name,
        color: input.color,
        textures: input.textures ?? undefined,
        tileSize: input.tileSize ?? undefined,
        pricing: input.pricing,
        flags: input.flags,
      })
      .returning();
    return NextResponse.json({ material: materialDbRowToDomain(row) }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('materials_tenant_slug_idx')) {
      return NextResponse.json(
        { error: 'validation_failed', details: [{ field: 'slug', code: 'slug_taken' }] },
        { status: 409 },
      );
    }
    throw err;
  }
});
