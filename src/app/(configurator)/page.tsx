import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { resolveTenantByHostOrDefault, getTenantProducts, productDbRowToDomain } from '@/db/resolveTenant';
import { BrandedShell } from '@/components/shop/BrandedShell';
import { LandingGrid } from '@/components/shop/LandingGrid';
import { t } from '@/lib/i18n';

/** Tenant-branded landing page. When the tenant has no products, fall
 *  through to `/configurator` (blank canvas) so empty tenants don't see
 *  a cold-start screen. */
export default async function LandingPage() {
  const tenantRow = await resolveTenantByHostOrDefault((await headers()).get('host'));
  if (!tenantRow) redirect('/configurator');

  const productRows = await getTenantProducts(tenantRow.id);
  if (productRows.length === 0) redirect('/configurator');

  const products = productRows.map(productDbRowToDomain);

  return (
    <BrandedShell variant="shop">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">
            {t('landing.hero.title', { displayName: tenantRow.displayName })}
          </h1>
          <p className="text-muted-foreground">{t('landing.hero.subtitle')}</p>
        </header>
        <LandingGrid products={products} />
      </div>
    </BrandedShell>
  );
}
