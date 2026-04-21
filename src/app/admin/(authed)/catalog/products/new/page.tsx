import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getTenantMaterials, materialDbRowToDomain } from '@/db/resolveTenant';
import { ProductForm } from '@/components/admin/catalog/ProductForm';

export default async function NewProductPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const tenantId = session?.user?.tenantId ?? null;

  // super_admin without a default tenant scope cannot create products yet
  if (!tenantId) redirect('/admin/catalog/products');

  const rows = await getTenantMaterials(tenantId);
  const materials = rows.map(materialDbRowToDomain);

  return <ProductForm tenantId={tenantId} mode="create" materials={materials} />;
}
