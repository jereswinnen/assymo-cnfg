import Link from 'next/link';
import { headers } from 'next/headers';
import { asc, eq } from 'drizzle-orm';
import { Plus } from 'lucide-react';
import { auth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { db } from '@/db/client';
import { products } from '@/db/schema';
import { productDbRowToDomain } from '@/db/resolveTenant';
import { resolveAdminTenantScope } from '@/lib/adminScope';
import { t } from '@/lib/i18n';
import { PageHeaderActions } from '@/components/admin/PageHeaderActions';
import { ProductsTable } from '@/components/admin/catalog/ProductsTable';

export default async function CatalogProductsPage() {
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const tenantId = resolveAdminTenantScope(session);

  // Include archived rows (the list shows both; future toggle can hide them).
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.tenantId, tenantId))
    .orderBy(asc(products.sortOrder), asc(products.name));

  const list = rows.map(productDbRowToDomain);

  return (
    <div className="space-y-6">
      <PageHeaderActions>
        <Button asChild>
          <Link href="/admin/catalog/products/new">
            <Plus />
            {t('admin.catalog.products.new')}
          </Link>
        </Button>
      </PageHeaderActions>

      <ProductsTable products={list} />
    </div>
  );
}
