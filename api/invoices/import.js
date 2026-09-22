// Hromadné obnovenie zo zálohy (JSON export) — nahradí všetky faktúry a nastavenia.
const { randomUUID } = require('crypto');
const { sql, ensureSchema, handleError } = require('../_db');

module.exports = async (req, res) => {
  try {
    await ensureSchema();

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const { invoices, settings } = req.body || {};
    if (!Array.isArray(invoices)) {
      return res.status(400).json({ error: 'validation', message: 'invoices musí byť pole.' });
    }

    await sql`DELETE FROM invoices`;
    for (const inv of invoices) {
      const id = inv.id || randomUUID();
      await sql`
        INSERT INTO invoices (
          id, number, variable_symbol, issue_date, due_date, delivery_date, payment_method,
          client, items, note, paid_at, created_at, payments, doc_type,
          related_invoice_id, related_invoice_number, converted_to_invoice_id, converted_to_invoice_number, valid_until
        )
        VALUES (
          ${id}, ${inv.number}, ${inv.variableSymbol || null}, ${inv.issueDate || null}, ${inv.dueDate || null}, ${inv.deliveryDate || null}, ${inv.paymentMethod || null},
          ${JSON.stringify(inv.client || {})}, ${JSON.stringify(inv.items || [])}, ${inv.note || null}, ${inv.paidAt || null}, ${inv.createdAt || new Date().toISOString()},
          ${JSON.stringify(inv.payments || [])}, ${inv.docType || 'invoice'},
          ${inv.relatedInvoiceId || null}, ${inv.relatedInvoiceNumber || null}, ${inv.convertedToInvoiceId || null}, ${inv.convertedToInvoiceNumber || null}, ${inv.validUntil || null}
        )
      `;
    }

    if (settings) {
      await sql`
        INSERT INTO settings (id, data) VALUES (1, ${JSON.stringify(settings)})
        ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(settings)}
      `;
    }

    return res.status(200).json({ ok: true, count: invoices.length });
  } catch (err) {
    return handleError(res, err);
  }
};
