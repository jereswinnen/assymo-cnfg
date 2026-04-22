import { cache } from 'react';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from './client';
import {
  materials as materialsTable,
  products as productsTable,
  tenantHosts,
  tenants,
  type MaterialDbRow,
  type ProductDbRow,
  type SupplierDbRow,
  type SupplierProductDbRow,
  type TenantRow,
} from './schema';
import type { MaterialRow, ProductRow } from '@/domain/catalog';
import type { SupplierRow, SupplierProductRow } from '@/domain/supplier';
import { DEFAULT_TENANT_ID, candidateHostKeys } from '@/domain/tenant';

/** Resolve a tenant row by host header, trying exact/bare/subdomain
 *  candidates against `tenant_hosts`. Returns null when no candidate
 *  matches — callers decide whether to fall back to the default tenant
 *  or 404. Wrapped in React `cache()` so the layout and API routes in
 *  the same request share one DB round-trip. */
export const resolveTenantByHost = cache(
  async (host: string | null | undefined): Promise<TenantRow | null> => {
    const candidates = candidateHostKeys(host);
    for (const key of candidates) {
      const rows = await db
        .select()
        .from(tenants)
        .innerJoin(tenantHosts, eq(tenantHosts.tenantId, tenants.id))
        .where(eq(tenantHosts.hostname, key))
        .limit(1);
      const row = rows[0]?.tenants;
      if (row) return row;
    }
    return null;
  },
);

/** Look up a tenant row by its stable slug. Returns null when missing. */
export const getTenantById = cache(
  async (id: string): Promise<TenantRow | null> => {
    const rows = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    return rows[0] ?? null;
  },
);

/** Convenience: resolve from host, falling back to the default tenant
 *  row when the host is unknown. Returns null only if the DB is empty
 *  or the default tenant is missing. */
export async function resolveTenantByHostOrDefault(
  host: string | null | undefined,
): Promise<TenantRow | null> {
  return (await resolveTenantByHost(host)) ?? getTenantById(DEFAULT_TENANT_ID);
}

/** All non-archived materials for a tenant. Cached per-request so the
 *  layout + any API handler in the same request share one query. */
export const getTenantMaterials = cache(
  async (tenantId: string): Promise<MaterialDbRow[]> => {
    return db
      .select()
      .from(materialsTable)
      .where(
        and(
          eq(materialsTable.tenantId, tenantId),
          isNull(materialsTable.archivedAt),
        ),
      );
  },
);

/** Convert a DB row into the domain-level `MaterialRow` transport type
 *  consumed by TenantContext, pickers, pricing, and canvas. Dates are
 *  ISO strings on the domain side. */
export function materialDbRowToDomain(r: MaterialDbRow): MaterialRow {
  return {
    id: r.id,
    tenantId: r.tenantId,
    categories: r.categories as MaterialRow['categories'],
    slug: r.slug,
    name: r.name,
    color: r.color,
    textures: r.textures ?? null,
    tileSize: r.tileSize ?? null,
    pricing: r.pricing,
    flags: r.flags,
    archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** All non-archived products for a tenant, sorted by `sort_order` then
 *  by name for stable rendering. Cached per-request so the layout and
 *  any API handlers in the same request share one round-trip. */
export const getTenantProducts = cache(
  async (tenantId: string): Promise<ProductDbRow[]> => {
    return db
      .select()
      .from(productsTable)
      .where(
        and(
          eq(productsTable.tenantId, tenantId),
          isNull(productsTable.archivedAt),
        ),
      )
      .orderBy(productsTable.sortOrder, productsTable.name);
  },
);

/** Map a DB row into the domain `ProductRow` transport type. Timestamps
 *  become ISO strings; jsonb fields pass through (Drizzle deserialises
 *  via the `.$type<T>()` cast). */
export function productDbRowToDomain(r: ProductDbRow): ProductRow {
  return {
    id: r.id,
    tenantId: r.tenantId,
    kind: r.kind,
    slug: r.slug,
    name: r.name,
    description: r.description ?? null,
    heroImage: r.heroImage ?? null,
    defaults: r.defaults,
    constraints: r.constraints,
    basePriceCents: r.basePriceCents,
    sortOrder: r.sortOrder,
    archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** Map a DB row into the domain `SupplierRow` transport type. The
 *  `contact` jsonb field passes through as-is (typed via `.$type<>()`);
 *  nullable text columns are coerced to null. */
export function supplierDbRowToDomain(r: SupplierDbRow): SupplierRow {
  return {
    id: r.id,
    tenantId: r.tenantId,
    slug: r.slug,
    name: r.name,
    logoUrl: r.logoUrl ?? null,
    contact: r.contact,
    notes: r.notes ?? null,
    archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** Map a DB row into the domain `SupplierProductRow` transport type.
 *  The `meta` jsonb field passes through typed as `DoorMeta | WindowMeta`
 *  (validated at the app layer). */
export function supplierProductDbRowToDomain(r: SupplierProductDbRow): SupplierProductRow {
  return {
    id: r.id,
    tenantId: r.tenantId,
    supplierId: r.supplierId,
    kind: r.kind,
    sku: r.sku,
    name: r.name,
    heroImage: r.heroImage ?? null,
    widthMm: r.widthMm,
    heightMm: r.heightMm,
    priceCents: r.priceCents,
    meta: r.meta,
    sortOrder: r.sortOrder,
    archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
