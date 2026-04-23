'use client';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { t } from '@/lib/i18n';

interface Point {
  week: string;
  orders: number;
}

const config = {
  orders: {
    label: t('admin.dashboard.chart.series.orders'),
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

export function OrdersTrendChart({ data }: { data: Point[] }) {
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <BarChart
        accessibilityLayer
        data={data}
        margin={{ left: 0, right: 0, top: 16, bottom: 0 }}
        barCategoryGap="25%"
      >
        <CartesianGrid
          vertical={false}
          strokeDasharray="2 4"
          stroke="var(--border)"
          opacity={0.7}
        />
        <XAxis
          dataKey="week"
          tickLine={false}
          axisLine={false}
          tickMargin={12}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={32}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          allowDecimals={false}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
          content={<ChartTooltipContent indicator="line" />}
        />
        <Bar dataKey="orders" fill="var(--color-orders)" radius={[3, 3, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ChartContainer>
  );
}
