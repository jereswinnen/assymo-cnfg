import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { resolveAdminTenantScope } from '@/lib/adminScope';
import { SupplierForm } from '@/components/admin/catalog/SupplierForm';

export default async function NewSupplierPage() {
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const tenantId = resolveAdminTenantScope(session);

  return <SupplierForm tenantId={tenantId} mode="create" />;
}
