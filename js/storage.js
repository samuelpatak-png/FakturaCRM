// Dátová vrstva appky — faktúry a nastavenia žijú v spoločnej Postgres databáze (cez /api/*).
// Čítania (getInvoices/getSettings/...) sú synchrónne a čítajú z lokálnej pamäťovej kópie,
// ktorá sa naplní pri štarte (Store.init) a drží sa v sync po každej úspešnej zápisovej operácii —
// vďaka tomu väčšina obrazoviek (dashboard, faktúry, štatistiky) nemusí vôbec riešiť asynchronicitu.
'use strict';

const DEFAULT_SETTINGS = {
  companyName: '',
  street: '',
  city: '',
  zip: '',
  country: 'Slovensko',
  ico: '',
  dic: '',
  icDph: '',
  isVatPayer: false,
  bankName: '',
  iban: '',
  swift: '',
  email: '',
  phone: '',
  defaultDueDays: 14,
  defaultVatRate: 20,
  invoicePrefix: 'FA',
  footerNote: '',
  theme: 'system',
};

let _invoicesCache = [];
let _settingsCache = Object.assign({}, DEFAULT_SETTINGS);

async function apiFetch(url, options) {
  const res = await fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options));
  let body = null;
  try { body = await res.json(); } catch (err) { /* prázdna odpoveď */ }
  if (!res.ok) {
    throw new Error((body && (body.message || body.error)) || `Chyba servera (${res.status})`);
  }
  return body;
}

