import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { resolveAdminTenantScope } from '@/lib/adminScope';
import { MaterialForm } from '@/components/admin/catalog/MaterialForm';

export default async function NewMaterialPage() {
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const tenantId = resolveAdminTenantScope(session);

  return <MaterialForm tenantId={tenantId} mode="create" />;
}
