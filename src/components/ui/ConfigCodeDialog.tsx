'use client';

import { useState, useCallback } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { QrCode, Copy, Check, X, Loader2 } from 'lucide-react';
import { useConfigStore } from '@/store/useConfigStore';
import type { ConfigData } from '@/domain/config';
import { t } from '@/lib/i18n';

export default function ConfigCodeDialog({ iconOnly }: { iconOnly?: boolean } = {}) {
  const version = useConfigStore((s) => s.version);
  const buildings = useConfigStore((s) => s.buildings);
  const connections = useConfigStore((s) => s.connections);
  const roof = useConfigStore((s) => s.roof);
  const defaultHeight = useConfigStore((s) => s.defaultHeight);

  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSave = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const data: ConfigData = { version, buildings, connections, roof, defaultHeight };
      const res = await fetch('/api/configs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) {
        setError(t('code.saveFailed'));
        return;
      }
      const body = (await res.json()) as { code: string };
      setCode(body.code);
    } catch {
      setError(t('code.saveFailed'));
    } finally {
      setBusy(false);
    }
  }, [version, buildings, connections, roof, defaultHeight]);

  const handleCopy = useCallback(() => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setCode(null);
      setError(null);
      setCopied(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Trigger asChild>
        {iconOnly ? (
          <button className="flex items-center justify-center h-11 w-11 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <QrCode className="h-5 w-5" />
          </button>
        ) : (
          <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <QrCode className="h-3.5 w-3.5" />
            Code
          </button>
        )}
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-background p-6 shadow-xl ring-1 ring-black/[0.08] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
          <div className="flex items-center justify-between mb-4">
            <DialogPrimitive.Title className="text-base font-semibold">
              {t('code.title')}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {code ? (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                {t('code.currentLabel')}
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-lg bg-muted px-3 py-2.5 font-mono text-sm tracking-wider select-all break-all">
                  {code}
                </div>
                <button
                  onClick={handleCopy}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      {t('code.copied')}
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      {t('code.copy')}
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{t('code.shareHint')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t('code.saveHint')}</p>
              <button
                onClick={handleSave}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:pointer-events-none transition-colors"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('code.save')}
              </button>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
