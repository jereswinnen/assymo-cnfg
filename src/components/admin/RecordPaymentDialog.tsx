'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { t } from '@/lib/i18n';

interface Props {
  invoiceId: string;
}

export function RecordPaymentDialog({ invoiceId }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountEur, setAmountEur] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [providerRef, setProviderRef] = useState('');
  const [note, setNote] = useState('');

  async function submit() {
    setBusy(true);
    setError(null);
    const amountCents = Math.round(Number(amountEur) * 100);
    const res = await fetch(`/api/admin/invoices/${invoiceId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountCents,
        method: 'manual',
        paidAt,
        providerRef: providerRef || null,
        note: note || null,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      window.dispatchEvent(new Event('payment-recorded'));
      setAmountEur('');
      setProviderRef('');
      setNote('');
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(t('admin.tenant.saveError', { error: data.error ?? res.status }));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {t('admin.recordPayment.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.recordPayment.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t('admin.recordPayment.amount')}>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={amountEur}
              onChange={(e) => setAmountEur(e.target.value)}
            />
          </Field>
          <Field label={t('admin.recordPayment.paidAt')}>
            <Input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </Field>
          <Field label={t('admin.recordPayment.providerRef')}>
            <Input
              value={providerRef}
              onChange={(e) => setProviderRef(e.target.value)}
            />
          </Field>
          <Field label={t('admin.recordPayment.note')}>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy || !amountEur}>
            {t('admin.recordPayment.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
