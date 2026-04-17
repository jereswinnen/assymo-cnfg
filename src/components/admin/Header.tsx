'use client';
import { Fragment } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  AdminHeaderActions,
  useAdminHeaderTitleValue,
} from '@/components/admin/AdminHeaderContext';
import { getBreadcrumbs } from '@/components/admin/breadcrumbs';

function AdminBreadcrumbs() {
  const pathname = usePathname();
  const dynamicTitle = useAdminHeaderTitleValue();
  const crumbs = getBreadcrumbs(pathname, dynamicTitle);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => (
          <Fragment key={i}>
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {crumb.href ? (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-10 px-4 flex h-16 shrink-0 items-center gap-2 border-b bg-background">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
      <AdminBreadcrumbs />
      <div className="ml-auto flex items-center gap-2">
        <AdminHeaderActions />
      </div>
    </header>
  );
}
