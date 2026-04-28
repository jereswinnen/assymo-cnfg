'use client';
import { Controller, type Control } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { t } from '@/lib/i18n';
import type { MaterialRow } from '@/domain/catalog';
import type { GateSwingDirection } from '@/domain/building';
import type { ProductFormValues } from './productFormSchema';

const SWINGS: readonly GateSwingDirection[] = ['inward', 'outward', 'sliding'] as const;

function parseIntOrUndef(v: string): number | undefined {
  if (v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return undefined;
  return n;
}

function MmHint({ mm }: { mm: number | undefined }) {
  if (mm === undefined) return null;
  const m = (mm / 1000).toLocaleString('nl-BE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
  return (
    <p className="text-xs text-muted-foreground">
      {t('admin.catalog.products.field.poort.mmHint', { mm, m })}
    </p>
  );
}

interface Props {
  control: Control<ProductFormValues>;
  gateMaterials: MaterialRow[];
}

export function GateProductDefaults({ control, gateMaterials }: Props) {
  return (
    <>
      {/* Defaults */}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.catalog.products.field.poort.defaults')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={control}
            name="poortPartCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.catalog.products.field.poort.partCount')}</FormLabel>
                <FormControl>
                  <ToggleGroup
                    type="single"
                    value={field.value === undefined ? '' : String(field.value)}
                    onValueChange={(v) => {
                      if (v === '1') field.onChange(1);
                      else if (v === '2') field.onChange(2);
                      else field.onChange(undefined);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <ToggleGroupItem value="1">1</ToggleGroupItem>
                    <ToggleGroupItem value="2">2</ToggleGroupItem>
                  </ToggleGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="poortPartWidthMm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('admin.catalog.products.field.poort.partWidthMm')}
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="1"
                    inputMode="numeric"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(parseIntOrUndef(e.target.value))}
                  />
                </FormControl>
                <MmHint mm={field.value} />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="poortHeightMm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('admin.catalog.products.field.poort.heightMm')}
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="1"
                    inputMode="numeric"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(parseIntOrUndef(e.target.value))}
                  />
                </FormControl>
                <MmHint mm={field.value} />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="poortSwingDirection"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('admin.catalog.products.field.poort.swingDirection')}
                </FormLabel>
                <FormControl>
                  <ToggleGroup
                    type="single"
                    value={field.value ?? ''}
                    onValueChange={(v) => {
                      if (v === 'inward' || v === 'outward' || v === 'sliding') {
                        field.onChange(v);
                      } else {
                        field.onChange(undefined);
                      }
                    }}
                    variant="outline"
                    size="sm"
                  >
                    {SWINGS.map((s) => (
                      <ToggleGroupItem key={s} value={s}>
                        {t(`configurator.gate.swing.${s}`)}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="poortMotorized"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <FormLabel className="cursor-pointer text-sm">
                  {t('admin.catalog.products.field.poort.motorized')}
                </FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value ?? false}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="poortMaterialSlug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('admin.catalog.products.field.poort.material')}
                </FormLabel>
                <Select
                  value={field.value ?? '__none__'}
                  onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t(
                          'admin.catalog.products.field.poort.material.placeholder',
                        )}
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {t('admin.catalog.products.field.poort.material.placeholder')}
                    </SelectItem>
                    {gateMaterials.map((m) => (
                      <SelectItem key={m.slug} value={m.slug}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Constraints */}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.catalog.products.field.poort.constraints')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Controller
            control={control}
            name="poortPartCountAllowed"
            render={({ field }) => (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {t('admin.catalog.products.field.poort.partCountAllowed')}
                </Label>
                <div className="flex gap-4">
                  {([1, 2] as const).map((n) => {
                    const checked = field.value.includes(n);
                    return (
                      <label key={n} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) => {
                            if (next === true) {
                              field.onChange([...field.value, n].sort());
                            } else {
                              field.onChange(field.value.filter((v) => v !== n));
                            }
                          }}
                        />
                        {n}
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('admin.catalog.products.field.poort.partCountAllowed.hint')}
                </p>
              </div>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={control}
              name="poortPartWidthMinMm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('admin.catalog.products.field.poort.partWidthMinMm')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      inputMode="numeric"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(parseIntOrUndef(e.target.value))}
                    />
                  </FormControl>
                  <MmHint mm={field.value} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="poortPartWidthMaxMm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('admin.catalog.products.field.poort.partWidthMaxMm')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      inputMode="numeric"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(parseIntOrUndef(e.target.value))}
                    />
                  </FormControl>
                  <MmHint mm={field.value} />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={control}
              name="poortHeightMinMm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('admin.catalog.products.field.poort.heightMinMm')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      inputMode="numeric"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(parseIntOrUndef(e.target.value))}
                    />
                  </FormControl>
                  <MmHint mm={field.value} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="poortHeightMaxMm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('admin.catalog.products.field.poort.heightMaxMm')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      inputMode="numeric"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(parseIntOrUndef(e.target.value))}
                    />
                  </FormControl>
                  <MmHint mm={field.value} />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Controller
            control={control}
            name="poortSwingsAllowed"
            render={({ field }) => (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {t('admin.catalog.products.field.poort.swingsAllowed')}
                </Label>
                <div className="flex flex-wrap gap-4">
                  {SWINGS.map((s) => {
                    const checked = field.value.includes(s);
                    return (
                      <label key={s} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) => {
                            if (next === true) {
                              field.onChange([...field.value, s]);
                            } else {
                              field.onChange(field.value.filter((v) => v !== s));
                            }
                          }}
                        />
                        {t(`configurator.gate.swing.${s}`)}
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('admin.catalog.products.field.poort.swingsAllowed.hint')}
                </p>
              </div>
            )}
          />

          <FormField
            control={control}
            name="poortMotorizedAllowed"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('admin.catalog.products.field.poort.motorizedAllowed')}
                </FormLabel>
                <FormControl>
                  <ToggleGroup
                    type="single"
                    value={
                      field.value === undefined ? 'any' : field.value ? 'always' : 'never'
                    }
                    onValueChange={(v) => {
                      if (v === 'always') field.onChange(true);
                      else if (v === 'never') field.onChange(false);
                      else field.onChange(undefined);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <ToggleGroupItem value="any">
                      {t('admin.catalog.products.field.poort.motorizedAllowed.any')}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="always">
                      {t('admin.catalog.products.field.poort.motorizedAllowed.always')}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="never">
                      {t('admin.catalog.products.field.poort.motorizedAllowed.never')}
                    </ToggleGroupItem>
                  </ToggleGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Controller
            control={control}
            name="poortAllowedMaterialSlugs"
            render={({ field }) => (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {t('admin.catalog.products.field.poort.allowedMaterialSlugs')}
                </Label>
                {gateMaterials.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t('admin.catalog.products.field.poort.allowedMaterialSlugs.hint')}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {gateMaterials.map((m) => {
                      const checked = field.value.includes(m.slug);
                      return (
                        <label key={m.slug} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(next) => {
                              if (next === true) {
                                field.onChange([...field.value, m.slug]);
                              } else {
                                field.onChange(field.value.filter((v) => v !== m.slug));
                              }
                            }}
                          />
                          <span
                            className="inline-block h-3 w-3 rounded-sm border"
                            style={{ backgroundColor: m.color }}
                          />
                          {m.name}
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('admin.catalog.products.field.poort.allowedMaterialSlugs.hint')}
                </p>
              </div>
            )}
          />
        </CardContent>
      </Card>
    </>
  );
}
