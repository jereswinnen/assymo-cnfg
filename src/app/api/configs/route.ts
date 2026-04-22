import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';
import { db } from '@/db/client';
import { configs } from '@/db/schema';
import {
  contentHash,
  migrateConfig,
  validateConfig,
  type LegacyConfig,
} from '@/domain/config';
import { resolveApiTenant } from '@/lib/apiTenant';

/** Bitcoin-style base58 (no 0/O/I/l). 10 chars ≈ 57.5 bits of entropy.
 *  Collision probability < 1e-8 per tenant at 10k saved scenes. */
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const newCode = customAlphabet(BASE58, 10);

/** Save a configurator scene. Dedupe per tenant by SHA-256 content hash
 *  over the canonicalised ConfigData — saving the same scene twice
 *  returns the existing short code. */
export async function POST(req: NextRequest) {
  const tenant = await resolveApiTenant();
  if (!tenant) {
    return NextResponse.json({ error: 'unknown_tenant' }, { status: 404 });
  }

  let body: { data?: unknown };
  try {
    body = (await req.json()) as { data?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.data || typeof body.data !== 'object') {
    return NextResponse.json({ error: 'data_required' }, { status: 400 });
  }

  let migrated;
  try {
    migrated = migrateConfig(body.data as LegacyConfig);
  } catch {
    return NextResponse.json({ error: 'invalid_data' }, { status: 400 });
  }

  const errors = validateConfig(migrated);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: 'validation_failed', details: errors },
      { status: 422 },
    );
  }

  const hash = await contentHash(migrated);

  const [existing] = await db
    .select({ id: configs.id, code: configs.code })
    .from(configs)
    .where(and(eq(configs.tenantId, tenant.id), eq(configs.contentHash, hash)))
    .limit(1);

  if (existing) {
    return NextResponse.json({ id: existing.id, code: existing.code }, { status: 200 });
  }

  const id = crypto.randomUUID();
  const code = newCode();
  await db.insert(configs).values({
    id,
    tenantId: tenant.id,
    code,
    contentHash: hash,
    data: migrated,
    version: migrated.version,
  });

  return NextResponse.json({ id, code }, { status: 201 });
}
