// Obrazovka: Zoznam faktúr, cenových ponúk a dobropisov
'use strict';

const INVOICE_FILTERS = ['all', 'paid', 'partial', 'unpaid', 'overdue'];
const DOC_TABS = [
  { key: 'invoice', label: 'Faktúry', newRoute: 'invoice/new', newLabel: 'Nová faktúra' },
  { key: 'quote', label: 'Cenové ponuky', newRoute: 'invoice/new/quote', newLabel: 'Nová ponuka' },
  { key: 'credit_note', label: 'Dobropisy', newRoute: 'invoice/new/credit-note', newLabel: 'Nový dobropis' },
];

Views.invoices = function renderInvoices(root, params) {
  const initialFilter = INVOICE_FILTERS.includes(params && params.status) ? params.status : 'all';
  const state = { search: '', filter: initialFilter, docTab: 'invoice', selected: new Set() };

  let container, searchInput, bulkBar, bulkCount;

  function currentList() {
    let list = Store.getInvoices().filter((inv) => (inv.docType || 'invoice') === state.docTab);
    if (state.docTab === 'invoice' && state.filter !== 'all') {
      list = list.filter((inv) => getInvoiceStatus(inv) === state.filter);
    }
    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      list = list.filter((inv) => {
        const clientName = (inv.client && inv.client.name) || '';
        return (inv.number || '').toLowerCase().includes(q) || clientName.toLowerCase().includes(q);
      });
    }
    list.sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''));
    return list;
  }

  function renderShell() {
    const tab = DOC_TABS.find((t) => t.key === state.docTab);

    root.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Faktúry</h1>
          <p class="page-subtitle">Faktúry, cenové ponuky a dobropisy na jednom mieste</p>
        </div>
        <a href="#${tab.newRoute}" class="btn btn-primary">${Icons.plus} ${tab.newLabel}</a>
      </div>

      <div class="tabs" id="docTabs">
        ${DOC_TABS.map((t) => `<button type="button" class="tab-btn ${state.docTab === t.key ? 'active' : ''}" data-tab="${t.key}">${t.label}</button>`).join('')}
      </div>

      <div class="toolbar">
        <div class="search-input-wrap">
          ${Icons.search}
          <input type="search" id="invSearch" value="${escapeHtml(state.search)}" placeholder="Hľadať podľa klienta alebo čísla…" aria-label="Hľadať">
        </div>
        ${state.docTab === 'invoice' ? `
        <div class="filter-chips" id="filterChips" role="group" aria-label="Filter podľa stavu">
          <button class="chip ${state.filter === 'all' ? 'active' : ''}" data-filter="all" type="button">Všetky</button>
          <button class="chip ${state.filter === 'paid' ? 'active' : ''}" data-filter="paid" type="button">Zaplatené</button>
          <button class="chip ${state.filter === 'partial' ? 'active' : ''}" data-filter="partial" type="button">Čiastočne</button>
          <button class="chip ${state.filter === 'unpaid' ? 'active' : ''}" data-filter="unpaid" type="button">Nezaplatené</button>
          <button class="chip ${state.filter === 'overdue' ? 'active' : ''}" data-filter="overdue" type="button">Po splatnosti</button>
        </div>` : ''}
        <div class="spacer"></div>
      </div>

      ${state.docTab === 'invoice' ? `
      <div class="bulk-bar" id="bulkBar" hidden>
        <span id="bulkCount"></span>
        <div class="spacer"></div>
        <button class="btn btn-secondary btn-sm" data-bulk="paid">${Icons.checkCircle} Označiť ako zaplatené</button>
        <button class="btn btn-secondary btn-sm" data-bulk="unpaid">Označiť ako nezaplatené</button>
        <button class="btn btn-danger btn-sm" data-bulk="delete">${Icons.trash} Odstrániť</button>
        <button class="btn btn-ghost btn-sm" data-bulk="clear">Zrušiť výber</button>
      </div>` : ''}

      <div class="card">
        <div id="invoicesTableContainer"></div>
      </div>
    `;

    container = root.querySelector('#invoicesTableContainer');
    searchInput = root.querySelector('#invSearch');
    bulkBar = root.querySelector('#bulkBar');
    bulkCount = bulkBar ? bulkBar.querySelector('#bulkCount') : null;

    root.querySelectorAll('#docTabs .tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.tab === state.docTab) return;
        state.docTab = btn.dataset.tab;
        state.filter = 'all';
        state.search = '';
        state.selected.clear();
        renderShell();
        applyFilters();
      });
    });

    searchInput.addEventListener('input', () => {
      state.search = searchInput.value;
      state.selected.clear();
      applyFilters();
    });

    if (state.docTab === 'invoice') {
      root.querySelectorAll('#filterChips .chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          root.querySelectorAll('#filterChips .chip').forEach((c) => c.classList.remove('active'));
          chip.classList.add('active');
          state.filter = chip.dataset.filter;
          state.selected.clear();
          applyFilters();
        });
      });

      bulkBar.querySelector('[data-bulk="clear"]').addEventListener('click', () => {
        state.selected.clear();
        applyFilters();
      });
      bulkBar.querySelector('[data-bulk="paid"]').addEventListener('click', () => runBulkPaid(true));
      bulkBar.querySelector('[data-bulk="unpaid"]').addEventListener('click', () => runBulkPaid(false));
      bulkBar.querySelector('[data-bulk="delete"]').addEventListener('click', runBulkDelete);
    }
  }

  function updateBulkBar(visibleIds) {
    if (!bulkBar) return;
    const selectedVisible = visibleIds.filter((id) => state.selected.has(id));
    bulkBar.hidden = state.selected.size === 0;
    bulkCount.textContent = `Vybraných: ${state.selected.size}`;
    const selectAllChk = container.querySelector('#selectAllChk');
    if (selectAllChk) {
      selectAllChk.checked = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
      selectAllChk.indeterminate = selectedVisible.length > 0 && selectedVisible.length < visibleIds.length;
    }
  }

  function applyFilters() {
    const total = Store.getInvoices().filter((inv) => (inv.docType || 'invoice') === state.docTab).length;
    const list = currentList();
    renderTable(list, total);
  }

  async function runBulkPaid(paid) {
    const ids = Array.from(state.selected);
    try {
      await Promise.all(ids.map((id) => (paid ? Store.markFullyPaid(id) : Store.markUnpaid(id))));
      App.toast(`Upravených faktúr: ${ids.length} (${paid ? 'zaplatené' : 'nezaplatené'})`, 'good');
    } catch (err) {
      console.error(err);
      App.toast('Niektoré faktúry sa nepodarilo upraviť. Skús to znova.', 'critical');
    }
    state.selected.clear();
    applyFilters();
  }

  function runBulkDelete() {
    const ids = Array.from(state.selected);
    const removedList = ids.map((id) => Store.removeFromCache(id)).filter(Boolean);
    state.selected.clear();
    applyFilters();
    App.toastUndo(`Odstránené faktúry: ${removedList.length}`, {
      onUndo: () => { removedList.forEach((inv) => Store.restoreToCache(inv)); applyFilters(); },
      onCommit: async () => {
        try {
          await Promise.all(removedList.map((inv) => Store.commitDeleteInvoice(inv.id)));
        } catch (err) {
          removedList.forEach((inv) => Store.restoreToCache(inv));
          applyFilters();
          throw err;
        }
      },
    });
  }

  function renderTable(list, totalCount) {
    const tab = DOC_TABS.find((t) => t.key === state.docTab);
    if (totalCount === 0) {
      if (bulkBar) bulkBar.hidden = true;
      const emptyCopy = {
        invoice: { title: 'Zatiaľ žiadne faktúry', message: 'Vystav svoju prvú faktúru a začni sledovať príjmy.' },
        quote: { title: 'Zatiaľ žiadne cenové ponuky', message: 'Vytvor ponuku, ktorú neskôr jedným klikom premeníš na faktúru.' },
        credit_note: { title: 'Zatiaľ žiadne dobropisy', message: 'Dobropis vytvoríš z detailu konkrétnej faktúry alebo tu.' },
      }[state.docTab];
      container.innerHTML = emptyStateHtml({
        icon: Icons.fileText,
        title: emptyCopy.title,
        message: emptyCopy.message,
        actionHtml: `<a href="#${tab.newRoute}" class="btn btn-primary">${Icons.plus} ${tab.newLabel}</a>`,
      });
      return;
    }
    if (list.length === 0) {
      if (bulkBar) bulkBar.hidden = true;
      container.innerHTML = emptyStateHtml({
        icon: Icons.search,
        title: 'Žiadne výsledky',
        message: 'Skús zmeniť vyhľadávanie alebo filter.',
      });
      return;
    }

    const visibleIds = list.map((inv) => inv.id);
    const isInvoiceTab = state.docTab === 'invoice';

    const headerCells = isInvoiceTab
      ? `<th class="col-checkbox"><input type="checkbox" id="selectAllChk" aria-label="Vybrať všetky"></th>
         <th>Faktúra</th><th>Klient</th><th>Vystavená</th><th>Splatnosť</th><th class="num-cell">Suma</th><th>Stav</th><th></th>`
      : state.docTab === 'quote'
        ? `<th>Ponuka</th><th>Klient</th><th>Vystavená</th><th>Platná do</th><th class="num-cell">Suma</th><th>Stav</th><th></th>`
        : `<th>Dobropis</th><th>Klient</th><th>Vystavená</th><th>Súvisí s</th><th class="num-cell">Suma</th><th>Stav</th><th></th>`;

    container.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${list.map((doc) => (isInvoiceTab ? invoiceRowHtml(doc, state.selected.has(doc.id)) : documentRowHtml(doc, state.docTab))).join('')}</tbody>
        </table>
      </div>`;

    if (isInvoiceTab) updateBulkBar(visibleIds);

    container.querySelectorAll('tbody tr').forEach((tr) => {
      const id = tr.dataset.id;
      tr.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]') || e.target.closest('.row-select')) return;
        App.navigate(`invoice/view/${id}`);
      });
    });

    if (isInvoiceTab) {
      container.querySelector('#selectAllChk').addEventListener('change', (e) => {
        if (e.target.checked) visibleIds.forEach((id) => state.selected.add(id));
        else visibleIds.forEach((id) => state.selected.delete(id));
        container.querySelectorAll('.row-select').forEach((chk) => { chk.checked = e.target.checked; });
        updateBulkBar(visibleIds);
      });

      container.querySelectorAll('.row-select').forEach((chk) => {
        chk.addEventListener('click', (e) => e.stopPropagation());
        chk.addEventListener('change', (e) => {
          const id = e.target.dataset.id;
          if (e.target.checked) state.selected.add(id);
          else state.selected.delete(id);
          updateBulkBar(visibleIds);
        });
      });

      container.querySelectorAll('[data-action="toggle-paid"]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          const isPaid = getInvoiceStatus(Store.getInvoice(id)) === 'paid';
          try {
            await (isPaid ? Store.markUnpaid(id) : Store.markFullyPaid(id));
            App.toast(isPaid ? 'Faktúra označená ako nezaplatená' : 'Faktúra označená ako zaplatená', 'good');
            applyFilters();
          } catch (err) {
            console.error(err);
            App.toast('Zmenu sa nepodarilo uložiť. Skús to znova.', 'critical');
          }
        });
      });
    }

    container.querySelectorAll('[data-action="convert"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const created = await Store.convertQuoteToInvoice(btn.dataset.id);
          App.toast('Ponuka bola premenená na faktúru', 'good');
          App.navigate(`invoice/view/${created.id}`);
        } catch (err) {
          console.error(err);
          App.toast('Ponuku sa nepodarilo premeniť. Skús to znova.', 'critical');
        }
      });
    });

    container.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        App.navigate(`invoice/edit/${btn.dataset.id}`);
      });
    });

    container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const removed = Store.removeFromCache(id);
        state.selected.delete(id);
        applyFilters();
        App.toastUndo(`${DOC_TABS.find((t) => t.key === state.docTab).label.replace(/y$/, 'a')} ${removed.number} bola odstránená`, {
          onUndo: () => { Store.restoreToCache(removed); applyFilters(); },
          onCommit: async () => {
            try {
              await Store.commitDeleteInvoice(removed.id);
            } catch (err) {
              Store.restoreToCache(removed);
              applyFilters();
              throw err;
            }
          },
        });
      });
    });
  }

  renderShell();
  applyFilters();
};

