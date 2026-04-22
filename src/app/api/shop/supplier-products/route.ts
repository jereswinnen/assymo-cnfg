import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { suppliers, supplierProducts } from '@/db/schema';
import {
  supplierProductDbRowToDomain,
  resolveTenantByHostOrDefault,
} from '@/db/resolveTenant';
import type { SupplierProductKind } from '@/domain/supplier';

/** Public list — returns non-archived supplier products for the host's
 *  tenant, optionally filtered by kind (?kind=door|window). No auth
 *  required: feeds UI components that unauthenticated visitors see.
 *  Only includes products from non-archived suppliers. */
export async function GET(req: Request) {
  const host = (await headers()).get('host');
  const tenantRow = await resolveTenantByHostOrDefault(host);
  if (!tenantRow) {
    return NextResponse.json({ error: 'unknown_tenant' }, { status: 404 });
  }

  const url = new URL(req.url);
  const kindParam = url.searchParams.get('kind');
  const validKinds = ['door', 'window'] as const satisfies readonly SupplierProductKind[];
  const kind = kindParam && (validKinds as readonly string[]).includes(kindParam)
    ? (kindParam as SupplierProductKind)
    : null;

  const conds = [
    eq(supplierProducts.tenantId, tenantRow.id),
    isNull(supplierProducts.archivedAt),
    // Join through suppliers to exclude products from archived suppliers
    eq(suppliers.id, supplierProducts.supplierId),
    isNull(suppliers.archivedAt),
  ];

  if (kind) {
    conds.push(eq(supplierProducts.kind, kind));
  }

  const rows = await db
    .select()
    .from(supplierProducts)
    .innerJoin(suppliers, eq(suppliers.id, supplierProducts.supplierId))
    .where(and(...conds));

  return NextResponse.json({
    products: rows.map(({ supplier_products }) => supplierProductDbRowToDomain(supplier_products)),
  });
}
