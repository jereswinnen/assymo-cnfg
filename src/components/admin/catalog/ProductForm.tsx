'use client';
import { useForm, Controller } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
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
import {
  PRODUCT_KINDS,
  normalizeSlug,
  type MaterialRow,
  type ProductRow,
  type ProductSlot,
} from '@/domain/catalog';
import { HeroImageUploadField } from './HeroImageUploadField';
import { MaterialMultiSelect } from './MaterialMultiSelect';
import { GateProductDefaults } from './GateProductDefaults';
import { productFormSchema, type ProductFormValues } from './productFormSchema';

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
  const form = useForm<ProductFormValues>({
    resolver: standardSchemaResolver(productFormSchema),
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
          poortPartCount: initial.defaults.poort?.partCount,
          poortPartWidthMm: initial.defaults.poort?.partWidthMm,
          poortHeightMm: initial.defaults.poort?.heightMm,
          poortSwingDirection: initial.defaults.poort?.swingDirection,
          poortMotorized: initial.defaults.poort?.motorized,
          poortMaterialSlug: initial.defaults.poort?.materialId ?? null,
          poortPartCountAllowed: initial.constraints.poort?.partCountAllowed ?? [],
          poortPartWidthMinMm: initial.constraints.poort?.partWidthMinMm,
          poortPartWidthMaxMm: initial.constraints.poort?.partWidthMaxMm,
          poortHeightMinMm: initial.constraints.poort?.heightMinMm,
          poortHeightMaxMm: initial.constraints.poort?.heightMaxMm,
          poortSwingsAllowed: initial.constraints.poort?.swingsAllowed ?? [],
          poortMotorizedAllowed: initial.constraints.poort?.motorizedAllowed,
          poortAllowedMaterialSlugs: initial.constraints.poort?.allowedMaterialSlugs ?? [],
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
          poortPartCount: undefined,
          poortPartWidthMm: undefined,
          poortHeightMm: undefined,
          poortSwingDirection: undefined,
          poortMotorized: undefined,
          poortMaterialSlug: null,
          poortPartCountAllowed: [],
          poortPartWidthMinMm: undefined,
          poortPartWidthMaxMm: undefined,
          poortHeightMinMm: undefined,
          poortHeightMaxMm: undefined,
          poortSwingsAllowed: [],
          poortMotorizedAllowed: undefined,
          poortAllowedMaterialSlugs: [],
          basePriceEur: null,
          sortOrder: 0,
        },
  });

  const slug = form.watch('slug');
  const kind = form.watch('kind');
  const isPoort = kind === 'poort';

  const byCategory = (cat: MaterialRow['categories'][number]) =>
    materials.filter((m) => m.categories.includes(cat) && !m.archivedAt);

  const wallOpts = byCategory('wall');
  const roofCoverOpts = byCategory('roof-cover');
  const roofTrimOpts = byCategory('roof-trim');
  const floorOpts = byCategory('floor');
  const doorOpts = byCategory('door');
  const gateOpts = byCategory('gate');

  async function onSubmit(values: ProductFormValues) {
    const defaults: Record<string, unknown> = {};
    const cons: Record<string, unknown> = {};

    if (values.kind === 'poort') {
      const poortDefaults: Record<string, unknown> = {};
      if (values.poortPartCount !== undefined) poortDefaults.partCount = values.poortPartCount;
      if (values.poortPartWidthMm !== undefined) poortDefaults.partWidthMm = values.poortPartWidthMm;
      if (values.poortHeightMm !== undefined) poortDefaults.heightMm = values.poortHeightMm;
      if (values.poortSwingDirection !== undefined)
        poortDefaults.swingDirection = values.poortSwingDirection;
      if (values.poortMotorized !== undefined) poortDefaults.motorized = values.poortMotorized;
      if (values.poortMaterialSlug) poortDefaults.materialId = values.poortMaterialSlug;
      if (Object.keys(poortDefaults).length) defaults.poort = poortDefaults;

      const poortCons: Record<string, unknown> = {};
      if (values.poortPartCountAllowed.length)
        poortCons.partCountAllowed = values.poortPartCountAllowed;
      if (values.poortPartWidthMinMm !== undefined)
        poortCons.partWidthMinMm = values.poortPartWidthMinMm;
      if (values.poortPartWidthMaxMm !== undefined)
        poortCons.partWidthMaxMm = values.poortPartWidthMaxMm;
      if (values.poortHeightMinMm !== undefined) poortCons.heightMinMm = values.poortHeightMinMm;
      if (values.poortHeightMaxMm !== undefined) poortCons.heightMaxMm = values.poortHeightMaxMm;
      if (values.poortSwingsAllowed.length) poortCons.swingsAllowed = values.poortSwingsAllowed;
      if (values.poortMotorizedAllowed !== undefined)
        poortCons.motorizedAllowed = values.poortMotorizedAllowed;
      if (values.poortAllowedMaterialSlugs.length)
        poortCons.allowedMaterialSlugs = values.poortAllowedMaterialSlugs;
      if (Object.keys(poortCons).length) cons.poort = poortCons;
    } else {
      const materialsObj: Partial<Record<ProductSlot, string>> = {};
      if (values.wallSlug) materialsObj.wallCladding = values.wallSlug;
      if (values.roofCoverSlug) materialsObj.roofCovering = values.roofCoverSlug;
      if (values.roofTrimSlug) materialsObj.roofTrim = values.roofTrimSlug;
      if (values.floorSlug) materialsObj.floor = values.floorSlug;
      if (values.doorSlug) materialsObj.door = values.doorSlug;

      if (values.width) defaults.width = values.width;
      if (values.depth) defaults.depth = values.depth;
      if (values.height) defaults.height = values.height;
      if (Object.keys(materialsObj).length) defaults.materials = materialsObj;

      const allow: Partial<Record<ProductSlot, string[]>> = {};
      if (values.allowWall.length) allow.wallCladding = values.allowWall;
      if (values.allowRoofCover.length) allow.roofCovering = values.allowRoofCover;
      if (values.allowRoofTrim.length) allow.roofTrim = values.allowRoofTrim;
      if (values.allowFloor.length) allow.floor = values.allowFloor;
      if (values.allowDoor.length) allow.door = values.allowDoor;

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
    }

    const body: Record<string, unknown> = {
      tenantId,
      kind: values.kind,
      slug: values.slug,
      name: values.name,
      description: values.description,
      heroImage: values.heroImage,
      defaults,
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
        toast.error(t('admin.catalog.products.toast.saveFailed'));
      }
      return;
    }

    toast.success(t('admin.catalog.products.toast.saved'));
    router.push('/admin/catalog/products');
    router.refresh();
  }

  async function archive() {
    if (!initial) return;
    const res = await fetch(`/api/admin/products/${initial.id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error(t('admin.catalog.products.toast.archiveFailed'));
      return;
    }
    toast.success(t('admin.catalog.products.toast.archived'));
    router.push('/admin/catalog/products');
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
                    <FormLabel>{t('admin.catalog.products.field.kind')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRODUCT_KINDS.map((k) => (
                          <SelectItem key={k} value={k}>
                            {t(`admin.catalog.products.kind.${k}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

        {isPoort ? (
          <GateProductDefaults control={form.control} gateMaterials={gateOpts} />
        ) : (
          <>
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
                            {byCategory(cat).map((m) => (
                              <SelectItem key={m.slug} value={m.slug}>
                                {m.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
          </>
        )}

        {/* Prijs & volgorde */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.catalog.form.section.priceSort')}</CardTitle>
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
                  <AlertDialogTitle>
                    {t('admin.catalog.products.archive.title')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('admin.catalog.products.archive.description')}
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
