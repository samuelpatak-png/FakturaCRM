// Obrazovka: Nová / Upraviť faktúru
'use strict';

const UNIT_OPTIONS = ['ks', 'hod', 'deň', 'mesiac', 'km', 'balík', 'sada'];
const PAYMENT_METHODS = ['Bankový prevod', 'Hotovosť', 'Platobná karta'];

// Mimo-klik poslucháč pre autocomplete sa pri každom vykreslení formulára nahrádza,
// nech sa pri opakovanom otvorení formulára nehromadí na document.
let invoiceFormOutsideClickHandler = null;

Views.invoiceForm = function renderInvoiceForm(root, params) {
  const editingId = params && params.id;
  const existing = editingId ? Store.getInvoice(editingId) : null;
  const settings = Store.getSettings();

  if (editingId && !existing) {
    root.innerHTML = emptyStateHtml({
      icon: Icons.alertTriangle,
      title: 'Faktúra sa nenašla',
      message: 'Táto faktúra už možno bola odstránená.',
      actionHtml: `<a href="#invoices" class="btn btn-primary">Späť na faktúry</a>`,
    });
    return;
  }

  const defaultIssueDate = todayISO();
  const state = existing
    ? JSON.parse(JSON.stringify(existing))
    : {
        id: null,
        number: Store.nextInvoiceNumber(settings),
        variableSymbol: '',
        issueDate: defaultIssueDate,
        dueDate: addDays(defaultIssueDate, settings.defaultDueDays || 14),
        deliveryDate: defaultIssueDate,
        paymentMethod: PAYMENT_METHODS[0],
        client: { name: '', street: '', city: '', zip: '', country: 'Slovensko', ico: '', dic: '', icDph: '' },
        items: [emptyItem(settings)],
        note: '',
      };
  if (!state.client) state.client = { name: '', street: '', city: '', zip: '', country: 'Slovensko', ico: '', dic: '', icDph: '' };
  if (!state.items || !state.items.length) state.items = [emptyItem(settings)];
  state.variableSymbol = state.variableSymbol || state.number.replace(/\D/g, '');

  let dueDateTouched = !!existing;

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${existing ? 'Upraviť faktúru' : 'Nová faktúra'}</h1>
        <p class="page-subtitle">${existing ? escapeHtml(existing.number) : 'Vyplň údaje a vystav faktúru'}</p>
      </div>
    </div>

    <form id="invoiceForm" novalidate>
      <div class="card card-pad" style="margin-bottom:20px;">
        <div class="form-section">
          <div class="form-section-title">Základné údaje</div>
          <div class="form-grid cols-3">
            <div class="field">
              <label for="f-number">Číslo faktúry *</label>
              <input type="text" id="f-number" value="${escapeHtml(state.number)}" required>
              <span class="error-text" data-error="number" hidden></span>
            </div>
            <div class="field">
              <label for="f-vs">Variabilný symbol</label>
              <input type="text" id="f-vs" value="${escapeHtml(state.variableSymbol)}">
            </div>
            <div class="field">
              <label for="f-payment">Forma úhrady</label>
              <select id="f-payment">
                ${PAYMENT_METHODS.map((m) => `<option value="${m}" ${state.paymentMethod === m ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="f-issue">Dátum vystavenia *</label>
              <input type="date" id="f-issue" value="${state.issueDate}" required>
            </div>
            <div class="field">
              <label for="f-due">Dátum splatnosti *</label>
              <input type="date" id="f-due" value="${state.dueDate}" required>
              <span class="error-text" data-error="dueDate" hidden></span>
            </div>
            <div class="field">
              <label for="f-delivery">Dátum dodania</label>
              <input type="date" id="f-delivery" value="${state.deliveryDate || state.issueDate}">
            </div>
          </div>
        </div>

        <div class="form-section" style="margin-bottom:0;">
          <div class="form-section-title">Odberateľ</div>
          <div class="form-grid">
            <div class="field span-2 autocomplete">
              <label for="f-client-name">Názov / meno *</label>
              <input type="text" id="f-client-name" value="${escapeHtml(state.client.name)}" autocomplete="off" required>
              <div class="autocomplete-list" id="clientSuggestions"></div>
              <span class="error-text" data-error="clientName" hidden></span>
            </div>
            <div class="field">
              <label for="f-client-street">Ulica a číslo</label>
              <input type="text" id="f-client-street" value="${escapeHtml(state.client.street)}">
            </div>
            <div class="field">
              <label for="f-client-city">Mesto</label>
              <input type="text" id="f-client-city" value="${escapeHtml(state.client.city)}">
            </div>
            <div class="field">
              <label for="f-client-zip">PSČ</label>
              <input type="text" id="f-client-zip" value="${escapeHtml(state.client.zip)}">
            </div>
            <div class="field">
              <label for="f-client-country">Krajina</label>
              <input type="text" id="f-client-country" value="${escapeHtml(state.client.country || 'Slovensko')}">
            </div>
            <div class="field">
              <label for="f-client-ico">IČO</label>
              <input type="text" id="f-client-ico" value="${escapeHtml(state.client.ico)}">
            </div>
            <div class="field">
              <label for="f-client-dic">DIČ</label>
              <input type="text" id="f-client-dic" value="${escapeHtml(state.client.dic)}">
            </div>
            <div class="field">
              <label for="f-client-icdph">IČ DPH</label>
              <input type="text" id="f-client-icdph" value="${escapeHtml(state.client.icDph)}">
            </div>
          </div>
        </div>
      </div>

      <div class="card card-pad" style="margin-bottom:20px;">
        <div class="form-section" style="margin-bottom:0;">
          <div class="form-section-title">Položky</div>
          <table class="items-table">
            <thead>
              <tr>
                <th class="col-desc">Popis</th>
                <th class="col-qty">Množstvo</th>
                <th class="col-unit">Jednotka</th>
                <th class="col-price">Cena / ks</th>
                <th class="col-vat">DPH %</th>
                <th class="col-total">Spolu</th>
                <th class="col-del"></th>
              </tr>
            </thead>
            <tbody id="itemsBody"></tbody>
          </table>
          <button type="button" class="btn btn-secondary btn-sm" id="addItemBtn" style="margin-top:10px;">${Icons.plus} Pridať položku</button>
          <span class="error-text" data-error="items" hidden style="display:block; margin-top:8px;"></span>

          <div class="totals-box" id="totalsBox"></div>
        </div>
      </div>

      <div class="card card-pad" style="margin-bottom:20px;">
        <div class="field">
          <label for="f-note">Poznámka na faktúre</label>
          <textarea id="f-note">${escapeHtml(state.note || '')}</textarea>
        </div>
      </div>

      <div class="form-actions">
        <a href="${existing ? `#invoice/view/${existing.id}` : '#invoices'}" class="btn btn-secondary">Zrušiť</a>
        <button type="submit" class="btn btn-primary">${Icons.checkCircle} Uložiť faktúru</button>
      </div>
    </form>
  `;

  const form = root.querySelector('#invoiceForm');
  const itemsBody = root.querySelector('#itemsBody');
  const totalsBox = root.querySelector('#totalsBox');

  function renderItems() {
    const canDelete = state.items.length > 1;
    itemsBody.innerHTML = state.items.map((item, idx) => itemRowHtml(item, idx, canDelete)).join('');
    wireItemRowEvents();
    recalcTotals();
  }

  function wireItemRowEvents() {
    itemsBody.querySelectorAll('tr').forEach((tr) => {
      const idx = Number(tr.dataset.index);
      tr.querySelector('.i-desc').addEventListener('input', (e) => { state.items[idx].description = e.target.value; });
      tr.querySelector('.i-qty').addEventListener('input', (e) => { state.items[idx].quantity = e.target.value; recalcTotals(); });
      tr.querySelector('.i-unit').addEventListener('change', (e) => { state.items[idx].unit = e.target.value; });
      tr.querySelector('.i-price').addEventListener('input', (e) => { state.items[idx].unitPrice = e.target.value; recalcTotals(); });
      tr.querySelector('.i-vat').addEventListener('input', (e) => { state.items[idx].vatRate = e.target.value; recalcTotals(); });
      const delBtn = tr.querySelector('.i-del');
      if (delBtn) {
        delBtn.addEventListener('click', () => {
          state.items.splice(idx, 1);
          renderItems();
        });
      }
    });
  }

  function recalcTotals() {
    itemsBody.querySelectorAll('tr').forEach((tr) => {
      const idx = Number(tr.dataset.index);
      const total = computeItemTotal(state.items[idx]);
      tr.querySelector('.item-total').textContent = formatCurrency(total);
    });

    const totals = computeInvoiceTotals(state);
    let html = `
      <div class="totals-row"><span>Bez DPH</span><span class="num-cell">${formatCurrency(totals.subtotal)}</span></div>`;
    if (totals.vatBreakdown.length) {
      totals.vatBreakdown.forEach((v) => {
        html += `<div class="totals-row"><span>DPH ${v.rate}%</span><span class="num-cell">${formatCurrency(v.amount)}</span></div>`;
      });
    }
    html += `<div class="totals-row grand"><span>Spolu na úhradu</span><span class="num-cell">${formatCurrency(totals.total)}</span></div>`;
    totalsBox.innerHTML = html;
  }

  root.querySelector('#addItemBtn').addEventListener('click', () => {
    state.items.push(emptyItem(settings));
    renderItems();
  });

  renderItems();

  // -- Klient: prepojenie polí so stavom + autocomplete --
  const clientFieldMap = {
    'f-client-name': 'name', 'f-client-street': 'street', 'f-client-city': 'city',
    'f-client-zip': 'zip', 'f-client-country': 'country', 'f-client-ico': 'ico',
    'f-client-dic': 'dic', 'f-client-icdph': 'icDph',
  };
  Object.entries(clientFieldMap).forEach(([elId, key]) => {
    root.querySelector('#' + elId).addEventListener('input', (e) => {
      state.client[key] = e.target.value;
    });
  });

  const nameInput = root.querySelector('#f-client-name');
  const suggestBox = root.querySelector('#clientSuggestions');
  const allClients = Store.getClientSuggestions();

  nameInput.addEventListener('input', () => {
    const q = nameInput.value.trim().toLowerCase();
    if (!q) { suggestBox.classList.remove('open'); return; }
    const matches = allClients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
    if (!matches.length) { suggestBox.classList.remove('open'); return; }
    suggestBox.innerHTML = matches.map((c) => `<div class="autocomplete-item" data-name="${escapeHtml(c.name)}">${escapeHtml(c.name)}${c.city ? `<div class="cell-sub">${escapeHtml(c.city)}</div>` : ''}</div>`).join('');
    suggestBox.classList.add('open');
  });
  suggestBox.addEventListener('click', (e) => {
    const item = e.target.closest('.autocomplete-item');
    if (!item) return;
    const client = allClients.find((c) => c.name === item.dataset.name);
    if (client) {
      state.client = Object.assign({}, state.client, client);
      Object.entries(clientFieldMap).forEach(([elId, key]) => {
        root.querySelector('#' + elId).value = state.client[key] || '';
      });
    }
    suggestBox.classList.remove('open');
  });
  if (invoiceFormOutsideClickHandler) {
    document.removeEventListener('click', invoiceFormOutsideClickHandler);
  }
  invoiceFormOutsideClickHandler = (e) => {
    if (!suggestBox.contains(e.target) && e.target !== nameInput) suggestBox.classList.remove('open');
  };
  document.addEventListener('click', invoiceFormOutsideClickHandler);

  // -- Dátumy --
  const issueInput = root.querySelector('#f-issue');
  const dueInput = root.querySelector('#f-due');
  const deliveryInput = root.querySelector('#f-delivery');
  issueInput.addEventListener('change', () => {
    state.issueDate = issueInput.value;
    if (!dueDateTouched) {
      const newDue = addDays(state.issueDate, settings.defaultDueDays || 14);
      dueInput.value = newDue;
      state.dueDate = newDue;
    }
  });
  dueInput.addEventListener('input', () => { state.dueDate = dueInput.value; dueDateTouched = true; });
  deliveryInput.addEventListener('input', () => { state.deliveryDate = deliveryInput.value; });

  root.querySelector('#f-number').addEventListener('input', (e) => { state.number = e.target.value; });
  root.querySelector('#f-vs').addEventListener('input', (e) => { state.variableSymbol = e.target.value; });
  root.querySelector('#f-payment').addEventListener('change', (e) => { state.paymentMethod = e.target.value; });
  root.querySelector('#f-note').addEventListener('input', (e) => { state.note = e.target.value; });

  // -- Odoslanie --
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const errors = validateInvoice(state);
    clearFormErrors(root);
    if (Object.keys(errors).length) {
      showFormErrors(root, errors);
      const firstKey = Object.keys(errors)[0];
      const firstErrorEl = root.querySelector(`[data-error="${firstKey}"]`);
      if (firstErrorEl) firstErrorEl.closest('.field, .form-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
      App.toast('Skontroluj vyznačené polia', 'critical');
      return;
    }

    state.items = state.items
      .filter((it) => it.description.trim() || Number(it.quantity) > 0)
      .map((it) => ({
        description: it.description.trim(),
        quantity: Number(it.quantity) || 0,
        unit: it.unit,
        unitPrice: Number(it.unitPrice) || 0,
        vatRate: Number(it.vatRate) || 0,
      }));

    let saved;
    if (existing) {
      saved = Store.updateInvoice(existing.id, state);
      App.toast('Faktúra bola aktualizovaná', 'good');
    } else {
      const { id, ...data } = state;
      saved = Store.createInvoice(data);
      App.toast('Faktúra bola vytvorená', 'good');
    }
    App.navigate(`invoice/view/${saved.id}`);
  });
};

function emptyItem(settings) {
  return { description: '', quantity: 1, unit: 'ks', unitPrice: 0, vatRate: settings.isVatPayer ? (settings.defaultVatRate || 0) : 0 };
}

function itemRowHtml(item, idx, canDelete) {
  return `
    <tr data-index="${idx}">
      <td class="col-desc"><input type="text" class="i-desc" value="${escapeHtml(item.description)}" placeholder="Napr. Konzultačné služby"></td>
      <td class="col-qty"><input type="number" class="i-qty" value="${item.quantity}" min="0" step="0.5"></td>
      <td class="col-unit">
        <select class="i-unit">
          ${UNIT_OPTIONS.map((u) => `<option value="${u}" ${item.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
      </td>
      <td class="col-price"><input type="number" class="i-price" value="${item.unitPrice}" min="0" step="0.01"></td>
      <td class="col-vat"><input type="number" class="i-vat" value="${item.vatRate}" min="0" max="100" step="1"></td>
      <td class="col-total"><div class="item-total">${formatCurrency(computeItemTotal(item))}</div></td>
      <td class="col-del">${canDelete ? `<button type="button" class="btn btn-icon btn-ghost btn-sm i-del" aria-label="Odstrániť položku">${Icons.trash}</button>` : ''}</td>
    </tr>`;
}

function validateInvoice(state) {
  const errors = {};
  if (!state.number || !state.number.trim()) errors.number = 'Zadaj číslo faktúry.';
  if (!state.client.name || !state.client.name.trim()) errors.clientName = 'Zadaj názov alebo meno odberateľa.';
  if (state.dueDate && state.issueDate && state.dueDate < state.issueDate) errors.dueDate = 'Splatnosť nemôže byť pred dátumom vystavenia.';
  const validItems = state.items.filter((it) => it.description.trim() && Number(it.quantity) > 0 && Number(it.unitPrice) >= 0);
  if (!validItems.length) errors.items = 'Pridaj aspoň jednu položku s popisom, množstvom a cenou.';
  return errors;
}

function clearFormErrors(root) {
  root.querySelectorAll('.error-text').forEach((el) => { el.hidden = true; el.textContent = ''; });
  root.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
}

function showFormErrors(root, errors) {
  Object.entries(errors).forEach(([key, message]) => {
    const el = root.querySelector(`[data-error="${key}"]`);
    if (el) { el.hidden = false; el.textContent = message; }
  });
  if (errors.number) root.querySelector('#f-number').classList.add('invalid');
  if (errors.clientName) root.querySelector('#f-client-name').classList.add('invalid');
  if (errors.dueDate) root.querySelector('#f-due').classList.add('invalid');
}
