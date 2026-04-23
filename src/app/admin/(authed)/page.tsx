import Link from 'next/link';
import { headers } from 'next/headers';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { invoices, orders, payments } from '@/db/schema';
import { resolveAdminTenantScope } from '@/lib/adminScope';
import { t } from '@/lib/i18n';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { OrderStatusBadge } from '@/components/admin/OrderStatusBadge';
import { OrdersTrendChart } from '@/components/admin/dashboard/OrdersTrendChart';
import type { OrderStatus } from '@/domain/orders';

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat('nl-BE', { style: 'currency', currency }).format(cents / 100);
}

function startOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const dow = (copy.getDay() + 6) % 7;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - dow);
  return copy;
}

function weekLabel(d: Date): string {
  return d.toLocaleDateString('nl-BE', { day: '2-digit', month: 'short' });
}

export default async function AdminDashboard() {
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const tenantId = resolveAdminTenantScope(session);
  const now = new Date();
  const monthStart = startOfMonth(now);
  const eightWeeksAgo = startOfWeek(new Date(now.getTime() - 7 * 8 * 24 * 60 * 60 * 1000));

  const [openOrdersRow, revenueRow, activeClientsRow, trendRows, recent, unpaidRows] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, tenantId),
            inArray(orders.status, ['submitted', 'quoted'] as OrderStatus[]),
          ),
        ),
      db
        .select({ total: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int` })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, tenantId),
            eq(orders.status, 'accepted' as OrderStatus),
            gte(orders.createdAt, monthStart),
          ),
        ),
      db
        .select({ count: sql<number>`count(distinct ${orders.customerId})::int` })
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), gte(orders.createdAt, monthStart))),
      db
        .select({
          bucket: sql<string>`to_char(date_trunc('week', ${orders.createdAt}), 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), gte(orders.createdAt, eightWeeksAgo)))
        .groupBy(sql`date_trunc('week', ${orders.createdAt})`)
        .orderBy(sql`date_trunc('week', ${orders.createdAt})`),
      db
        .select({
          id: orders.id,
          contactName: orders.contactName,
          totalCents: orders.totalCents,
          currency: orders.currency,
          status: orders.status,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(eq(orders.tenantId, tenantId))
        .orderBy(desc(orders.createdAt))
        .limit(5),
      db
        .select({
          id: invoices.id,
          total: invoices.totalCents,
          paid: sql<number>`coalesce((select sum(${payments.amountCents}) from ${payments} where ${payments.invoiceId} = ${invoices.id}), 0)::int`,
        })
        .from(invoices)
        .where(eq(invoices.tenantId, tenantId)),
    ]);

  const openOrders = openOrdersRow[0]?.count ?? 0;
  const revenueCents = revenueRow[0]?.total ?? 0;
  const activeClients = activeClientsRow[0]?.count ?? 0;
  const unpaidInvoices = unpaidRows.filter((r) => r.paid < r.total).length;

  const trendByWeek = new Map(trendRows.map((r) => [r.bucket, r.count]));
  const chartData = Array.from({ length: 8 }, (_, i) => {
    const weekStart = startOfWeek(
      new Date(now.getTime() - (7 - i) * 7 * 24 * 60 * 60 * 1000),
    );
    const key = weekStart.toISOString().slice(0, 10);
    return { week: weekLabel(weekStart), orders: trendByWeek.get(key) ?? 0 };
  });

  const kpis = [
    {
      labelKey: 'admin.dashboard.kpi.openOrders',
      hintKey: 'admin.dashboard.kpi.openOrders.hint',
      value: String(openOrders),
    },
    {
      labelKey: 'admin.dashboard.kpi.revenue',
      hintKey: 'admin.dashboard.kpi.revenue.hint',
      value: formatCents(revenueCents, 'EUR'),
    },
    {
      labelKey: 'admin.dashboard.kpi.unpaidInvoices',
      hintKey: 'admin.dashboard.kpi.unpaidInvoices.hint',
      value: String(unpaidInvoices),
    },
    {
      labelKey: 'admin.dashboard.kpi.activeClients',
      hintKey: 'admin.dashboard.kpi.activeClients.hint',
      value: String(activeClients),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">
          {t('admin.dashboard.greeting', { name: session.user.name ?? session.user.email })}
        </h1>
        <p className="text-muted-foreground text-sm">{t('admin.dashboard.subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.labelKey}>
            <CardHeader>
              <CardDescription>{t(k.labelKey)}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{k.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-xs">{t(k.hintKey)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.dashboard.chart.title')}</CardTitle>
          <CardDescription>{t('admin.dashboard.chart.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <OrdersTrendChart data={chartData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.dashboard.recent.title')}</CardTitle>
          <CardDescription>
            <Link href="/admin/orders" className="hover:underline">
              {t('admin.dashboard.recent.viewAll')}
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{t('admin.dashboard.recent.empty')}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.orders.col.customer')}</TableHead>
                  <TableHead>{t('admin.orders.col.status')}</TableHead>
                  <TableHead className="text-right">{t('admin.orders.col.total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                        {o.contactName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={o.status as OrderStatus} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCents(o.totalCents, o.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
