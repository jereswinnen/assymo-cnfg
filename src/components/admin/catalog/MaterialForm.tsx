'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
  MATERIAL_CATEGORIES,
  normalizeSlug,
  type MaterialCategory,
  type MaterialRow,
} from '@/domain/catalog';
import { TextureUploadField } from './TextureUploadField';

const schema = z.object({
  category: z.enum(MATERIAL_CATEGORIES as unknown as [MaterialCategory, ...MaterialCategory[]]),
  slug: z.string().min(1).max(48),
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textureColor: z.string().nullable(),
  textureNormal: z.string().nullable(),
  textureRoughness: z.string().nullable(),
  tileWidth: z.number().nullable(),
  tileHeight: z.number().nullable(),
  perSqm: z.number().nullable(),
  surcharge: z.number().nullable(),
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
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          category: initial.category,
          slug: initial.slug,
          name: initial.name,
          color: initial.color,
          textureColor: initial.textures?.color ?? null,
          textureNormal: initial.textures?.normal ?? null,
          textureRoughness: initial.textures?.roughness ?? null,
          tileWidth: initial.tileSize?.[0] ?? null,
          tileHeight: initial.tileSize?.[1] ?? null,
          perSqm: initial.pricing.perSqm ?? null,
          surcharge: initial.pricing.surcharge ?? null,
          clearsOpenings: initial.flags.clearsOpenings ?? false,
          isVoid: initial.flags.isVoid ?? false,
        }
      : {
          category: 'wall',
          slug: '',
          name: '',
          color: '#888888',
          textureColor: null,
          textureNormal: null,
          textureRoughness: null,
          tileWidth: null,
          tileHeight: null,
          perSqm: null,
          surcharge: null,
          clearsOpenings: false,
          isVoid: false,
        },
  });

  const category = form.watch('category');
  const slug = form.watch('slug');

  async function onSubmit(values: FormValues) {
    const body: Record<string, unknown> = {
      category: values.category,
      slug: values.slug,
      name: values.name,
      color: values.color,
      pricing:
        values.category === 'door'
          ? { surcharge: values.surcharge ?? 0 }
          : values.category === 'roof-trim'
            ? {}
            : { perSqm: values.perSqm ?? 0 },
      flags: {
        ...(values.category === 'wall' && values.clearsOpenings ? { clearsOpenings: true } : {}),
        ...(values.category === 'floor' && values.isVoid ? { isVoid: true } : {}),
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
    if (mode === 'edit') delete body.category;

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      if (Array.isArray(payload?.details)) {
        for (const e of payload.details as { field: string; code: string }[]) {
          const field = e.field as keyof FormValues;
          const msg = t(`admin.catalog.materials.error.${e.code}`);
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
            {mode === 'create' && (
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.catalog.materials.field.category')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MATERIAL_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {t(`admin.catalog.materials.category.${c}`)}
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

        {/* Texturen — all categories except door */}
        {category !== 'door' && (
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
                            field.onChange(
                              e.target.value === '' ? null : Number(e.target.value),
                            )
                          }
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Prijs — all categories except roof-trim */}
        {category !== 'roof-trim' && (
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.catalog.materials.field.pricing')}</CardTitle>
            </CardHeader>
            <CardContent>
              {category === 'door' ? (
                <FormField
                  control={form.control}
                  name="surcharge"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.catalog.materials.field.surcharge')}</FormLabel>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="perSqm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.catalog.materials.field.perSqm')}</FormLabel>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Opties — wall + floor only */}
        {(category === 'wall' || category === 'floor') && (
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.catalog.form.section.options')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {category === 'wall' && (
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
              {category === 'floor' && (
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
