import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '@/db/client';
import { invoices, payments } from '@/db/schema';
import { validatePaymentInput } from '@/domain/invoicing';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

export const POST = withSession(async (session, req, ctx: { params: Promise<{ id: string }> }) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const { id: invoiceId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const { value, errors } = validatePaymentInput(body);
  if (!value) {
    return NextResponse.json({ error: 'validation_failed', details: errors }, { status: 422 });
  }

  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!invoice) return NextResponse.json({ error: 'invoice_not_found' }, { status: 404 });
  requireTenantScope(session, invoice.tenantId);

  const [payment] = await db
    .insert(payments)
    .values({
      id: randomUUID(),
      invoiceId,
      amountCents: value.amountCents,
      currency: invoice.currency,
      method: value.method,
      providerRef: value.providerRef,
      paidAt: new Date(value.paidAt),
      note: value.note,
    })
    .returning();

  return NextResponse.json({ payment }, { status: 201 });
});
