import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { configs } from '@/db/schema';
import {
  decodeState,
  migrateConfig,
  validateConfig,
} from '@/domain/config';
import { resolveApiTenant } from '@/lib/apiTenant';

/** Save a configurator scene by its base58 share code. Idempotent per
 *  (tenant, code): re-submitting the same code returns the existing row
 *  rather than erroring on the unique index. */
export async function POST(req: NextRequest) {
  const tenant = await resolveApiTenant();
  if (!tenant) {
    return NextResponse.json({ error: 'unknown_tenant' }, { status: 404 });
  }

  let body: { code?: unknown };
  try {
    body = (await req.json()) as { code?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!code) {
    return NextResponse.json({ error: 'code_required' }, { status: 400 });
  }

  let decoded;
  try {
    decoded = decodeState(code);
  } catch {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }

  const migrated = migrateConfig(decoded);
  const errors = validateConfig(migrated);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: 'validation_failed', details: errors },
      { status: 422 },
    );
  }

  const existing = await db
    .select({ id: configs.id })
    .from(configs)
    .where(and(eq(configs.tenantId, tenant.id), eq(configs.code, code)))
    .limit(1);

  if (existing[0]) {
    return NextResponse.json({ id: existing[0].id, code }, { status: 200 });
  }

  const id = crypto.randomUUID();
  await db.insert(configs).values({
    id,
    tenantId: tenant.id,
    code,
    contentHash: '', // TODO(Task 4): replace with SHA-256 of canonicalizeConfig(migrated)
    data: migrated,
    version: migrated.version,
  });

  return NextResponse.json({ id, code }, { status: 201 });
}