const Store = {
  async init() {
    const [invoices, settings] = await Promise.all([
      apiFetch('/api/invoices'),
      apiFetch('/api/settings'),
    ]);
    _invoicesCache = invoices || [];
    _settingsCache = Object.assign({}, DEFAULT_SETTINGS, settings || {});
  },

  getSettings() {
    return _settingsCache;
  },

  async saveSettings(settings) {
    const saved = await apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(settings) });
    _settingsCache = Object.assign({}, DEFAULT_SETTINGS, saved);
    return _settingsCache;
  },

  getInvoices() {
    return _invoicesCache;
  },

  getInvoice(id) {
    return _invoicesCache.find((inv) => inv.id === id) || null;
  },

  async createInvoice(data) {
    const created = await apiFetch('/api/invoices', { method: 'POST', body: JSON.stringify(data) });
    _invoicesCache = [created, ..._invoicesCache];
    return created;
  },

  async updateInvoice(id, data) {
    const idx = _invoicesCache.findIndex((inv) => inv.id === id);
    if (idx === -1) return null;
    const merged = Object.assign({}, _invoicesCache[idx], data);
    const updated = await apiFetch(`/api/invoices/${id}`, { method: 'PUT', body: JSON.stringify(merged) });
    _invoicesCache = _invoicesCache.map((inv) => (inv.id === id ? updated : inv));
    return updated;
  },

  // Odstráni faktúru len z lokálnej kópie (bez volania API) — používa sa pri "Undo" mazaní,
  // kde sa faktúra z appky zmizne okamžite, ale na serveri sa zmaže až po uplynutí undo okna.
  removeFromCache(id) {
    const removed = _invoicesCache.find((inv) => inv.id === id) || null;
    _invoicesCache = _invoicesCache.filter((inv) => inv.id !== id);
    return removed;
  },

  restoreToCache(invoice) {
    if (!invoice || _invoicesCache.some((inv) => inv.id === invoice.id)) return;
    _invoicesCache = [invoice, ..._invoicesCache];
  },

  async commitDeleteInvoice(id) {
    await apiFetch(`/api/invoices/${id}`, { method: 'DELETE' });
  },

  async deleteInvoice(id) {
    const removed = this.removeFromCache(id);
    try {
      await this.commitDeleteInvoice(id);
    } catch (err) {
      this.restoreToCache(removed);
      throw err;
    }
  },

  // -- Platby (podporujú aj čiastočné platby) --------------------------
  async addPayment(id, amount, date) {
    const inv = this.getInvoice(id);
    if (!inv) return null;
    const payments = (inv.payments || []).concat([{ date: date || todayISO(), amount: Number(amount) || 0 }]);
    return this.updateInvoice(id, { payments, paidAt: null });
  },

  async removePayment(id, index) {
    const inv = this.getInvoice(id);
    if (!inv) return null;
    const payments = (inv.payments || []).slice();
    payments.splice(index, 1);
    return this.updateInvoice(id, { payments });
  },

  // Rýchla akcia: doplatiť celý zostatok jedným klikom.
  async markFullyPaid(id) {
    const inv = this.getInvoice(id);
    if (!inv) return null;
    const remaining = getRemainingAmount(inv);
    if (remaining <= 0) return inv;
    return this.addPayment(id, remaining);
  },

  // Rýchla akcia: vynulovať všetky zaznamenané platby.
  async markUnpaid(id) {
    return this.updateInvoice(id, { payments: [], paidAt: null });
  },

  async wipeInvoices() {
    await apiFetch('/api/invoices', { method: 'DELETE' });
    _invoicesCache = [];
  },

  nextInvoiceNumber(settings, docType) {
    const year = new Date().getFullYear();
    const prefixes = { invoice: settings.invoicePrefix || 'FA', quote: 'CP', credit_note: 'DOB' };
    const prefix = (prefixes[docType] || prefixes.invoice).trim() || 'FA';
    const pattern = new RegExp('^' + escapeRegex(prefix) + '-' + year + '-(\\d+)$');
    let max = 0;
    this.getInvoices().forEach((inv) => {
      const m = pattern.exec(inv.number || '');
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    const next = String(max + 1).padStart(3, '0');
    return `${prefix}-${year}-${next}`;
  },

  // Vytvorí novú faktúru z cenovej ponuky (rovnaký klient/položky, nové číslo a dátumy)
  // a označí ponuku ako premenenú.
  async convertQuoteToInvoice(quoteId) {
    const quote = this.getInvoice(quoteId);
    if (!quote) return null;
    const settings = this.getSettings();
    const issueDate = todayISO();
    const number = this.nextInvoiceNumber(settings, 'invoice');
    const data = {
      number,
      variableSymbol: number.replace(/\D/g, ''),
      issueDate,
      dueDate: addDays(issueDate, settings.defaultDueDays || 14),
      deliveryDate: issueDate,
      paymentMethod: quote.paymentMethod,
      client: quote.client,
      items: quote.items,
      note: quote.note,
      docType: 'invoice',
      payments: [],
    };
    const created = await this.createInvoice(data);
    await this.updateInvoice(quoteId, { convertedToInvoiceId: created.id, convertedToInvoiceNumber: created.number });
    return created;
  },

  getClientSuggestions() {
    const seen = new Map();
    this.getInvoices().forEach((inv) => {
      if (inv.client && inv.client.name && !seen.has(inv.client.name)) {
        seen.set(inv.client.name, inv.client);
      }
    });
    return Array.from(seen.values());
  },

  exportAll() {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        app: 'FakturaCRM',
        version: 1,
        settings: this.getSettings(),
        invoices: this.getInvoices(),
      },
      null,
      2
    );
  },

  async importAll(jsonString) {
    const data = JSON.parse(jsonString);
    if (!data || !Array.isArray(data.invoices)) {
      throw new Error('Neplatný formát súboru zálohy.');
    }
    await apiFetch('/api/invoices/import', {
      method: 'POST',
      body: JSON.stringify({ invoices: data.invoices, settings: data.settings || null }),
    });
    await this.init();
  },

  // Jednoduchý peňažný denník (len príjmová strana — appka nesleduje výdaje) pre účtovníčku, ako CSV.
  // Jeden riadok = jedna prijatá platba (aj čiastočná), nie jedna faktúra.
  exportPenaznyDennikCsv() {
    const entries = [];
    this.getInvoices().forEach((inv) => {
      if ((inv.docType || 'invoice') !== 'invoice') return;
      const desc = (inv.items || []).map((it) => it.description).filter(Boolean).join('; ');
      getInvoicePayments(inv).forEach((p) => {
        entries.push({
          date: p.date || '',
          number: inv.number || '',
          client: (inv.client && inv.client.name) || '',
          desc,
          amount: Number(p.amount) || 0,
        });
      });
    });
    entries.sort((a, b) => a.date.localeCompare(b.date));

    const header = ['Dátum úhrady', 'Doklad č.', 'Odberateľ', 'Popis', 'Suma (€)'];
    const rows = entries.map((e) => [formatDate(e.date), e.number, e.client, e.desc, csvAmount(e.amount)]);
    const total = entries.reduce((sum, e) => sum + e.amount, 0);
    rows.push(['', '', '', 'Spolu', csvAmount(total)]);

    const lines = [header, ...rows].map((row) => row.map(csvEscape).join(';'));
    return '﻿' + lines.join('\r\n'); // BOM, nech Excel správne zobrazí diakritiku
  },
};

