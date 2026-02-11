'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { calculateQuote } from '@/lib/pricing';
import { t } from '@/lib/i18n';

export default function QuoteSummary() {
  const config = useConfigStore((s) => s.config);
  const { lineItems, total } = calculateQuote(config);

  return (
    <div className="space-y-3">
      <div className="divide-y divide-gray-100">
        {lineItems.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between py-2 text-sm"
          >
            <div>
              <span className="text-gray-700">{item.label}</span>
              {item.area > 0 && (
                <span className="ml-2 text-xs text-gray-400">
                  {item.area.toFixed(1)} m²
                </span>
              )}
            </div>
            <span className="font-medium tabular-nums text-gray-900">
              €{item.total.toFixed(0)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t-2 border-gray-900 pt-3">
        <span className="font-semibold text-gray-900">{t('quote.total')}</span>
        <span className="text-lg font-bold tabular-nums text-gray-900">
          €{total.toFixed(0)}
        </span>
      </div>
    </div>
  );
}
