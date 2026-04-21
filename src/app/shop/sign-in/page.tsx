'use client';
import Link from 'next/link';
import { useState } from 'react';
import { signIn } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { t } from '@/lib/i18n';

export default function ShopSignInPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sent' | 'error'>('idle');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setState('idle');
    try {
      await signIn.magicLink({ email, callbackURL: '/shop/account' });
      setState('sent');
    } catch {
      setState('error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('shop.signIn.title')}</CardTitle>
        <CardDescription>{t('shop.signIn.lead')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('shop.signIn.email')}</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {t('shop.signIn.submit')}
          </Button>
          {state === 'sent' && (
            <p className="text-sm text-green-600">{t('shop.signIn.sent')}</p>
          )}
          {state === 'error' && (
            <p className="text-sm text-destructive">{t('shop.signIn.error')}</p>
          )}
          <div className="pt-2 text-center">
            <Link
              href="/"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('shop.signIn.backToConfigurator')}
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
