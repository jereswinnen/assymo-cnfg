'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { t } from '@/lib/i18n';

interface Props {
  actorKind: 'super_admin' | 'tenant_admin';
  actorTenantId: string | null;
  tenantOptions: { id: string; displayName: string }[];
}

export function InviteUserDialog({ actorKind, actorTenantId, tenantOptions }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'super_admin' | 'tenant_admin'>('tenant_admin');
  const [tenantId, setTenantId] = useState<string>(actorTenantId ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        name,
        kind,
        tenantId: kind === 'super_admin' ? null : tenantId,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg(t('admin.users.invite.success', { email }));
      setEmail('');
      setName('');
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMsg(`${t('admin.error.generic')} (${data.error ?? res.status})`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t('admin.users.invite')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.users.invite.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('admin.users.invite.email')}</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">{t('admin.users.invite.name')}</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kind">{t('admin.users.invite.role')}</Label>
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as 'super_admin' | 'tenant_admin')}
            >
              <SelectTrigger id="kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tenant_admin">{t('admin.role.tenant_admin')}</SelectItem>
                {actorKind === 'super_admin' && (
                  <SelectItem value="super_admin">{t('admin.role.super_admin')}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          {actorKind === 'super_admin' && kind !== 'super_admin' && (
            <div className="space-y-2">
              <Label htmlFor="tenantId">{t('admin.users.invite.tenant')}</Label>
              <Select value={tenantId} onValueChange={setTenantId}>
                <SelectTrigger id="tenantId" className="w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {tenantOptions.map((tx) => (
                    <SelectItem key={tx.id} value={tx.id}>
                      {tx.displayName} ({tx.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {msg && <p className="text-sm text-neutral-600">{msg}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {t('admin.users.invite.submit')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
