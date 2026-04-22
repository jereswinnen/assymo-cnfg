import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { BrandedShell } from '@/components/shop/BrandedShell';
import { Toaster } from '@/components/ui/sonner';
export default async function ShopAuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect('/shop/sign-in');
  const kind = session.user.kind as string | null;
  if (kind === 'super_admin' || kind === 'tenant_admin') redirect('/admin');
  if (kind !== 'client') redirect('/shop/sign-in');

  return (
    <BrandedShell variant="shop">
      {children}
      <Toaster />
    </BrandedShell>
  );
}
