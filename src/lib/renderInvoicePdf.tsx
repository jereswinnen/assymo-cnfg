import { renderToStream } from '@react-pdf/renderer';
import { InvoicePdf } from '@/components/invoice/InvoicePdf';
import type { InvoiceRecord, PaymentStatus } from '@/domain/invoicing';
import type { OrderRecord } from '@/domain/orders';

/** Render an invoice as a Node Readable stream of application/pdf bytes.
 *  Callers are responsible for piping the stream into the Response body. */
export async function renderInvoicePdfStream(args: {
  invoice: InvoiceRecord;
  order: OrderRecord;
  status: PaymentStatus;
}): Promise<NodeJS.ReadableStream> {
  return renderToStream(<InvoicePdf {...args} />);
}
