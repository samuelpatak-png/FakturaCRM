// Obrazovka: Nová / Upraviť faktúru, cenovú ponuku alebo dobropis
'use strict';

const UNIT_OPTIONS = ['ks', 'hod', 'deň', 'mesiac', 'km', 'balík', 'sada'];
const PAYMENT_METHODS = ['Bankový prevod', 'Hotovosť', 'Platobná karta'];
const DOC_TYPE_META = {
  invoice: { label: 'Faktúra', newTitle: 'Nová faktúra', editTitle: 'Upraviť faktúru', saveLabel: 'Uložiť faktúru' },
  quote: { label: 'Cenová ponuka', newTitle: 'Nová cenová ponuka', editTitle: 'Upraviť cenovú ponuku', saveLabel: 'Uložiť ponuku' },
  credit_note: { label: 'Dobropis', newTitle: 'Nový dobropis', editTitle: 'Upraviť dobropis', saveLabel: 'Uložiť dobropis' },
};

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
      title: 'Dokument sa nenašiel',
      message: 'Tento dokument už možno bol odstránený.',
      actionHtml: `<a href="#invoices" class="btn btn-primary">Späť na faktúry</a>`,
    });
    return;
  }

  const initialDocType = existing
    ? (existing.docType || 'invoice')
    : (['invoice', 'quote', 'credit_note'].includes(params && params.docType) ? params.docType : 'invoice');
  const relatedInvoice = !existing && initialDocType === 'credit_note' && params && params.relatedInvoiceId
    ? Store.getInvoice(params.relatedInvoiceId)
    : null;

  const defaultIssueDate = todayISO();
  const state = existing
    ? JSON.parse(JSON.stringify(existing))
    : {
        id: null,
        docType: initialDocType,
        number: Store.nextInvoiceNumber(settings, initialDocType),
        variableSymbol: '',
        issueDate: defaultIssueDate,
        dueDate: addDays(defaultIssueDate, settings.defaultDueDays || 14),
        deliveryDate: defaultIssueDate,
        validUntil: initialDocType === 'quote' ? addDays(defaultIssueDate, 30) : '',
        paymentMethod: PAYMENT_METHODS[0],
        client: relatedInvoice ? relatedInvoice.client : { name: '', street: '', city: '', zip: '', country: 'Slovensko', ico: '', dic: '', icDph: '', email: '' },
        items: [emptyItem(settings)],
        note: '',
        payments: [],
        relatedInvoiceId: relatedInvoice ? relatedInvoice.id : '',
        relatedInvoiceNumber: relatedInvoice ? relatedInvoice.number : '',
      };
  if (!state.docType) state.docType = 'invoice';
  if (!state.client) state.client = { name: '', street: '', city: '', zip: '', country: 'Slovensko', ico: '', dic: '', icDph: '', email: '' };
  if (!state.items || !state.items.length) state.items = [emptyItem(settings)];
  state.variableSymbol = state.variableSymbol || state.number.replace(/\D/g, '');

  let dueDateTouched = !!existing;
  const meta = DOC_TYPE_META[state.docType];
  const invoiceOptions = Store.getInvoices().filter((inv) => (inv.docType || 'invoice') === 'invoice');

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${existing ? meta.editTitle : meta.newTitle}</h1>
        <p class="page-subtitle">${existing ? escapeHtml(existing.number) : 'Vyplň údaje a vystav dokument'}</p>
      </div>
    </div>

    <form id="invoiceForm" novalidate>
      ${!existing ? `
      <div class="card card-pad" style="margin-bottom:20px;">
        <div class="form-section" style="margin-bottom:0;">
          <div class="form-section-title">Typ dokumentu</div>
          <div class="filter-chips" id="docTypeChips" role="group" aria-label="Typ dokumentu">
            <button type="button" class="chip ${state.docType === 'invoice' ? 'active' : ''}" data-doctype="invoice">Faktúra</button>
            <button type="button" class="chip ${state.docType === 'quote' ? 'active' : ''}" data-doctype="quote">Cenová ponuka</button>
            <button type="button" class="chip ${state.docType === 'credit_note' ? 'active' : ''}" data-doctype="credit_note">Dobropis</button>
          </div>
        </div>
      </div>` : `
      <div class="card card-pad" style="margin-bottom:20px; display:flex; align-items:center; gap:10px;">
        <span class="badge badge-neutral">${meta.label}</span>
        ${state.docType === 'credit_note' && state.relatedInvoiceNumber ? `<span class="cell-sub">Súvisí s faktúrou ${escapeHtml(state.relatedInvoiceNumber)}</span>` : ''}
      </div>`}

      <div class="card card-pad" style="margin-bottom:20px;">
        <div class="form-section">
          <div class="form-section-title">Základné údaje</div>
          <div class="form-grid cols-3">
            <div class="field">
              <label for="f-number">Číslo *</label>
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
            <div class="field" id="dueDateField" style="${state.docType === 'quote' ? 'display:none;' : ''}">
              <label for="f-due">Dátum splatnosti *</label>
              <input type="date" id="f-due" value="${state.dueDate}" ${state.docType === 'quote' ? '' : 'required'}>
              <span class="error-text" data-error="dueDate" hidden></span>
            </div>
            <div class="field" id="deliveryDateField" style="${state.docType === 'quote' ? 'display:none;' : ''}">
              <label for="f-delivery">Dátum dodania</label>
              <input type="date" id="f-delivery" value="${state.deliveryDate || state.issueDate}">
            </div>
            <div class="field" id="validUntilField" style="${state.docType === 'quote' ? '' : 'display:none;'}">
              <label for="f-validuntil">Ponuka platná do</label>
              <input type="date" id="f-validuntil" value="${state.validUntil || ''}">
            </div>
            <div class="field span-2" id="relatedInvoiceField" style="${state.docType === 'credit_note' ? '' : 'display:none;'}">
              <label for="f-related">Súvisiaca faktúra</label>
              <select id="f-related">
                <option value="">— vyber faktúru —</option>
                ${invoiceOptions.map((inv) => `<option value="${inv.id}" ${state.relatedInvoiceId === inv.id ? 'selected' : ''}>${escapeHtml(inv.number)} — ${escapeHtml((inv.client && inv.client.name) || '')}</option>`).join('')}
              </select>
              <span class="hint">Faktúra, ktorú tento dobropis opravuje. Pri položkách zadaj záporné množstvo/sumu podľa toho, čo sa opravuje.</span>
              <span class="error-text" data-error="related" hidden></span>
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
            <div class="field">
              <label for="f-client-email">E-mail</label>
              <input type="email" id="f-client-email" value="${escapeHtml(state.client.email || '')}">
              <span class="hint">Na odoslanie pripomienky pri nezaplatenej faktúre</span>
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
          <label for="f-note">Poznámka na dokumente</label>
          <textarea id="f-note">${escapeHtml(state.note || '')}</textarea>
        </div>
      </div>

      <div class="form-actions">
        <a href="${existing ? `#invoice/view/${existing.id}` : '#invoices'}" class="btn btn-secondary">Zrušiť</a>
        <button type="submit" class="btn btn-primary">${Icons.checkCircle} ${meta.saveLabel}</button>
      </div>
    </form>
  `;

  const form = root.querySelector('#invoiceForm');
  const itemsBody = root.querySelector('#itemsBody');
  const totalsBox = root.querySelector('#totalsBox');

  function renderItems() {
    const canDelete = state.items.length > 1;
    const allowNegative = state.docType === 'credit_note';
    itemsBody.innerHTML = state.items.map((item, idx) => itemRowHtml(item, idx, canDelete, allowNegative)).join('');
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
    const grandLabel = state.docType === 'quote' ? 'Cena spolu' : state.docType === 'credit_note' ? 'Suma dobropisu' : 'Spolu na úhradu';
    html += `<div class="totals-row grand"><span>${grandLabel}</span><span class="num-cell">${formatCurrency(totals.total)}</span></div>`;
    totalsBox.innerHTML = html;
  }

  root.querySelector('#addItemBtn').addEventListener('click', () => {
    state.items.push(emptyItem(settings));
    renderItems();
  });

  renderItems();

  const docTypeChips = root.querySelector('#docTypeChips');
  if (docTypeChips) {
    docTypeChips.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        if (chip.dataset.doctype === state.docType) return;
        Views.invoiceForm(root, { docType: chip.dataset.doctype });
      });
    });
  }

  const validUntilInput = root.querySelector('#f-validuntil');
  if (validUntilInput) {
    validUntilInput.addEventListener('input', () => { state.validUntil = validUntilInput.value; });
  }
  const relatedSelect = root.querySelector('#f-related');
  if (relatedSelect) {
    relatedSelect.addEventListener('change', () => {
      const rel = Store.getInvoice(relatedSelect.value);
      state.relatedInvoiceId = rel ? rel.id : '';
      state.relatedInvoiceNumber = rel ? rel.number : '';
      if (rel && rel.client) {
        state.client = Object.assign({}, state.client, rel.client);
        Object.entries(clientFieldMap).forEach(([elId, key]) => {
          root.querySelector('#' + elId).value = state.client[key] || '';
        });
      }
    });
  }

  // -- Klient: prepojenie polí so stavom + autocomplete --
  const clientFieldMap = {
    'f-client-name': 'name', 'f-client-street': 'street', 'f-client-city': 'city',
    'f-client-zip': 'zip', 'f-client-country': 'country', 'f-client-ico': 'ico',
    'f-client-dic': 'dic', 'f-client-icdph': 'icDph', 'f-client-email': 'email',
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
  form.addEventListener('submit', async (e) => {
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

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Ukladám…';

    try {
      let saved;
      if (existing) {
        saved = await Store.updateInvoice(existing.id, state);
        App.toast('Faktúra bola aktualizovaná', 'good');
      } else {
        const { id, ...data } = state;
        saved = await Store.createInvoice(data);
        App.toast('Faktúra bola vytvorená', 'good');
      }
      App.navigate(`invoice/view/${saved.id}`);
    } catch (err) {
      console.error(err);
      App.toast('Faktúru sa nepodarilo uložiť. Skús to znova.', 'critical');
      submitBtn.disabled = false;
      submitBtn.innerHTML = `${Icons.checkCircle} Uložiť faktúru`;
    }
  });
};

function emptyItem(settings) {
  return { description: '', quantity: 1, unit: 'ks', unitPrice: 0, vatRate: settings.isVatPayer ? (settings.defaultVatRate || 0) : 0 };
}

function itemRowHtml(item, idx, canDelete, allowNegative) {
  const numMin = allowNegative ? '' : 'min="0"';
  return `
    <tr data-index="${idx}">
      <td class="col-desc"><input type="text" class="i-desc" value="${escapeHtml(item.description)}" placeholder="Napr. Konzultačné služby"></td>
      <td class="col-qty"><input type="number" class="i-qty" value="${item.quantity}" ${numMin} step="0.5"></td>
      <td class="col-unit">
        <select class="i-unit">
          ${UNIT_OPTIONS.map((u) => `<option value="${u}" ${item.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
      </td>
      <td class="col-price"><input type="number" class="i-price" value="${item.unitPrice}" ${numMin} step="0.01"></td>
      <td class="col-vat"><input type="number" class="i-vat" value="${item.vatRate}" min="0" max="100" step="1"></td>
      <td class="col-total"><div class="item-total">${formatCurrency(computeItemTotal(item))}</div></td>
      <td class="col-del">${canDelete ? `<button type="button" class="btn btn-icon btn-ghost btn-sm i-del" aria-label="Odstrániť položku">${Icons.trash}</button>` : ''}</td>
    </tr>`;
}

function validateInvoice(state) {
  const errors = {};
  if (!state.number || !state.number.trim()) errors.number = 'Zadaj číslo dokladu.';
  if (!state.client.name || !state.client.name.trim()) errors.clientName = 'Zadaj názov alebo meno odberateľa.';
  if (state.docType !== 'quote' && state.dueDate && state.issueDate && state.dueDate < state.issueDate) {
    errors.dueDate = 'Splatnosť nemôže byť pred dátumom vystavenia.';
  }
  if (state.docType === 'credit_note' && !state.relatedInvoiceId) {
    errors.related = 'Vyber faktúru, ktorú dobropis opravuje.';
  }
  const validItems = state.docType === 'credit_note'
    ? state.items.filter((it) => it.description.trim() && Number(it.quantity) !== 0)
    : state.items.filter((it) => it.description.trim() && Number(it.quantity) > 0 && Number(it.unitPrice) >= 0);
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
  if (errors.related) root.querySelector('#f-related').classList.add('invalid');
}
