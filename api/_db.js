// Zdieľaná DB vrstva pre API funkcie. Dátumy sa ukladajú ako obyčajný text (YYYY-MM-DD),
// nie ako natívny DATE typ — appka s nimi aj tak pracuje len ako s reťazcami na strane klienta.
const { sql } = require('@vercel/postgres');

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL,
      variable_symbol TEXT,
      issue_date TEXT,
      due_date TEXT,
      delivery_date TEXT,
      payment_method TEXT,
      client JSONB,
      items JSONB,
      note TEXT,
      paid_at TEXT,
      created_at TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      id INT PRIMARY KEY DEFAULT 1,
      data JSONB NOT NULL
    )
  `;
  schemaReady = true;
}

function rowToInvoice(row) {
  return {
    id: row.id,
    number: row.number,
    variableSymbol: row.variable_symbol,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    deliveryDate: row.delivery_date,
    paymentMethod: row.payment_method,
    client: row.client,
    items: row.items,
    note: row.note,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

function handleError(res, err) {
  console.error(err);
  res.status(500).json({ error: 'server_error', message: String((err && err.message) || err) });
}

module.exports = { sql, ensureSchema, rowToInvoice, handleError };
