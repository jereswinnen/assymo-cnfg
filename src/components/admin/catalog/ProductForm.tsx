'use client';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import {
  PRODUCT_KINDS,
  normalizeSlug,
  type MaterialRow,
  type ProductKind,
  type ProductRow,
  type ProductSlot,
} from '@/domain/catalog';
import { HeroImageUploadField } from './HeroImageUploadField';
import { MaterialMultiSelect } from './MaterialMultiSelect';

const schema = z.object({
  kind: z.enum(PRODUCT_KINDS as unknown as [ProductKind, ...ProductKind[]]),
  slug: z.string().min(1).max(48),
  name: z.string().min(1).max(100),
  description: z.string().max(1000).nullable(),
  heroImage: z.string().nullable(),
  width: z.number().nullable(),
  depth: z.number().nullable(),
  height: z.number().nullable(),
  wallSlug: z.string().nullable(),
  roofCoverSlug: z.string().nullable(),
  roofTrimSlug: z.string().nullable(),
  floorSlug: z.string().nullable(),
  doorSlug: z.string().nullable(),
  minWidth: z.number().nullable(),
  maxWidth: z.number().nullable(),
  minDepth: z.number().nullable(),
  maxDepth: z.number().nullable(),
  minHeight: z.number().nullable(),
  maxHeight: z.number().nullable(),
  allowWall: z.array(z.string()),
  allowRoofCover: z.array(z.string()),
  allowRoofTrim: z.array(z.string()),
  allowFloor: z.array(z.string()),
  allowDoor: z.array(z.string()),
  basePriceEur: z.number().nullable(),
  sortOrder: z.number().int(),
});

type FormValues = z.infer<typeof schema>;

