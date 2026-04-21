import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { resolveTenantByHostOrDefault, getTenantProducts, productDbRowToDomain } from '@/db/resolveTenant';

/** Public list — returns non-archived products for the host's tenant,
 *  ordered by sort_order then name. No auth required: this feeds the
 *  landing-page product grid that unauthenticated visitors see. */
export async function GET() {
  const host = (await headers()).get('host');
  const tenantRow = await resolveTenantByHostOrDefault(host);
  if (!tenantRow) {
    return NextResponse.json({ error: 'unknown_tenant' }, { status: 404 });
  }
  const rows = await getTenantProducts(tenantRow.id);
  return NextResponse.json({ products: rows.map(productDbRowToDomain) });
}
