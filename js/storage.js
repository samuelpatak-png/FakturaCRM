// Dátová vrstva appky — všetko sa ukladá do localStorage prehliadača.
'use strict';

const STORAGE_KEYS = {
  invoices: 'fakturacrm.invoices.v1',
  settings: 'fakturacrm.settings.v1',
};

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

function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) ||
    'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch (err) {
    console.error('Chyba pri čítaní z localStorage:', key, err);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error('Chyba pri zápise do localStorage:', key, err);
    return false;
  }
}

const Store = {
  getSettings() {
    return Object.assign({}, DEFAULT_SETTINGS, readJSON(STORAGE_KEYS.settings, {}));
  },

  saveSettings(settings) {
    writeJSON(STORAGE_KEYS.settings, settings);
    return settings;
  },

  getInvoices() {
    return readJSON(STORAGE_KEYS.invoices, []);
  },

  saveInvoices(list) {
    writeJSON(STORAGE_KEYS.invoices, list);
    return list;
  },

  getInvoice(id) {
    return this.getInvoices().find((inv) => inv.id === id) || null;
  },

  createInvoice(data) {
    const list = this.getInvoices();
    const invoice = Object.assign(
      {
        id: uid(),
        createdAt: new Date().toISOString(),
        paidAt: null,
      },
      data
    );
    list.push(invoice);
    this.saveInvoices(list);
    return invoice;
  },

  updateInvoice(id, data) {
    const list = this.getInvoices();
    const idx = list.findIndex((inv) => inv.id === id);
    if (idx === -1) return null;
    list[idx] = Object.assign({}, list[idx], data);
    this.saveInvoices(list);
    return list[idx];
  },

  deleteInvoice(id) {
    const list = this.getInvoices().filter((inv) => inv.id !== id);
    this.saveInvoices(list);
  },

  setPaid(id, paid) {
    return this.updateInvoice(id, {
      paidAt: paid ? new Date().toISOString().slice(0, 10) : null,
    });
  },

  nextInvoiceNumber(settings) {
    const year = new Date().getFullYear();
    const prefix = (settings.invoicePrefix || 'FA').trim() || 'FA';
    const list = this.getInvoices();
    const pattern = new RegExp('^' + escapeRegex(prefix) + '-' + year + '-(\\d+)$');
    let max = 0;
    list.forEach((inv) => {
      const m = pattern.exec(inv.number || '');
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    const next = String(max + 1).padStart(3, '0');
    return `${prefix}-${year}-${next}`;
  },

  getClientSuggestions() {
    const list = this.getInvoices();
    const seen = new Map();
    list.forEach((inv) => {
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

  importAll(jsonString) {
    const data = JSON.parse(jsonString);
    if (!data || !Array.isArray(data.invoices)) {
      throw new Error('Neplatný formát súboru zálohy.');
    }
    if (data.settings) this.saveSettings(Object.assign({}, DEFAULT_SETTINGS, data.settings));
    this.saveInvoices(data.invoices);
  },
};

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

function getInvoiceStatus(invoice) {
  if (invoice.paidAt) return 'paid';
  const due = invoice.dueDate ? new Date(invoice.dueDate) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (due && due < today) return 'overdue';
  return 'unpaid';
}

const STATUS_LABELS = {
  paid: 'Zaplatená',
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

// Príjem = súčet faktúr, ktoré sú ZAPLATENÉ, zaradený podľa dátumu úhrady (paidAt).
function getMonthlySeries(invoices, monthsCount) {
  const now = new Date();
  const keys = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const sums = new Map(keys.map((k) => [k, 0]));
  invoices.forEach((inv) => {
    if (!inv.paidAt) return;
    const key = monthKey(inv.paidAt);
    if (sums.has(key)) {
      sums.set(key, sums.get(key) + computeInvoiceTotals(inv).total);
    }
  });
  return keys.map((key) => ({
    key,
    value: sums.get(key),
    shortLabel: monthShortLabel(key),
    fullLabel: monthLabel(key),
  }));
}

function getStatusAggregates(invoices) {
  const result = {
    paid: { count: 0, sum: 0 },
    unpaid: { count: 0, sum: 0 },
    overdue: { count: 0, sum: 0 },
  };
  invoices.forEach((inv) => {
    const status = getInvoiceStatus(inv);
    const total = computeInvoiceTotals(inv).total;
    result[status].count += 1;
    result[status].sum += total;
  });
  return result;
}

function sumPaidBetween(invoices, fromISO, toISO) {
  return invoices
    .filter((inv) => inv.paidAt && inv.paidAt >= fromISO && inv.paidAt <= toISO)
    .reduce((sum, inv) => sum + computeInvoiceTotals(inv).total, 0);
}

function getTopClients(invoices, limit) {
  const map = new Map();
  invoices.forEach((inv) => {
    if (getInvoiceStatus(inv) !== 'paid') return;
    const name = (inv.client && inv.client.name) || 'Neznámy klient';
    const total = computeInvoiceTotals(inv).total;
    const entry = map.get(name) || { name, sum: 0, count: 0 };
    entry.sum += total;
    entry.count += 1;
    map.set(name, entry);
  });
  return Array.from(map.values())
    .sort((a, b) => b.sum - a.sum)
    .slice(0, limit);
}
