'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, Users, Store } from 'lucide-react';
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { t } from '@/lib/i18n';
import type { Role } from '@/lib/auth-guards';
import type { LucideIcon } from 'lucide-react';

interface Props { role: Role; tenantId: string | null }

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  visible: (role: Role) => boolean;
}

const ITEMS: NavItem[] = [
  { href: '/admin', labelKey: 'admin.nav.dashboard', icon: LayoutDashboard, visible: () => true },
  { href: '/admin/tenants', labelKey: 'admin.nav.tenants', icon: Building2, visible: (r) => r === 'super_admin' },
  { href: '/admin/users', labelKey: 'admin.nav.users', icon: Users, visible: () => true },
];

export function Sidebar({ role, tenantId }: Props) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => i.visible(role));
  const ownTenantHref = tenantId ? `/admin/tenants/${tenantId}` : null;

  return (
    <ShadcnSidebar collapsible="icon">
      <SidebarHeader>
        <div className="px-2 py-1.5 text-sm font-semibold">{t('admin.title')}</div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={t(item.labelKey)}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{t(item.labelKey)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {role === 'tenant_admin' && ownTenantHref && (
          <SidebarGroup>
            <SidebarGroupLabel>{t('admin.nav.tenant')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(ownTenantHref)}
                    tooltip={t('admin.nav.tenant')}
                  >
                    <Link href={ownTenantHref}>
                      <Store />
                      <span>{t('admin.nav.tenant')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </ShadcnSidebar>
  );
}
