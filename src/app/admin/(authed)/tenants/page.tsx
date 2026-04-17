import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { TenantsTable } from '@/components/admin/TenantsTable';
import { CreateTenantDialog } from '@/components/admin/CreateTenantDialog';
import { t } from '@/lib/i18n';

export default async function TenantsPage() {
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  if (session.user.role !== 'super_admin') redirect('/admin');

  const rows = await db.select().from(tenants);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('admin.tenants.title')}</h1>
        <CreateTenantDialog />
      </div>
      <TenantsTable tenants={rows} />
    </div>
  );
}
