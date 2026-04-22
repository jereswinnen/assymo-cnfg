import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { SupplierForm } from '@/components/admin/catalog/SupplierForm';

export default async function NewSupplierPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const tenantId = session?.user?.tenantId ?? null;

  // super_admin without a default tenant scope cannot create suppliers yet
  if (!tenantId) redirect('/admin/catalog/suppliers');

  return <SupplierForm tenantId={tenantId} mode="create" />;
}
