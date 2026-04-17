import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { t } from '@/lib/i18n';
import type { OrderQuoteSnapshot } from '@/domain/orders';

interface Props { snapshot: OrderQuoteSnapshot }

function formatEuros(eur: number, currency: string): string {
  return eur.toLocaleString('nl-BE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
}

/** Render the frozen quote line items. Labels go through `t(labelKey,
 *  labelParams)` per the project convention — never pre-formatted. */
export function OrderQuoteTable({ snapshot }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Onderdeel</TableHead>
          <TableHead className="text-right">Bedrag</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {snapshot.items.flatMap((item) =>
          item.lineItems.map((li, idx) => (
            <TableRow key={`${item.code}-${idx}`}>
              <TableCell>{t(li.labelKey, li.labelParams)}</TableCell>
              <TableCell className="text-right">
                {formatEuros(li.total, snapshot.currency)}
              </TableCell>
            </TableRow>
          )),
        )}
        <TableRow>
          <TableCell className="font-semibold">{t('email.orderConfirmation.total')}</TableCell>
          <TableCell className="text-right font-semibold">
            {formatEuros(snapshot.totalCents / 100, snapshot.currency)}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
