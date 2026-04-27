import type { Metadata } from 'next';
import { headers } from 'next/headers';
import {
  resolveTenantByHostOrDefault,
  getTenantMaterials,
  getTenantProducts,
  getTenantSuppliers,
  getTenantSupplierProducts,
  materialDbRowToDomain,
  productDbRowToDomain,
  supplierDbRowToDomain,
  supplierProductDbRowToDomain,
} from '@/db/resolveTenant';
import { TenantProvider } from '@/lib/TenantProvider';
import { ThemeProvider } from '@/lib/ThemeProvider';
import { resolveTenantFeatures, type TenantContext } from '@/domain/tenant';
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

  const [materialRows, productRows, supplierRows, supplierProductRows] =
    await Promise.all([
      getTenantMaterials(tenantRow.id),
      getTenantProducts(tenantRow.id),
      getTenantSuppliers(tenantRow.id),
      getTenantSupplierProducts(tenantRow.id),
    ]);
  const materials = materialRows.map(materialDbRowToDomain);
  const products = productRows.map(productDbRowToDomain);
  const supplierList = supplierRows.map(supplierDbRowToDomain);
  const supplierProductList = supplierProductRows.map(supplierProductDbRowToDomain);

  const tenantContext: TenantContext = {
    id: tenantRow.id,
    displayName: tenantRow.displayName,
    locale: tenantRow.locale,
    currency: tenantRow.currency,
    priceBook: tenantRow.priceBook,
    branding: tenantRow.branding,
    invoicing: tenantRow.invoicing,
    features: resolveTenantFeatures(tenantRow.features),
    catalog: { materials, products },
    supplierCatalog: { suppliers: supplierList, products: supplierProductList },
  };

  return (
    <html lang={tenantRow.locale} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <TenantProvider value={tenantContext}>{children}</TenantProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
