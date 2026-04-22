/**
 * One-shot: copy the PBR textures from wall-category rows to door-category
 * rows sharing the same slug, for the Assymo tenant. Doors were originally
 * color-only; this seeds them with the same material maps their wall
 * counterpart carries so the 3D canvas renders wooden/metal/etc. doors
 * with texture instead of a flat color swatch.
 *
 * Run once after `scripts/seed-textures.ts`:
 *   pnpm tsx --env-file=.env.local scripts/seed-door-textures.ts
 *
 * Idempotent — door rows that already have textures are skipped.
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { and, eq } from 'drizzle-orm';
import { materials } from '../src/db/schema.ts';

const TENANT_ID = 'assymo';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const db = drizzle({ client: neon(process.env.DATABASE_URL) });

  const rows = await db
    .select()
    .from(materials)
    .where(eq(materials.tenantId, TENANT_ID));

  const wallBySlug = new Map(
    rows.filter((r) => r.category === 'wall').map((r) => [r.slug, r]),
  );
  const doorRows = rows.filter((r) => r.category === 'door');

  let copied = 0;
  let skipped = 0;
  let noMatch = 0;

  for (const door of doorRows) {
    if (door.textures?.color) {
      skipped += 1;
      continue;
    }
    const wall = wallBySlug.get(door.slug);
    if (!wall || !wall.textures?.color) {
      noMatch += 1;
      continue;
    }

    await db
      .update(materials)
      .set({
        textures: wall.textures,
        tileSize: door.tileSize ?? wall.tileSize,
      })
      .where(and(eq(materials.tenantId, TENANT_ID), eq(materials.id, door.id)));

    copied += 1;
    console.log(`[seed-door-textures] copied wall/${wall.slug} → door/${door.slug}`);
  }

  console.log(
    `[seed-door-textures] done — copied: ${copied}, skipped (already set): ${skipped}, ` +
    `no matching wall texture: ${noMatch}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
