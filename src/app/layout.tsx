import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { resolveTenantFromHost } from '@/domain/tenant';
import { TenantProvider } from '@/lib/TenantProvider';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const tenant = resolveTenantFromHost((await headers()).get('host'));
  return {
    title: `${tenant.displayName} Configurator`,
    description: 'Interactieve 3D configurator met prijsberekening',
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tenant = resolveTenantFromHost((await headers()).get('host'));

  return (
    <html lang={tenant.locale}>
      <body className="antialiased">
        <TenantProvider tenant={tenant}>{children}</TenantProvider>
      </body>
    </html>
  );
}
