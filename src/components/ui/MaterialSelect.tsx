'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { BaseCatalogEntry } from '@/domain/materials';
import { getAtomColor, getAtom } from '@/domain/materials';
import { useTenant } from '@/lib/TenantProvider';
import { cn } from '@/lib/utils';

interface MaterialSelectProps<T extends BaseCatalogEntry> {
  catalog: readonly T[];
  value: string;
  onChange: (atomId: string) => void;
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
  const { catalog: tenantCatalog } = useTenant();
  const materials = tenantCatalog.materials;

  const currentColor = getAtomColor(materials, value);
  const currentName = getAtom(materials, value)?.name ?? value;

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className={cn('w-full', className)}
        size="sm"
        aria-label={ariaLabel}
      >
        <SelectValue>
          <Swatch color={currentColor} atomId={value} />
          <span className="text-xs">{currentName}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {catalog.map((entry) => {
          const color = getAtomColor(materials, entry.atomId);
          const name = getAtom(materials, entry.atomId)?.name ?? entry.atomId;
          const price = showPrice
            ? (entry as unknown as { pricePerSqm?: number }).pricePerSqm
            : undefined;
          return (
            <SelectItem key={entry.atomId} value={entry.atomId}>
              <Swatch color={color} atomId={entry.atomId} />
              <span className="text-xs">{name}</span>
              {typeof price === 'number' && (
                <span className="ml-auto pl-3 text-[10px] text-muted-foreground">
                  {'€'}{price}/m{'²'}
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
