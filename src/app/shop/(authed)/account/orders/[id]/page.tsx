import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { auth } from '@/lib/auth';
import { ClientOrderDetail } from '@/components/shop/ClientOrderDetail';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ShopOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) notFound();
  const tenantId = (session.user.tenantId as string | null) ?? '__none__';

  const [row] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, id),
        eq(orders.customerId, session.user.id),
        eq(orders.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!row) notFound();

  return (
    <ClientOrderDetail
      order={{
        id: row.id,
        status: row.status,
        contactName: row.contactName,
        contactEmail: row.contactEmail,
        contactPhone: row.contactPhone,
        notes: row.notes,
        quoteSnapshot: row.quoteSnapshot,
        submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
      }}
    />
  );
}
