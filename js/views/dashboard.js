// Obrazovka: Prehľad (dashboard)
'use strict';

Views.dashboard = function renderDashboard(root) {
  const invoices = Store.getInvoices();
  const settings = Store.getSettings();
  const agg = getStatusAggregates(invoices);

  const totalPaid = agg.paid.sum;
  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const monthStart = `${thisMonthKey}-01`;
  const monthEnd = `${thisMonthKey}-31`;
  const prevStart = `${prevMonthKey}-01`;
  const prevEnd = `${prevMonthKey}-31`;
  const thisMonthSum = sumPaidBetween(invoices, monthStart, monthEnd);
  const prevMonthSum = sumPaidBetween(invoices, prevStart, prevEnd);

  let deltaHtml = '';
  if (prevMonthSum > 0) {
    const delta = ((thisMonthSum - prevMonthSum) / prevMonthSum) * 100;
    const up = delta >= 0;
    deltaHtml = `<span class="stat-meta" style="color:${up ? 'var(--color-good-text)' : 'var(--color-critical-text)'}">${up ? '▲' : '▼'} ${Math.abs(delta).toFixed(0)} % oproti minulému mesiacu</span>`;
  } else {
    deltaHtml = `<span class="stat-meta">Minulý mesiac: ${formatCurrency(prevMonthSum)}</span>`;
  }

  const outstandingCount = agg.unpaid.count + agg.overdue.count + agg.partial.count;
  const outstandingSum = agg.unpaid.sum + agg.overdue.sum + agg.partial.sum;

  const hasCompanyName = !!settings.companyName;

  const recent = invoices
    .filter((inv) => (inv.docType || 'invoice') === 'invoice')
    .slice()
    .sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''))
    .slice(0, 6);

  root.innerHTML = `
    ${!hasCompanyName ? `
    <div class="card card-pad" style="margin-bottom:20px; display:flex; align-items:center; gap:14px; border-color: var(--color-primary);">
      <div class="stat-icon">${Icons.building}</div>
      <div style="flex:1">
        <strong>Doplň údaje o firme</strong>
        <p class="cell-sub" style="margin-top:2px;">Predtým ako vystavíš prvú faktúru, vyplň v Nastaveniach svoje fakturačné údaje (názov, IČO, IBAN...).</p>
      </div>
      <a href="#settings" class="btn btn-secondary btn-sm">Otvoriť nastavenia</a>
    </div>` : ''}

    ${agg.overdue.count > 0 ? `
    <div class="card card-pad" style="margin-bottom:20px; display:flex; align-items:center; gap:14px; border-color: var(--color-critical);">
      <div class="stat-icon critical">${Icons.alertTriangle}</div>
      <div style="flex:1">
        <strong>${agg.overdue.count} ${pluralInvoices(agg.overdue.count)} po splatnosti</strong>
        <p class="cell-sub" style="margin-top:2px;">Spolu ${formatCurrency(agg.overdue.sum)} čaká na úhradu už po termíne. Oplatí sa klientom pripomenúť.</p>
      </div>
      <a href="#invoices/overdue" class="btn btn-secondary btn-sm">Zobraziť faktúry</a>
    </div>` : ''}

    <div class="page-header">
      <div>
        <h1>Prehľad</h1>
        <p class="page-subtitle">Aktuálny stav tvojich príjmov a faktúr</p>
      </div>
      <a href="#invoice/new" class="btn btn-primary">${Icons.plus} Nová faktúra</a>
    </div>

    <div class="stat-grid">
      <div class="stat-tile">
        <div class="stat-tile-head">
          <span class="stat-label">Celkové príjmy</span>
          <span class="stat-icon good">${Icons.euro}</span>
        </div>
        <span class="stat-value">${formatCurrency(totalPaid)}</span>
        <span class="stat-meta">Súčet všetkých zaplatených faktúr</span>
      </div>

      <div class="stat-tile">
        <div class="stat-tile-head">
          <span class="stat-label">Príjmy tento mesiac</span>
          <span class="stat-icon">${Icons.trendingUp}</span>
        </div>
        <span class="stat-value">${formatCurrency(thisMonthSum)}</span>
        ${deltaHtml}
      </div>

      <div class="stat-tile">
        <div class="stat-tile-head">
          <span class="stat-label">Neuhradené</span>
          <span class="stat-icon warning">${Icons.clock}</span>
        </div>
        <span class="stat-value">${formatCurrency(outstandingSum)}</span>
        <span class="stat-meta">${outstandingCount} ${pluralInvoices(outstandingCount)} čaká na úhradu</span>
      </div>

      <div class="stat-tile">
        <div class="stat-tile-head">
          <span class="stat-label">Po splatnosti</span>
          <span class="stat-icon critical">${Icons.alertTriangle}</span>
        </div>
        <span class="stat-value">${formatCurrency(agg.overdue.sum)}</span>
        <span class="stat-meta">${agg.overdue.count} ${pluralInvoices(agg.overdue.count)} po termíne</span>
      </div>
    </div>

    <div class="grid-2">
      <div class="card chart-card">
        <div class="section-title">Mesačné príjmy</div>
        <p class="cell-sub" style="margin-bottom:14px;">Posledných 12 mesiacov, podľa dátumu úhrady</p>
        <div class="chart-wrap"><canvas id="monthlyChart" role="img" aria-label="Graf mesačných príjmov za posledných 12 mesiacov"></canvas></div>
      </div>

      <div class="card chart-card">
        <div class="section-title">Stav faktúr</div>
        <p class="cell-sub" style="margin-bottom:14px;">Podľa počtu a sumy</p>
        <div class="chart-wrap donut"><canvas id="statusDonut" role="img" aria-label="Podiel zaplatených, neuhradených a faktúr po splatnosti"></canvas></div>
        <div class="legend-row" id="donutLegend"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="section-title">Posledné faktúry</div>
        <a href="#invoices" class="btn btn-ghost btn-sm">Zobraziť všetky</a>
      </div>
      ${recent.length ? `
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Faktúra</th><th>Klient</th><th>Vystavená</th><th class="num-cell">Suma</th><th>Stav</th>
          </tr></thead>
          <tbody>
            ${recent.map(recentRowHtml).join('')}
          </tbody>
        </table>
      </div>` : emptyStateHtml({
        title: 'Zatiaľ žiadne faktúry',
        message: 'Vystav svoju prvú faktúru a začni sledovať príjmy.',
        actionHtml: `<a href="#invoice/new" class="btn btn-primary">${Icons.plus} Nová faktúra</a>`,
      })}
    </div>
  `;

  if (recent.length) {
    root.querySelectorAll('tbody tr[data-id]').forEach((tr) => {
      tr.addEventListener('click', () => App.navigate(`invoice/view/${tr.dataset.id}`));
    });
  }

  const monthlyPoints = getMonthlySeries(invoices, 12);
  const monthlyCanvas = document.getElementById('monthlyChart');
  const monthlyChartWrap = monthlyCanvas.closest('.chart-wrap');
  if (!Charts.renderMonthlyIncome(monthlyCanvas, monthlyPoints)) {
    monthlyChartWrap.innerHTML = chartEmptyHtml('Zatiaľ žiadne zaplatené faktúry');
  }

  const donutCanvas = document.getElementById('statusDonut');
  const donutSegments = [
    { label: 'Zaplatené', value: agg.paid.sum, color: cssVar('--color-good') },
    { label: 'Čiastočne', value: agg.partial.sum, color: cssVar('--color-info') },
    { label: 'Nezaplatené', value: agg.unpaid.sum, color: cssVar('--color-warning') },
    { label: 'Po splatnosti', value: agg.overdue.sum, color: cssVar('--color-critical') },
  ].filter((s) => s.value > 0);

  if (Charts.renderStatusDonut(donutCanvas, donutSegments)) {
    document.getElementById('donutLegend').innerHTML = donutSegments
      .map((s) => `<span class="legend-item"><span class="legend-dot" style="background:${s.color}"></span>${s.label} — ${formatCurrency(s.value)}</span>`)
      .join('');
  } else {
    donutCanvas.closest('.chart-wrap').innerHTML = chartEmptyHtml('Zatiaľ žiadne faktúry');
  }
};

function recentRowHtml(inv) {
  const status = getInvoiceStatus(inv);
  const totals = computeInvoiceTotals(inv);
  return `
    <tr data-id="${inv.id}" class="clickable">
      <td data-label="Faktúra"><span class="cell-title">${escapeHtml(inv.number)}</span></td>
      <td data-label="Klient">${escapeHtml((inv.client && inv.client.name) || '—')}</td>
      <td data-label="Vystavená">${formatDate(inv.issueDate)}</td>
      <td data-label="Suma" class="num-cell">${formatCurrency(totals.total)}</td>
      <td data-label="Stav">${statusBadgeHtml(status)}</td>
    </tr>`;
}
