'use client';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';
import type { Role } from '@/lib/auth-guards';

interface Props { name: string; email: string; role: Role }

export function Header({ name, email, role }: Props) {
  const router = useRouter();
  return (
    <header className="h-14 bg-white border-b border-neutral-200 flex items-center justify-between px-6">
      <div className="text-sm text-neutral-600">
        {name} <span className="text-neutral-400">·</span> {t(`admin.role.${role}`)}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-neutral-500">{email}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await signOut();
            router.push('/admin/sign-in');
          }}
        >
          {t('admin.signOut')}
        </Button>
      </div>
    </header>
  );
}
