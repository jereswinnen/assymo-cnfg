import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { resolveTenantByHostOrDefault } from '@/db/resolveTenant';
import {
  brandingToCssVars,
  cssVarsToInlineBlock,
  DEFAULT_ASSYMO_BRANDING,
} from '@/domain/tenant';
import { ShopHeader } from './ShopHeader';
import { ShopFooter } from './ShopFooter';

interface Props {
  /** "shop" renders header + footer around children; "configurator"
   *  renders the slim header only and lets children own the rest of
   *  the viewport (the canvas needs `h-dvh`). */
  variant?: 'shop' | 'configurator';
  children: React.ReactNode;
}

/** Server-only shell that reads the tenant branding + session and
 *  injects brand CSS vars. Used by `/shop/*` routes and by the
 *  configurator root. */
export async function BrandedShell({ variant = 'shop', children }: Props) {
  const hostHeader = (await headers()).get('host');
  const tenantRow = await resolveTenantByHostOrDefault(hostHeader);
  const branding = tenantRow?.branding ?? DEFAULT_ASSYMO_BRANDING;

  const session = await auth.api.getSession({ headers: await headers() });
  const signedIn =
    session?.user?.userType === 'client'
      ? { name: session.user.name ?? null, email: session.user.email }
      : null;

  const cssBlock = cssVarsToInlineBlock(brandingToCssVars(branding));

  if (variant === 'configurator') {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: cssBlock }} />
        <div className="flex flex-col h-dvh">
          <ShopHeader branding={branding} signedIn={signedIn} variant="configurator" />
          <main className="flex-1 relative min-h-0">{children}</main>
        </div>
      </>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssBlock }} />
      <div className="flex flex-col min-h-dvh">
        <ShopHeader branding={branding} signedIn={signedIn} variant="shop" />
        <main className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto">
          {children}
        </main>
        <ShopFooter branding={branding} />
      </div>
    </>
  );
}
