import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { UsersTable } from '@/components/admin/UsersTable';
import { InviteUserDialog } from '@/components/admin/InviteUserDialog';
import { t } from '@/lib/i18n';

export default async function UsersPage() {
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const role = session.user.role as string;
  const tenantId = session.user.tenantId as string | null;

  // For super_admin we need the full tenant list to populate the invite dialog.
  const allTenants = role === 'super_admin' ? await db.select().from(tenants) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('admin.users.title')}</h1>
        <InviteUserDialog
          actorRole={role as 'super_admin' | 'tenant_admin'}
          actorTenantId={tenantId}
          tenantOptions={allTenants.map((tx) => ({ id: tx.id, displayName: tx.displayName }))}
        />
      </div>
      <UsersTable />
    </div>
  );
}
