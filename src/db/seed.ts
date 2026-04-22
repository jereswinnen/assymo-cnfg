import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { and, eq, sql } from 'drizzle-orm';
import { DEFAULT_PRICE_BOOK } from '../domain/pricing/priceBook.ts';
import { DEFAULT_ASSYMO_BRANDING } from '../domain/tenant/branding.ts';
import { DEFAULT_ASSYMO_INVOICING } from '../domain/tenant/invoicing.ts';
import * as schema from './schema.ts';
import { products, tenantHosts, tenants, suppliers, supplierProducts } from './schema.ts';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set — run with --env-file=.env.local');
}
const db = drizzle({ client: neon(process.env.DATABASE_URL), schema });

const DEFAULT_HOSTS = ['localhost', 'localhost:3000', 'assymo.be'];
const TENANT_ID = 'assymo';

const DEMO_SUPPLIER = {
  slug: 'demo',
  name: 'Assymo Demo Leverancier',
  logoUrl: null,
  contact: { email: 'demo@assymo.be', phone: null, website: null },
  notes: 'Seeded demo supplier — voor developmentstests en UX-verkenning.',
};

const DEMO_SUPPLIER_PRODUCTS = [
  // Door products
  {
    sku: 'DEMO-DR-01',
    name: 'Enkele houten deur 900×2100',
    kind: 'door' as const,
    widthMm: 900,
    heightMm: 2100,
    priceCents: 65000,
    sortOrder: 0,
    heroImage: null,
    meta: { swingDirection: 'outward', lockType: 'cylinder', glazing: 'solid' },
  },
  {
    sku: 'DEMO-DR-02',
    name: 'Dubbele houten deur 1800×2100',
    kind: 'door' as const,
    widthMm: 1800,
    heightMm: 2100,
    priceCents: 120000,
    sortOrder: 1,
    heroImage: null,
    meta: { swingDirection: 'outward', lockType: 'multipoint', glazing: 'solid' },
  },
  {
    sku: 'DEMO-DR-03',
    name: 'Enkele glasdeur 900×2100',
    kind: 'door' as const,
    widthMm: 900,
    heightMm: 2100,
    priceCents: 95000,
    sortOrder: 2,
    heroImage: null,
    meta: { swingDirection: 'outward', lockType: 'cylinder', glazing: 'glass-panel' },
  },
  // Window products
  {
    sku: 'DEMO-WN-01',
    name: 'Standaard raam 1200×1000',
    kind: 'window' as const,
    widthMm: 1200,
    heightMm: 1000,
    priceCents: 35000,
    sortOrder: 0,
    heroImage: null,
    meta: { glazingType: 'double', openable: true, uValue: 1.1 },
  },
  {
    sku: 'DEMO-WN-02',
    name: 'Groot vast raam 1500×1200',
    kind: 'window' as const,
    widthMm: 1500,
    heightMm: 1200,
    priceCents: 52000,
    sortOrder: 1,
    heroImage: null,
    meta: { glazingType: 'triple', openable: false, uValue: 0.8 },
  },
];

const ASSYMO_SEED_PRODUCTS = [
  {
    slug: 'standaard-overkapping-4x3',
    kind: 'overkapping' as const,
    name: 'Standaard Overkapping 4×3',
    description: 'Open overkapping, 4 bij 3 meter, met dakpannen en houten wandelementen.',
    defaults: {
      width: 4, depth: 3, height: 2.6,
      materials: {
        wallCladding: 'wood',
        roofCovering: 'dakpannen',
        roofTrim: 'wood',
      },
    },
    constraints: {},
    basePriceCents: 0,
    sortOrder: 10,
  },
  {
    slug: 'standaard-berging-3x3',
    kind: 'berging' as const,
    name: 'Standaard Berging 3×3',
    description: 'Gesloten berging, 3 bij 3 meter, met EPDM dak en betonnen vloer.',
    defaults: {
      width: 3, depth: 3, height: 2.4,
      materials: {
        wallCladding: 'wood',
        roofCovering: 'epdm',
        roofTrim: 'wood',
        floor: 'beton',
        door: 'wood',
      },
    },
    constraints: {},
    basePriceCents: 0,
    sortOrder: 20,
  },
];

