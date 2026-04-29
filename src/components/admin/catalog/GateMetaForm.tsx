'use client';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import { t } from '@/lib/i18n';
import { Trash2 } from 'lucide-react';

export const GATE_PART_COUNT_VALUES = ['1', '2', 'configurable'] as const;
export const GATE_MOTORIZED_VALUES = ['always', 'never', 'optional'] as const;
export const GATE_GLAZING_VALUES = ['none', 'partial', 'full'] as const;
export const GATE_SWING_VALUES = ['inward', 'outward', 'sliding'] as const;

const optionSchema = z.object({
  sku: z.string().min(1),
  label: z.string().min(1),
  ralCode: z.string().nullable(),
  surchargeEur: z.string(),
});

export const gateFieldsSchema = z.object({
  gatePartCount: z.enum(GATE_PART_COUNT_VALUES).nullable(),
  gateMotorized: z.enum(GATE_MOTORIZED_VALUES).nullable(),
  gateMotorizedSurchargeEur: z.string(),
  gateSwingDirections: z.array(z.enum(GATE_SWING_VALUES)),
  gateDefaultWidthMm: z.number().int().min(0).nullable(),
  gateDefaultHeightMm: z.number().int().min(0).nullable(),
  gateMaxWidthMm: z.number().int().min(0).nullable(),
  gateMaxHeightMm: z.number().int().min(0).nullable(),
  gateGlazing: z.enum(GATE_GLAZING_VALUES).nullable(),
  gateColors: z.array(optionSchema),
  gateLocks: z.array(optionSchema),
  gateHandles: z.array(optionSchema),
});

export type GateFieldsValues = z.infer<typeof gateFieldsSchema>;

export const emptyGateFields: GateFieldsValues = {
  gatePartCount: null,
  gateMotorized: null,
  gateMotorizedSurchargeEur: '',
  gateSwingDirections: [],
  gateDefaultWidthMm: null,
  gateDefaultHeightMm: null,
  gateMaxWidthMm: null,
  gateMaxHeightMm: null,
  gateGlazing: null,
  gateColors: [],
  gateLocks: [],
  gateHandles: [],
};

type OptionListName = 'gateColors' | 'gateLocks' | 'gateHandles';

