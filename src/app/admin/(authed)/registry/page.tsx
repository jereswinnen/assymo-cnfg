import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { MaterialsSection } from '@/components/admin/MaterialsSection';
import { t } from '@/lib/i18n';

export default async function AdminRegistryPage() {
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const tenantId = session.user.tenantId as string | null;
  const role = session.user.role as string;

  // super_admin has no single "own" tenant — they edit per-tenant via
  // /admin/tenants/[id], where the section is mounted. Avoid presenting
  // an arbitrary-scope picker here; keep the admin tree single-purpose.
  if (role === 'super_admin' && !tenantId) {
    redirect('/admin/tenants');
  }

  if (!tenantId) {
    return (
      <div className="max-w-2xl">
        <p className="text-sm text-muted-foreground">
          {t('admin.registry.noTenant')}
        </p>
      </div>
    );
  }

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!tenant) redirect('/admin');

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">{t('admin.registry.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('admin.registry.lead')}
        </p>
      </div>
      <MaterialsSection
        tenantId={tenant.id}
        initialEnabledMaterials={tenant.enabledMaterials}
      />
    </div>
  );
}
