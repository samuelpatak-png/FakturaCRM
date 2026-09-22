// Obrazovka: Zoznam faktúr
'use strict';

Views.invoices = function renderInvoices(root) {
  const state = { search: '', filter: 'all', sortBy: 'issueDate', sortDir: 'desc' };

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
        <button class="chip active" data-filter="all" type="button">Všetky</button>
        <button class="chip" data-filter="paid" type="button">Zaplatené</button>
        <button class="chip" data-filter="unpaid" type="button">Nezaplatené</button>
        <button class="chip" data-filter="overdue" type="button">Po splatnosti</button>
      </div>
      <div class="spacer"></div>
    </div>

    <div class="card">
      <div id="invoicesTableContainer"></div>
    </div>
  `;

  const container = root.querySelector('#invoicesTableContainer');
  const searchInput = root.querySelector('#invSearch');

  function applyFilters() {
    let list = Store.getInvoices();
    const total = list.length;

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

    renderTable(container, list, total);
  }

  root.querySelectorAll('#filterChips .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      root.querySelectorAll('#filterChips .chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.filter = chip.dataset.filter;
      applyFilters();
    });
  });

  searchInput.addEventListener('input', () => {
    state.search = searchInput.value;
    applyFilters();
  });

  applyFilters();

  function renderTable(el, list, totalCount) {
    if (totalCount === 0) {
      el.innerHTML = emptyStateHtml({
        icon: Icons.fileText,
        title: 'Zatiaľ žiadne faktúry',
        message: 'Vystav svoju prvú faktúru a začni sledovať príjmy.',
        actionHtml: `<a href="#invoice/new" class="btn btn-primary">${Icons.plus} Nová faktúra</a>`,
      });
      return;
    }
    if (list.length === 0) {
      el.innerHTML = emptyStateHtml({
        icon: Icons.search,
        title: 'Žiadne výsledky',
        message: 'Skús zmeniť vyhľadávanie alebo filter.',
      });
      return;
    }

    el.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Faktúra</th><th>Klient</th><th>Vystavená</th><th>Splatnosť</th>
            <th class="num-cell">Suma</th><th>Stav</th><th></th>
          </tr></thead>
          <tbody>${list.map(invoiceRowHtml).join('')}</tbody>
        </table>
      </div>`;

    el.querySelectorAll('tbody tr').forEach((tr) => {
      const id = tr.dataset.id;
      tr.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) return;
        App.navigate(`invoice/view/${id}`);
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
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const inv = Store.getInvoice(id);
        const ok = await App.confirm({
          title: 'Odstrániť faktúru?',
          message: `Faktúra ${inv.number} bude natrvalo odstránená. Táto akcia sa nedá vrátiť späť.`,
          confirmLabel: 'Odstrániť',
          danger: true,
        });
        if (ok) {
          try {
            await Store.deleteInvoice(id);
            App.toast('Faktúra odstránená');
            applyFilters();
          } catch (err) {
            console.error(err);
            App.toast('Faktúru sa nepodarilo odstrániť. Skús to znova.', 'critical');
          }
        }
      });
    });
  }
};

function invoiceRowHtml(inv) {
  const status = getInvoiceStatus(inv);
  const totals = computeInvoiceTotals(inv);
  const isPaid = status === 'paid';
  return `
    <tr data-id="${inv.id}" class="clickable">
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
