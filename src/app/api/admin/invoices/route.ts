import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { invoices } from '@/db/schema';
import { requireBusiness } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

export const GET = withSession(async (session) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const role = session.user.role as 'super_admin' | 'tenant_admin';
  const tenantId = session.user.tenantId as string | null;

  const rows = role === 'super_admin'
    ? await db.select().from(invoices).orderBy(desc(invoices.createdAt))
    : await db.select().from(invoices).where(eq(invoices.tenantId, tenantId!)).orderBy(desc(invoices.createdAt));

  return NextResponse.json({ invoices: rows });
});
