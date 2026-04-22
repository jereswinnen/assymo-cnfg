'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { t } from '@/lib/i18n';

const VAT_OPTIONS = [0, 0.06, 0.12, 0.21] as const;

function formatDate(iso: string): string {
  return format(parseISO(iso), 'dd/MM/yyyy', { locale: nl });
}

function toIsoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

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
              <DatePickerField
                value={issuedAt}
                onChange={(iso) => {
                  setIssuedAt(iso);
                  setDueAt(addDays(iso, defaultPaymentTermDays));
                }}
              />
            </Field>
            <Field label={t('admin.issueInvoice.dueAt')}>
              <DatePickerField value={dueAt} onChange={setDueAt} />
            </Field>
          </div>
          <Field label={t('admin.issueInvoice.vatRate')}>
            <Select
              value={String(vatRate)}
              onValueChange={(v) => setVatRate(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VAT_OPTIONS.map((o) => (
                  <SelectItem key={o} value={String(o)}>
                    {Math.round(o * 100)}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

/** Shadcn Popover + Calendar date input. Stores ISO (`yyyy-MM-dd`) for
 *  the API; displays DD/MM/YYYY (Belgian format) to the user. */
function DatePickerField({
  value,
  onChange,
}: {
  value: string;
  onChange: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start font-normal"
          type="button"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatDate(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parseISO(value)}
          onSelect={(d) => {
            if (d) {
              onChange(toIsoDate(d));
              setOpen(false);
            }
          }}
          locale={nl}
          weekStartsOn={1}
        />
      </PopoverContent>
    </Popover>
  );
}
