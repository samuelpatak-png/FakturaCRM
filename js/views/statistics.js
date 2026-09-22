// Obrazovka: Štatistiky
'use strict';

Views.statistics = function renderStatistics(root) {
  const invoices = Store.getInvoices();
  const agg = getStatusAggregates(invoices);
  const totalCount = invoices.length;

  const avgInvoiceValue = totalCount
    ? invoices.reduce((sum, inv) => sum + computeInvoiceTotals(inv).total, 0) / totalCount
    : 0;

  const paidWithDates = invoices.filter((inv) => inv.paidAt && inv.issueDate);
  const avgDaysToPay = paidWithDates.length
    ? Math.round(
        paidWithDates.reduce((sum, inv) => {
          const days = (new Date(inv.paidAt) - new Date(inv.issueDate)) / 86400000;
          return sum + Math.max(0, days);
        }, 0) / paidWithDates.length
      )
    : null;

  const uniqueClients = new Set(invoices.map((inv) => (inv.client && inv.client.name) || '').filter(Boolean)).size;
  const topClients = getTopClients(invoices, 8);

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Štatistiky</h1>
        <p class="page-subtitle">Prehľad výkonnosti fakturácie</p>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-tile">
        <div class="stat-tile-head"><span class="stat-label">Počet faktúr</span><span class="stat-icon">${Icons.fileText}</span></div>
        <span class="stat-value">${totalCount}</span>
        <span class="stat-meta">${agg.paid.count} zaplatených</span>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-head"><span class="stat-label">Priemerná hodnota faktúry</span><span class="stat-icon">${Icons.euro}</span></div>
        <span class="stat-value">${formatCurrency(avgInvoiceValue)}</span>
        <span class="stat-meta">Naprieč všetkými faktúrami</span>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-head"><span class="stat-label">Priemerná doba úhrady</span><span class="stat-icon">${Icons.clock}</span></div>
        <span class="stat-value">${avgDaysToPay === null ? '—' : `${avgDaysToPay} dní`}</span>
        <span class="stat-meta">Od vystavenia po zaplatenie</span>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-head"><span class="stat-label">Aktívni klienti</span><span class="stat-icon">${Icons.users}</span></div>
        <span class="stat-value">${uniqueClients}</span>
        <span class="stat-meta">Unikátnych odberateľov</span>
      </div>
    </div>

    <div class="grid-2">
      <div class="card chart-card">
        <div class="section-title">Mesačné príjmy</div>
        <p class="cell-sub" style="margin-bottom:14px;">Posledných 12 mesiacov, podľa dátumu úhrady</p>
        <div class="chart-wrap"><canvas id="statsMonthlyChart" role="img" aria-label="Graf mesačných príjmov za posledných 12 mesiacov"></canvas></div>
      </div>

      <div class="card chart-card">
        <div class="section-title">Stav faktúr</div>
        <p class="cell-sub" style="margin-bottom:14px;">Podľa počtu a sumy</p>
        <div class="chart-wrap donut"><canvas id="statsDonut" role="img" aria-label="Podiel zaplatených, neuhradených a faktúr po splatnosti"></canvas></div>
        <div class="legend-row" id="statsDonutLegend"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="section-title">Najlepší klienti</div>
      </div>
      ${topClients.length ? `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Klient</th><th class="num-cell">Faktúr</th><th class="num-cell">Príjmy</th></tr></thead>
          <tbody>
            ${topClients.map((c) => `
              <tr>
                <td data-label="Klient" class="cell-title">${escapeHtml(c.name)}</td>
                <td data-label="Faktúr" class="num-cell">${c.count}</td>
                <td data-label="Príjmy" class="num-cell">${formatCurrency(c.sum)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : emptyStateHtml({
        icon: Icons.users,
        title: 'Zatiaľ žiadne dáta',
        message: 'Keď pribudnú zaplatené faktúry, uvidíš tu rebríček klientov.',
      })}
    </div>
  `;
  const monthlyPoints = getMonthlySeries(invoices, 12);
  const monthlyCanvas = document.getElementById('statsMonthlyChart');
  if (!Charts.renderMonthlyIncome(monthlyCanvas, monthlyPoints)) {
    monthlyCanvas.closest('.chart-wrap').innerHTML = chartEmptyHtml('Zatiaľ žiadne zaplatené faktúry');
  }

  const donutCanvas = document.getElementById('statsDonut');
  const donutSegments = [
    { label: 'Zaplatené', value: agg.paid.sum, color: cssVar('--color-good') },
    { label: 'Nezaplatené', value: agg.unpaid.sum, color: cssVar('--color-warning') },
    { label: 'Po splatnosti', value: agg.overdue.sum, color: cssVar('--color-critical') },
  ].filter((s) => s.value > 0);

  if (Charts.renderStatusDonut(donutCanvas, donutSegments)) {
    document.getElementById('statsDonutLegend').innerHTML = donutSegments
      .map((s) => `<span class="legend-item"><span class="legend-dot" style="background:${s.color}"></span>${s.label} — ${formatCurrency(s.value)}</span>`)
      .join('');
  } else {
    donutCanvas.closest('.chart-wrap').innerHTML = chartEmptyHtml('Zatiaľ žiadne faktúry');
  }
};
