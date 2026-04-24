'use client';
import { useForm } from 'react-hook-form';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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
  MATERIAL_CATEGORIES,
  normalizeSlug,
  type MaterialCategory,
  type MaterialPricing,
  type MaterialRow,
} from '@/domain/catalog';
import { TextureUploadField } from './TextureUploadField';

const schema = z.object({
  categories: z.array(z.enum(MATERIAL_CATEGORIES as unknown as [MaterialCategory, ...MaterialCategory[]])).min(1),
  slug: z.string().min(1).max(48),
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textureColor: z.string().nullable(),
  textureNormal: z.string().nullable(),
  textureRoughness: z.string().nullable(),
  tileWidth: z.number().nullable(),
  tileHeight: z.number().nullable(),
  priceWall: z.number().nullable(),
  priceRoofCover: z.number().nullable(),
  priceFloor: z.number().nullable(),
  priceDoor: z.number().nullable(),
  clearsOpenings: z.boolean(),
  isVoid: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function MaterialForm({
  tenantId,
  initial,
  mode,
}: {
  tenantId: string;
  initial?: MaterialRow;
  mode: 'create' | 'edit';
}) {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: initial
      ? {
          categories: initial.categories,
          slug: initial.slug,
          name: initial.name,
          color: initial.color,
          textureColor: initial.textures?.color ?? null,
          textureNormal: initial.textures?.normal ?? null,
          textureRoughness: initial.textures?.roughness ?? null,
          tileWidth: initial.tileSize?.[0] ?? null,
          tileHeight: initial.tileSize?.[1] ?? null,
          priceWall: initial.pricing.wall?.perSqm ?? null,
          priceRoofCover: initial.pricing['roof-cover']?.perSqm ?? null,
          priceFloor: initial.pricing.floor?.perSqm ?? null,
          priceDoor: initial.pricing.door?.surcharge ?? null,
          clearsOpenings: initial.flags.clearsOpenings ?? false,
          isVoid: initial.flags.isVoid ?? false,
        }
      : {
          categories: ['wall'],
          slug: '',
          name: '',
          color: '#888888',
          textureColor: null,
          textureNormal: null,
          textureRoughness: null,
          tileWidth: null,
          tileHeight: null,
          priceWall: null,
          priceRoofCover: null,
          priceFloor: null,
          priceDoor: null,
          clearsOpenings: false,
          isVoid: false,
        },
  });

  const categories = form.watch('categories');
  const slug = form.watch('slug');

  const hasWall = categories.includes('wall');
  const hasRoofCover = categories.includes('roof-cover');
  const hasFloor = categories.includes('floor');
  const hasDoor = categories.includes('door');

  async function onSubmit(values: FormValues) {
    const pricing: MaterialPricing = {};
    if (values.categories.includes('wall')) pricing.wall = { perSqm: values.priceWall ?? 0 };
    if (values.categories.includes('roof-cover')) pricing['roof-cover'] = { perSqm: values.priceRoofCover ?? 0 };
    if (values.categories.includes('floor')) pricing.floor = { perSqm: values.priceFloor ?? 0 };
    if (values.categories.includes('door')) pricing.door = { surcharge: values.priceDoor ?? 0 };

    const body: Record<string, unknown> = {
      tenantId,
      categories: values.categories,
      slug: values.slug,
      name: values.name,
      color: values.color,
      pricing,
      flags: {
        ...(values.categories.includes('wall') && values.clearsOpenings ? { clearsOpenings: true } : {}),
        ...(values.categories.includes('floor') && values.isVoid ? { isVoid: true } : {}),
      },
      textures:
        values.textureColor && values.textureNormal && values.textureRoughness
          ? {
              color: values.textureColor,
              normal: values.textureNormal,
              roughness: values.textureRoughness,
            }
          : null,
      tileSize:
        values.tileWidth && values.tileHeight ? [values.tileWidth, values.tileHeight] : null,
    };

    const url =
      mode === 'create' ? '/api/admin/materials' : `/api/admin/materials/${initial!.id}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      if (Array.isArray(payload?.details)) {
        for (const e of payload.details as { field: string; code: string }[]) {
          const msg = t(`admin.catalog.materials.error.${e.code}`);
          const field = e.field as keyof FormValues;
          if (field in values) {
            form.setError(field, { message: msg });
          } else {
            toast.error(msg);
          }
        }
      } else {
        toast.error(t('admin.catalog.materials.toast.saveFailed'));
      }
      return;
    }

    toast.success(t('admin.catalog.materials.toast.saved'));
    router.push('/admin/catalog/materials');
    router.refresh();
  }

  async function archive() {
    if (!initial) return;
    const res = await fetch(`/api/admin/materials/${initial.id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error(t('admin.catalog.materials.toast.archiveFailed'));
      return;
    }
    toast.success(t('admin.catalog.materials.toast.archived'));
    router.push('/admin/catalog/materials');
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
        {/* Basis */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.catalog.form.section.basics')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="categories"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.catalog.materials.field.categories')}</FormLabel>
                  <div className="grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-3">
                    {MATERIAL_CATEGORIES.map((c) => {
                      const checked = field.value.includes(c);
                      return (
                        <label
                          key={c}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(next) => {
                              const want = next === true;
                              const set = new Set(field.value);
                              if (want) set.add(c);
                              else set.delete(c);
                              field.onChange(Array.from(set));
                            }}
                          />
                          {t(`admin.catalog.materials.category.${c}`)}
                        </label>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.catalog.materials.field.name')}</FormLabel>
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
                  <FormLabel>{t('admin.catalog.materials.field.slug')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.catalog.materials.field.color')}</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={field.value}
                        onChange={field.onChange}
                        className="h-9 w-12 cursor-pointer rounded border"
                      />
                      <Input {...field} className="flex-1 font-mono" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Texturen — shared across categories */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.catalog.materials.field.textures')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TextureUploadField
              label={t('admin.catalog.materials.field.texture.color')}
              value={form.watch('textureColor')}
              onChange={(v) => form.setValue('textureColor', v)}
              tenantId={tenantId}
              slug={slug || 'draft'}
              slot="color"
            />
            <TextureUploadField
              label={t('admin.catalog.materials.field.texture.normal')}
              value={form.watch('textureNormal')}
              onChange={(v) => form.setValue('textureNormal', v)}
              tenantId={tenantId}
              slug={slug || 'draft'}
              slot="normal"
            />
            <TextureUploadField
              label={t('admin.catalog.materials.field.texture.roughness')}
              value={form.watch('textureRoughness')}
              onChange={(v) => form.setValue('textureRoughness', v)}
              tenantId={tenantId}
              slug={slug || 'draft'}
              slot="roughness"
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tileWidth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.catalog.materials.field.tileWidth')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tileHeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.catalog.materials.field.tileHeight')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Prijs — one input per selected pricing-bearing category */}
        {(hasWall || hasRoofCover || hasFloor || hasDoor) && (
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.catalog.materials.field.pricing')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasWall && (
                <PriceRow
                  label={t('admin.catalog.materials.field.price.wall')}
                  suffix="€/m²"
                  name="priceWall"
                  form={form}
                />
              )}
              {hasRoofCover && (
                <PriceRow
                  label={t('admin.catalog.materials.field.price.roofCover')}
                  suffix="€/m²"
                  name="priceRoofCover"
                  form={form}
                />
              )}
              {hasFloor && (
                <PriceRow
                  label={t('admin.catalog.materials.field.price.floor')}
                  suffix="€/m²"
                  name="priceFloor"
                  form={form}
                />
              )}
              {hasDoor && (
                <PriceRow
                  label={t('admin.catalog.materials.field.price.door')}
                  suffix="€"
                  name="priceDoor"
                  form={form}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Opties — wall + floor toggles */}
        {(hasWall || hasFloor) && (
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.catalog.form.section.options')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {hasWall && (
                <FormField
                  control={form.control}
                  name="clearsOpenings"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer">
                        {t('admin.catalog.materials.field.flag.clearsOpenings')}
                      </FormLabel>
                    </FormItem>
                  )}
                />
              )}
              {hasFloor && (
                <FormField
                  control={form.control}
                  name="isVoid"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer">
                        {t('admin.catalog.materials.field.flag.isVoid')}
                      </FormLabel>
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {t('admin.catalog.materials.action.save')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/catalog/materials')}
          >
            {t('admin.catalog.materials.action.cancel')}
          </Button>
          {mode === 'edit' && !initial?.archivedAt && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" className="ml-auto">
                  {t('admin.catalog.materials.action.archive')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t('admin.catalog.materials.archive.title')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('admin.catalog.materials.archive.description')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {t('admin.catalog.materials.action.cancel')}
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={archive}>
                    {t('admin.catalog.materials.action.archive')}
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

function PriceRow({
  label,
  suffix,
  name,
  form,
}: {
  label: string;
  suffix: string;
  name: 'priceWall' | 'priceRoofCover' | 'priceFloor' | 'priceDoor';
  form: ReturnType<typeof useForm<FormValues>>;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="1"
                min={0}
                value={field.value ?? ''}
                onChange={(e) =>
                  field.onChange(e.target.value === '' ? null : Number(e.target.value))
                }
              />
              <span className="text-sm text-muted-foreground">{suffix}</span>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
