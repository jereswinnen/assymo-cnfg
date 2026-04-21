import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { validateEnabledMaterialsPatch } from '@/domain/tenant';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

/** PATCH the tenant's material allow-list. Mirrors the branding +
 *  price-book PATCH shape. `null` is a valid value (unrestricted)
 *  and is stored verbatim, so the response round-trips. */
export const PATCH = withSession(
  async (session, req, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;
    requireTenantScope(session, id);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    const { enabledMaterials, errors } = validateEnabledMaterialsPatch(body);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'validation_failed', details: errors },
        { status: 422 },
      );
    }

    const [current] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);
    if (!current) {
      return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });
    }

    // NOTE(5.5.1): enabledMaterials column was migrated to per-material
    // archivedAt on the materials table. This endpoint is preserved for
    // backwards-compat but is now a no-op on the tenant row itself.
    // T23 will repurpose or remove it.
    void enabledMaterials; // validated above — kept for future use

    const [updated] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    return NextResponse.json({ tenant: updated });
  },
);
