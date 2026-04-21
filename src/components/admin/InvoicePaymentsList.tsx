'use client';
import { useEffect, useState, useCallback } from 'react';
import { t } from '@/lib/i18n';
import type { PaymentRecord, PaymentStatus } from '@/domain/invoicing';

interface Props {
  invoiceId: string;
  totalCents: number;
  currency: string;
}

function fmtCents(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('nl-BE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-BE');
}

export function InvoicePaymentsList({
  invoiceId,
  totalCents,
  currency,
}: Props) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [status, setStatus] = useState<PaymentStatus>('unpaid');

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/invoices/${invoiceId}`);
    if (!res.ok) return;
    const data = await res.json();
    setPayments(data.payments);
    setStatus(data.status);
  }, [invoiceId]);

  useEffect(() => {
    load();
  }, [load]);

  // Listen for a window-level event fired by RecordPaymentDialog so the list refreshes.
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('payment-recorded', handler);
    return () => window.removeEventListener('payment-recorded', handler);
  }, [load]);

  const sum = payments.reduce((acc, p) => acc + p.amountCents, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {fmtCents(sum, currency)} / {fmtCents(totalCents, currency)}
        </span>
        <span className="font-medium">{t(`payment.status.${status}`)}</span>
      </div>
      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('admin.invoice.detail.noPayments')}
        </p>
      ) : (
        <ul className="divide-y">
          {payments.map((p) => (
            <li
              key={p.id}
              className="py-2 flex items-start justify-between text-sm"
            >
              <div>
                <div>{fmtDate(p.paidAt)}</div>
                {p.providerRef && (
                  <div className="text-xs text-muted-foreground">
                    {p.providerRef}
                  </div>
                )}
                {p.note && (
                  <div className="text-xs text-muted-foreground">{p.note}</div>
                )}
              </div>
              <div className="font-mono">
                {fmtCents(p.amountCents, p.currency)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
