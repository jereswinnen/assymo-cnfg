import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getTenantMaterials, materialDbRowToDomain } from '@/db/resolveTenant';
import { resolveAdminTenantScope } from '@/lib/adminScope';
import { ProductForm } from '@/components/admin/catalog/ProductForm';

export default async function NewProductPage() {
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const tenantId = resolveAdminTenantScope(session);

  const rows = await getTenantMaterials(tenantId);
  const materials = rows.map(materialDbRowToDomain);

  return <ProductForm tenantId={tenantId} mode="create" materials={materials} />;
}