async function main() {
  // 1. Tenant + hosts.
  await db
    .insert(tenants)
    .values({
      id: TENANT_ID,
      displayName: 'Assymo',
      locale: 'nl',
      currency: 'EUR',
      priceBook: DEFAULT_PRICE_BOOK,
      branding: DEFAULT_ASSYMO_BRANDING,
      invoicing: DEFAULT_ASSYMO_INVOICING,
    })
    .onConflictDoUpdate({
      target: tenants.id,
      set: {
        displayName: sql`excluded.display_name`,
        locale: sql`excluded.locale`,
        currency: sql`excluded.currency`,
        priceBook: sql`excluded.price_book`,
        branding: sql`excluded.branding`,
        invoicing: sql`excluded.invoicing`,
        updatedAt: sql`now()`,
      },
    });

  for (const hostname of DEFAULT_HOSTS) {
    await db
      .insert(tenantHosts)
      .values({ hostname, tenantId: TENANT_ID })
      .onConflictDoNothing({ target: tenantHosts.hostname });
  }

  console.log(`[seed] tenant: ${TENANT_ID} (${DEFAULT_HOSTS.length} hosts)`);

  // 2. Products — skip any (tenant, slug) that already exists.
  let productsInserted = 0;
  let productsSkipped = 0;
  for (const p of ASSYMO_SEED_PRODUCTS) {
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.tenantId, TENANT_ID),
          eq(products.slug, p.slug),
        ),
      )
      .limit(1);
    if (existing) { productsSkipped += 1; continue; }

    await db.insert(products).values({
      id: randomUUID(),
      tenantId: TENANT_ID,
      kind: p.kind,
      slug: p.slug,
      name: p.name,
      description: p.description,
      heroImage: null,
      defaults: p.defaults,
      constraints: p.constraints,
      basePriceCents: p.basePriceCents,
      sortOrder: p.sortOrder,
    });
    productsInserted += 1;
  }

  console.log(
    `[seed] products: ${productsInserted} inserted / ${productsSkipped} already present (total ${ASSYMO_SEED_PRODUCTS.length})`,
  );

  // 3. Demo supplier + products — idempotent via onConflictDoNothing.
  const [existingSupplier] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(
      and(
        eq(suppliers.tenantId, TENANT_ID),
        eq(suppliers.slug, DEMO_SUPPLIER.slug),
      ),
    )
    .limit(1);

  let supplierId: string;
  if (existingSupplier) {
    supplierId = existingSupplier.id;
  } else {
    const newId = crypto.randomUUID();
    await db.insert(suppliers).values({
      id: newId,
      tenantId: TENANT_ID,
      slug: DEMO_SUPPLIER.slug,
      name: DEMO_SUPPLIER.name,
      logoUrl: DEMO_SUPPLIER.logoUrl,
      contact: DEMO_SUPPLIER.contact,
      notes: DEMO_SUPPLIER.notes,
    });
    supplierId = newId;
  }

  let supplierProductsInserted = 0;
  let supplierProductsSkipped = 0;
  for (const p of DEMO_SUPPLIER_PRODUCTS) {
    const [existing] = await db
      .select({ id: supplierProducts.id })
      .from(supplierProducts)
      .where(
        and(
          eq(supplierProducts.tenantId, TENANT_ID),
          eq(supplierProducts.kind, p.kind),
          eq(supplierProducts.sku, p.sku),
        ),
      )
      .limit(1);
    if (existing) { supplierProductsSkipped += 1; continue; }

    await db.insert(supplierProducts).values({
      id: randomUUID(),
      tenantId: TENANT_ID,
      supplierId,
      kind: p.kind,
      sku: p.sku,
      name: p.name,
      heroImage: p.heroImage,
      widthMm: p.widthMm,
      heightMm: p.heightMm,
      priceCents: p.priceCents,
      meta: p.meta,
      sortOrder: p.sortOrder,
    });
    supplierProductsInserted += 1;
  }

  if (supplierProductsInserted > 0 || !existingSupplier) {
    console.log(
      `[seed] supplier: ${DEMO_SUPPLIER.slug} (${!existingSupplier ? 'created' : 'exists'})`,
    );
    console.log(
      `[seed] supplier products: ${supplierProductsInserted} inserted / ${supplierProductsSkipped} already present (total ${DEMO_SUPPLIER_PRODUCTS.length})`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
