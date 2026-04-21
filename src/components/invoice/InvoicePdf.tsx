import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { InvoiceRecord, PaymentStatus } from '@/domain/invoicing';
import type { OrderRecord } from '@/domain/orders';
import { t } from '@/lib/i18n';

interface Props {
  invoice: InvoiceRecord;
  order: OrderRecord;
  status: PaymentStatus;
}

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  supplierBlock: { width: '50%' },
  metaBlock: { width: '50%', textAlign: 'right' },
  h1: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  customerBlock: { marginBottom: 24 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  muted: { color: '#555' },
  line: { marginBottom: 2 },
  table: { marginTop: 12, marginBottom: 12 },
  tableRow: { flexDirection: 'row', borderBottom: '1 solid #ddd', paddingVertical: 4 },
  tableHeader: { flexDirection: 'row', borderBottom: '1 solid #000', paddingVertical: 4, fontWeight: 'bold' },
  labelCol: { flex: 3 },
  amountCol: { flex: 1, textAlign: 'right' },
  totals: { alignSelf: 'flex-end', width: '40%', marginTop: 8 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalsGrand: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4, borderTop: '1 solid #000', fontWeight: 'bold' },
  footer: { position: 'absolute', bottom: 32, left: 48, right: 48, fontSize: 9, color: '#666', textAlign: 'center' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, fontSize: 9, borderRadius: 4, alignSelf: 'flex-end' },
});

const fmtCents = (cents: number, currency: string) =>
  (cents / 100).toLocaleString('nl-BE', { style: 'currency', currency, minimumFractionDigits: 2 });

/** Accepts both the DB shape (Date) and the wire shape (ISO string) so
 *  the same component renders whether it's handed a freshly-queried row
 *  or a JSON-round-tripped record. */
const fmtDate = (value: Date | string) => new Date(value).toLocaleDateString('nl-BE');

export function InvoicePdf({ invoice, order, status }: Props) {
  const s = invoice.supplierSnapshot;
  const lineItems = order.quoteSnapshot.items.flatMap((item) => item.lineItems);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.supplierBlock}>
            <Text style={styles.h1}>{s.displayName}</Text>
            <Text style={styles.line}>{s.address}</Text>
            {s.vatNumber && <Text style={styles.line}>BTW: {s.vatNumber}</Text>}
            <Text style={styles.line}>{s.contactEmail}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.h1}>{t('invoice.pdf.title')}</Text>
            <Text style={styles.line}>{t('invoice.pdf.number')}: {invoice.number}</Text>
            <Text style={styles.line}>{t('invoice.pdf.issuedAt')}: {fmtDate(invoice.issuedAt)}</Text>
            <Text style={styles.line}>{t('invoice.pdf.dueAt')}: {fmtDate(invoice.dueAt)}</Text>
            <Text style={{ ...styles.statusPill, color: statusColor(status) }}>
              {t(`invoice.pdf.status.${status}`)}
            </Text>
          </View>
        </View>

        <View style={styles.customerBlock}>
          <Text style={styles.sectionTitle}>{t('invoice.pdf.customer')}</Text>
          <Text style={styles.line}>{invoice.customerName}</Text>
          {invoice.customerAddress.split('\n').map((line, i) => (
            <Text key={i} style={styles.line}>{line}</Text>
          ))}
          <Text style={{ ...styles.line, ...styles.muted }}>{order.contactEmail}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.labelCol}>{t('invoice.pdf.lineItems.description')}</Text>
            <Text style={styles.amountCol}>{t('invoice.pdf.lineItems.amount')}</Text>
          </View>
          {lineItems.map((li, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.labelCol}>{t(li.labelKey, li.labelParams)}</Text>
              <Text style={styles.amountCol}>{fmtCents(Math.round(li.total * 100), invoice.currency)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text>{t('invoice.pdf.subtotal')}</Text>
            <Text>{fmtCents(invoice.subtotalCents, invoice.currency)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>{t('invoice.pdf.vat', { rate: (Number(invoice.vatRate) * 100).toFixed(0) })}</Text>
            <Text>{fmtCents(invoice.vatCents, invoice.currency)}</Text>
          </View>
          <View style={styles.totalsGrand}>
            <Text>{t('invoice.pdf.grandTotal')}</Text>
            <Text>{fmtCents(invoice.totalCents, invoice.currency)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          {t('invoice.pdf.paymentInstructions', {
            iban: s.bankIban,
            bic: s.bankBic ?? '-',
            reference: invoice.number,
          })}
        </Text>
      </Page>
    </Document>
  );
}

function statusColor(status: PaymentStatus): string {
  switch (status) {
    case 'paid': return '#16a34a';
    case 'partial': return '#ca8a04';
    case 'overpaid': return '#7c3aed';
    case 'unpaid': return '#dc2626';
  }
}