function OptionList({
  name,
  titleKey,
  showRalCode = false,
}: {
  name: OptionListName;
  titleKey: string;
  showRalCode?: boolean;
}) {
  const form = useFormContext<GateFieldsValues>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t(titleKey)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t('admin.catalog.supplierProducts.gate.option.empty')}
          </p>
        )}
        {fields.map((field, idx) => (
          <div
            key={field.id}
            className="grid gap-2 rounded-md border border-border p-3"
            style={{
              gridTemplateColumns: showRalCode
                ? 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,7rem) auto'
                : 'minmax(0,1fr) minmax(0,1fr) minmax(0,7rem) auto',
            }}
          >
            <FormField
              control={form.control}
              name={`${name}.${idx}.sku` as const}
              render={({ field: f }) => (
                <FormItem>
                  <FormLabel className="text-xs">
                    {t('admin.catalog.supplierProducts.gate.option.sku')}
                  </FormLabel>
                  <FormControl>
                    <Input {...f} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`${name}.${idx}.label` as const}
              render={({ field: f }) => (
                <FormItem>
                  <FormLabel className="text-xs">
                    {t('admin.catalog.supplierProducts.gate.option.label')}
                  </FormLabel>
                  <FormControl>
                    <Input {...f} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {showRalCode && (
              <FormField
                control={form.control}
                name={`${name}.${idx}.ralCode` as const}
                render={({ field: f }) => (
                  <FormItem>
                    <FormLabel className="text-xs">
                      {t('admin.catalog.supplierProducts.gate.option.ral')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        value={(f.value as string | null) ?? ''}
                        onChange={(e) => f.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name={`${name}.${idx}.surchargeEur` as const}
              render={({ field: f }) => (
                <FormItem>
                  <FormLabel className="text-xs">
                    {t('admin.catalog.supplierProducts.gate.option.surcharge')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      {...f}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(idx)}
              aria-label={t('admin.catalog.supplierProducts.gate.option.remove')}
              className="self-end"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({ sku: '', label: '', ralCode: null, surchargeEur: '' })
          }
        >
          {t('admin.catalog.supplierProducts.gate.option.add')}
        </Button>
      </CardContent>
    </Card>
  );
}

export function GateMetaForm() {
  const form = useFormContext<GateFieldsValues>();
  const motorized = form.watch('gateMotorized');

  const swings = form.watch('gateSwingDirections');
  const toggleSwing = (s: (typeof GATE_SWING_VALUES)[number]) => {
    const set = new Set<(typeof GATE_SWING_VALUES)[number]>(swings);
    if (set.has(s)) set.delete(s);
    else set.add(s);
    form.setValue('gateSwingDirections', [...set], { shouldDirty: true });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.catalog.supplierProducts.kind.gate')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={form.control}
          name="gatePartCount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t('admin.catalog.supplierProducts.gate.partCount')}
              </FormLabel>
              <FormControl>
                <ToggleGroup
                  type="single"
                  value={field.value ?? ''}
                  onValueChange={(v) =>
                    field.onChange(v === '' ? null : (v as typeof field.value))
                  }
                  variant="outline"
                  size="sm"
                >
                  <ToggleGroupItem value="1">1</ToggleGroupItem>
                  <ToggleGroupItem value="2">2</ToggleGroupItem>
                  <ToggleGroupItem value="configurable">
                    {t('admin.catalog.supplierProducts.gate.partCount.configurable')}
                  </ToggleGroupItem>
                </ToggleGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="gateMotorized"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t('admin.catalog.supplierProducts.gate.motorized')}
              </FormLabel>
              <Select
                value={field.value ?? '__none__'}
                onValueChange={(v) =>
                  field.onChange(v === '__none__' ? null : (v as typeof field.value))
                }
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {GATE_MOTORIZED_VALUES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`admin.catalog.supplierProducts.gate.motorized.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {motorized === 'optional' && (
          <FormField
            control={form.control}
            name="gateMotorizedSurchargeEur"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('admin.catalog.supplierProducts.gate.motorSurcharge')}
                </FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormItem>
          <FormLabel>
            {t('admin.catalog.supplierProducts.gate.swings')}
          </FormLabel>
          <div className="flex gap-4">
            {GATE_SWING_VALUES.map((s) => (
              <label
                key={s}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={swings.includes(s)}
                  onCheckedChange={() => toggleSwing(s)}
                />
                {t(`configurator.gate.swing.${s}`)}
              </label>
            ))}
          </div>
        </FormItem>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="gateDefaultWidthMm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('admin.catalog.supplierProducts.gate.defaultDims')} (B mm)
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="1"
                    min={0}
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? null : Number(e.target.value))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="gateDefaultHeightMm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('admin.catalog.supplierProducts.gate.defaultDims')} (H mm)
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="1"
                    min={0}
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? null : Number(e.target.value))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="gateMaxWidthMm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('admin.catalog.supplierProducts.gate.maxDims')} (B mm)
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="1"
                    min={0}
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? null : Number(e.target.value))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="gateMaxHeightMm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('admin.catalog.supplierProducts.gate.maxDims')} (H mm)
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="1"
                    min={0}
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? null : Number(e.target.value))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="gateGlazing"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t('admin.catalog.supplierProducts.gate.glazing')}
              </FormLabel>
              <Select
                value={field.value ?? '__none__'}
                onValueChange={(v) =>
                  field.onChange(v === '__none__' ? null : (v as typeof field.value))
                }
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {GATE_GLAZING_VALUES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`admin.catalog.supplierProducts.gate.glazing.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <OptionList
          name="gateColors"
          titleKey="admin.catalog.supplierProducts.gate.colors"
          showRalCode
        />
        <OptionList
          name="gateLocks"
          titleKey="admin.catalog.supplierProducts.gate.locks"
        />
        <OptionList
          name="gateHandles"
          titleKey="admin.catalog.supplierProducts.gate.handles"
        />
      </CardContent>
    </Card>
  );
}
