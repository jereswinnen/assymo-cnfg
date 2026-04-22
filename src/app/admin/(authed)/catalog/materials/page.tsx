import Link from 'next/link';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { getTenantMaterials, materialDbRowToDomain } from '@/db/resolveTenant';
import { resolveAdminTenantScope } from '@/lib/adminScope';
import { t } from '@/lib/i18n';
import { PageHeaderActions } from '@/components/admin/PageHeaderActions';
import { MaterialsTable } from '@/components/admin/catalog/MaterialsTable';

export default async function CatalogMaterialsPage() {
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const tenantId = resolveAdminTenantScope(session);

  const rows = await getTenantMaterials(tenantId);
  const materials = rows.map(materialDbRowToDomain);

  return (
    <div className="space-y-6">
      <PageHeaderActions>
        <Button asChild>
          <Link href="/admin/catalog/materials/new">
            {t('admin.catalog.materials.new')}
          </Link>
        </Button>
      </PageHeaderActions>

      <MaterialsTable materials={materials} />
    </div>
  );
}
