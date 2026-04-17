'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { PriceBook } from '@/domain/pricing';
import { t } from '@/lib/i18n';

interface Props { tenantId: string; initialPriceBook: PriceBook }

export function PriceBookSection({ tenantId, initialPriceBook }: Props) {
  const [text, setText] = useState(JSON.stringify(initialPriceBook, null, 2));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setMsg(null);
    let parsed: unknown;
    try { parsed = JSON.parse(text); }
    catch { setMsg(t('admin.tenant.saveError', { error: 'invalid_json' })); return; }
    setBusy(true);
    const res = await fetch(`/api/admin/tenants/${tenantId}/price-book`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
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
      <CardHeader><CardTitle>{t('admin.tenant.section.priceBook')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={20}
          className="font-mono text-xs"
        />
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={busy}>{t('admin.tenant.save')}</Button>
          {msg && <span className="text-sm text-neutral-600">{msg}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
