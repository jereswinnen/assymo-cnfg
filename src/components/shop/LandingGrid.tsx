import Link from 'next/link';
import { PencilRuler } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import type { ProductRow } from '@/domain/catalog';

/** Branded product grid rendered on `/` when the tenant has products.
 *  Each card links to `/configurator?product=<slug>`. The final tile is
 *  the "Bouw van nul" escape hatch. */
export function LandingGrid({ products }: { products: ProductRow[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <Card
          key={p.id}
          className="flex flex-col overflow-hidden pt-0 transition-shadow hover:shadow-md"
        >
          <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
            {p.heroImage && (
              <img
                src={p.heroImage}
                alt={p.name}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            )}
          </div>
          <CardHeader>
            <CardTitle className="text-xl">{p.name}</CardTitle>
            {p.description && (
              <CardDescription className="line-clamp-2">
                {p.description}
              </CardDescription>
            )}
          </CardHeader>
          {p.basePriceCents > 0 && (
            <CardContent className="pt-0 text-sm font-medium">
              {t('landing.product.fromPrice', {
                amount: (p.basePriceCents / 100).toFixed(0),
              })}
            </CardContent>
          )}
          <CardFooter className="mt-auto">
            <Button
              asChild
              className="w-full bg-[var(--brand-primary)] text-white hover:opacity-90 transition-opacity"
            >
              <Link href={`/configurator?product=${p.slug}`}>
                {t('landing.product.configure')}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      ))}

      {/* "Bouw van nul" escape hatch — matches card height via flex. */}
      <Card className="flex flex-col items-center justify-center border-2 border-dashed bg-transparent text-center transition-colors hover:bg-muted/20">
        <CardHeader className="items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)]">
            <PencilRuler
              className="h-6 w-6"
              style={{ color: 'var(--brand-primary)' }}
            />
          </div>
          <CardTitle className="text-xl">{t('landing.blankSlate.title')}</CardTitle>
          <CardDescription className="max-w-xs">
            {t('landing.blankSlate.body')}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild variant="outline">
            <Link href="/configurator?fresh=1">{t('landing.blankSlate.title')}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
