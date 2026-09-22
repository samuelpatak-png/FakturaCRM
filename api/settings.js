const { sql, ensureSchema, handleError } = require('./_db');

module.exports = async (req, res) => {
  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const { rows } = await sql`SELECT data FROM settings WHERE id = 1`;
      return res.status(200).json(rows.length ? rows[0].data : {});
    }

    if (req.method === 'PUT') {
      const data = req.body || {};
      await sql`
        INSERT INTO settings (id, data) VALUES (1, ${JSON.stringify(data)})
        ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(data)}
      `;
      return res.status(200).json(data);
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    return handleError(res, err);
  }
};
