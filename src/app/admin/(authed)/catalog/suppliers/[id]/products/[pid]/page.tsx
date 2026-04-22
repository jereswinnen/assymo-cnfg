import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { suppliers, supplierProducts } from '@/db/schema';
import { supplierProductDbRowToDomain } from '@/db/resolveTenant';
import { PageTitle } from '@/components/admin/PageTitle';
import { SupplierProductForm } from '@/components/admin/catalog/SupplierProductForm';

export default async function EditSupplierProductPage({
  params,
}: {
  params: Promise<{ id: string; pid: string }>;
}) {
  const [session, { id, pid }] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    params,
  ]);

  const [supplierRow] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  if (!supplierRow) notFound();

  if (
    session?.user?.kind !== 'super_admin' &&
    supplierRow.tenantId !== session?.user?.tenantId
  ) {
    notFound();
  }

  const [productRow] = await db
    .select()
    .from(supplierProducts)
    .where(eq(supplierProducts.id, pid))
    .limit(1);
  if (!productRow || productRow.supplierId !== id) notFound();

  const product = supplierProductDbRowToDomain(productRow);

  return (
    <>
      <PageTitle title={product.name} />
      <SupplierProductForm
        tenantId={supplierRow.tenantId}
        supplierId={id}
        mode="edit"
        initial={product}
      />
    </>
  );
}
