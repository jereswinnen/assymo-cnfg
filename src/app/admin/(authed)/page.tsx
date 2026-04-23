import Link from 'next/link';
import { headers } from 'next/headers';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { ArrowUpRight, ClipboardList, Receipt, TrendingUp, Users } from 'lucide-react';
import type { CSSProperties } from 'react';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { invoices, orders, payments } from '@/db/schema';
import { resolveAdminTenantScope } from '@/lib/adminScope';
import { t } from '@/lib/i18n';
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

function formatToday(d: Date): string {
  return d.toLocaleDateString('nl-BE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
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
      icon: ClipboardList,
      accent: 'var(--chart-1)',
    },
    {
      labelKey: 'admin.dashboard.kpi.revenue',
      hintKey: 'admin.dashboard.kpi.revenue.hint',
      value: formatCents(revenueCents, 'EUR'),
      icon: TrendingUp,
      accent: 'var(--chart-2)',
    },
    {
      labelKey: 'admin.dashboard.kpi.unpaidInvoices',
      hintKey: 'admin.dashboard.kpi.unpaidInvoices.hint',
      value: String(unpaidInvoices),
      icon: Receipt,
      accent: 'var(--chart-4)',
    },
    {
      labelKey: 'admin.dashboard.kpi.activeClients',
      hintKey: 'admin.dashboard.kpi.activeClients.hint',
      value: String(activeClients),
      icon: Users,
      accent: 'var(--chart-3)',
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-2 py-10">
      {/* Masthead */}
      <header className="flex items-end justify-between border-b pb-10">
        <div className="flex flex-col gap-3">
          <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-[0.22em]">
            {t('admin.nav.dashboard')}
          </span>
          <h1 className="font-[family-name:var(--font-display)] text-5xl leading-[0.95] tracking-tight md:text-6xl">
            {t('admin.dashboard.greeting', {
              name: session.user.name ?? session.user.email,
            })}
          </h1>
        </div>
        <div className="text-muted-foreground hidden text-right text-xs md:block">
          <div className="tabular-nums">{formatToday(now)}</div>
        </div>
      </header>

      {/* KPI row */}
      <section className="grid grid-cols-1 border-b sm:grid-cols-2 sm:divide-x lg:grid-cols-4">
        {kpis.map((k, i) => (
          <div
            key={k.labelKey}
            className={`flex flex-col gap-6 px-6 py-10 sm:px-8 ${i >= 2 ? 'sm:border-t lg:border-t-0' : ''}`}
            style={{ '--accent': k.accent } as CSSProperties}
          >
            <div className="flex items-center justify-between">
              <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--accent)]/12 text-[var(--accent)] ring-1 ring-[var(--accent)]/20 ring-inset">
                <k.icon className="size-5" strokeWidth={1.75} />
              </div>
              <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-[0.22em]">
                {t(k.labelKey)}
              </span>
            </div>
            <div className="font-[family-name:var(--font-display)] text-[3.5rem] leading-[0.9] tracking-tight tabular-nums">
              {k.value}
            </div>
            <p className="text-muted-foreground text-xs leading-snug">{t(k.hintKey)}</p>
          </div>
        ))}
      </section>

      {/* Chart */}
      <section className="grid grid-cols-12 gap-8 border-b py-14">
        <div className="col-span-12 flex flex-col gap-1 md:col-span-3">
          <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-[0.22em]">
            {t('admin.dashboard.chart.title')}
          </span>
          <p className="font-[family-name:var(--font-display)] text-2xl italic leading-tight">
            {t('admin.dashboard.chart.subtitle')}
          </p>
        </div>
        <div className="col-span-12 md:col-span-9">
          <OrdersTrendChart data={chartData} />
        </div>
      </section>

      {/* Recent orders */}
      <section className="flex flex-col gap-6 pt-14">
        <div className="flex items-end justify-between">
          <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-[0.22em]">
            {t('admin.dashboard.recent.title')}
          </span>
          <Link
            href="/admin/orders"
            className="group inline-flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase hover:text-muted-foreground"
          >
            {t('admin.dashboard.recent.viewAll')}
            <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t('admin.dashboard.recent.empty')}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[10px] font-medium uppercase tracking-[0.18em]">
                  {t('admin.orders.col.customer')}
                </TableHead>
                <TableHead className="text-[10px] font-medium uppercase tracking-[0.18em]">
                  {t('admin.orders.col.status')}
                </TableHead>
                <TableHead className="text-right text-[10px] font-medium uppercase tracking-[0.18em]">
                  {t('admin.orders.col.total')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((o) => (
                <TableRow key={o.id} className="group">
                  <TableCell className="py-4">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="inline-flex items-center gap-2 font-medium group-hover:underline"
                    >
                      {o.contactName}
                    </Link>
                  </TableCell>
                  <TableCell className="py-4">
                    <OrderStatusBadge status={o.status as OrderStatus} />
                  </TableCell>
                  <TableCell className="py-4 text-right font-[family-name:var(--font-display)] text-lg tabular-nums">
                    {formatCents(o.totalCents, o.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
