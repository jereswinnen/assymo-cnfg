'use client';
import { Controller, useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { t } from '@/lib/i18n';
import type {
  SupplierProductRow,
  SupplierProductKind,
  DoorMeta,
  WindowMeta,
  GateMeta,
  GateMetaOption,
} from '@/domain/supplier';
import { HeroImageUploadField } from './HeroImageUploadField';
import {
  GateMetaForm,
  emptyGateFields,
  gateFieldsSchema,
  type GateFieldsValues,
} from './GateMetaForm';

/** Accept "1234,56" or "1234.56"; blank → 0. Returns cents. */
function parseEuroToCents(input: string): number {
  const cleaned = input.replace(/\s/g, '').replace(',', '.');
  const n = Number(cleaned);
  if (!isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function centsToEuroInput(cents: number): string {
  if (cents <= 0) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

function mmToMDisplay(mm: number): string {
  return `${mm} mm = ${(mm / 1000).toFixed(3).replace(/\.?0+$/, '')} m`;
}

const KINDS: SupplierProductKind[] = ['door', 'window', 'gate'];

const DOOR_SWING = ['inward', 'outward', 'none'] as const;
const DOOR_LOCK = ['cylinder', 'multipoint', 'none'] as const;
const DOOR_GLAZING = ['solid', 'glass-panel', 'half-glass'] as const;
const WINDOW_GLAZING = ['double', 'triple', 'single'] as const;

const baseSchema = z.object({
  kind: z.enum(['door', 'window', 'gate']),
  sku: z.string().min(1),
  name: z.string().min(1).max(100),
  heroImage: z.string().nullable(),
  widthMm: z.number().int().min(1).max(10000),
  heightMm: z.number().int().min(1).max(10000),
  priceEur: z.string(),
  sortOrder: z.number().int().min(0),
  // Door meta
  swingDirection: z.enum(DOOR_SWING).nullable(),
  lockType: z.enum(DOOR_LOCK).nullable(),
  glazing: z.enum(DOOR_GLAZING).nullable(),
  rValue: z.number().min(0).nullable(),
  // Window meta
  glazingType: z.enum(WINDOW_GLAZING).nullable(),
  uValue: z.number().min(0).nullable(),
  frameMaterial: z.string().nullable(),
  openable: z.boolean(),
  segmentsEnabled: z.boolean(),
  segmentsAutoThresholdMm: z.number().int().nonnegative().nullable(),
  segmentsPerAdditionalThresholdMm: z.number().int().positive().nullable(),
  segmentsMaxCount: z.number().int().positive().nullable(),
  segmentsSurchargeEur: z.string(),
  schuifraamEnabled: z.boolean(),
  schuifraamSurchargeEur: z.string(),
  // Shared
  leadTimeDays: z.number().int().min(0).nullable(),
}).extend(gateFieldsSchema.shape).superRefine((values, ctx) => {
  if (values.kind === 'window' && values.segmentsEnabled) {
    if (values.segmentsAutoThresholdMm == null || values.segmentsAutoThresholdMm <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['segmentsAutoThresholdMm'],
        message: 'required when segments enabled',
      });
    }
  }
});

type FormValues = z.infer<typeof baseSchema>;

function gateOptionToFormFields(
  o: GateMetaOption,
): GateFieldsValues['gateColors'][number] {
  return {
    sku: o.sku,
    label: o.label ?? '',
    ralCode: o.ralCode ?? null,
    surchargeEur: centsToEuroInput(o.surchargeCents ?? 0),
  };
}

function gateFieldsFromMeta(meta: GateMeta): GateFieldsValues {
  const motorized: GateFieldsValues['gateMotorized'] =
    meta.motorized === true
      ? 'always'
      : meta.motorized === false
        ? 'never'
        : meta.motorized === 'optional'
          ? 'optional'
          : null;
  const partCount: GateFieldsValues['gatePartCount'] =
    meta.partCount === 1
      ? '1'
      : meta.partCount === 2
        ? '2'
        : meta.partCount === 'configurable'
          ? 'configurable'
          : null;
  return {
    gatePartCount: partCount,
    gateMotorized: motorized,
    gateMotorizedSurchargeEur: centsToEuroInput(meta.motorizedSurchargeCents ?? 0),
    gateSwingDirections: meta.swingDirections ?? [],
    gateDefaultWidthMm: meta.defaultDimensions?.widthMm ?? null,
    gateDefaultHeightMm: meta.defaultDimensions?.heightMm ?? null,
    gateMaxWidthMm: meta.maxDimensions?.widthMm ?? null,
    gateMaxHeightMm: meta.maxDimensions?.heightMm ?? null,
    gateGlazing: meta.glazing ?? null,
    gateColors: (meta.availableColors ?? []).map(gateOptionToFormFields),
    gateLocks: (meta.availableLocks ?? []).map(gateOptionToFormFields),
    gateHandles: (meta.availableHandles ?? []).map(gateOptionToFormFields),
  };
}

function defaultsFromRow(p: SupplierProductRow): FormValues {
  const doorMeta = p.kind === 'door' ? (p.meta as DoorMeta) : ({} as DoorMeta);
  const winMeta = p.kind === 'window' ? (p.meta as WindowMeta) : ({} as WindowMeta);
  const gateFields =
    p.kind === 'gate' ? gateFieldsFromMeta(p.meta as GateMeta) : emptyGateFields;
  return {
    kind: p.kind,
    sku: p.sku,
    name: p.name,
    heroImage: p.heroImage,
    widthMm: p.widthMm,
    heightMm: p.heightMm,
    priceEur: centsToEuroInput(p.priceCents),
    sortOrder: p.sortOrder,
    swingDirection: doorMeta.swingDirection ?? null,
    lockType: doorMeta.lockType ?? null,
    glazing: doorMeta.glazing ?? null,
    rValue: doorMeta.rValue ?? null,
    glazingType: winMeta.glazingType ?? null,
    uValue: winMeta.uValue ?? null,
    frameMaterial: winMeta.frameMaterial ?? null,
    openable: winMeta.openable ?? false,
    segmentsEnabled: !!winMeta.segments?.enabled,
    segmentsAutoThresholdMm: winMeta.segments?.autoThresholdMm ?? null,
    segmentsPerAdditionalThresholdMm: winMeta.segments?.perAdditionalThresholdMm ?? null,
    segmentsMaxCount: winMeta.segments?.maxCount ?? null,
    segmentsSurchargeEur:
      winMeta.segments?.surchargeCentsPerDivider != null
        ? centsToEuroInput(winMeta.segments.surchargeCentsPerDivider)
        : '',
    schuifraamEnabled: !!winMeta.schuifraam?.enabled,
    schuifraamSurchargeEur:
      winMeta.schuifraam?.surchargeCents != null
        ? centsToEuroInput(winMeta.schuifraam.surchargeCents)
        : '',
    leadTimeDays: doorMeta.leadTimeDays ?? winMeta.leadTimeDays ?? null,
    ...gateFields,
  };
}

function emptyDefaults(kind: SupplierProductKind): FormValues {
  return {
    kind,
    sku: '',
    name: '',
    heroImage: null,
    widthMm: 900,
    heightMm: 2100,
    priceEur: '',
    sortOrder: 0,
    swingDirection: null,
    lockType: null,
    glazing: null,
    rValue: null,
    glazingType: null,
    uValue: null,
    frameMaterial: null,
    openable: false,
    segmentsEnabled: false,
    segmentsAutoThresholdMm: null,
    segmentsPerAdditionalThresholdMm: null,
    segmentsMaxCount: null,
    segmentsSurchargeEur: '',
    schuifraamEnabled: false,
    schuifraamSurchargeEur: '',
    leadTimeDays: null,
    ...emptyGateFields,
  };
}

export function SupplierProductForm({
  tenantId,
  supplierId,
  initial,
  mode,
  defaultKind = 'door',
}: {
  tenantId: string;
  supplierId: string;
  initial?: SupplierProductRow;
  mode: 'create' | 'edit';
  defaultKind?: SupplierProductKind;
}) {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(baseSchema),
    defaultValues: initial ? defaultsFromRow(initial) : emptyDefaults(defaultKind),
  });

  const kind = form.watch('kind');
  const widthMm = form.watch('widthMm');
  const heightMm = form.watch('heightMm');

  async function onSubmit(values: FormValues) {
    const priceCents = parseEuroToCents(values.priceEur);

    const meta: Record<string, unknown> = {};
    if (values.kind === 'door') {
      if (values.swingDirection) meta.swingDirection = values.swingDirection;
      if (values.lockType) meta.lockType = values.lockType;
      if (values.glazing) meta.glazing = values.glazing;
      if (values.rValue !== null) meta.rValue = values.rValue;
      if (values.leadTimeDays !== null) meta.leadTimeDays = values.leadTimeDays;
    } else if (values.kind === 'window') {
      if (values.glazingType) meta.glazingType = values.glazingType;
      if (values.uValue !== null) meta.uValue = values.uValue;
      if (values.frameMaterial) meta.frameMaterial = values.frameMaterial;
      meta.openable = values.openable;
      if (values.leadTimeDays !== null) meta.leadTimeDays = values.leadTimeDays;
      if (values.segmentsEnabled) {
        const seg: Record<string, unknown> = {
          enabled: true,
          autoThresholdMm: values.segmentsAutoThresholdMm!,
        };
        if (values.segmentsPerAdditionalThresholdMm != null) {
          seg.perAdditionalThresholdMm = values.segmentsPerAdditionalThresholdMm;
        }
        if (values.segmentsMaxCount != null) {
          seg.maxCount = values.segmentsMaxCount;
        }
        const segCents = parseEuroToCents(values.segmentsSurchargeEur);
        if (segCents > 0) seg.surchargeCentsPerDivider = segCents;
        meta.segments = seg;
      }
      if (values.schuifraamEnabled) {
        const sf: Record<string, unknown> = { enabled: true };
        const sfCents = parseEuroToCents(values.schuifraamSurchargeEur);
        if (sfCents > 0) sf.surchargeCents = sfCents;
        meta.schuifraam = sf;
      }
    } else {
      // kind === 'gate'
      if (values.gatePartCount) {
        meta.partCount =
          values.gatePartCount === '1'
            ? 1
            : values.gatePartCount === '2'
              ? 2
              : 'configurable';
      }
      if (values.gateMotorized) {
        meta.motorized =
          values.gateMotorized === 'always'
            ? true
            : values.gateMotorized === 'never'
              ? false
              : 'optional';
      }
      if (values.gateMotorized === 'optional') {
        const cents = parseEuroToCents(values.gateMotorizedSurchargeEur);
        if (cents > 0) meta.motorizedSurchargeCents = cents;
      }
      if (values.gateSwingDirections.length > 0) {
        meta.swingDirections = values.gateSwingDirections;
      }
      if (values.gateDefaultWidthMm && values.gateDefaultHeightMm) {
        meta.defaultDimensions = {
          widthMm: values.gateDefaultWidthMm,
          heightMm: values.gateDefaultHeightMm,
        };
      }
      if (values.gateMaxWidthMm && values.gateMaxHeightMm) {
        meta.maxDimensions = {
          widthMm: values.gateMaxWidthMm,
          heightMm: values.gateMaxHeightMm,
        };
      }
      if (values.gateGlazing) meta.glazing = values.gateGlazing;
      const optionToMeta = (
        o: GateFieldsValues['gateColors'][number],
      ): GateMetaOption => {
        const out: GateMetaOption = { sku: o.sku, label: o.label };
        if (o.ralCode) out.ralCode = o.ralCode;
        const cents = parseEuroToCents(o.surchargeEur);
        if (cents > 0) out.surchargeCents = cents;
        return out;
      };
      if (values.gateColors.length > 0) {
        meta.availableColors = values.gateColors.map(optionToMeta);
      }
      if (values.gateLocks.length > 0) {
        meta.availableLocks = values.gateLocks.map(optionToMeta);
      }
      if (values.gateHandles.length > 0) {
        meta.availableHandles = values.gateHandles.map(optionToMeta);
      }
    }

    const body: Record<string, unknown> = {
      sku: values.sku,
      name: values.name,
      heroImage: values.heroImage,
      widthMm: values.widthMm,
      heightMm: values.heightMm,
      priceCents,
      meta,
      sortOrder: values.sortOrder,
    };

    if (mode === 'create') {
      body.kind = values.kind;
    }

    const url =
      mode === 'create'
        ? `/api/admin/suppliers/${supplierId}/products`
        : `/api/admin/supplier-products/${initial!.id}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      if (Array.isArray(payload?.details)) {
        for (const e of payload.details as (string | { field?: string; code?: string })[]) {
          const code = typeof e === 'string' ? e : (e as { code?: string }).code ?? 'unknown';
          const field = typeof e === 'string' ? undefined : (e as { field?: string }).field;
          const msg = t(`admin.catalog.supplierProducts.error.${code}`);
          if (field === 'sku') {
            form.setError('sku', { message: msg });
          } else {
            toast.error(msg);
          }
        }
      } else {
        toast.error(t('admin.catalog.supplierProducts.toast.saveFailed'));
      }
      return;
    }

    toast.success(t('admin.catalog.supplierProducts.toast.saved'));
    router.push(`/admin/catalog/suppliers/${supplierId}`);
    router.refresh();
  }

  async function archive() {
    if (!initial) return;
    const res = await fetch(
      `/api/admin/supplier-products/${initial.id}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      toast.error(t('admin.catalog.supplierProducts.toast.archiveFailed'));
      return;
    }
    toast.success(t('admin.catalog.supplierProducts.toast.archived'));
    router.push(`/admin/catalog/suppliers/${supplierId}`);
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
        {/* Basis */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.catalog.form.section.basics')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === 'create' && (
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.catalog.supplierProducts.field.kind')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {KINDS.map((k) => (
                          <SelectItem key={k} value={k}>
                            {t(`admin.catalog.supplierProducts.kind.${k}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {mode === 'edit' && (
              <div className="text-sm text-muted-foreground">
                {t('admin.catalog.supplierProducts.field.kind')}:{' '}
                <span className="font-medium text-foreground">
                  {t(`admin.catalog.supplierProducts.kind.${kind}`)}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.catalog.supplierProducts.field.sku')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.catalog.supplierProducts.field.sortOrder')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        min={0}
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.catalog.supplierProducts.field.name')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Controller
              control={form.control}
              name="heroImage"
              render={({ field }) => (
                <HeroImageUploadField
                  label={t('admin.catalog.supplierProducts.field.heroImage')}
                  value={field.value}
                  onChange={field.onChange}
                  tenantId={tenantId}
                  slug={form.watch('sku') || 'draft'}
                  uploadUrl="/api/admin/uploads/supplier-images"
                  pathPrefix="supplier"
                />
              )}
            />
          </CardContent>
        </Card>

        {/* Afmetingen & prijs */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.catalog.form.section.dimensionsPrice')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="widthMm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.catalog.supplierProducts.field.widthMm')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        min={1}
                        max={10000}
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    {widthMm > 0 && (
                      <FormDescription>{mmToMDisplay(widthMm)}</FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="heightMm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.catalog.supplierProducts.field.heightMm')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        min={1}
                        max={10000}
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    {heightMm > 0 && (
                      <FormDescription>{mmToMDisplay(heightMm)}</FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="priceEur"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.catalog.supplierProducts.field.price')} (€)</FormLabel>
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
          </CardContent>
        </Card>

        {/* Kind-specific meta */}
        {kind === 'door' && (
          <Card>
            <CardHeader>
              <CardTitle>{t(`admin.catalog.supplierProducts.kind.door`)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="swingDirection"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.catalog.supplierProducts.field.swingDirection')}</FormLabel>
                    <Select
                      value={field.value ?? '__none__'}
                      onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {DOOR_SWING.map((v) => (
                          <SelectItem key={v} value={v}>
                            {t(`admin.catalog.supplierProducts.field.swingDirection.${v}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lockType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.catalog.supplierProducts.field.lockType')}</FormLabel>
                    <Select
                      value={field.value ?? '__none__'}
                      onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {DOOR_LOCK.map((v) => (
                          <SelectItem key={v} value={v}>
                            {t(`admin.catalog.supplierProducts.field.lockType.${v}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="glazing"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.catalog.supplierProducts.field.glazing')}</FormLabel>
                    <Select
                      value={field.value ?? '__none__'}
                      onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {DOOR_GLAZING.map((v) => (
                          <SelectItem key={v} value={v}>
                            {t(`admin.catalog.supplierProducts.field.glazing.${v}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="rValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.catalog.supplierProducts.field.rValue')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
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
                  name="leadTimeDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.catalog.supplierProducts.field.leadTimeDays')}</FormLabel>
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
            </CardContent>
          </Card>
        )}

        {kind === 'window' && (
          <Card>
            <CardHeader>
              <CardTitle>{t(`admin.catalog.supplierProducts.kind.window`)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="glazingType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.catalog.supplierProducts.field.glazingType')}</FormLabel>
                    <Select
                      value={field.value ?? '__none__'}
                      onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {WINDOW_GLAZING.map((v) => (
                          <SelectItem key={v} value={v}>
                            {t(`admin.catalog.supplierProducts.field.glazingType.${v}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="frameMaterial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.catalog.supplierProducts.field.frameMaterial')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="uValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.catalog.supplierProducts.field.uValue')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
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
                  name="leadTimeDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.catalog.supplierProducts.field.leadTimeDays')}</FormLabel>
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
                name="openable"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="cursor-pointer">
                      {t('admin.catalog.supplierProducts.field.openable')}
                    </FormLabel>
                  </FormItem>
                )}
              />

              <hr className="border-border" />

              <FormField
                control={form.control}
                name="segmentsEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="cursor-pointer">
                      {t('admin.catalog.supplierProducts.field.segments.enabled')}
                    </FormLabel>
                  </FormItem>
                )}
              />
              {form.watch('segmentsEnabled') && (
                <div className="grid grid-cols-2 gap-4 pl-6">
                  <FormField
                    control={form.control}
                    name="segmentsAutoThresholdMm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('admin.catalog.supplierProducts.field.segments.autoThresholdMm')}</FormLabel>
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
                    name="segmentsPerAdditionalThresholdMm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('admin.catalog.supplierProducts.field.segments.perAdditionalThresholdMm')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="1"
                            min={1}
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
                    name="segmentsMaxCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('admin.catalog.supplierProducts.field.segments.maxCount')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="1"
                            min={1}
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
                    name="segmentsSurchargeEur"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('admin.catalog.supplierProducts.field.segments.surchargeEur')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <hr className="border-border" />

              <FormField
                control={form.control}
                name="schuifraamEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="cursor-pointer">
                      {t('admin.catalog.supplierProducts.field.schuifraam.enabled')}
                    </FormLabel>
                  </FormItem>
                )}
              />
              {form.watch('schuifraamEnabled') && (
                <div className="pl-6">
                  <FormField
                    control={form.control}
                    name="schuifraamSurchargeEur"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('admin.catalog.supplierProducts.field.schuifraam.surchargeEur')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {kind === 'gate' && <GateMetaForm />}

        {/* Footer */}
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {t('admin.catalog.supplierProducts.action.save')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/admin/catalog/suppliers/${supplierId}`)}
          >
            {t('admin.catalog.supplierProducts.action.cancel')}
          </Button>
          {mode === 'edit' && !initial?.archivedAt && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" className="ml-auto">
                  {t('admin.catalog.supplierProducts.action.archive')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t('admin.catalog.supplierProducts.archive.title')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('admin.catalog.supplierProducts.archive.description')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {t('admin.catalog.supplierProducts.action.cancel')}
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={archive}>
                    {t('admin.catalog.supplierProducts.action.archive')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </form>
    </Form>
  );
}
