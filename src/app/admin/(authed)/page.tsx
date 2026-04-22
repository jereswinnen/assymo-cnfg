import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { t } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function AdminDashboard() {
  // Layout already guarantees a business session.
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const tenantId = session.user.tenantId as string | null;
  const kind = session.user.kind as string;

  const [tenant] = tenantId
    ? await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
    : [];

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">
        {t('admin.dashboard.greeting', { name: session.user.name ?? session.user.email })}
      </h1>
      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="text-sm text-neutral-700 space-y-1">
          <p>{t('admin.dashboard.role', { role: t(`admin.role.${kind}`) })}</p>
          {tenant && <p>{t('admin.dashboard.tenant', { tenant: tenant.displayName })}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
