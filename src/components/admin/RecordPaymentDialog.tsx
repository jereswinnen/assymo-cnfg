'use client';
import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { t } from '@/lib/i18n';

interface Props {
  invoiceId: string;
  /** Invoice total in cents; drives the quick-percentage preset buttons. */
  totalCents: number;
}

const QUICK_PERCENTS = [25, 50, 75, 100] as const;
// Matches server + derivePaymentStatus: tiny rounding drift is accepted.
const TOLERANCE_CENTS = 1;

function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });
}

/** Accept "1234,56" or "1234.56"; blank → 0. Returns cents. */
function parseEuroToCents(input: string): number {
  const cleaned = input.replace(/\s/g, '').replace(',', '.');
  const n = Number(cleaned);
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

function centsToEuroInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function RecordPaymentDialog({ invoiceId, totalCents }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountEur, setAmountEur] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [providerRef, setProviderRef] = useState('');
  const [note, setNote] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [remainingCents, setRemainingCents] = useState(totalCents);

  // Refresh the remaining amount every time the dialog opens so the
  // operator sees a live figure even if other tabs recorded payments.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/invoices/${invoiceId}`);
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as {
        payments: { amountCents: number }[];
      };
      const paid = data.payments.reduce((a, p) => a + p.amountCents, 0);
      if (!cancelled) setRemainingCents(totalCents - paid);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, invoiceId, totalCents]);

  const amountCents = parseEuroToCents(amountEur);
  const exceedsRemaining =
    amountCents > 0 && amountCents > remainingCents + TOLERANCE_CENTS;
  const fullyPaid = remainingCents <= TOLERANCE_CENTS;

  async function submit() {
    setBusy(true);
    setError(null);
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
    if (data.error === 'amount_exceeds_total') {
      const remaining = data.details?.remainingCents ?? remainingCents;
      setRemainingCents(remaining);
      setError(
        t('admin.recordPayment.exceedsRemaining', {
          remaining: fmtCents(Math.max(remaining, 0)),
        }),
      );
      return;
    }
    setError(t('admin.tenant.saveError', { error: data.error ?? res.status }));
  }

  function setFromPercent(pct: number) {
    const base = Math.max(remainingCents, 0);
    const cents = Math.round((base * pct) / 100);
    setAmountEur(centsToEuroInput(cents));
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
            <div className="space-y-2">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amountEur}
                onChange={(e) => setAmountEur(e.target.value)}
                aria-invalid={exceedsRemaining || undefined}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {t('admin.recordPayment.remaining', {
                    remaining: fmtCents(Math.max(remainingCents, 0)),
                  })}
                </span>
              </div>
              {exceedsRemaining && (
                <p className="text-sm text-destructive">
                  {t('admin.recordPayment.exceedsRemaining', {
                    remaining: fmtCents(Math.max(remainingCents, 0)),
                  })}
                </p>
              )}
              <div className="flex flex-wrap gap-1">
                {QUICK_PERCENTS.map((p) => (
                  <Button
                    key={p}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFromPercent(p)}
                    disabled={fullyPaid}
                  >
                    {p}%
                  </Button>
                ))}
              </div>
            </div>
          </Field>
          <Field label={t('admin.recordPayment.paidAt')}>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start font-normal"
                  type="button"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(parseISO(paidAt), 'dd/MM/yyyy', { locale: nl })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parseISO(paidAt)}
                  onSelect={(d) => {
                    if (d) {
                      setPaidAt(format(d, 'yyyy-MM-dd'));
                      setDatePickerOpen(false);
                    }
                  }}
                  locale={nl}
                  weekStartsOn={1}
                />
              </PopoverContent>
            </Popover>
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
          <Button
            onClick={submit}
            disabled={busy || !amountEur || exceedsRemaining || fullyPaid}
          >
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
