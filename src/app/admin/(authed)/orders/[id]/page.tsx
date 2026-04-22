import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { orders, invoices, tenants } from '@/db/schema';
import { user } from '@/db/auth-schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTitle } from '@/components/admin/PageTitle';
import { PageHeaderActions } from '@/components/admin/PageHeaderActions';
import { OrderStatusBadge } from '@/components/admin/OrderStatusBadge';
import { OrderStatusControl } from '@/components/admin/OrderStatusControl';
import { OrderQuoteTable } from '@/components/admin/OrderQuoteTable';
import { OrderContactCard } from '@/components/admin/OrderContactCard';
import { IssueInvoiceDialog } from '@/components/admin/IssueInvoiceDialog';
import { t } from '@/lib/i18n';
import type { OrderStatus } from '@/domain/orders';

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const kind = session.user.kind as string;
  const actorTenantId = session.user.tenantId as string | null;

  const [row] = await db
    .select({
      order: orders,
      customer: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
      },
    })
    .from(orders)
    .leftJoin(user, eq(orders.customerId, user.id))
    .where(eq(orders.id, id))
    .limit(1);

  if (!row) notFound();
  if (kind !== 'super_admin' && row.order.tenantId !== actorTenantId) {
    redirect('/admin/orders');
  }

  const order = row.order;

  const [invoice] = await db
    .select({ id: invoices.id, number: invoices.number })
    .from(invoices)
    .where(eq(invoices.orderId, order.id))
    .limit(1);
  const [tenantRow] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, order.tenantId))
    .limit(1);

  return (
    <div className="space-y-6">
      <PageTitle title={`#${order.id.slice(0, 8)}`} />
      <PageHeaderActions>
        <OrderStatusBadge status={order.status as OrderStatus} />
        <OrderStatusControl orderId={order.id} currentStatus={order.status as OrderStatus} />
      </PageHeaderActions>

      <div className="grid gap-6 md:grid-cols-2">
        <OrderContactCard
          contactName={order.contactName}
          contactEmail={order.contactEmail}
          contactPhone={order.contactPhone}
          customerId={order.customerId}
          notes={order.notes}
        />
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.orders.detail.section.config')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="font-mono text-xs break-all">
              {t('admin.orders.detail.code')}: {order.code}
            </div>
            <a
              href={`/?code=${order.code}`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline text-sm"
            >
              {t('admin.orders.detail.openConfigurator')} ↗
            </a>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.orders.detail.section.quote')}</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderQuoteTable snapshot={order.quoteSnapshot} />
        </CardContent>
      </Card>

      {invoice ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.invoice.detail.downloadPdf')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/admin/invoices/${invoice.id}`}
              className="underline"
            >
              {invoice.number}
            </Link>
          </CardContent>
        </Card>
      ) : (
        order.status === 'accepted' &&
        tenantRow && (
          <IssueInvoiceDialog
            orderId={order.id}
            defaultCustomerName={order.contactName}
            defaultVatRate={tenantRow.invoicing.vatRate}
            defaultPaymentTermDays={tenantRow.invoicing.paymentTermDays}
          />
        )
      )}
    </div>
  );
}
