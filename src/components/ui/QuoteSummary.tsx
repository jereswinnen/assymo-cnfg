'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { calculateTotalQuote } from '@/lib/pricing';
import { t } from '@/lib/i18n';
import { useTenant } from '@/lib/TenantProvider';

export default function QuoteSummary() {
  const tenant = useTenant();
  const buildings = useConfigStore((s) => s.buildings);
  const roof = useConfigStore((s) => s.roof);
  const defaultHeight = useConfigStore((s) => s.defaultHeight);
  const { lineItems, total } = calculateTotalQuote(buildings, roof, tenant.priceBook, defaultHeight);

  return (
    <div className="space-y-3">
      <div className="divide-y divide-border/60">
        {lineItems.map((item, i) => (
          <div
            key={`${item.labelKey}-${i}`}
            className="flex items-center justify-between py-2.5 text-sm"
          >
            <div>
              <span className="text-foreground">{t(item.labelKey, item.labelParams)}</span>
              {item.area > 0 && (
                <span className="ml-2 text-[11px] text-muted-foreground">
                  {item.area.toFixed(1)} m{'\u00B2'}
                </span>
              )}
            </div>
            <span className="font-medium tabular-nums text-foreground">
              {'\u20AC'}{item.total.toFixed(0)}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t-2 border-foreground/20 pt-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-foreground">{t('quote.total')}</span>
          <span className="text-lg font-bold tabular-nums text-foreground">
            {'\u20AC'}{total.toFixed(0)}
          </span>
        </div>
      </div>
    </div>
  );
}
