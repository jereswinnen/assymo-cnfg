import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import { DEFAULT_PRICE_BOOK } from '../domain/pricing/priceBook.ts';
import { DEFAULT_ASSYMO_BRANDING } from '../domain/tenant/branding.ts';
import * as schema from './schema.ts';
import { tenantHosts, tenants } from './schema.ts';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set — run with --env-file=.env.local');
}

const db = drizzle({ client: neon(process.env.DATABASE_URL), schema });

const DEFAULT_HOSTS = ['localhost', 'localhost:3000', 'assymo.be'];

async function main() {
  await db
    .insert(tenants)
    .values({
      id: 'assymo',
      displayName: 'Assymo',
      locale: 'nl',
      currency: 'EUR',
      priceBook: DEFAULT_PRICE_BOOK,
      branding: DEFAULT_ASSYMO_BRANDING,
    })
    .onConflictDoUpdate({
      target: tenants.id,
      set: {
        displayName: sql`excluded.display_name`,
        locale: sql`excluded.locale`,
        currency: sql`excluded.currency`,
        priceBook: sql`excluded.price_book`,
        branding: sql`excluded.branding`,
        updatedAt: sql`now()`,
      },
    });

  for (const hostname of DEFAULT_HOSTS) {
    await db
      .insert(tenantHosts)
      .values({ hostname, tenantId: 'assymo' })
      .onConflictDoNothing({ target: tenantHosts.hostname });
  }

  console.log(`Seeded tenant: assymo (${DEFAULT_HOSTS.length} hosts)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
