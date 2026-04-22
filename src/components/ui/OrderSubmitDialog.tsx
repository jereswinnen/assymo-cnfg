'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShoppingBag, CheckCircle2, Loader2 } from 'lucide-react';
import {
  contactFormSchema,
  mapShopOrdersErrorCode,
  type ContactFormValues,
} from '@/domain/orders';
import { useConfigStore } from '@/store/useConfigStore';
import { useSubmitOrder } from './useSubmitOrder';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  useFormField,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

/** Renders the current field's error via the i18n helper, since our
 *  zod schema emits i18n keys (not Dutch strings) as `error.message`. */
function TranslatedFormMessage({ className }: { className?: string }) {
  const { error, formMessageId } = useFormField();
  if (!error?.message) return null;
  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn('text-sm text-destructive', className)}
    >
      {t(String(error.message))}
    </p>
  );
}

export default function OrderSubmitDialog() {
  const [open, setOpen] = useState(false);
  const buildingCount = useConfigStore((s) => s.buildings.length);
  const disabled = buildingCount === 0;

  const { state, submit, reset } = useSubmitOrder();

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { name: '', email: '', phone: '', notes: '' },
    mode: 'onSubmit',
  });

  const mappedError = useMemo(() => {
    if (state.kind !== 'error') return null;
    return mapShopOrdersErrorCode(state.code, state.details);
  }, [state]);

  // Surface server-side field errors onto the form so they render
  // inline next to the right input.
  useEffect(() => {
    if (!mappedError?.fieldErrors) return;
    for (const [field, key] of Object.entries(mappedError.fieldErrors)) {
      form.setError(field as keyof ContactFormValues, {
        type: 'server',
        message: key,
      });
    }
  }, [mappedError, form]);

  const onSubmit = async (values: ContactFormValues) => {
    // Re-parse to pick up zod's transforms (trim, lowercase,
    // empty→undefined) — RHF's input type still reflects the
    // pre-transform shape.
    const parsed = contactFormSchema.parse(values);
    await submit(parsed);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      reset();
      form.reset({ name: '', email: '', phone: '', notes: '' });
    }
  };

  const isSubmitting = state.kind === 'submitting';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={disabled ? t('configurator.submit.cta.disabled') : undefined}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium bg-[var(--brand-primary)] text-white hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none transition-opacity"
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          {t('configurator.submit.cta')}
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        {state.kind === 'success' ? (
          <SuccessView
            orderId={state.orderId}
            totalCents={state.totalCents}
            currency={state.currency}
            email={form.getValues('email')}
            emailDispatched={state.emailDispatched}
            onClose={() => handleOpenChange(false)}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('configurator.submit.dialog.title')}</DialogTitle>
              <DialogDescription>
                {t('configurator.submit.dialog.description')}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('configurator.submit.field.name.label')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t(
                            'configurator.submit.field.name.placeholder',
                          )}
                          autoComplete="name"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <TranslatedFormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('configurator.submit.field.email.label')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={t(
                            'configurator.submit.field.email.placeholder',
                          )}
                          autoComplete="email"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <TranslatedFormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('configurator.submit.field.phone.label')}{' '}
                        <span className="text-muted-foreground font-normal">
                          {t('configurator.submit.field.phone.optional')}
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder={t(
                            'configurator.submit.field.phone.placeholder',
                          )}
                          autoComplete="tel"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <TranslatedFormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('configurator.submit.field.notes.label')}{' '}
                        <span className="text-muted-foreground font-normal">
                          {t('configurator.submit.field.notes.optional')}
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t(
                            'configurator.submit.field.notes.placeholder',
                          )}
                          rows={3}
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <TranslatedFormMessage />
                    </FormItem>
                  )}
                />

                {mappedError && !mappedError.fieldErrors && (
                  <p role="alert" className="text-sm text-destructive">
                    {t(mappedError.i18nKey)}
                  </p>
                )}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleOpenChange(false)}
                    disabled={isSubmitting}
                  >
                    {t('configurator.submit.cancel')}
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('configurator.submit.submitting')}
                      </>
                    ) : (
                      t('configurator.submit.submit')
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SuccessView({
  orderId,
  totalCents,
  currency,
  email,
  emailDispatched,
  onClose,
}: {
  orderId: string;
  totalCents: number;
  currency: string;
  email: string;
  emailDispatched: boolean;
  onClose: () => void;
}) {
  const total = formatTotal(totalCents, currency);
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <DialogTitle>
            {t('configurator.submit.success.title')}
          </DialogTitle>
        </div>
        <DialogDescription>
          {t('configurator.submit.success.lead')}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            {t('configurator.submit.success.orderIdLabel')}
          </span>
          <code className="font-mono text-xs">#{orderId.slice(0, 8)}</code>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            {t('configurator.submit.success.totalLabel')}
          </span>
          <span className="font-medium tabular-nums">{total}</span>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {emailDispatched
          ? t('configurator.submit.success.emailHint', { email })
          : t('configurator.submit.success.emailFallback')}
      </p>

      <DialogFooter>
        <Button type="button" onClick={onClose}>
          {t('configurator.submit.success.close')}
        </Button>
      </DialogFooter>
    </>
  );
}

function formatTotal(cents: number, currency: string): string {
  const amount = (cents / 100).toLocaleString('nl-BE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const symbol = currency === 'EUR' ? '\u20AC' : currency + ' ';
  return `${symbol}${amount}`;
}
