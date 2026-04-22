import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { suppliers } from '@/db/schema';
import type { SupplierProductKind } from '@/domain/supplier';
import { SupplierProductForm } from '@/components/admin/catalog/SupplierProductForm';

export default async function NewSupplierProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const [session, { id }, sp] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    params,
    searchParams,
  ]);

  const tenantId = session?.user?.tenantId ?? null;
  if (!tenantId) redirect(`/admin/catalog/suppliers/${id}`);

  const [row] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  if (!row) notFound();

  if (
    session?.user?.role !== 'super_admin' &&
    row.tenantId !== session?.user?.tenantId
  ) {
    notFound();
  }

  const kind: SupplierProductKind =
    sp.kind === 'window' ? 'window' : 'door';

  return (
    <SupplierProductForm
      tenantId={row.tenantId}
      supplierId={id}
      mode="create"
      defaultKind={kind}
    />
  );
}
