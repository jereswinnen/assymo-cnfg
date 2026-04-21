'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Building2,
  ChevronsUpDownIcon,
  ClipboardList,
  Contact2,
  LayoutDashboard,
  LogOutIcon,
  Package,
  Palette,
  Receipt,
  Store,
  Users,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { signOut } from '@/lib/auth-client';
import { t } from '@/lib/i18n';
import type { Role } from '@/lib/auth-guards';
import type { LucideIcon } from 'lucide-react';

interface Props {
  role: Role;
  tenantId: string | null;
  name: string;
  email: string;
}

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  visible: (role: Role) => boolean;
}

const ITEMS: NavItem[] = [
  { href: '/admin', labelKey: 'admin.nav.dashboard', icon: LayoutDashboard, visible: () => true },
  { href: '/admin/orders', labelKey: 'admin.nav.orders', icon: ClipboardList, visible: () => true },
  { href: '/admin/invoices', labelKey: 'admin.nav.invoices', icon: Receipt, visible: () => true },
  { href: '/admin/clients', labelKey: 'admin.nav.clients', icon: Contact2, visible: () => true },
  { href: '/admin/tenants', labelKey: 'admin.nav.tenants', icon: Building2, visible: (r) => r === 'super_admin' },
  { href: '/admin/users', labelKey: 'admin.nav.users', icon: Users, visible: () => true },
  { href: '/admin/registry', labelKey: 'admin.nav.registry', icon: Package, visible: (r) => r === 'tenant_admin' },
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function Sidebar({ role, tenantId, name, email }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile } = useSidebar();
  const items = ITEMS.filter((i) => i.visible(role));
  const ownTenantHref = tenantId ? `/admin/tenants/${tenantId}` : null;
  const initials = getInitials(name) || '..';

  const handleSignOut = async () => {
    await signOut();
    router.push('/admin/sign-in');
  };

  return (
    <ShadcnSidebar collapsible="offcanvas">
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
        <SidebarGroup>
          <SidebarGroupLabel>{t('admin.nav.catalog')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === '/admin/catalog/materials' || pathname.startsWith('/admin/catalog/materials/')}
                  tooltip={t('admin.nav.catalog.materials')}
                >
                  <Link href="/admin/catalog/materials">
                    <Palette />
                    <span>{t('admin.nav.catalog.materials')}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{name}</span>
                    <span className="truncate text-xs text-muted-foreground">{email}</span>
                  </div>
                  <ChevronsUpDownIcon className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side={isMobile ? 'bottom' : 'right'}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{name}</span>
                      <span className="truncate text-xs text-muted-foreground">{email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOutIcon />
                  {t('admin.signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </ShadcnSidebar>
  );
}
