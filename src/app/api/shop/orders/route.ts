import { NextResponse, type NextRequest } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { configs, orders } from '@/db/schema';
import { user } from '@/db/auth-schema';
import { migrateConfig, validateConfig } from '@/domain/config';
import { buildConfigSnapshot, buildQuoteSnapshot } from '@/domain/orders';
import { auth } from '@/lib/auth';
import { resolveApiTenant } from '@/lib/apiTenant';
import {
  getTenantMaterials,
  materialDbRowToDomain,
  getTenantSupplierProducts,
  supplierProductDbRowToDomain,
} from '@/db/resolveTenant';
import { validateSupplierPlacements } from '@/domain/supplier';
import { requireClient } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

interface ContactBody {
  email?: unknown;
  name?: unknown;
  phone?: unknown;
  notes?: unknown;
}
interface PostBody {
  code?: unknown;
  contact?: ContactBody;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

/** List the signed-in client's own orders, newest-first. We filter on
 *  both `customerId` AND `tenantId` so isolation is a query-level
 *  guarantee, not an application-layer invariant — a future bug that
 *  mis-assigned a customerId could never cross a tenant boundary here. */
export const GET = withSession(async (session) => {
  requireClient(session);
  const clientId = session.user.id;
  const tenantId = (session.user.tenantId as string | null) ?? '__none__';

  const rows = await db
    .select({
      id: orders.id,
      code: orders.code,
      status: orders.status,
      totalCents: orders.totalCents,
      currency: orders.currency,
      submittedAt: orders.submittedAt,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(eq(orders.customerId, clientId), eq(orders.tenantId, tenantId)))
    .orderBy(desc(orders.createdAt));

  return NextResponse.json({ orders: rows });
});

/** Public endpoint: anyone with a valid share code + contact details
 *  can submit an order. The tenant is derived from the request host
 *  (per project convention — see `src/lib/apiTenant.ts`). */
export async function POST(req: NextRequest) {
  const tenant = await resolveApiTenant();
  if (!tenant) {
    return NextResponse.json({ error: 'unknown_tenant' }, { status: 404 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // ── Input validation ────────────────────────────────────────────
  const errors: string[] = [];
  if (!isNonEmptyString(body.code)) errors.push('code');
  const contact = body.contact ?? {};
  if (!isNonEmptyString(contact.email) || !EMAIL_RE.test(contact.email as string)) {
    errors.push('contact.email');
  }
  if (!isNonEmptyString(contact.name)) errors.push('contact.name');
  if (contact.phone !== undefined && contact.phone !== null && !isNonEmptyString(contact.phone)) {
    errors.push('contact.phone');
  }
  if (contact.notes !== undefined && contact.notes !== null && typeof contact.notes !== 'string') {
    errors.push('contact.notes');
  }
  if (errors.length > 0) {
    return NextResponse.json(
      { error: 'validation_failed', details: errors },
      { status: 422 },
    );
  }

  const code = (body.code as string).trim();
  const email = (contact.email as string).toLowerCase();
  const name = (contact.name as string).trim();
  const phone =
    typeof contact.phone === 'string' && contact.phone.trim().length > 0
      ? contact.phone.trim()
      : null;
  const notes =
    typeof contact.notes === 'string' && contact.notes.trim().length > 0
      ? contact.notes.trim()
      : null;

  // ── Resolve the config ──────────────────────────────────────────
  const [configRow] = await db
    .select()
    .from(configs)
    .where(and(eq(configs.tenantId, tenant.id), eq(configs.code, code)))
    .limit(1);
  if (!configRow) {
    return NextResponse.json({ error: 'config_not_found' }, { status: 404 });
  }
  const migrated = migrateConfig(configRow.data);
  const configErrors = validateConfig(migrated);
  if (configErrors.length > 0) {
    return NextResponse.json(
      { error: 'config_invalid', details: configErrors },
      { status: 422 },
    );
  }

  // ── Resolve materials + supplier products ───────────────────────
  const [materialRows, allSupplierProductRows] = await Promise.all([
    getTenantMaterials(tenant.id),
    getTenantSupplierProducts(tenant.id),
  ]);
  const materials = materialRows.map(materialDbRowToDomain);
  // Include archived rows for the existence/archive checks below; pricing
  // and placements only consider non-archived rows separately.
  const allSupplierProductDbRows = allSupplierProductRows;

  // ── Supplier ref validation ──────────────────────────────────────
  // Collect all referenced supplier product IDs from the config
  const referencedIds = new Set<string>();
  for (const building of migrated.buildings) {
    for (const wallCfg of Object.values(building.walls)) {
      if (!wallCfg) continue;
      if (wallCfg.doorSupplierProductId) referencedIds.add(wallCfg.doorSupplierProductId);
      for (const win of wallCfg.windows ?? []) {
        if (win.supplierProductId) referencedIds.add(win.supplierProductId);
      }
    }
    // Phase 5.8.3: gate-primitive supplier-product reference
    if (building.type === 'poort' && building.gateConfig?.supplierProductId) {
      referencedIds.add(building.gateConfig.supplierProductId);
    }
  }

  if (referencedIds.size > 0) {
    // Fetch ALL supplier products (including archived) for existence check.
    // getTenantSupplierProducts only returns non-archived; we need to check
    // existence separately. Re-query without the archivedAt filter.
    const { db } = await import('@/db/client');
    const { supplierProducts: supplierProductsTable } = await import('@/db/schema');
    const { eq, inArray } = await import('drizzle-orm');
    const refIds = [...referencedIds];
    const allRows = await db
      .select()
      .from(supplierProductsTable)
      .where(
        refIds.length === 1
          ? eq(supplierProductsTable.id, refIds[0])
          : inArray(supplierProductsTable.id, refIds),
      );
    const foundIds = new Map(allRows.map((r) => [r.id, r]));

    for (const id of referencedIds) {
      const row = foundIds.get(id);
      if (!row) {
        return NextResponse.json(
          { error: 'supplier_product_not_found', details: { id } },
          { status: 422 },
        );
      }
      if (row.archivedAt !== null) {
        return NextResponse.json(
          { error: 'supplier_product_archived', details: { id } },
          { status: 422 },
        );
      }
    }
  }

  // ── Geometry placement validation ────────────────────────────────
  const activeSupplierProducts = allSupplierProductDbRows.map(supplierProductDbRowToDomain);
  const placementIssues = validateSupplierPlacements(
    migrated.buildings,
    activeSupplierProducts,
    migrated.defaultHeight,
  );
  if (placementIssues.length > 0) {
    const first = placementIssues[0];
    const errorCode =
      first.code === 'too_tall'
        ? 'supplier_placement_too_tall'
        : first.code === 'too_wide'
          ? 'supplier_placement_too_wide'
          : first.code === 'gate_too_tall'
            ? 'gate_placement_too_tall'
            : 'gate_placement_too_wide';
    return NextResponse.json(
      {
        error: errorCode,
        details: {
          buildingId: first.buildingId,
          wallSide: first.wallSide,
          productId: first.productId,
          ...first.details,
        },
      },
      { status: 422 },
    );
  }

  // ── Snapshot the priced quote ───────────────────────────────────
  const quoteSnapshot = buildQuoteSnapshot({
    code,
    buildings: migrated.buildings,
    roof: migrated.roof,
    priceBook: tenant.priceBook,
    defaultHeight: migrated.defaultHeight,
    currency: tenant.currency,
    materials,
    supplierProducts: activeSupplierProducts,
  });
  const configSnapshot = buildConfigSnapshot(code, migrated);

  // ── Resolve / create the client user ────────────────────────────
  // Global-unique emails (project convention). If the email already
  // belongs to a business user we refuse to attach the order to that
  // row — it would mix the two userTypes; instead we surface a
  // dedicated 409. If it belongs to a client we reuse the row.
  const [existingUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  let customerId: string;
  if (existingUser) {
    if (existingUser.kind !== 'client') {
      return NextResponse.json(
        { error: 'email_in_use_by_business' },
        { status: 409 },
      );
    }
    customerId = existingUser.id;
  } else {
    customerId = crypto.randomUUID();
    const now = new Date();
    await db.insert(user).values({
      id: customerId,
      email,
      name,
      emailVerified: false,
      tenantId: tenant.id,
      kind: 'client' as const,
      createdAt: now,
      updatedAt: now,
    });
  }

  // ── Create the order row ────────────────────────────────────────
  const orderId = crypto.randomUUID();
  const now = new Date();
  const [inserted] = await db
    .insert(orders)
    .values({
      id: orderId,
      tenantId: tenant.id,
      configId: configRow.id,
      code,
      customerId,
      contactEmail: email,
      contactName: name,
      contactPhone: phone,
      notes,
      status: 'submitted' as const,
      totalCents: quoteSnapshot.totalCents,
      currency: tenant.currency,
      quoteSnapshot,
      configSnapshot,
      createdAt: now,
      updatedAt: now,
      submittedAt: now,
    })
    .returning();

  // ── Fire the magic-link email (carries the order template) ──────
  // Best-effort: order is already persisted, so we still 201 even if
  // delivery flakes. The admin can resend later.
  let emailDispatched = true;
  try {
    await auth.api.signInMagicLink({
      body: {
        email,
        callbackURL: `/shop/account/orders/${orderId}`,
      },
      headers: new Headers(),
    });
  } catch {
    emailDispatched = false;
  }

  return NextResponse.json(
    {
      id: inserted.id,
      status: inserted.status,
      totalCents: inserted.totalCents,
      currency: inserted.currency,
      emailDispatched,
    },
    { status: 201 },
  );
}
