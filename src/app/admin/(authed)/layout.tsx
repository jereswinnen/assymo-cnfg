import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/admin/Sidebar';
import { Header } from '@/components/admin/Header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { Role, UserType } from '@/lib/auth-guards';

export default async function AdminAuthedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/admin/sign-in');
  }

  const userType = session.user.userType as UserType | null;
  if (userType !== 'business') {
    // Clients have no business in /admin — bounce them to /shop/account.
    redirect('/shop/account');
  }

  const role = session.user.role as Role;

  return (
    <SidebarProvider>
      <Sidebar role={role} tenantId={session.user.tenantId as string | null} />
      <SidebarInset>
        <Header
          name={session.user.name ?? session.user.email}
          email={session.user.email}
          role={role}
        />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
