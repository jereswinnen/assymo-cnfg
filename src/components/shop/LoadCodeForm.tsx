'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';

/** Small form on the landing page letting returning customers paste a
 *  share code and jump straight to their saved scene. Client-only — the
 *  server-side shortcut at `/?code=<code>` handles direct URL shares. */
export function LoadCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = code.trim();
        if (!trimmed) return;
        router.push(`/configurator?code=${encodeURIComponent(trimmed)}`);
      }}
      className="mx-auto flex max-w-md items-center gap-2 pt-4"
    >
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={t('landing.loadCode.placeholder')}
        aria-label={t('landing.loadCode.placeholder')}
        className="font-mono"
      />
      <Button type="submit" variant="outline" disabled={code.trim().length === 0}>
        {t('landing.loadCode.submit')}
      </Button>
    </form>
  );
}
