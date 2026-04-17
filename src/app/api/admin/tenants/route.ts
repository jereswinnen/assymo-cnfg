import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { tenantHosts, tenants } from '@/db/schema';
import { DEFAULT_PRICE_BOOK, type PriceBook } from '@/domain/pricing';
import type { Currency, Locale } from '@/domain/tenant';
import { requireRole } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

const TENANT_ID_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
const ALLOWED_LOCALES: readonly Locale[] = ['nl', 'fr', 'en'];
const ALLOWED_CURRENCIES: readonly Currency[] = ['EUR'];

interface CreateTenantBody {
  id?: unknown;
  displayName?: unknown;
  locale?: unknown;
  currency?: unknown;
  priceBook?: unknown;
  hosts?: unknown;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/** super_admin creates a new tenant. Tenant id is a stable slug used
 *  in every FK. Hosts are inserted into `tenant_hosts` atomically with
 *  the tenant row — if any host conflicts with an existing row the
 *  whole create is rejected (409). */
export const POST = withSession(async (session, req) => {
  requireRole(session, ['super_admin']);

  let body: CreateTenantBody;
  try {
    body = (await req.json()) as CreateTenantBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const errors: string[] = [];

  if (!isNonEmptyString(body.id) || !TENANT_ID_RE.test(body.id)) errors.push('id');
  if (!isNonEmptyString(body.displayName)) errors.push('displayName');
  if (typeof body.locale !== 'string' || !ALLOWED_LOCALES.includes(body.locale as Locale)) {
    errors.push('locale');
  }
  if (typeof body.currency !== 'string' || !ALLOWED_CURRENCIES.includes(body.currency as Currency)) {
    errors.push('currency');
  }

  const hosts = Array.isArray(body.hosts) ? body.hosts : [];
  if (!Array.isArray(body.hosts) && body.hosts !== undefined) errors.push('hosts');
  for (let i = 0; i < hosts.length; i++) {
    if (!isNonEmptyString(hosts[i])) errors.push(`hosts[${i}]`);
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: 'validation_failed', details: errors }, { status: 422 });
  }

  const id = (body.id as string).toLowerCase();
  const displayName = body.displayName as string;
  const locale = body.locale as Locale;
  const currency = body.currency as Currency;
  const priceBook = (body.priceBook as PriceBook | undefined) ?? DEFAULT_PRICE_BOOK;
  const normalizedHosts = (hosts as string[]).map((h) => h.toLowerCase());

  try {
    const [tenant] = await db
      .insert(tenants)
      .values({ id, displayName, locale, currency, priceBook })
      .returning();

    if (normalizedHosts.length > 0) {
      await db
        .insert(tenantHosts)
        .values(normalizedHosts.map((hostname) => ({ hostname, tenantId: id })));
    }

    return NextResponse.json({ tenant, hosts: normalizedHosts }, { status: 201 });
  } catch (err) {
    // Unique-violation on either the tenants PK or tenant_hosts PK.
    const message = err instanceof Error ? err.message : String(err);
    if (/duplicate key|unique/i.test(message)) {
      return NextResponse.json({ error: 'conflict' }, { status: 409 });
    }
    throw err;
  }
});
