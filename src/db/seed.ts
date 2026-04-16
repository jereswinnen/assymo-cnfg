import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import { DEFAULT_PRICE_BOOK } from '../domain/pricing/priceBook.ts';
import * as schema from './schema.ts';
import { tenants } from './schema.ts';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set — run with --env-file=.env.local');
}

const db = drizzle({ client: neon(process.env.DATABASE_URL), schema });

async function main() {
  await db
    .insert(tenants)
    .values({
      id: 'assymo',
      displayName: 'Assymo',
      locale: 'nl',
      currency: 'EUR',
      priceBook: DEFAULT_PRICE_BOOK,
    })
    .onConflictDoUpdate({
      target: tenants.id,
      set: {
        displayName: sql`excluded.display_name`,
        locale: sql`excluded.locale`,
        currency: sql`excluded.currency`,
        priceBook: sql`excluded.price_book`,
        updatedAt: sql`now()`,
      },
    });

  console.log('Seeded tenant: assymo');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
