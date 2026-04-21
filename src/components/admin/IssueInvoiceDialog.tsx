'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  orderId: string;
  defaultCustomerName: string;
  defaultVatRate: number;
  defaultPaymentTermDays: number;
}

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function IssueInvoiceDialog({
  orderId,
  defaultCustomerName,
  defaultVatRate,
  defaultPaymentTermDays,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState(defaultCustomerName);
  const [customerAddress, setCustomerAddress] = useState('');
  const [issuedAt, setIssuedAt] = useState(today());
  const [dueAt, setDueAt] = useState(addDays(today(), defaultPaymentTermDays));
  const [vatRate, setVatRate] = useState(defaultVatRate);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/orders/${orderId}/invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName,
        customerAddress,
        issuedAt,
        dueAt,
        vatRate,
      }),
    });
    setBusy(false);
    if (res.ok) {
      const { invoice } = await res.json();
      setOpen(false);
      router.push(`/admin/invoices/${invoice.id}`);
      return;
    }
    const data = await res.json().catch(() => ({}));
    const code = data.error as string | undefined;
    if (
      code &&
      t(`admin.issueInvoice.error.${code}`) !==
        `admin.issueInvoice.error.${code}`
    ) {
      setError(t(`admin.issueInvoice.error.${code}`));
    } else {
      setError(t('admin.tenant.saveError', { error: code ?? res.status }));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t('admin.issueInvoice.trigger')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.issueInvoice.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t('admin.issueInvoice.customerName')}>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </Field>
          <Field label={t('admin.issueInvoice.customerAddress')}>
            <Textarea
              rows={3}
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('admin.issueInvoice.issuedAt')}>
              <Input
                type="date"
                value={issuedAt}
                onChange={(e) => {
                  setIssuedAt(e.target.value);
                  setDueAt(addDays(e.target.value, defaultPaymentTermDays));
                }}
              />
            </Field>
            <Field label={t('admin.issueInvoice.dueAt')}>
              <Input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </Field>
          </div>
          <Field label={t('admin.issueInvoice.vatRate')}>
            <Input
              type="number"
              step="0.01"
              min={0}
              max={1}
              value={vatRate}
              onChange={(e) => setVatRate(Number(e.target.value))}
            />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>
            {t('admin.issueInvoice.submit')}
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
