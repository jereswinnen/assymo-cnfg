import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { user } from '@/db/auth-schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTitle } from '@/components/admin/PageTitle';
import { ClientOrdersList } from '@/components/admin/ClientOrdersList';
import { Badge } from '@/components/ui/badge';
import { t } from '@/lib/i18n';
import type { OrderStatus } from '@/domain/orders';

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const kind = session.user.kind as string;
  const actorTenantId = session.user.tenantId as string | null;

  const [client] = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      kind: user.kind,
      tenantId: user.tenantId,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);

  if (!client || client.kind !== 'client') notFound();
  if (kind !== 'super_admin' && client.tenantId !== actorTenantId) {
    redirect('/admin/clients');
  }

  const clientOrders = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalCents: orders.totalCents,
      currency: orders.currency,
      submittedAt: orders.submittedAt,
    })
    .from(orders)
    .where(eq(orders.customerId, id))
    .orderBy(desc(orders.createdAt));

  return (
    <div className="space-y-6">
      <PageTitle title={client.name ?? client.email} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t('admin.clients.detail.section.profile')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-neutral-500">{t('admin.clients.detail.email')}:</span> {client.email}</div>
            <div><span className="text-neutral-500">{t('admin.clients.detail.name')}:</span> {client.name ?? '—'}</div>
            <div className="pt-2">
              {client.emailVerified ? (
                <Badge>{t('admin.clients.detail.claimed')}</Badge>
              ) : (
                <Badge variant="outline">{t('admin.clients.detail.unclaimed')}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t('admin.clients.detail.section.orders')}</CardTitle></CardHeader>
          <CardContent>
            <ClientOrdersList
              orders={clientOrders.map((o) => ({
                ...o,
                status: o.status as OrderStatus,
                submittedAt: o.submittedAt ? o.submittedAt.toISOString() : null,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
