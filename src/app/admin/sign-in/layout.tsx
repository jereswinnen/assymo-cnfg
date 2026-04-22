// Sign-in lives outside the (authed) group, so the session-guard layout
// doesn't apply here. We still bounce already-signed-in business users
// straight to /admin to avoid showing them the sign-in form.
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function SignInLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session && (session.user.kind === 'super_admin' || session.user.kind === 'tenant_admin')) redirect('/admin');
  return <div className="min-h-screen flex items-center justify-center bg-neutral-50">{children}</div>;
}
