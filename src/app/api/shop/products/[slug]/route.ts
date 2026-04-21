import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { products } from '@/db/schema';
import { resolveTenantByHostOrDefault, productDbRowToDomain } from '@/db/resolveTenant';

/** Public product lookup by slug, scoped to the request's tenant via
 *  the Host header. Archived products return 404. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const host = (await headers()).get('host');
  const tenantRow = await resolveTenantByHostOrDefault(host);
  if (!tenantRow) {
    return NextResponse.json({ error: 'unknown_tenant' }, { status: 404 });
  }
  const [row] = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.tenantId, tenantRow.id),
        eq(products.slug, slug),
        isNull(products.archivedAt),
      ),
    )
    .limit(1);
  if (!row) return NextResponse.json({ error: 'product_not_found' }, { status: 404 });
  return NextResponse.json({ product: productDbRowToDomain(row) });
}
