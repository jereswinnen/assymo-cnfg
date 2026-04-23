import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { asc, eq } from 'drizzle-orm';
import { Plus } from 'lucide-react';
import { auth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { db } from '@/db/client';
import { suppliers, supplierProducts } from '@/db/schema';
import { supplierDbRowToDomain, supplierProductDbRowToDomain } from '@/db/resolveTenant';
import { t } from '@/lib/i18n';
import { PageTitle } from '@/components/admin/PageTitle';
import { PageHeaderActions } from '@/components/admin/PageHeaderActions';
import { SupplierForm } from '@/components/admin/catalog/SupplierForm';
import { SupplierProductsTable } from '@/components/admin/catalog/SupplierProductsTable';

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [session, { id }] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    params,
  ]);

  const [row] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  if (!row) notFound();

  // Scope check: tenant_admin may only edit suppliers in their own tenant.
  if (
    session?.user?.kind !== 'super_admin' &&
    row.tenantId !== session?.user?.tenantId
  ) {
    notFound();
  }

  const supplier = supplierDbRowToDomain(row);

  const productRows = await db
    .select()
    .from(supplierProducts)
    .where(eq(supplierProducts.supplierId, id))
    .orderBy(asc(supplierProducts.sortOrder), asc(supplierProducts.name));

  const products = productRows.map(supplierProductDbRowToDomain);

  return (
    <>
      <PageTitle title={supplier.name} />
      <PageHeaderActions>
        <Button asChild>
          <Link href={`/admin/catalog/suppliers/${id}/products/new`}>
            <Plus />
            {t('admin.catalog.supplierProducts.new')}
          </Link>
        </Button>
      </PageHeaderActions>

      <div className="space-y-8">
        <SupplierForm tenantId={row.tenantId} mode="edit" initial={supplier} />

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t('admin.catalog.supplierProducts.title')}</h2>
          <SupplierProductsTable products={products} supplierId={id} />
        </section>
      </div>
    </>
  );
}
