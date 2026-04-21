import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { invoices, orders, payments } from '@/db/schema';
import { derivePaymentStatus } from '@/domain/invoicing';
import { requireClient } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

interface Ctx { params: Promise<{ id: string }> }

/** Fetch a single invoice by id, strictly scoped to the caller's own
 *  order (`order.customerId === session.user.id`). Returns 404 for
 *  both "not found" and "not yours" to avoid leaking existence of
 *  another client's invoice. */
export const GET = withSession(async (session, _req, { params }: Ctx) => {
  requireClient(session);
  const { id } = await params;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);
  if (!invoice) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, invoice.orderId))
    .limit(1);
  if (!order || order.customerId !== session.user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, id))
    .orderBy(asc(payments.paidAt));
  const status = derivePaymentStatus(invoice.totalCents, paymentRows);

  return NextResponse.json({ invoice, order, payments: paymentRows, status });
});
