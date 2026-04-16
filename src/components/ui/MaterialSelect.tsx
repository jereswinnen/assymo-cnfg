'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  resolveCatalog,
  type BaseCatalogEntry,
  type MaterialSlug,
} from '@/domain/materials';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface MaterialSelectProps<T extends BaseCatalogEntry> {
  catalog: readonly T[];
  value: string;
  onChange: (atomId: MaterialSlug) => void;
  /** Show €N/m² on each dropdown item (only meaningful for entries with pricePerSqm). */
  showPrice?: boolean;
  /** Renders the trigger as read-only — used when the value is inherited
   *  from a parent (e.g. building primary material). */
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export default function MaterialSelect<T extends BaseCatalogEntry>({
  catalog,
  value,
  onChange,
  showPrice = false,
  disabled = false,
  className,
  ariaLabel,
}: MaterialSelectProps<T>) {
  const entries = resolveCatalog(catalog);
  const current = entries.find((e) => e.atomId === value);

  return (
    <Select value={value} onValueChange={(v) => onChange(v as MaterialSlug)} disabled={disabled}>
      <SelectTrigger
        className={cn('w-full', className)}
        size="sm"
        aria-label={ariaLabel}
      >
        <SelectValue>
          {current && (
            <>
              <Swatch color={current.atom.color} atomId={current.atomId} />
              <span className="text-xs">{t(current.atom.labelKey)}</span>
            </>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {entries.map((entry) => {
          const price = showPrice
            ? (entry as unknown as { pricePerSqm?: number }).pricePerSqm
            : undefined;
          return (
            <SelectItem key={entry.atomId} value={entry.atomId}>
              <Swatch color={entry.atom.color} atomId={entry.atomId} />
              <span className="text-xs">{t(entry.atom.labelKey)}</span>
              {typeof price === 'number' && (
                <span className="ml-auto pl-3 text-[10px] text-muted-foreground">
                  {'\u20AC'}{price}/m{'\u00B2'}
                </span>
              )}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function Swatch({ color, atomId }: { color: string; atomId: string }) {
  // 'transparent' is the sentinel for the "geen" floor atom — render a blank slot
  // so the row stays aligned without a visible chip.
  if (color === 'transparent') {
    return <span className="h-4 w-4 shrink-0" aria-hidden />;
  }
  return (
    <span
      className="h-4 w-4 shrink-0 rounded-sm border border-border/50"
      style={{
        backgroundColor: color,
        opacity: atomId === 'glass' ? 0.6 : 1,
      }}
      aria-hidden
    />
  );
}
