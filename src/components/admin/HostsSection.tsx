'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TenantHostRow } from '@/db/schema';
import { t } from '@/lib/i18n';

interface Props { tenantId: string; initialHosts: TenantHostRow[] }

export function HostsSection({ tenantId, initialHosts }: Props) {
  const [hosts, setHosts] = useState(initialHosts);
  const [hostname, setHostname] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!hostname.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/admin/tenants/${tenantId}/hosts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostname }),
    });
    setBusy(false);
    if (res.ok) {
      const { host } = await res.json();
      setHosts((prev) => [...prev, host]);
      setHostname('');
    }
  }

  async function remove(h: string) {
    setBusy(true);
    const res = await fetch(
      `/api/admin/tenants/${tenantId}/hosts/${encodeURIComponent(h)}`,
      { method: 'DELETE' },
    );
    setBusy(false);
    if (res.ok) setHosts((prev) => prev.filter((row) => row.hostname !== h));
  }

  return (
    <Card>
      <CardHeader><CardTitle>{t('admin.tenant.section.hosts')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder={t('admin.tenant.hosts.placeholder')}
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
          />
          <Button onClick={add} disabled={busy || !hostname.trim()}>
            {t('admin.tenant.hosts.add')}
          </Button>
        </div>
        {hosts.length === 0 ? (
          <p className="text-sm text-neutral-500">{t('admin.tenant.hosts.empty')}</p>
        ) : (
          <ul className="space-y-1">
            {hosts.map((h) => (
              <li key={h.hostname} className="flex items-center justify-between text-sm font-mono">
                {h.hostname}
                <Button size="sm" variant="ghost" onClick={() => remove(h.hostname)}>
                  {t('admin.tenant.hosts.delete')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
