import { ClientsTable } from '@/components/admin/ClientsTable';

export default function ClientsPage() {
  // Static breadcrumb from STATIC_LABELS — no <PageTitle>.
  return (
    <div className="space-y-6">
      <ClientsTable />
    </div>
  );
}
