'use client';
import { Controller, useForm } from 'react-hook-form';
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
import { slugify } from '@/domain/supplier';
import type { SupplierRow } from '@/domain/supplier';
import { HeroImageUploadField } from './HeroImageUploadField';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const schema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(48).regex(SLUG_RE),
  logoUrl: z.string().nullable(),
  contactEmail: z.string().email().nullable(),
  contactPhone: z.string().nullable(),
  contactWebsite: z.string().url().nullable(),
  notes: z.string().nullable(),
});

type FormValues = z.infer<typeof schema>;

export function SupplierForm({
  tenantId,
  initial,
  mode,
}: {
  tenantId: string;
  initial?: SupplierRow;
  mode: 'create' | 'edit';
}) {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          name: initial.name,
          slug: initial.slug,
          logoUrl: initial.logoUrl,
          contactEmail: initial.contact.email ?? null,
          contactPhone: initial.contact.phone ?? null,
          contactWebsite: initial.contact.website ?? null,
          notes: initial.notes,
        }
      : {
          name: '',
          slug: '',
          logoUrl: null,
          contactEmail: null,
          contactPhone: null,
          contactWebsite: null,
          notes: null,
        },
  });

  const slug = form.watch('slug');

  async function onSubmit(values: FormValues) {
    const contact: Record<string, string> = {};
    if (values.contactEmail) contact.email = values.contactEmail;
    if (values.contactPhone) contact.phone = values.contactPhone;
    if (values.contactWebsite) contact.website = values.contactWebsite;

    const body = {
      name: values.name,
      slug: values.slug,
      logoUrl: values.logoUrl,
      contact,
      notes: values.notes,
    };

    const url =
      mode === 'create' ? '/api/admin/suppliers' : `/api/admin/suppliers/${initial!.id}`;
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
          const code = typeof e === 'string' ? e : (e.code ?? 'unknown');
          const field = typeof e === 'string' ? undefined : e.field;
          const msg = t(`admin.catalog.suppliers.error.${code}`);
          if (field === 'slug') {
            form.setError('slug', { message: msg });
          } else {
            toast.error(msg);
          }
        }
      } else {
        toast.error(t('admin.catalog.suppliers.toast.saveFailed'));
      }
      return;
    }

    const data = await res.json();
    toast.success(t('admin.catalog.suppliers.toast.saved'));

    if (mode === 'create') {
      const id: string = (data as { supplier?: { id?: string } }).supplier?.id ?? '';
      router.push(`/admin/catalog/suppliers/${id}`);
    } else {
      router.refresh();
    }
  }

  async function archive() {
    if (!initial) return;
    const res = await fetch(`/api/admin/suppliers/${initial.id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error(t('admin.catalog.suppliers.toast.archiveFailed'));
      return;
    }
    toast.success(t('admin.catalog.suppliers.toast.archived'));
    router.push('/admin/catalog/suppliers');
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
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.catalog.suppliers.field.name')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onBlur={(e) => {
                        field.onBlur();
                        if (!slug) form.setValue('slug', slugify(e.target.value));
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
                  <FormLabel>{t('admin.catalog.suppliers.field.slug')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Controller
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <HeroImageUploadField
                  label={t('admin.catalog.suppliers.field.logo')}
                  value={field.value}
                  onChange={field.onChange}
                  tenantId={tenantId}
                  slug={slug || 'draft'}
                  uploadUrl="/api/admin/uploads/images"
                />
              )}
            />
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.catalog.suppliers.column.contact')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="contactEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.catalog.suppliers.field.contact.email')}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.catalog.suppliers.field.contact.phone')}</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactWebsite"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.catalog.suppliers.field.contact.website')}</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Notities */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.catalog.suppliers.field.notes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
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
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {t('admin.catalog.suppliers.action.save')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/catalog/suppliers')}
          >
            {t('admin.catalog.suppliers.action.cancel')}
          </Button>
          {mode === 'edit' && !initial?.archivedAt && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" className="ml-auto">
                  {t('admin.catalog.suppliers.action.archive')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t('admin.catalog.suppliers.archive.title')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('admin.catalog.suppliers.archive.description')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {t('admin.catalog.suppliers.action.cancel')}
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={archive}>
                    {t('admin.catalog.suppliers.action.archive')}
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
