import type { Metadata } from 'next';
import { headers } from 'next/headers';
import {
  resolveTenantByHostOrDefault,
  getTenantMaterials,
  getTenantProducts,
  materialDbRowToDomain,
  productDbRowToDomain,
} from '@/db/resolveTenant';
import { TenantProvider } from '@/lib/TenantProvider';
import type { TenantContext } from '@/domain/tenant';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await resolveTenantByHostOrDefault((await headers()).get('host'));
  return {
    title: `${tenant?.displayName ?? 'Assymo'} Configurator`,
    description: 'Interactieve 3D configurator met prijsberekening',
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const hdrs = await headers();
  const tenantRow = await resolveTenantByHostOrDefault(hdrs.get('host'));
  if (!tenantRow) {
    throw new Error(
      'No tenant resolved for this host and no default tenant in DB. Run `pnpm db:seed` to create the assymo tenant.',
    );
  }

  const [materialRows, productRows] = await Promise.all([
    getTenantMaterials(tenantRow.id),
    getTenantProducts(tenantRow.id),
  ]);
  const materials = materialRows.map(materialDbRowToDomain);
  const products = productRows.map(productDbRowToDomain);

  const tenantContext: TenantContext = {
    id: tenantRow.id,
    displayName: tenantRow.displayName,
    locale: tenantRow.locale,
    currency: tenantRow.currency,
    priceBook: tenantRow.priceBook,
    branding: tenantRow.branding,
    invoicing: tenantRow.invoicing,
    catalog: { materials, products },
  };

  return (
    <html lang={tenantRow.locale}>
      <body className="antialiased">
        <TenantProvider value={tenantContext}>{children}</TenantProvider>
      </body>
    </html>
  );
}
