import { t } from '@/lib/i18n';

export interface Crumb {
  label: string;
  href?: string;
}

/** Map of static admin pathnames to their breadcrumb label key.
 *  Dynamic segments are handled below via prefix-matching against
 *  this same map for the parent. */
const STATIC_LABELS: Record<string, string> = {
  '/admin': 'admin.nav.dashboard',
  '/admin/orders': 'admin.nav.orders',
  '/admin/clients': 'admin.nav.clients',
  '/admin/tenants': 'admin.nav.tenants',
  '/admin/users': 'admin.nav.users',
};

/** Resolve breadcrumbs for a pathname.
 *
 *  Static pages (in STATIC_LABELS): single crumb with the mapped label.
 *  Dynamic pages (e.g. /admin/tenants/<id>): parent crumb (linked) +
 *  the registered dynamicTitle as the leaf. The dynamicTitle comes
 *  from useAdminHeaderTitle on the page itself. If the page has not
 *  yet registered a title (mid-load), shows '…' as a placeholder.
 *
 *  Falls back to a single 'Admin' crumb for unknown routes. */
export function getBreadcrumbs(
  pathname: string,
  dynamicTitle: string | null,
): Crumb[] {
  // Exact static match
  if (STATIC_LABELS[pathname]) {
    return [{ label: t(STATIC_LABELS[pathname]) }];
  }

  // Dynamic — find the deepest static parent and chain a leaf onto it.
  // e.g. /admin/tenants/<id> → parent /admin/tenants
  const parents = Object.keys(STATIC_LABELS)
    .filter((p) => p !== '/admin' && pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length);

  const parent = parents[0];
  if (parent) {
    return [
      { label: t(STATIC_LABELS[parent]), href: parent },
      { label: dynamicTitle ?? '…' },
    ];
  }

  return [{ label: 'Admin' }];
}
