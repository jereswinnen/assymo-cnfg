// Sign-in lives outside the (authed) group, so the session-guard layout
// doesn't apply here. Already-signed-in clients bounce to /shop/account;
// business users bounce to /admin (they shouldn't be on /shop at all).
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { BrandedShell } from '@/components/shop/BrandedShell';

export default async function ShopSignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.userType === 'client') redirect('/shop/account');
  if (session?.user?.userType === 'business') redirect('/admin');

  return (
    <BrandedShell variant="shop">
      <div className="flex items-center justify-center min-h-[60vh]">
        {children}
      </div>
    </BrandedShell>
  );
}
