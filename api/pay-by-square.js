// Vygeneruje QR kód pre platbu (slovenský štandard Pay by Square) ako SVG.
// GET /api/pay-by-square?iban=...&amount=...&vs=...&note=...&name=...
//
// Poznámka: "bysquare" balík exportuje encode/PaymentOptions/CurrencyCode z podcesty "bysquare/pay"
// (nie z hlavného "bysquare"), je to čisto ESM balík (načítava sa cez dynamický import(), nie require,
// nech ho Vercel-ov bundler pre serverless funkcie spoľahlivo zabalí), vyžaduje platný IBAN
// (overuje sa kontrolný súčet, nielen formát) a vyžaduje meno príjemcu (beneficiary.name) —
// všetko overené lokálnym testom pred nasadením.

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { encode, PaymentOptions, CurrencyCode } = await import('bysquare/pay');
  const QRCode = (await import('qrcode')).default;

  const iban = String(req.query.iban || '').replace(/\s+/g, '').toUpperCase();
  const amount = Number(req.query.amount);
  const vs = String(req.query.vs || '').replace(/\D/g, '').slice(0, 10);
  const note = String(req.query.note || '').slice(0, 140);
  const name = String(req.query.name || '').trim().slice(0, 70) || 'Príjemca';

  if (!iban) {
    return res.status(400).json({ error: 'validation', message: 'Chýba IBAN.' });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'validation', message: 'Neplatná suma.' });
  }

  let qrString;
  try {
    const payment = {
      type: PaymentOptions.PaymentOrder,
      amount,
      currencyCode: CurrencyCode.EUR,
      bankAccounts: [{ iban }],
      beneficiary: { name },
    };
    if (vs) payment.variableSymbol = vs;
    if (note) payment.paymentNote = note;
    qrString = encode({ payments: [payment] });
  } catch (err) {
    // Chyby zo "bysquare" (napr. neplatný IBAN podľa kontrolného súčtu) sú vždy problém vstupu.
    return res.status(400).json({ error: 'validation', message: (err && err.message) || 'Neplatné platobné údaje.' });
  }

  try {
    const svg = await QRCode.toString(qrString, { type: 'svg', margin: 1, width: 240 });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(svg);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error', message: String((err && err.message) || err) });
  }
};
