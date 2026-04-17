import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { UsersTable } from '@/components/admin/UsersTable';
import { InviteUserDialog } from '@/components/admin/InviteUserDialog';
import { PageTitle } from '@/components/admin/PageTitle';
import { PageHeaderActions } from '@/components/admin/PageHeaderActions';
import { t } from '@/lib/i18n';

export default async function UsersPage() {
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const role = session.user.role as string;
  const tenantId = session.user.tenantId as string | null;

  // For super_admin we need the full tenant list to populate the invite dialog.
  const allTenants = role === 'super_admin' ? await db.select().from(tenants) : [];

  return (
    <div className="space-y-6">
      <PageTitle title={t('admin.users.title')} />
      <PageHeaderActions>
        <InviteUserDialog
          actorRole={role as 'super_admin' | 'tenant_admin'}
          actorTenantId={tenantId}
          tenantOptions={allTenants.map((tx) => ({ id: tx.id, displayName: tx.displayName }))}
        />
      </PageHeaderActions>
      <UsersTable />
    </div>
  );
}
