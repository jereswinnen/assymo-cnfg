import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as appSchema from './schema';
import * as authSchema from './auth-schema';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env.local and fill in the Neon pooled connection string.',
  );
}

const schema = { ...appSchema, ...authSchema };

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle({ client: sql, schema });

export { schema };
