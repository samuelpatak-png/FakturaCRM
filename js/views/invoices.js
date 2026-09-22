// Obrazovka: Zoznam faktúr
'use strict';

const INVOICE_FILTERS = ['all', 'paid', 'unpaid', 'overdue'];

Views.invoices = function renderInvoices(root, params) {
  const initialFilter = INVOICE_FILTERS.includes(params && params.status) ? params.status : 'all';
  const state = { search: '', filter: initialFilter, selected: new Set() };

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Faktúry</h1>
        <p class="page-subtitle">Všetky vystavené faktúry na jednom mieste</p>
      </div>
      <a href="#invoice/new" class="btn btn-primary">${Icons.plus} Nová faktúra</a>
    </div>

    <div class="toolbar">
      <div class="search-input-wrap">
        ${Icons.search}
        <input type="search" id="invSearch" placeholder="Hľadať podľa klienta alebo čísla faktúry…" aria-label="Hľadať faktúry">
      </div>
      <div class="filter-chips" id="filterChips" role="group" aria-label="Filter podľa stavu">
        <button class="chip ${initialFilter === 'all' ? 'active' : ''}" data-filter="all" type="button">Všetky</button>
        <button class="chip ${initialFilter === 'paid' ? 'active' : ''}" data-filter="paid" type="button">Zaplatené</button>
        <button class="chip ${initialFilter === 'unpaid' ? 'active' : ''}" data-filter="unpaid" type="button">Nezaplatené</button>
        <button class="chip ${initialFilter === 'overdue' ? 'active' : ''}" data-filter="overdue" type="button">Po splatnosti</button>
      </div>
      <div class="spacer"></div>
    </div>

    <div class="bulk-bar" id="bulkBar" hidden>
      <span id="bulkCount"></span>
      <div class="spacer"></div>
      <button class="btn btn-secondary btn-sm" data-bulk="paid">${Icons.checkCircle} Označiť ako zaplatené</button>
      <button class="btn btn-secondary btn-sm" data-bulk="unpaid">Označiť ako nezaplatené</button>
      <button class="btn btn-danger btn-sm" data-bulk="delete">${Icons.trash} Odstrániť</button>
      <button class="btn btn-ghost btn-sm" data-bulk="clear">Zrušiť výber</button>
    </div>

    <div class="card">
      <div id="invoicesTableContainer"></div>
    </div>
  `;

  const container = root.querySelector('#invoicesTableContainer');
  const searchInput = root.querySelector('#invSearch');
  const bulkBar = root.querySelector('#bulkBar');
  const bulkCount = root.querySelector('#bulkCount');

  function currentList() {
    let list = Store.getInvoices();
    if (state.filter !== 'all') {
      list = list.filter((inv) => getInvoiceStatus(inv) === state.filter);
    }
    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      list = list.filter((inv) => {
        const clientName = (inv.client && inv.client.name) || '';
        return inv.number.toLowerCase().includes(q) || clientName.toLowerCase().includes(q);
      });
    }
    list.sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''));
    return list;
  }

  function updateBulkBar(visibleIds) {
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
    const total = Store.getInvoices().length;
    const list = currentList();
    renderTable(container, list, total);
  }

  root.querySelectorAll('#filterChips .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      root.querySelectorAll('#filterChips .chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.filter = chip.dataset.filter;
      state.selected.clear();
      applyFilters();
    });
  });

  searchInput.addEventListener('input', () => {
    state.search = searchInput.value;
    state.selected.clear();
    applyFilters();
  });

  bulkBar.querySelector('[data-bulk="clear"]').addEventListener('click', () => {
    state.selected.clear();
    applyFilters();
  });

  bulkBar.querySelector('[data-bulk="paid"]').addEventListener('click', () => runBulkPaid(true));
  bulkBar.querySelector('[data-bulk="unpaid"]').addEventListener('click', () => runBulkPaid(false));
  bulkBar.querySelector('[data-bulk="delete"]').addEventListener('click', runBulkDelete);

  async function runBulkPaid(paid) {
    const ids = Array.from(state.selected);
    try {
      await Promise.all(ids.map((id) => Store.setPaid(id, paid)));
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

  applyFilters();

  function renderTable(el, list, totalCount) {
    if (totalCount === 0) {
      bulkBar.hidden = true;
      el.innerHTML = emptyStateHtml({
        icon: Icons.fileText,
        title: 'Zatiaľ žiadne faktúry',
        message: 'Vystav svoju prvú faktúru a začni sledovať príjmy.',
        actionHtml: `<a href="#invoice/new" class="btn btn-primary">${Icons.plus} Nová faktúra</a>`,
      });
      return;
    }
    if (list.length === 0) {
      bulkBar.hidden = true;
      el.innerHTML = emptyStateHtml({
        icon: Icons.search,
        title: 'Žiadne výsledky',
        message: 'Skús zmeniť vyhľadávanie alebo filter.',
      });
      return;
    }

    const visibleIds = list.map((inv) => inv.id);

    el.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th class="col-checkbox"><input type="checkbox" id="selectAllChk" aria-label="Vybrať všetky"></th>
            <th>Faktúra</th><th>Klient</th><th>Vystavená</th><th>Splatnosť</th>
            <th class="num-cell">Suma</th><th>Stav</th><th></th>
          </tr></thead>
          <tbody>${list.map((inv) => invoiceRowHtml(inv, state.selected.has(inv.id))).join('')}</tbody>
        </table>
      </div>`;

    updateBulkBar(visibleIds);

    el.querySelectorAll('tbody tr').forEach((tr) => {
      const id = tr.dataset.id;
      tr.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]') || e.target.closest('.row-select')) return;
        App.navigate(`invoice/view/${id}`);
      });
    });

    el.querySelector('#selectAllChk').addEventListener('change', (e) => {
      if (e.target.checked) visibleIds.forEach((id) => state.selected.add(id));
      else visibleIds.forEach((id) => state.selected.delete(id));
      el.querySelectorAll('.row-select').forEach((chk) => { chk.checked = e.target.checked; });
      updateBulkBar(visibleIds);
    });

    el.querySelectorAll('.row-select').forEach((chk) => {
      chk.addEventListener('click', (e) => e.stopPropagation());
      chk.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        if (e.target.checked) state.selected.add(id);
        else state.selected.delete(id);
        updateBulkBar(visibleIds);
      });
    });

    el.querySelectorAll('[data-action="toggle-paid"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const inv = Store.getInvoice(id);
        const isPaid = getInvoiceStatus(inv) === 'paid';
        try {
          await Store.setPaid(id, !isPaid);
          App.toast(isPaid ? 'Faktúra označená ako nezaplatená' : 'Faktúra označená ako zaplatená', 'good');
          applyFilters();
        } catch (err) {
          console.error(err);
          App.toast('Zmenu sa nepodarilo uložiť. Skús to znova.', 'critical');
        }
      });
    });

    el.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        App.navigate(`invoice/edit/${btn.dataset.id}`);
      });
    });

    el.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const removed = Store.removeFromCache(id);
        state.selected.delete(id);
        applyFilters();
        App.toastUndo(`Faktúra ${removed.number} bola odstránená`, {
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
