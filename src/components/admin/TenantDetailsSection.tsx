import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TenantRow } from '@/db/schema';
import { t } from '@/lib/i18n';

interface Props { tenant: TenantRow }

export function TenantDetailsSection({ tenant }: Props) {
  return (
    <Card>
      <CardHeader><CardTitle>{t('admin.tenant.section.details')}</CardTitle></CardHeader>
      <CardContent className="text-sm text-neutral-700 space-y-1 font-mono">
        <p>id: {tenant.id}</p>
        <p>locale: {tenant.locale}</p>
        <p>currency: {tenant.currency}</p>
      </CardContent>
    </Card>
  );
}
