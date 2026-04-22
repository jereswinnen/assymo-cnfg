'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HeroImageUploadField } from '@/components/admin/catalog/HeroImageUploadField';
import { ColorPickerField } from '@/components/admin/ColorPickerField';
import type { Branding } from '@/domain/tenant';
import { t } from '@/lib/i18n';

interface Props { tenantId: string; initialBranding: Branding }

export function BrandingSection({ tenantId, initialBranding }: Props) {
  const [b, setB] = useState(initialBranding);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function set<K extends keyof Branding>(k: K, v: Branding[K]) {
    setB((prev) => ({ ...prev, [k]: v }));
  }
  function setFooter<K extends keyof Branding['footer']>(k: K, v: Branding['footer'][K]) {
    setB((prev) => ({ ...prev, footer: { ...prev.footer, [k]: v } }));
  }

  async function save() {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/admin/tenants/${tenantId}/branding`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(b),
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
      <CardHeader><CardTitle>{t('admin.tenant.section.branding')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Field label={t('admin.tenant.branding.displayName')}>
          <Input value={b.displayName} onChange={(e) => set('displayName', e.target.value)} />
        </Field>
        <HeroImageUploadField
          label={t('admin.tenant.branding.logoUrl')}
          value={b.logoUrl || null}
          onChange={(url) => set('logoUrl', url ?? '')}
          tenantId={tenantId}
          slug="logo"
          previewFit="contain"
        />
        <div className="grid grid-cols-2 gap-4">
          <ColorPickerField
            label={t('admin.tenant.branding.primaryColor')}
            value={b.primaryColor}
            onChange={(v) => set('primaryColor', v)}
          />
          <ColorPickerField
            label={t('admin.tenant.branding.accentColor')}
            value={b.accentColor}
            onChange={(v) => set('accentColor', v)}
          />
        </div>
        <Field label={t('admin.tenant.branding.footer.contactEmail')}>
          <Input value={b.footer.contactEmail} onChange={(e) => setFooter('contactEmail', e.target.value)} />
        </Field>
        <Field label={t('admin.tenant.branding.footer.address')}>
          <Input value={b.footer.address} onChange={(e) => setFooter('address', e.target.value)} />
        </Field>
        <Field label={t('admin.tenant.branding.footer.vatNumber')}>
          <Input
            value={b.footer.vatNumber ?? ''}
            onChange={(e) => setFooter('vatNumber', e.target.value || null)}
          />
        </Field>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={busy}>{t('admin.tenant.save')}</Button>
          {msg && <span className="text-sm text-neutral-600">{msg}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