function invoiceRowHtml(inv, selected) {
  const status = getInvoiceStatus(inv);
  const totals = computeInvoiceTotals(inv);
  const isPaid = status === 'paid';
  return `
    <tr data-id="${inv.id}" class="clickable">
      <td class="col-checkbox" data-label=""><input type="checkbox" class="row-select" data-id="${inv.id}" ${selected ? 'checked' : ''} aria-label="Vybrať faktúru ${escapeHtml(inv.number)}"></td>
      <td data-label="Faktúra"><span class="cell-title">${escapeHtml(inv.number)}</span></td>
      <td data-label="Klient">
        <div>
          ${escapeHtml((inv.client && inv.client.name) || '—')}
          ${inv.client && inv.client.ico ? `<div class="cell-sub">IČO: ${escapeHtml(inv.client.ico)}</div>` : ''}
        </div>
      </td>
      <td data-label="Vystavená">${formatDate(inv.issueDate)}</td>
      <td data-label="Splatnosť">${formatDate(inv.dueDate)}</td>
      <td data-label="Suma" class="num-cell">${formatCurrency(totals.total)}</td>
      <td data-label="Stav">${statusBadgeHtml(status)}</td>
      <td data-label="">
        <div class="row-actions">
          <button class="btn btn-icon btn-ghost btn-sm" data-action="toggle-paid" data-id="${inv.id}" title="${isPaid ? 'Označiť ako nezaplatenú' : 'Označiť ako zaplatenú'}" aria-label="${isPaid ? 'Označiť ako nezaplatenú' : 'Označiť ako zaplatenú'}">${Icons.checkCircle}</button>
          <button class="btn btn-icon btn-ghost btn-sm" data-action="edit" data-id="${inv.id}" title="Upraviť" aria-label="Upraviť faktúru">${Icons.edit}</button>
          <button class="btn btn-icon btn-ghost btn-sm" data-action="delete" data-id="${inv.id}" title="Odstrániť" aria-label="Odstrániť faktúru">${Icons.trash}</button>
        </div>
      </td>
    </tr>`;
}

