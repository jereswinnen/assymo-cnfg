import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env.local' });

if (!process.env.DATABASE_URL_UNPOOLED) {
  throw new Error(
    'DATABASE_URL_UNPOOLED is not set. Copy .env.example to .env.local and fill in the Neon unpooled connection string.',
  );
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED,
  },
  strict: true,
  verbose: true,
});
