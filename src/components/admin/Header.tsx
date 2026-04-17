'use client';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  AdminHeaderActions,
  useAdminHeaderTitleValue,
} from '@/components/admin/AdminHeaderContext';

export function Header() {
  const title = useAdminHeaderTitleValue();
  return (
    <header className="px-4 flex h-16 shrink-0 items-center gap-2 border-b">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
      {title && <h1 className="text-sm font-medium truncate">{title}</h1>}
      <div className="ml-auto flex items-center gap-2">
        <AdminHeaderActions />
      </div>
    </header>
  );
}
