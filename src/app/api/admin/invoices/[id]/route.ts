import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { invoices, payments } from '@/db/schema';
import { derivePaymentStatus } from '@/domain/invoicing';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

export const GET = withSession(async (session, _req, ctx: { params: Promise<{ id: string }> }) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const { id } = await ctx.params;

  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!invoice) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  requireTenantScope(session, invoice.tenantId);

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, id))
    .orderBy(asc(payments.paidAt));

  const status = derivePaymentStatus(invoice.totalCents, paymentRows);
  return NextResponse.json({ invoice, payments: paymentRows, status });
});