function documentRowHtml(doc, tab) {
  const totals = computeInvoiceTotals(doc);
  if (tab === 'quote') {
    const converted = !!doc.convertedToInvoiceId;
    return `
      <tr data-id="${doc.id}" class="clickable">
        <td data-label="Ponuka"><span class="cell-title">${escapeHtml(doc.number)}</span></td>
        <td data-label="Klient">${escapeHtml((doc.client && doc.client.name) || '—')}</td>
        <td data-label="Vystavená">${formatDate(doc.issueDate)}</td>
        <td data-label="Platná do">${formatDate(doc.validUntil)}</td>
        <td data-label="Suma" class="num-cell">${formatCurrency(totals.total)}</td>
        <td data-label="Stav">${converted ? `<span class="badge badge-good">→ ${escapeHtml(doc.convertedToInvoiceNumber || '')}</span>` : `<span class="badge badge-neutral">Otvorená</span>`}</td>
        <td data-label="">
          <div class="row-actions">
            ${!converted ? `<button class="btn btn-icon btn-ghost btn-sm" data-action="convert" data-id="${doc.id}" title="Premeniť na faktúru" aria-label="Premeniť na faktúru">${Icons.checkCircle}</button>` : ''}
            <button class="btn btn-icon btn-ghost btn-sm" data-action="edit" data-id="${doc.id}" title="Upraviť" aria-label="Upraviť">${Icons.edit}</button>
            <button class="btn btn-icon btn-ghost btn-sm" data-action="delete" data-id="${doc.id}" title="Odstrániť" aria-label="Odstrániť">${Icons.trash}</button>
          </div>
        </td>
      </tr>`;
  }
  return `
    <tr data-id="${doc.id}" class="clickable">
      <td data-label="Dobropis"><span class="cell-title">${escapeHtml(doc.number)}</span></td>
      <td data-label="Klient">${escapeHtml((doc.client && doc.client.name) || '—')}</td>
      <td data-label="Vystavená">${formatDate(doc.issueDate)}</td>
      <td data-label="Súvisí s">${escapeHtml(doc.relatedInvoiceNumber || '—')}</td>
      <td data-label="Suma" class="num-cell">${formatCurrency(totals.total)}</td>
      <td data-label="Stav"><span class="badge badge-neutral">Dobropis</span></td>
      <td data-label="">
        <div class="row-actions">
          <button class="btn btn-icon btn-ghost btn-sm" data-action="edit" data-id="${doc.id}" title="Upraviť" aria-label="Upraviť">${Icons.edit}</button>
          <button class="btn btn-icon btn-ghost btn-sm" data-action="delete" data-id="${doc.id}" title="Odstrániť" aria-label="Odstrániť">${Icons.trash}</button>
        </div>
      </td>
    </tr>`;
}
