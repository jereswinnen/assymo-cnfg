import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { TenantsTable } from '@/components/admin/TenantsTable';
import { CreateTenantDialog } from '@/components/admin/CreateTenantDialog';
import { PageHeaderActions } from '@/components/admin/PageHeaderActions';

export default async function TenantsPage() {
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  if (session.user.kind !== 'super_admin') redirect('/admin');

  const rows = await db.select().from(tenants);

  const createDialog = <CreateTenantDialog />;

  return (
    <div className="space-y-6">
      <PageHeaderActions>{createDialog}</PageHeaderActions>
      <TenantsTable tenants={rows} emptyAction={createDialog} />
    </div>
  );
}
