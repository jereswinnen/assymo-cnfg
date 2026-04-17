'use client';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { signOut } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';
import type { Role } from '@/lib/auth-guards';

interface Props { name: string; email: string; role: Role }

export function Header({ name, email, role }: Props) {
  const router = useRouter();
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <div className="text-sm text-muted-foreground">
        {name} <span className="text-muted-foreground/60">·</span> {t(`admin.role.${role}`)}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{email}</span>
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