export function ProductForm({
  tenantId,
  initial,
  mode,
  materials,
}: {
  tenantId: string;
  initial?: ProductRow;
  mode: 'create' | 'edit';
  materials: MaterialRow[];
}) {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          kind: initial.kind,
          slug: initial.slug,
          name: initial.name,
          description: initial.description,
          heroImage: initial.heroImage,
          width: initial.defaults.width ?? null,
          depth: initial.defaults.depth ?? null,
          height: initial.defaults.height ?? null,
          wallSlug: initial.defaults.materials?.wallCladding ?? null,
          roofCoverSlug: initial.defaults.materials?.roofCovering ?? null,
          roofTrimSlug: initial.defaults.materials?.roofTrim ?? null,
          floorSlug: initial.defaults.materials?.floor ?? null,
          doorSlug: initial.defaults.materials?.door ?? null,
          minWidth: initial.constraints.minWidth ?? null,
          maxWidth: initial.constraints.maxWidth ?? null,
          minDepth: initial.constraints.minDepth ?? null,
          maxDepth: initial.constraints.maxDepth ?? null,
          minHeight: initial.constraints.minHeight ?? null,
          maxHeight: initial.constraints.maxHeight ?? null,
          allowWall: initial.constraints.allowedMaterialsBySlot?.wallCladding ?? [],
          allowRoofCover: initial.constraints.allowedMaterialsBySlot?.roofCovering ?? [],
          allowRoofTrim: initial.constraints.allowedMaterialsBySlot?.roofTrim ?? [],
          allowFloor: initial.constraints.allowedMaterialsBySlot?.floor ?? [],
          allowDoor: initial.constraints.allowedMaterialsBySlot?.door ?? [],
          basePriceEur: initial.basePriceCents > 0 ? initial.basePriceCents / 100 : null,
          sortOrder: initial.sortOrder,
        }
      : {
          kind: 'overkapping',
          slug: '',
          name: '',
          description: null,
          heroImage: null,
          width: null,
          depth: null,
          height: null,
          wallSlug: null,
          roofCoverSlug: null,
          roofTrimSlug: null,
          floorSlug: null,
          doorSlug: null,
          minWidth: null,
          maxWidth: null,
          minDepth: null,
          maxDepth: null,
          minHeight: null,
          maxHeight: null,
          allowWall: [],
          allowRoofCover: [],
          allowRoofTrim: [],
          allowFloor: [],
          allowDoor: [],
          basePriceEur: null,
          sortOrder: 0,
        },
  });

  const slug = form.watch('slug');

  const byCategory = (cat: MaterialRow['category']) =>
    materials.filter((m) => m.category === cat && !m.archivedAt);

  const wallOpts = byCategory('wall');
  const roofCoverOpts = byCategory('roof-cover');
  const roofTrimOpts = byCategory('roof-trim');
  const floorOpts = byCategory('floor');
  const doorOpts = byCategory('door');

  async function onSubmit(values: FormValues) {
    const materialsObj: Partial<Record<ProductSlot, string>> = {};
    if (values.wallSlug) materialsObj.wallCladding = values.wallSlug;
    if (values.roofCoverSlug) materialsObj.roofCovering = values.roofCoverSlug;
    if (values.roofTrimSlug) materialsObj.roofTrim = values.roofTrimSlug;
    if (values.floorSlug) materialsObj.floor = values.floorSlug;
    if (values.doorSlug) materialsObj.door = values.doorSlug;

    const dims: Record<string, number> = {};
    if (values.width) dims.width = values.width;
    if (values.depth) dims.depth = values.depth;
    if (values.height) dims.height = values.height;

    const allow: Partial<Record<ProductSlot, string[]>> = {};
    if (values.allowWall.length) allow.wallCladding = values.allowWall;
    if (values.allowRoofCover.length) allow.roofCovering = values.allowRoofCover;
    if (values.allowRoofTrim.length) allow.roofTrim = values.allowRoofTrim;
    if (values.allowFloor.length) allow.floor = values.allowFloor;
    if (values.allowDoor.length) allow.door = values.allowDoor;

    const cons: Record<string, unknown> = {};
    for (const k of [
      'minWidth',
      'maxWidth',
      'minDepth',
      'maxDepth',
      'minHeight',
      'maxHeight',
    ] as const) {
      const v = values[k];
      if (v !== null) cons[k] = v;
    }
    if (Object.keys(allow).length) cons.allowedMaterialsBySlot = allow;

    const body: Record<string, unknown> = {
      kind: values.kind,
      slug: values.slug,
      name: values.name,
      description: values.description,
      heroImage: values.heroImage,
      defaults: {
        ...dims,
        ...(Object.keys(materialsObj).length ? { materials: materialsObj } : {}),
      },
      constraints: cons,
      basePriceCents: values.basePriceEur ? Math.round(values.basePriceEur * 100) : 0,
      sortOrder: values.sortOrder,
    };

    const url =
      mode === 'create' ? '/api/admin/products' : `/api/admin/products/${initial!.id}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';
    if (mode === 'edit') delete body.kind;

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      if (Array.isArray(payload?.details)) {
        for (const e of payload.details as { field: string; code: string }[]) {
          const msg = t(`admin.catalog.products.error.${e.code}`);
          toast.error(msg);
        }
      } else {
        toast.error('Opslaan mislukt');
      }
      return;
    }

    toast.success('Opgeslagen');
    router.push('/admin/catalog/products');
    router.refresh();
  }

  async function archive() {
    if (!initial) return;
    const res = await fetch(`/api/admin/products/${initial.id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Archiveren mislukt');
      return;
    }
    toast.success('Gearchiveerd');
    router.push('/admin/catalog/products');
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
        {/* Basis */}
        <Card>
          <CardHeader>
            <CardTitle>Basis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === 'create' && (
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.catalog.products.field.kind')}</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      >
                        {PRODUCT_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {t(`admin.catalog.products.kind.${k}`)}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.catalog.products.field.name')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onBlur={(e) => {
                        field.onBlur();
                        if (!slug) form.setValue('slug', normalizeSlug(e.target.value));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.catalog.products.field.slug')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.catalog.products.field.description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
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
                  label={t('admin.catalog.products.field.heroImage')}
                  value={field.value}
                  onChange={field.onChange}
                  tenantId={tenantId}
                  slug={slug || 'draft'}
                />
              )}
            />
          </CardContent>
        </Card>

        {/* Standaardwaarden */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.catalog.products.field.defaults')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {(['width', 'depth', 'height'] as const).map((k) => (
                <FormField
                  key={k}
                  control={form.control}
                  name={k}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t(`admin.catalog.products.field.defaults.${k}`)}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === '' ? null : Number(e.target.value),
                            )
                          }
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ))}
            </div>

            {(
              [
                ['wallSlug', 'wall', 'defaults.wall'],
                ['roofCoverSlug', 'roof-cover', 'defaults.roofCover'],
                ['roofTrimSlug', 'roof-trim', 'defaults.roofTrim'],
                ['floorSlug', 'floor', 'defaults.floor'],
                ['doorSlug', 'door', 'defaults.door'],
              ] as const
            ).map(([name, cat, labelKey]) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t(`admin.catalog.products.field.${labelKey}`)}
                    </FormLabel>
                    <FormControl>
                      <select
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      >
                        <option value="">—</option>
                        {byCategory(cat).map((m) => (
                          <option key={m.slug} value={m.slug}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                  </FormItem>
                )}
              />
            ))}
          </CardContent>
        </Card>

        {/* Grenzen */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.catalog.products.field.constraints')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  ['minWidth', 'constraints.minWidth'],
                  ['maxWidth', 'constraints.maxWidth'],
                  ['minDepth', 'constraints.minDepth'],
                  ['maxDepth', 'constraints.maxDepth'],
                  ['minHeight', 'constraints.minHeight'],
                  ['maxHeight', 'constraints.maxHeight'],
                ] as const
              ).map(([k, labelKey]) => (
                <FormField
                  key={k}
                  control={form.control}
                  name={k}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t(`admin.catalog.products.field.${labelKey}`)}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === '' ? null : Number(e.target.value),
                            )
                          }
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ))}
            </div>

            {(
              [
                ['allowWall', wallOpts, 'constraints.allowed.wall'],
                ['allowRoofCover', roofCoverOpts, 'constraints.allowed.roofCover'],
                ['allowRoofTrim', roofTrimOpts, 'constraints.allowed.roofTrim'],
                ['allowFloor', floorOpts, 'constraints.allowed.floor'],
                ['allowDoor', doorOpts, 'constraints.allowed.door'],
              ] as const
            ).map(([name, opts, labelKey]) => (
              <Controller
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <MaterialMultiSelect
                    label={t(`admin.catalog.products.field.${labelKey}`)}
                    hint={t('admin.catalog.products.field.constraints.allowed.hint')}
                    options={opts}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            ))}
          </CardContent>
        </Card>

        {/* Prijs & volgorde */}
        <Card>
          <CardHeader>
            <CardTitle>Prijs &amp; volgorde</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="basePriceEur"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.catalog.products.field.basePrice')} (€)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      min={0}
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === '' ? null : Number(e.target.value),
                        )
                      }
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sortOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.catalog.products.field.sortOrder')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {t('admin.catalog.products.action.save')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/catalog/products')}
          >
            {t('admin.catalog.products.action.cancel')}
          </Button>
          {mode === 'edit' && !initial?.archivedAt && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" className="ml-auto">
                  {t('admin.catalog.products.action.archive')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Product archiveren?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Historische bestellingen blijven bewaard, maar het product verschijnt niet
                    meer op de landingspagina.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {t('admin.catalog.products.action.cancel')}
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={archive}>
                    {t('admin.catalog.products.action.archive')}
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
