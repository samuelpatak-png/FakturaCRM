const { randomUUID } = require('crypto');
const { sql, ensureSchema, rowToInvoice, handleError } = require('../_db');

module.exports = async (req, res) => {
  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const { rows } = await sql`SELECT * FROM invoices ORDER BY created_at DESC`;
      return res.status(200).json(rows.map(rowToInvoice));
    }

    if (req.method === 'POST') {
      const inv = req.body || {};
      if (!inv.number) return res.status(400).json({ error: 'validation', message: 'Chýba číslo faktúry.' });
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      await sql`
        INSERT INTO invoices (
          id, number, variable_symbol, issue_date, due_date, delivery_date, payment_method,
          client, items, note, paid_at, created_at, payments, doc_type,
          related_invoice_id, related_invoice_number, converted_to_invoice_id, converted_to_invoice_number, valid_until
        )
        VALUES (
          ${id}, ${inv.number}, ${inv.variableSymbol || null}, ${inv.issueDate || null}, ${inv.dueDate || null}, ${inv.deliveryDate || null}, ${inv.paymentMethod || null},
          ${JSON.stringify(inv.client || {})}, ${JSON.stringify(inv.items || [])}, ${inv.note || null}, ${inv.paidAt || null}, ${createdAt},
          ${JSON.stringify(inv.payments || [])}, ${inv.docType || 'invoice'},
          ${inv.relatedInvoiceId || null}, ${inv.relatedInvoiceNumber || null}, ${inv.convertedToInvoiceId || null}, ${inv.convertedToInvoiceNumber || null}, ${inv.validUntil || null}
        )
      `;
      return res.status(201).json(Object.assign({}, inv, { id, createdAt, payments: inv.payments || [] }));
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM invoices`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    return handleError(res, err);
  }
};
