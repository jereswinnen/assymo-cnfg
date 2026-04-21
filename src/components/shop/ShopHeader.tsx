import Link from 'next/link';
import Image from 'next/image';
import type { Branding } from '@/domain/tenant';
import { t } from '@/lib/i18n';

interface Props {
  branding: Branding;
  /** When null, the "sign in" link is shown. When set, the account
   *  dropdown trigger is shown. */
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
          <Image
            src={branding.logoUrl}
            alt={branding.displayName}
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
            <Link
              href="/shop/account"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {signedIn.email}
            </Link>
          ) : (
            <Link
              href="/shop/sign-in"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('shop.nav.signIn')}
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
