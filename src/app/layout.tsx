import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { resolveTenantByHostOrDefault } from '@/db/resolveTenant';
import { TenantProvider } from '@/lib/TenantProvider';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await resolveTenantByHostOrDefault((await headers()).get('host'));
  return {
    title: `${tenant?.displayName ?? 'Assymo'} Configurator`,
    description: 'Interactieve 3D configurator met prijsberekening',
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tenant = await resolveTenantByHostOrDefault((await headers()).get('host'));
  if (!tenant) {
    throw new Error(
      'No tenant resolved for this host and no default tenant in DB. Run `pnpm db:seed` to create the assymo tenant.',
    );
  }

  return (
    <html lang={tenant.locale}>
      <body className="antialiased">
        <TenantProvider tenant={tenant}>{children}</TenantProvider>
      </body>
    </html>
  );
}
