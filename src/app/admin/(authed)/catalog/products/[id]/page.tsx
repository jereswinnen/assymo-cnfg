import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { products } from '@/db/schema';
import {
  productDbRowToDomain,
  getTenantMaterials,
  materialDbRowToDomain,
} from '@/db/resolveTenant';
import { ProductForm } from '@/components/admin/catalog/ProductForm';
import { PageTitle } from '@/components/admin/PageTitle';

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [session, { id }] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    params,
  ]);

  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!row) notFound();

  // Scope check: tenant_admin may only edit products in their own tenant.
  if (
    session?.user?.kind !== 'super_admin' &&
    row.tenantId !== session?.user?.tenantId
  ) {
    notFound();
  }

  const product = productDbRowToDomain(row);
  const matRows = await getTenantMaterials(row.tenantId);
  const materials = matRows.map(materialDbRowToDomain);

  return (
    <>
      <PageTitle title={product.name} />
      <ProductForm tenantId={row.tenantId} mode="edit" initial={product} materials={materials} />
    </>
  );
}
