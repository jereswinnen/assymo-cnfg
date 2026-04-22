import type { Branding } from '@/domain/tenant';
import { t } from '@/lib/i18n';

interface Props { branding: Branding }

export function ShopFooter({ branding }: Props) {
  const { footer, displayName } = branding;
  const year = new Date().getFullYear();
  return (
    <footer className="shrink-0 border-t border-black/10 bg-muted/20 px-4 py-6 text-xs text-muted-foreground">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="font-medium text-foreground">{displayName}</div>
          <div>{footer.address}</div>
          {footer.vatNumber && (
            <div>{t('shop.footer.vat')}: {footer.vatNumber}</div>
          )}
        </div>
        <div className="sm:text-right">
          <div>{t('shop.footer.contact')}:</div>
          <a
            href={`mailto:${footer.contactEmail}`}
            className="text-[var(--brand-primary)] hover:underline"
          >
            {footer.contactEmail}
          </a>
          <div className="mt-1 text-muted-foreground/60">
            © {year} {displayName}
          </div>
        </div>
      </div>
    </footer>
  );
}
