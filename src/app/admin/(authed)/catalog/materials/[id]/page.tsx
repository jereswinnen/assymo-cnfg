import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { materials } from '@/db/schema';
import { materialDbRowToDomain } from '@/db/resolveTenant';
import { MaterialForm } from '@/components/admin/catalog/MaterialForm';
import { PageTitle } from '@/components/admin/PageTitle';

export default async function EditMaterialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [session, { id }] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    params,
  ]);

  const [row] = await db.select().from(materials).where(eq(materials.id, id)).limit(1);
  if (!row) notFound();

  // Scope check: tenant_admin may only edit materials in their own tenant.
  if (
    session?.user?.role !== 'super_admin' &&
    row.tenantId !== session?.user?.tenantId
  ) {
    notFound();
  }

  const material = materialDbRowToDomain(row);

  return (
    <>
      <PageTitle title={material.name} />
      <MaterialForm tenantId={row.tenantId} mode="edit" initial={material} />
    </>
  );
}
