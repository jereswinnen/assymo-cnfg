import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { tenants, tenantHosts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { TenantDetailsSection } from '@/components/admin/TenantDetailsSection';
import { HostsSection } from '@/components/admin/HostsSection';
import { BrandingSection } from '@/components/admin/BrandingSection';
import { PriceBookSection } from '@/components/admin/PriceBookSection';
import { MaterialsSection } from '@/components/admin/MaterialsSection';
import { InvoicingSection } from '@/components/admin/InvoicingSection';
import { PageTitle } from '@/components/admin/PageTitle';

export default async function TenantDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const role = session.user.role as string;
  const userTenant = session.user.tenantId as string | null;

  if (role !== 'super_admin' && userTenant !== id) redirect('/admin');

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!tenant) notFound();

  const hosts = await db.select().from(tenantHosts).where(eq(tenantHosts.tenantId, id));

  return (
    <div className="space-y-8 max-w-4xl">
      <PageTitle title={tenant.displayName} />
      <TenantDetailsSection tenant={tenant} />
      <HostsSection tenantId={tenant.id} initialHosts={hosts} />
      <BrandingSection tenantId={tenant.id} initialBranding={tenant.branding} />
      <PriceBookSection tenantId={tenant.id} initialPriceBook={tenant.priceBook} />
      <MaterialsSection
        tenantId={tenant.id}
        initialEnabledMaterials={null}
      />
      <InvoicingSection tenantId={tenant.id} initialInvoicing={tenant.invoicing} />
    </div>
  );
}
