import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '@/db/client';
import { invoiceNumbers, invoices, orders, tenants } from '@/db/schema';
import {
  buildSupplierSnapshot,
  computeInvoiceAmounts,
  formatInvoiceNumber,
  validateIssueInvoiceInput,
} from '@/domain/invoicing';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';
import { auth } from '@/lib/auth';

export const POST = withSession(async (session, req, ctx: { params: Promise<{ id: string }> }) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const { id: orderId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const { value, errors } = validateIssueInvoiceInput(body);
  if (!value) {
    return NextResponse.json({ error: 'validation_failed', details: errors }, { status: 422 });
  }

  // Resolve order + tenant scope
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
  requireTenantScope(session, order.tenantId);

  if (order.status !== 'accepted') {
    return NextResponse.json({ error: 'order_not_invoiceable', details: { status: order.status } }, { status: 422 });
  }

  // 1:1 constraint: one invoice per order
  const [existing] = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.orderId, orderId)).limit(1);
  if (existing) {
    return NextResponse.json({ error: 'already_invoiced', details: { invoiceId: existing.id } }, { status: 409 });
  }

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, order.tenantId)).limit(1);
  if (!tenant) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });
  if (!tenant.invoicing.bankIban) {
    return NextResponse.json({ error: 'supplier_incomplete', details: ['bankIban'] }, { status: 422 });
  }

  // Compute amounts
  const amounts = computeInvoiceAmounts({
    subtotalCents: order.totalCents,
    vatRate: value.vatRate,
  });

  // Atomic sequence allocation
  const year = new Date(value.issuedAt).getUTCFullYear();
  const [numberRow] = await db
    .insert(invoiceNumbers)
    .values({ tenantId: order.tenantId, year, lastSeq: 1 })
    .onConflictDoUpdate({
      target: invoiceNumbers.tenantId,
      set: {
        year,
        lastSeq: sql`CASE WHEN ${invoiceNumbers.year} = ${year} THEN ${invoiceNumbers.lastSeq} + 1 ELSE 1 END`,
      },
    })
    .returning({ year: invoiceNumbers.year, lastSeq: invoiceNumbers.lastSeq });

  const number = formatInvoiceNumber(numberRow.year, numberRow.lastSeq);

  // Freeze supplier snapshot
  const supplierSnapshot = buildSupplierSnapshot({
    displayName: tenant.displayName,
    branding: tenant.branding,
    invoicing: tenant.invoicing,
  });

  // Insert the invoice
  const [invoice] = await db
    .insert(invoices)
    .values({
      id: randomUUID(),
      tenantId: order.tenantId,
      orderId: order.id,
      number,
      issuedAt: new Date(value.issuedAt),
      dueAt: new Date(value.dueAt),
      customerAddress: value.customerAddress,
      customerName: value.customerName,
      subtotalCents: amounts.subtotalCents,
      vatRate: String(value.vatRate),
      vatCents: amounts.vatCents,
      totalCents: amounts.totalCents,
      currency: order.currency,
      supplierSnapshot,
      pdfUrl: null,
    })
    .returning();

  // Best-effort: fire a magic-link email to the customer. The invoice is
  // already persisted, so we still 201 even if delivery flakes. If the
  // order has no customerId (magic link never claimed), we use the
  // order's contactEmail so the customer still gets notified.
  try {
    await auth.api.signInMagicLink({
      body: {
        email: order.contactEmail,
        callbackURL: `/shop/account/invoices/${invoice.id}`,
      },
      headers: new Headers(),
    });
  } catch {
    // Ignore — invoice creation is the primary effect.
  }

  return NextResponse.json({ invoice }, { status: 201 });
});
