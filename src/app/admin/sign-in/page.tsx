'use client';
import { useState } from 'react';
import { signIn } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { t } from '@/lib/i18n';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sent' | 'error'>('idle');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setState('idle');
    try {
      await signIn.magicLink({ email, callbackURL: '/admin' });
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
        <CardTitle>{t('admin.signIn.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('admin.signIn.email')}</Label>
            <Input
              id="email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {t('admin.signIn.submit')}
          </Button>
          {state === 'sent' && <p className="text-sm text-green-600">{t('admin.signIn.sent')}</p>}
          {state === 'error' && <p className="text-sm text-red-600">{t('admin.signIn.error')}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
