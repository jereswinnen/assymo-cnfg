import Link from 'next/link';
import { headers } from 'next/headers';
import { asc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { db } from '@/db/client';
import { suppliers } from '@/db/schema';
import { supplierDbRowToDomain } from '@/db/resolveTenant';
import { resolveAdminTenantScope } from '@/lib/adminScope';
import { t } from '@/lib/i18n';
import { PageHeaderActions } from '@/components/admin/PageHeaderActions';
import { SuppliersTable } from '@/components/admin/catalog/SuppliersTable';

export default async function CatalogSuppliersPage() {
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const tenantId = resolveAdminTenantScope(session);

  const rows = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.tenantId, tenantId))
    .orderBy(asc(suppliers.name));

  const list = rows.map(supplierDbRowToDomain);

  return (
    <div className="space-y-6">
      <PageHeaderActions>
        <Button asChild>
          <Link href="/admin/catalog/suppliers/new">
            {t('admin.catalog.suppliers.new')}
          </Link>
        </Button>
      </PageHeaderActions>

      <SuppliersTable suppliers={list} />
    </div>
  );
}
