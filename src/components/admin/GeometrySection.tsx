'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import {
  resolveTenantGeometry,
  type TenantGeometry,
} from '@/domain/tenant';
import { t } from '@/lib/i18n';

interface Props {
  tenantId: string;
  /** Raw stored value from the DB row. May be `{}` / null for older tenants;
   *  the component resolves through the canonical defaults so the input
   *  always reflects the effective runtime value. */
  initialGeometry: Partial<TenantGeometry> | null | undefined;
}

export function GeometrySection({ tenantId, initialGeometry }: Props) {
  const [geometry, setGeometry] = useState<TenantGeometry>(() =>
    resolveTenantGeometry(initialGeometry),
  );
  const [newPreset, setNewPreset] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/tenants/${tenantId}/geometry`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geometry),
    });
    setBusy(false);
    if (res.ok) setMsg(t('admin.tenant.saved'));
    else {
      const data = await res.json().catch(() => ({}));
      setMsg(t('admin.tenant.saveError', { error: data.error ?? res.status }));
    }
  }

  function addPreset() {
    const v = Number(newPreset);
    if (!Number.isFinite(v) || v < 80 || v > 300) return;
    const next = Array.from(new Set([...geometry.postSizePresetsMm, v])).sort(
      (a, b) => a - b,
    );
    setGeometry({ ...geometry, postSizePresetsMm: next });
    setNewPreset('');
  }

  function removePreset(mm: number) {
    if (geometry.postSizePresetsMm.length <= 1) return; // keep at least one
    setGeometry({
      ...geometry,
      postSizePresetsMm: geometry.postSizePresetsMm.filter((p) => p !== mm),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.tenant.section.geometry')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Default postSizeMm */}
        <div className="space-y-2">
          <Label htmlFor="postSizeMm">{t('admin.tenant.geometry.postSizeMm')}</Label>
          <p className="text-xs text-muted-foreground leading-snug">
            {t('admin.tenant.geometry.postSizeMm.help')}
          </p>
          <div className="flex items-center gap-2">
            <Input
              id="postSizeMm"
              type="number"
              min={80}
              max={300}
              step={1}
              className="w-32"
              value={geometry.postSizeMm}
              onChange={(e) =>
                setGeometry({ ...geometry, postSizeMm: Number(e.target.value) })
              }
            />
            <span className="text-sm text-muted-foreground">mm</span>
          </div>
        </div>

        {/* Preset list */}
        <div className="space-y-2">
          <Label>{t('admin.tenant.geometry.presets')}</Label>
          <p className="text-xs text-muted-foreground leading-snug">
            {t('admin.tenant.geometry.presets.help')}
          </p>
          <div className="flex flex-wrap gap-2">
            {geometry.postSizePresetsMm.map((mm) => (
              <span
                key={mm}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-3 py-1 text-sm"
              >
                {mm} mm
                <button
                  type="button"
                  onClick={() => removePreset(mm)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted disabled:opacity-30"
                  disabled={geometry.postSizePresetsMm.length <= 1}
                  aria-label={t('admin.tenant.geometry.presets.remove', {
                    mm: mm.toString(),
                  })}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Input
              type="number"
              min={80}
              max={300}
              step={1}
              className="w-32"
              placeholder={t('admin.tenant.geometry.presets.addPlaceholder')}
              value={newPreset}
              onChange={(e) => setNewPreset(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPreset();
                }
              }}
            />
            <Button type="button" size="sm" variant="outline" onClick={addPreset}>
              {t('admin.tenant.geometry.presets.add')}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={save} disabled={busy}>{t('admin.tenant.save')}</Button>
          {msg && <span className="text-sm text-neutral-600">{msg}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
