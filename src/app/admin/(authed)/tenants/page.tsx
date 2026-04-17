import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { TenantsTable } from '@/components/admin/TenantsTable';
import { CreateTenantDialog } from '@/components/admin/CreateTenantDialog';
import { PageTitle } from '@/components/admin/PageTitle';
import { PageHeaderActions } from '@/components/admin/PageHeaderActions';
import { t } from '@/lib/i18n';

export default async function TenantsPage() {
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  if (session.user.role !== 'super_admin') redirect('/admin');

  const rows = await db.select().from(tenants);

  return (
    <div className="space-y-6">
      <PageTitle title={t('admin.tenants.title')} />
      <PageHeaderActions>
        <CreateTenantDialog />
      </PageHeaderActions>
      <TenantsTable tenants={rows} />
    </div>
  );
}
