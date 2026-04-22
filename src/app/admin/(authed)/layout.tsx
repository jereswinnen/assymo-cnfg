import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/admin/Sidebar';
import { Header } from '@/components/admin/Header';
import { AdminHeaderProvider } from '@/components/admin/AdminHeaderContext';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import type { BusinessKind } from '@/lib/auth-guards';

export default async function AdminAuthedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/admin/sign-in');
  }

  const kind = session.user.kind as BusinessKind | 'client' | null;
  if (kind === 'client' || !kind) {
    redirect('/shop/account');
  }

  const tenantId = session.user.tenantId as string | null;
  const name = session.user.name ?? session.user.email;

  return (
    <AdminHeaderProvider>
      <SidebarProvider>
        <Sidebar kind={kind} tenantId={tenantId} name={name} email={session.user.email} />
        <SidebarInset>
          <Header />
          <div className="flex flex-1 flex-col p-4">{children}</div>
        </SidebarInset>
        <Toaster />
      </SidebarProvider>
    </AdminHeaderProvider>
  );
}
