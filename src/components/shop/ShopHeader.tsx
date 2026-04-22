import Link from 'next/link';
import Image from 'next/image';
import type { Branding } from '@/domain/tenant';
import { t } from '@/lib/i18n';
import { ShopHeaderUserMenu } from './ShopHeaderUserMenu';

interface Props {
  branding: Branding;
  /** When null, the "sign in" link is shown. When set, the caller's
   *  email is rendered as a link to /shop/account. */
  signedIn: { name: string | null; email: string } | null;
  /** Slim variant for the configurator — drops the auth slot entirely
   *  so the canvas owns the viewport. */
  variant?: 'shop' | 'configurator';
}

export function ShopHeader({ branding, signedIn, variant = 'shop' }: Props) {
  return (
    <header
      className="h-14 shrink-0 border-b border-black/10 bg-background flex items-center justify-between px-4"
      style={{ borderColor: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)' }}
    >
      <Link
        href={variant === 'configurator' ? '/' : '/shop/account'}
        className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity"
      >
        {branding.logoUrl && (
          // alt="" because the displayName sibling span already names
          // the link — the image is decorative. Partner tenants using
          // an external https logo URL will need a matching entry in
          // next.config.ts `images.remotePatterns`; today's seed uses
          // a local `/logo-*.svg` path.
          <Image
            src={branding.logoUrl}
            alt=""
            width={28}
            height={28}
            className="h-7 w-auto"
          />
        )}
        <span className="text-foreground">{branding.displayName}</span>
      </Link>

      {variant === 'shop' && (
        <div className="flex items-center gap-3 text-sm">
          {signedIn ? (
            <ShopHeaderUserMenu email={signedIn.email} />
          ) : (
            <Link
              href="/shop/sign-in"
              className="text-muted-foreground hover:text-[var(--brand-primary)] transition-colors"
            >
              {t('shop.nav.signIn')}
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
