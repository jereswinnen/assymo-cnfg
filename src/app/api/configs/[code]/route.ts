import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { configs } from '@/db/schema';
import { migrateConfig } from '@/domain/config';
import { calculateTotalQuote } from '@/domain/pricing';
import type { MaterialRow } from '@/domain/catalog';
import { resolveApiTenant } from '@/lib/apiTenant';

// TODO(5.5.1/T14): wire materials from TenantContext/resolver
const MATERIALS_PLACEHOLDER: MaterialRow[] = [];

/** Fetch a saved config by its share code, migrated to the current
 *  schema version and priced against the tenant's current priceBook
 *  (so price changes in the admin show up immediately). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const tenant = await resolveApiTenant();
  if (!tenant) {
    return NextResponse.json({ error: 'unknown_tenant' }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(configs)
    .where(and(eq(configs.tenantId, tenant.id), eq(configs.code, code)))
    .limit(1);

  if (!rows[0]) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const row = rows[0];
  const migrated = migrateConfig(row.data);
  const { lineItems, total } = calculateTotalQuote(
    migrated.buildings,
    migrated.roof,
    tenant.priceBook,
    MATERIALS_PLACEHOLDER,
    migrated.defaultHeight,
  );

  return NextResponse.json({
    id: row.id,
    code: row.code,
    tenantId: tenant.id,
    data: migrated,
    quote: {
      lineItems,
      total,
      currency: tenant.currency,
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
