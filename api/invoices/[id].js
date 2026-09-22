const { sql, ensureSchema, rowToInvoice, handleError } = require('../_db');

module.exports = async (req, res) => {
  const { id } = req.query;

  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const { rows } = await sql`SELECT * FROM invoices WHERE id = ${id}`;
      if (!rows.length) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json(rowToInvoice(rows[0]));
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const inv = req.body || {};
      if (!inv.number) return res.status(400).json({ error: 'validation', message: 'Chýba číslo faktúry.' });
      const { rowCount } = await sql`
        UPDATE invoices SET
          number = ${inv.number},
          variable_symbol = ${inv.variableSymbol || null},
          issue_date = ${inv.issueDate || null},
          due_date = ${inv.dueDate || null},
          delivery_date = ${inv.deliveryDate || null},
          payment_method = ${inv.paymentMethod || null},
          client = ${JSON.stringify(inv.client || {})},
          items = ${JSON.stringify(inv.items || [])},
          note = ${inv.note || null},
          paid_at = ${inv.paidAt || null}
        WHERE id = ${id}
      `;
      if (!rowCount) return res.status(404).json({ error: 'not_found' });
      const { rows } = await sql`SELECT * FROM invoices WHERE id = ${id}`;
      return res.status(200).json(rowToInvoice(rows[0]));
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM invoices WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT, PATCH, DELETE');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    return handleError(res, err);
  }
};
