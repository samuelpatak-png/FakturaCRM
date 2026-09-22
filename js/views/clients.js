// Obrazovky: Klienti (zoznam) a detail klienta
'use strict';

Views.clients = function renderClients(root) {
  const invoices = Store.getInvoices();
  const overview = getClientOverview(invoices);

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Klienti</h1>
        <p class="page-subtitle">Prehľad odberateľov a ich platobná história</p>
      </div>
    </div>

    <div class="toolbar">
      <div class="search-input-wrap">
        ${Icons.search}
        <input type="search" id="clientSearch" placeholder="Hľadať klienta…" aria-label="Hľadať klienta">
      </div>
    </div>

    <div class="card">
      <div id="clientsTableContainer"></div>
    </div>
  `;

  const container = root.querySelector('#clientsTableContainer');
  const searchInput = root.querySelector('#clientSearch');

  function renderList() {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = q ? overview.filter((c) => c.name.toLowerCase().includes(q)) : overview;

    if (!overview.length) {
      container.innerHTML = emptyStateHtml({
        icon: Icons.users,
        title: 'Zatiaľ žiadni klienti',
        message: 'Klienti sa objavia tu hneď, ako vystavíš prvú faktúru.',
        actionHtml: `<a href="#invoice/new" class="btn btn-primary">${Icons.plus} Nová faktúra</a>`,
      });
      return;
    }
    if (!filtered.length) {
      container.innerHTML = emptyStateHtml({ icon: Icons.search, title: 'Žiadne výsledky', message: 'Skús iné hľadanie.' });
      return;
    }

    container.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Klient</th><th class="num-cell">Faktúr</th><th class="num-cell">Zaplatené</th>
            <th class="num-cell">Neuhradené</th><th>Posledná faktúra</th>
          </tr></thead>
          <tbody>
            ${filtered.map((c) => `
              <tr class="clickable" data-name="${escapeHtml(c.name)}">
                <td data-label="Klient"><span class="cell-title">${escapeHtml(c.name)}</span>${c.info && c.info.ico ? `<div class="cell-sub">IČO: ${escapeHtml(c.info.ico)}</div>` : ''}</td>
                <td data-label="Faktúr" class="num-cell">${c.count}</td>
                <td data-label="Zaplatené" class="num-cell">${formatCurrency(c.paidSum)}</td>
                <td data-label="Neuhradené" class="num-cell">${formatCurrency(c.outstandingSum)}</td>
                <td data-label="Posledná faktúra">${formatDate(c.lastDate)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    container.querySelectorAll('tbody tr[data-name]').forEach((tr) => {
      tr.addEventListener('click', () => App.navigate(`client/${encodeURIComponent(tr.dataset.name)}`));
    });
  }

  searchInput.addEventListener('input', renderList);
  renderList();
};

Views.clientDetail = function renderClientDetail(root, params) {
  const name = params.name;
  const invoices = getClientInvoices(Store.getInvoices(), name);

  if (!invoices.length) {
    root.innerHTML = emptyStateHtml({
      icon: Icons.users,
      title: 'Klient sa nenašiel',
      message: 'Tento klient už možno nemá žiadne faktúry.',
      actionHtml: `<a href="#clients" class="btn btn-primary">Späť na klientov</a>`,
    });
    return;
  }

  const info = invoices[0].client || {};
  const agg = getStatusAggregates(invoices);
  const outstandingSum = agg.unpaid.sum + agg.overdue.sum + agg.partial.sum;
  const outstandingCount = agg.unpaid.count + agg.overdue.count + agg.partial.count;

  root.innerHTML = `
    <div class="page-header">
      <div>
        <p class="page-subtitle" style="margin-bottom:4px;"><a href="#clients">← Klienti</a></p>
        <h1>${escapeHtml(name)}</h1>
      </div>
      <a href="#invoice/new" class="btn btn-primary">${Icons.plus} Nová faktúra</a>
    </div>

    <div class="grid-2">
      <div class="stat-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom:0;">
        <div class="stat-tile">
          <div class="stat-tile-head"><span class="stat-label">Počet faktúr</span><span class="stat-icon">${Icons.fileText}</span></div>
          <span class="stat-value">${invoices.length}</span>
        </div>
        <div class="stat-tile">
          <div class="stat-tile-head"><span class="stat-label">Zaplatené</span><span class="stat-icon good">${Icons.euro}</span></div>
          <span class="stat-value">${formatCurrency(getTotalPaid(invoices))}</span>
        </div>
        <div class="stat-tile">
          <div class="stat-tile-head"><span class="stat-label">Neuhradené</span><span class="stat-icon warning">${Icons.clock}</span></div>
          <span class="stat-value">${formatCurrency(outstandingSum)}</span>
          <span class="stat-meta">${outstandingCount} ${pluralInvoices(outstandingCount)} čaká na úhradu</span>
        </div>
      </div>

      <div class="card card-pad">
        <div class="form-section-title">Údaje klienta</div>
        <p class="cell-sub" style="margin-bottom:12px;">Podľa poslednej faktúry</p>
        <div style="font-size:14.5px; line-height:1.8; color:var(--color-fg-secondary);">
          ${info.street ? `<div>${escapeHtml(info.street)}</div>` : ''}
          ${(info.zip || info.city) ? `<div>${escapeHtml(info.zip)} ${escapeHtml(info.city)}</div>` : ''}
          ${info.country ? `<div>${escapeHtml(info.country)}</div>` : ''}
          ${info.ico ? `<div>IČO: ${escapeHtml(info.ico)}</div>` : ''}
          ${info.dic ? `<div>DIČ: ${escapeHtml(info.dic)}</div>` : ''}
          ${info.icDph ? `<div>IČ DPH: ${escapeHtml(info.icDph)}</div>` : ''}
          ${info.email ? `<div>${escapeHtml(info.email)}</div>` : ''}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div class="section-title">História faktúr</div></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Faktúra</th><th>Vystavená</th><th>Splatnosť</th><th class="num-cell">Suma</th><th>Stav</th></tr></thead>
          <tbody>
            ${invoices.map((inv) => {
              const status = getInvoiceStatus(inv);
              const totals = computeInvoiceTotals(inv);
              return `
                <tr class="clickable" data-id="${inv.id}">
                  <td data-label="Faktúra"><span class="cell-title">${escapeHtml(inv.number)}</span></td>
                  <td data-label="Vystavená">${formatDate(inv.issueDate)}</td>
                  <td data-label="Splatnosť">${formatDate(inv.dueDate)}</td>
                  <td data-label="Suma" class="num-cell">${formatCurrency(totals.total)}</td>
                  <td data-label="Stav">${statusBadgeHtml(status)}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  root.querySelectorAll('tbody tr[data-id]').forEach((tr) => {
    tr.addEventListener('click', () => App.navigate(`invoice/view/${tr.dataset.id}`));
  });
};
