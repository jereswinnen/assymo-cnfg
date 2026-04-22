import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '@/db/client';
import { invoices, payments } from '@/db/schema';
import { validatePaymentInput } from '@/domain/invoicing';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

// Matches the ±1 cent tolerance used in derivePaymentStatus so a
// payment that rounds exactly to the total is accepted.
const TOLERANCE_CENTS = 1;

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

  const existing = await db
    .select({ amountCents: payments.amountCents })
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId));
  const paidCents = existing.reduce((a, p) => a + p.amountCents, 0);
  const remainingCents = invoice.totalCents - paidCents;
  if (value.amountCents > remainingCents + TOLERANCE_CENTS) {
    return NextResponse.json(
      {
        error: 'amount_exceeds_total',
        details: {
          totalCents: invoice.totalCents,
          paidCents,
          remainingCents,
        },
      },
      { status: 422 },
    );
  }

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
