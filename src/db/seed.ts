import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { and, eq, sql } from 'drizzle-orm';
import { put } from '@vercel/blob';
import { DEFAULT_PRICE_BOOK } from '../domain/pricing/priceBook.ts';
import { DEFAULT_ASSYMO_BRANDING } from '../domain/tenant/branding.ts';
import { DEFAULT_ASSYMO_INVOICING } from '../domain/tenant/invoicing.ts';
import * as schema from './schema.ts';
import { materials as materialsTable, products, tenantHosts, tenants } from './schema.ts';
import { ASSYMO_SEED_MATERIALS, type SeedMaterialInput } from './seedData.ts';
import type { MaterialTextures } from '../domain/catalog/types.ts';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set — run with --env-file=.env.local');
}
const db = drizzle({ client: neon(process.env.DATABASE_URL), schema });

const DEFAULT_HOSTS = ['localhost', 'localhost:3000', 'assymo.be'];
const TENANT_ID = 'assymo';

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

async function uploadTextures(
  slug: string,
  paths: SeedMaterialInput['texturePaths'],
): Promise<MaterialTextures | null> {
  if (!paths) return null;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn(`[seed] BLOB_READ_WRITE_TOKEN missing — skipping texture upload for ${slug}`);
    return null;
  }
  const urls: Partial<MaterialTextures> = {};
  for (const kind of ['color', 'normal', 'roughness'] as const) {
    const path = paths[kind];
    const abs = resolve(process.cwd(), path);
    const buf = await readFile(abs);
    const ext = path.endsWith('.png') ? 'png' : 'jpg';
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const blob = await put(`textures/${TENANT_ID}/${slug}-${kind}.${ext}`, buf, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    urls[kind] = blob.url;
  }
  return urls as MaterialTextures;
}

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

  // 2. Materials — skip any (tenant, category, slug) that already exists.
  let inserted = 0;
  let skipped = 0;
  for (const m of ASSYMO_SEED_MATERIALS) {
    const [existing] = await db
      .select({ id: materialsTable.id })
      .from(materialsTable)
      .where(
        and(
          eq(materialsTable.tenantId, TENANT_ID),
          eq(materialsTable.category, m.category),
          eq(materialsTable.slug, m.slug),
        ),
      )
      .limit(1);
    if (existing) {
      skipped += 1;
      continue;
    }

    const textures = await uploadTextures(m.slug, m.texturePaths);

    await db.insert(materialsTable).values({
      id: randomUUID(),
      tenantId: TENANT_ID,
      category: m.category,
      slug: m.slug,
      name: m.name,
      color: m.color,
      textures,
      tileSize: m.tileSize ?? null,
      pricing: m.pricing,
      flags: m.flags ?? {},
    });
    inserted += 1;
  }

  console.log(
    `[seed] tenant: ${TENANT_ID} (${DEFAULT_HOSTS.length} hosts), ` +
    `materials: ${inserted} inserted / ${skipped} already present (total ${ASSYMO_SEED_MATERIALS.length})`,
  );

  // 3. Products — skip any (tenant, slug) that already exists.
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