function csvAmount(n) {
  return (Number(n) || 0).toFixed(2).replace('.', ',');
}

function csvEscape(value) {
  const str = String(value == null ? '' : value);
  return /[;"\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---- Výpočty nad faktúrou -------------------------------------------------

function computeItemTotal(item) {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unitPrice) || 0;
  return qty * price;
}

function computeInvoiceTotals(invoice) {
  const items = invoice.items || [];
  let subtotal = 0;
  const vatGroups = new Map();

  items.forEach((item) => {
    const lineTotal = computeItemTotal(item);
    subtotal += lineTotal;
    const rate = Number(item.vatRate) || 0;
    const vatAmount = (lineTotal * rate) / 100;
    vatGroups.set(rate, (vatGroups.get(rate) || 0) + vatAmount);
  });

  let vatTotal = 0;
  vatGroups.forEach((amount) => (vatTotal += amount));

  return {
    subtotal,
    vatTotal,
    total: subtotal + vatTotal,
    vatBreakdown: Array.from(vatGroups.entries())
      .filter(([rate]) => rate > 0)
      .map(([rate, amount]) => ({ rate, amount })),
  };
}

// Zoznam platieb faktúry — normalizovaný aj pre staršie faktúry, ktoré majú len paidAt
// (z čias pred čiastočnými platbami): tie sa berú ako jedna platba na celú sumu.
function getInvoicePayments(invoice) {
  if (invoice.payments && invoice.payments.length) return invoice.payments;
  if (invoice.paidAt) return [{ date: invoice.paidAt, amount: computeInvoiceTotals(invoice).total }];
  return [];
}

function getAmountPaid(invoice) {
  return getInvoicePayments(invoice).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

function getRemainingAmount(invoice) {
  const total = computeInvoiceTotals(invoice).total;
  return Math.max(0, total - getAmountPaid(invoice));
}

// Poradie zámerne: zaplatená → po splatnosti (aj keď je čiastočne uhradená — to potrebuje
// najviac pozornosti) → čiastočne zaplatená → nezaplatená.
function getInvoiceStatus(invoice) {
  const total = computeInvoiceTotals(invoice).total;
  const amountPaid = getAmountPaid(invoice);
  if (total > 0 && amountPaid >= total) return 'paid';
  const due = invoice.dueDate ? new Date(invoice.dueDate) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (due && due < today) return 'overdue';
  if (amountPaid > 0) return 'partial';
  return 'unpaid';
}

const STATUS_LABELS = {
  paid: 'Zaplatená',
  partial: 'Čiastočne zaplatená',
  unpaid: 'Nezaplatená',
  overdue: 'Po splatnosti',
};

// ---- Formátovanie -----------------------------------------------------

const currencyFormatter = new Intl.NumberFormat('sk-SK', {
  style: 'currency',
  currency: 'EUR',
});

function formatCurrency(amount) {
  return currencyFormatter.format(Number(amount) || 0);
}

function formatDate(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthKey(isoDate) {
  return isoDate ? isoDate.slice(0, 7) : '';
}

const MONTH_NAMES_SK = [
  'Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún',
  'Júl', 'August', 'September', 'Október', 'November', 'December',
];

function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES_SK[parseInt(m, 10) - 1]} ${y}`;
}

const MONTH_SHORT_SK = ['Jan', 'Feb', 'Mar', 'Apr', 'Máj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

function monthShortLabel(key) {
  const [, m] = key.split('-');
  return MONTH_SHORT_SK[parseInt(m, 10) - 1];
}

// ---- Agregácie pre dashboard a štatistiky --------------------------------

function isRealInvoice(inv) {
  return (inv.docType || 'invoice') === 'invoice';
}

// Príjem = súčet skutočne prijatých platieb (aj čiastočných), zaradený podľa dátumu KAŽDEJ platby.
function getMonthlySeries(invoices, monthsCount) {
  const now = new Date();
  const keys = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const sums = new Map(keys.map((k) => [k, 0]));
  invoices.forEach((inv) => {
    if (!isRealInvoice(inv)) return;
    getInvoicePayments(inv).forEach((p) => {
      const key = monthKey(p.date);
      if (sums.has(key)) sums.set(key, sums.get(key) + (Number(p.amount) || 0));
    });
  });
  return keys.map((key) => ({
    key,
    value: sums.get(key),
    shortLabel: monthShortLabel(key),
    fullLabel: monthLabel(key),
  }));
}

// Súčty podľa stavu faktúry. "sum" je suma ešte dlžná pri nezaplatených/čiastočných/po splatnosti
// faktúrach, a celková suma pri zaplatených — nech "Neuhradené" vždy zobrazuje skutočný zostatok.
function getStatusAggregates(invoices) {
  const result = {
    paid: { count: 0, sum: 0 },
    partial: { count: 0, sum: 0 },
    unpaid: { count: 0, sum: 0 },
    overdue: { count: 0, sum: 0 },
  };
  invoices.forEach((inv) => {
    if (!isRealInvoice(inv)) return;
    const status = getInvoiceStatus(inv);
    const total = computeInvoiceTotals(inv).total;
    result[status].count += 1;
    result[status].sum += status === 'paid' ? total : getRemainingAmount(inv);
  });
  return result;
}

function sumPaidBetween(invoices, fromISO, toISO) {
  let sum = 0;
  invoices.forEach((inv) => {
    if (!isRealInvoice(inv)) return;
    getInvoicePayments(inv).forEach((p) => {
      if (p.date >= fromISO && p.date <= toISO) sum += Number(p.amount) || 0;
    });
  });
  return sum;
}

function getTopClients(invoices, limit) {
  const map = new Map();
  invoices.forEach((inv) => {
    if (!isRealInvoice(inv)) return;
    const paidAmount = getAmountPaid(inv);
    if (paidAmount <= 0) return;
    const name = (inv.client && inv.client.name) || 'Neznámy klient';
    const entry = map.get(name) || { name, sum: 0, count: 0 };
    entry.sum += paidAmount;
    entry.count += 1;
    map.set(name, entry);
  });
  return Array.from(map.values())
    .sort((a, b) => b.sum - a.sum)
    .slice(0, limit);
}

// Klienti nie sú samostatná entita — odvodzujú sa zoskupením faktúr podľa mena klienta.
// "info" (adresa, IČO...) sa berie z najnovšej faktúry s daným menom.
function getClientOverview(invoices) {
  const map = new Map();
  invoices.forEach((inv) => {
    if (!isRealInvoice(inv)) return;
    const name = (inv.client && inv.client.name) || '';
    if (!name) return;
    const entry = map.get(name) || {
      name,
      count: 0,
      paidSum: 0,
      outstandingSum: 0,
      lastDate: '',
      info: inv.client,
    };
    entry.count += 1;
    entry.paidSum += getAmountPaid(inv);
    entry.outstandingSum += getRemainingAmount(inv);
    const invDate = inv.issueDate || '';
    if (invDate >= entry.lastDate) {
      entry.lastDate = invDate;
      entry.info = inv.client;
    }
    map.set(name, entry);
  });
  return Array.from(map.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

function getClientInvoices(invoices, name) {
  return invoices
    .filter((inv) => isRealInvoice(inv) && (inv.client && inv.client.name) === name)
    .sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''));
}
