import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { t } from '@/lib/i18n';

interface Props {
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  customerId: string | null;
  notes: string | null;
}

export function OrderContactCard({
  contactName, contactEmail, contactPhone, customerId, notes,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.orders.detail.section.contact')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div><span className="text-neutral-500">{t('admin.orders.detail.contact.name')}:</span> {contactName}</div>
        <div><span className="text-neutral-500">{t('admin.orders.detail.contact.email')}:</span> {contactEmail}</div>
        {contactPhone && <div><span className="text-neutral-500">{t('admin.orders.detail.contact.phone')}:</span> {contactPhone}</div>}
        {customerId ? (
          <div>
            <Link href={`/admin/clients/${customerId}`} className="text-blue-600 hover:underline">
              {t('admin.orders.detail.openCustomer')}
            </Link>
          </div>
        ) : (
          <div className="text-xs text-neutral-500">{t('admin.orders.detail.noCustomer')}</div>
        )}
        {notes && (
          <div className="pt-2 border-t border-neutral-100 mt-2">
            <div className="text-xs text-neutral-500 mb-1">{t('admin.orders.detail.notes')}</div>
            <p className="whitespace-pre-wrap">{notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
