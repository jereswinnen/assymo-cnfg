'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@/lib/i18n';
import type { Role } from '@/lib/auth-guards';

interface Props { role: Role; tenantId: string | null }

interface NavItem { href: string; labelKey: string; visible: (role: Role) => boolean }

const ITEMS: NavItem[] = [
  { href: '/admin', labelKey: 'admin.nav.dashboard', visible: () => true },
  { href: '/admin/tenants', labelKey: 'admin.nav.tenants', visible: (r) => r === 'super_admin' },
  { href: '/admin/users', labelKey: 'admin.nav.users', visible: () => true },
];

export function Sidebar({ role, tenantId }: Props) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => i.visible(role));

  return (
    <aside className="w-60 bg-white border-r border-neutral-200 p-4 flex flex-col gap-1">
      <div className="px-3 py-2 mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {t('admin.title')}
      </div>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 rounded-md text-sm transition-colors ${
              active ? 'bg-neutral-100 font-medium' : 'hover:bg-neutral-50'
            }`}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
      {role === 'tenant_admin' && tenantId && (
        <Link
          href={`/admin/tenants/${tenantId}`}
          className={`mt-2 px-3 py-2 rounded-md text-sm transition-colors ${
            pathname.startsWith(`/admin/tenants/${tenantId}`) ? 'bg-neutral-100 font-medium' : 'hover:bg-neutral-50'
          }`}
        >
          {t('admin.nav.tenant')}
        </Link>
      )}
    </aside>
  );
}
