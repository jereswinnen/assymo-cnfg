'use client';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TenantInvoicing } from '@/domain/tenant';
import { VAT_RATES } from '@/domain/invoicing';
import { t } from '@/lib/i18n';

interface Props {
  tenantId: string;
  initialInvoicing: TenantInvoicing;
}

export function InvoicingSection({ tenantId, initialInvoicing }: Props) {
  const [v, setV] = useState(initialInvoicing);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function set<K extends keyof TenantInvoicing>(k: K, val: TenantInvoicing[K]) {
    setV((prev) => ({ ...prev, [k]: val }));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/tenants/${tenantId}/invoicing`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(v),
    });
    setBusy(false);
    if (res.ok) setMsg(t('admin.tenant.saved'));
    else {
      const data = await res.json().catch(() => ({}));
      setMsg(t('admin.tenant.saveError', { error: data.error ?? res.status }));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.tenant.section.invoicing')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label={t('admin.invoicing.form.vatRate')}
            hint={t('admin.invoicing.form.vatRate.help')}
          >
            <Select
              value={String(v.vatRate)}
              onValueChange={(val) => set('vatRate', Number(val))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VAT_RATES.map((r) => (
                  <SelectItem key={r} value={String(r)}>
                    {Math.round(r * 100)}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('admin.invoicing.form.paymentTermDays')}>
            <Input
              type="number"
              step={1}
              min={1}
              value={v.paymentTermDays}
              onChange={(e) => set('paymentTermDays', Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label={t('admin.invoicing.form.bankIban')}>
          <Input
            value={v.bankIban}
            onChange={(e) => set('bankIban', e.target.value)}
          />
        </Field>
        <Field label={t('admin.invoicing.form.bankBic')}>
          <Input
            value={v.bankBic ?? ''}
            onChange={(e) =>
              set('bankBic', e.target.value === '' ? null : e.target.value)
            }
          />
        </Field>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={busy}>
            {t('admin.invoicing.form.save')}
          </Button>
          {msg && <span className="text-sm text-neutral-600">{msg}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
