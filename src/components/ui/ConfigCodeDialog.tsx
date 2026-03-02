'use client';

import { useState, useCallback } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { QrCode, Copy, Check, X } from 'lucide-react';
import { useConfigStore } from '@/store/useConfigStore';
import { encodeState, decodeState, formatCode } from '@/lib/configCode';
import { t } from '@/lib/i18n';

export default function ConfigCodeDialog({ iconOnly }: { iconOnly?: boolean } = {}) {
  const buildings = useConfigStore((s) => s.buildings);
  const connections = useConfigStore((s) => s.connections);
  const roof = useConfigStore((s) => s.roof);
  const loadState = useConfigStore((s) => s.loadState);

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  const currentCode = open ? encodeState(buildings, connections, roof) : '';

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(currentCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [currentCode]);

  const handleInputChange = (val: string) => {
    const raw = val.replace(/[^0-9a-zA-Z]/g, '');
    setInputValue(formatCode(raw));
    setError('');
  };

  const handleLoad = () => {
    try {
      const { buildings: b, connections: c, roof: r } = decodeState(inputValue);
      loadState(b, c, r);
      setInputValue('');
      setError('');
      setOpen(false);
    } catch {
      setError(t('code.invalidCode'));
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setCopied(false);
      setInputValue('');
      setError('');
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

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t('code.currentLabel')}
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-lg bg-muted px-3 py-2.5 font-mono text-sm tracking-wider select-all break-all">
                {currentCode}
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
          </div>

          <div className="my-5 h-px bg-border" />

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t('code.loadTitle')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inputValue) handleLoad();
                }}
                placeholder={t('code.loadPlaceholder')}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2.5 font-mono text-sm tracking-wider placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={handleLoad}
                disabled={!inputValue}
                className="shrink-0 rounded-lg px-4 py-2.5 text-xs font-medium bg-muted text-foreground hover:bg-muted/80 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                {t('code.load')}
              </button>
            </div>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
