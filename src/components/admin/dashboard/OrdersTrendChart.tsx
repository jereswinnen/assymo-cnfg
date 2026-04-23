'use client';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
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
    <ChartContainer config={config} className="h-[220px] w-full">
      <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
        <Bar dataKey="orders" fill="var(--color-orders)" radius={6} />
      </BarChart>
    </ChartContainer>
  );
}
