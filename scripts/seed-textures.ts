/**
 * One-shot restoration: upload the original PBR textures (retrieved from
 * git history — they were deleted from the working tree in commit 14349c4)
 * to Vercel Blob and patch the `materials.textures` column on each Assymo
 * row.
 *
 * Run once after provisioning Blob + `BLOB_READ_WRITE_TOKEN`:
 *   pnpm tsx --env-file=.env.local scripts/seed-textures.ts
 *
 * Idempotent — materials that already have Blob URLs are skipped.
 */
import { execFileSync } from 'node:child_process';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { and, eq } from 'drizzle-orm';
import { put } from '@vercel/blob';
import { materials } from '../src/db/schema.ts';

type TexturePaths = { color: string; normal: string; roughness: string };
type Category = 'wall' | 'roof-cover' | 'roof-trim' | 'floor' | 'door';
interface SeedEntry {
  category: Category;
  slug: string;
  texturePaths?: TexturePaths;
}

const TENANT_ID = 'assymo';
// Commit before the /public/textures/* files were deleted.
const TEXTURE_COMMIT = '14349c4^';
// Commit where seedData.ts still existed (before T14 deleted it).
const SEED_DATA_COMMIT = 'c803511^';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set — run with --env-file=.env.local');
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  throw new Error(
    'BLOB_READ_WRITE_TOKEN is not set — provision Vercel Blob, then `vercel env pull .env.local`.',
  );
}

const db = drizzle({ client: neon(process.env.DATABASE_URL) });

/** Load seedData.ts from git history and extract the seed entries
 *  relevant to this script (category, slug, texturePaths). We parse
 *  loosely via a JSON-like regex rather than evaluating the TS module. */
function loadSeedEntries(): SeedEntry[] {
  const src = execFileSync('git', ['show', `${SEED_DATA_COMMIT}:src/db/seedData.ts`], {
    encoding: 'utf8',
  });

  // Match every `{ category: '...', slug: '...', ... }` object literal.
  // Capture texturePaths if present.
  const entries: SeedEntry[] = [];
  const objectRe = /\{\s*category:\s*'([^']+)',\s*slug:\s*'([^']+)',[\s\S]*?(?=\n\s{2}\},?\n)/g;
  for (const match of src.matchAll(objectRe)) {
    const [block, category, slug] = match;
    const tp = extractTexturePaths(block);
    entries.push({ category: category as Category, slug, texturePaths: tp });
  }
  return entries;
}

function extractTexturePaths(block: string): TexturePaths | undefined {
  const tpMatch = block.match(/texturePaths:\s*\{([\s\S]*?)\}/);
  if (!tpMatch) return undefined;
  const body = tpMatch[1];
  const color = body.match(/color:\s*'([^']+)'/)?.[1];
  const normal = body.match(/normal:\s*'([^']+)'/)?.[1];
  const roughness = body.match(/roughness:\s*'([^']+)'/)?.[1];
  if (!color || !normal || !roughness) return undefined;
  return { color, normal, roughness };
}

/** Read a texture file from git history as a buffer. */
function readTextureFromGit(path: string): Buffer {
  return execFileSync('git', ['show', `${TEXTURE_COMMIT}:${path}`], {
    maxBuffer: 10 * 1024 * 1024, // 10 MB per file; largest textures are ~2 MB
  });
}

async function uploadSlot(
  slug: string,
  slot: 'color' | 'normal' | 'roughness',
  path: string,
): Promise<string> {
  const buf = readTextureFromGit(path);
  const ext = path.endsWith('.png') ? 'png' : 'jpg';
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
  const blob = await put(`textures/${TENANT_ID}/${slug}-${slot}.${ext}`, buf, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return blob.url;
}

async function main() {
  const entries = loadSeedEntries();
  console.log(`[seed-textures] parsed ${entries.length} seed entries from git history`);

  let uploaded = 0;
  let skipped = 0;
  let noRow = 0;
  let noTextures = 0;

  for (const e of entries) {
    if (!e.texturePaths) {
      noTextures += 1;
      continue;
    }

    const rows = await db
      .select({ id: materials.id, textures: materials.textures })
      .from(materials)
      .where(
        and(
          eq(materials.tenantId, TENANT_ID),
          eq(materials.category, e.category),
          eq(materials.slug, e.slug),
        ),
      )
      .limit(1);

    if (!rows[0]) {
      console.warn(`[seed-textures] no row for ${e.category}/${e.slug} — skipping`);
      noRow += 1;
      continue;
    }

    if (rows[0].textures?.color) {
      skipped += 1;
      continue;
    }

    const [colorUrl, normalUrl, roughnessUrl] = await Promise.all([
      uploadSlot(e.slug, 'color', e.texturePaths.color),
      uploadSlot(e.slug, 'normal', e.texturePaths.normal),
      uploadSlot(e.slug, 'roughness', e.texturePaths.roughness),
    ]);

    await db
      .update(materials)
      .set({ textures: { color: colorUrl, normal: normalUrl, roughness: roughnessUrl } })
      .where(eq(materials.id, rows[0].id));

    uploaded += 1;
    console.log(`[seed-textures] uploaded ${e.category}/${e.slug}`);
  }

  console.log(
    `[seed-textures] done — uploaded: ${uploaded}, skipped (already set): ${skipped}, ` +
    `no row: ${noRow}, no texturePaths in seed entry: ${noTextures}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
