import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { configs } from '@/db/schema';
import { migrateConfig } from '@/domain/config';
import { calculateTotalQuote } from '@/domain/pricing';
import { resolveApiTenant } from '@/lib/apiTenant';
import {
  getTenantMaterials,
  materialDbRowToDomain,
  getTenantSupplierProducts,
  supplierProductDbRowToDomain,
} from '@/db/resolveTenant';

/** Fetch a saved config by its short share code. Data is served from
 *  `row.data` (authoritative) and migrated on-read; the code column is
 *  opaque. Prices against the tenant's current priceBook so admin price
 *  changes show up immediately. */
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
  const [materialRows, supplierProductRows] = await Promise.all([
    getTenantMaterials(tenant.id),
    getTenantSupplierProducts(tenant.id),
  ]);
  const materials = materialRows.map(materialDbRowToDomain);
  const supplierProducts = supplierProductRows.map(supplierProductDbRowToDomain);
  const { lineItems, total } = calculateTotalQuote(
    migrated.buildings,
    migrated.roof,
    migrated.connections,
    tenant.priceBook,
    materials,
    supplierProducts,
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
