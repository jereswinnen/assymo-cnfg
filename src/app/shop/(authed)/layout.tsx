import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { BrandedShell } from '@/components/shop/BrandedShell';
import { Toaster } from '@/components/ui/sonner';
import type { UserType } from '@/lib/auth-guards';

export default async function ShopAuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect('/shop/sign-in');
  const userType = session.user.userType as UserType | null;
  if (userType === 'business') redirect('/admin');
  if (userType !== 'client') redirect('/shop/sign-in');

  return (
    <BrandedShell variant="shop">
      {children}
      <Toaster />
    </BrandedShell>
  );
}
