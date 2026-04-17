import { OrdersTable } from '@/components/admin/OrdersTable';

export default function OrdersPage() {
  // Static breadcrumb comes from STATIC_LABELS — no <PageTitle> here.
  return (
    <div className="space-y-6">
      <OrdersTable />
    </div>
  );
}
