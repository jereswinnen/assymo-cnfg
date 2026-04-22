'use client';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { t } from '@/lib/i18n';
import type { MaterialRow } from '@/domain/catalog';

interface Props {
  label: string;
  hint?: string;
  options: MaterialRow[];
  value: string[];
  onChange: (next: string[]) => void;
}

export function MaterialMultiSelect({ label, hint, options, value, onChange }: Props) {
  const toggle = (slug: string) => {
    const has = value.includes(slug);
    onChange(has ? value.filter((s) => s !== slug) : [...value, slug]);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between font-normal">
            {value.length === 0
              ? t('admin.catalog.multiselect.placeholderAll')
              : t('admin.catalog.multiselect.placeholderCount', { count: value.length })}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0" align="start">
          <Command>
            <CommandInput placeholder={t('admin.catalog.multiselect.search')} />
            <CommandList>
              <CommandEmpty>{t('admin.catalog.multiselect.empty')}</CommandEmpty>
              <CommandGroup>
                {options.map((m) => {
                  const selected = value.includes(m.slug);
                  return (
                    <CommandItem key={m.slug} onSelect={() => toggle(m.slug)}>
                      <Check
                        className={`mr-2 h-4 w-4 ${selected ? 'opacity-100' : 'opacity-0'}`}
                      />
                      <span
                        className="mr-2 inline-block h-3 w-3 rounded-sm border"
                        style={{ backgroundColor: m.color }}
                      />
                      {m.name}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((slug) => {
            const m = options.find((o) => o.slug === slug);
            return (
              <Badge key={slug} variant="secondary" className="gap-1">
                {m?.name ?? slug}
                <button
                  type="button"
                  onClick={() => toggle(slug)}
                  aria-label={`Remove ${slug}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
