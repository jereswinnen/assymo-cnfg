import { ClientOrdersTable } from '@/components/shop/ClientOrdersTable';
import { t } from '@/lib/i18n';

export default function ShopAccountPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('shop.account.title')}</h1>
      <ClientOrdersTable />
    </div>
  );
}
