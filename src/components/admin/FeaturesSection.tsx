'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  resolveTenantFeatures,
  type TenantFeatures,
} from '@/domain/tenant';
import { t } from '@/lib/i18n';

interface Props {
  tenantId: string;
  /** The raw stored value from the DB row. May be `{}` for older tenants;
   *  the component resolves through the canonical defaults so the toggle
   *  always reflects the effective runtime value. */
  initialFeatures: Partial<TenantFeatures> | null | undefined;
}

export function FeaturesSection({ tenantId, initialFeatures }: Props) {
  const [features, setFeatures] = useState<TenantFeatures>(() =>
    resolveTenantFeatures(initialFeatures),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function set<K extends keyof TenantFeatures>(k: K, v: TenantFeatures[K]) {
    setFeatures((prev) => ({ ...prev, [k]: v }));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/tenants/${tenantId}/features`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features),
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
        <CardTitle>{t('admin.tenant.section.features')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ToggleRow
          label={t('admin.tenant.features.wallElevationView')}
          help={t('admin.tenant.features.wallElevationView.help')}
          checked={features.wallElevationView}
          onCheckedChange={(v) => set('wallElevationView', v)}
        />
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={save} disabled={busy}>{t('admin.tenant.save')}</Button>
          {msg && <span className="text-sm text-neutral-600">{msg}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label,
  help,
  checked,
  onCheckedChange,
}: {
  label: string;
  help: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground leading-snug">{help}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
