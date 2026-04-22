import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import type { ProductRow } from '@/domain/catalog';

/** Branded product grid rendered on `/` when the tenant has products.
 *  Each card links to `/configurator?product=<slug>`. The final tile is
 *  the "Bouw van nul" escape hatch. */
export function LandingGrid({ products }: { products: ProductRow[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <Card key={p.id} className="overflow-hidden">
          {p.heroImage ? (
            <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
              <img src={p.heroImage} alt={p.name} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="aspect-[4/3] w-full bg-muted" />
          )}
          <CardContent className="space-y-2 p-4">
            <h3 className="text-lg font-semibold">{p.name}</h3>
            {p.description && (
              <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
            )}
            {p.basePriceCents > 0 && (
              <p className="text-sm font-medium">
                {t('landing.product.fromPrice', { amount: (p.basePriceCents / 100).toFixed(0) })}
              </p>
            )}
            <Button asChild className="w-full bg-[var(--brand-primary)] text-white hover:opacity-90 transition-opacity">
              <Link href={`/configurator?product=${p.slug}`}>
                {t('landing.product.configure')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
      <Card className="flex flex-col items-center justify-center border-dashed text-center">
        <CardContent className="space-y-3 p-6">
          <h3 className="text-lg font-semibold">{t('landing.blankSlate.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('landing.blankSlate.body')}</p>
          <Button asChild variant="outline">
            <Link href="/configurator?fresh=1">{t('landing.blankSlate.title')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
