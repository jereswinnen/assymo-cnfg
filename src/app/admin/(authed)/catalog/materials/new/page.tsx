import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { MaterialForm } from '@/components/admin/catalog/MaterialForm';

export default async function NewMaterialPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const tenantId = session?.user?.tenantId ?? null;

  // super_admin without a default tenant scope cannot create materials yet
  if (!tenantId) redirect('/admin/catalog/materials');

  return <MaterialForm tenantId={tenantId} mode="create" />;
}
