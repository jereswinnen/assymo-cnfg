import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/admin/Sidebar';
import { Header } from '@/components/admin/Header';
import { AdminHeaderProvider } from '@/components/admin/AdminHeaderContext';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import type { Role, UserType } from '@/lib/auth-guards';

export default async function AdminAuthedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/admin/sign-in');
  }

  const userType = session.user.userType as UserType | null;
  if (userType !== 'business') {
    redirect('/shop/account');
  }

  const role = session.user.role as Role;
  const tenantId = session.user.tenantId as string | null;
  const name = session.user.name ?? session.user.email;

  return (
    <AdminHeaderProvider>
      <SidebarProvider>
        <Sidebar role={role} tenantId={tenantId} name={name} email={session.user.email} />
        <SidebarInset>
          <Header />
          <div className="flex-1 p-4">{children}</div>
        </SidebarInset>
        <Toaster />
      </SidebarProvider>
    </AdminHeaderProvider>
  );
}
