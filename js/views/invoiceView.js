// Obrazovka: Detail faktúry (náhľad + tlač)
'use strict';

Views.invoiceView = function renderInvoiceView(root, params) {
  const invoice = Store.getInvoice(params && params.id);
  const printRoot = document.getElementById('printRoot');

  if (!invoice) {
    printRoot.innerHTML = '';
    root.innerHTML = emptyStateHtml({
      icon: Icons.alertTriangle,
      title: 'Faktúra sa nenašla',
      message: 'Táto faktúra už možno bola odstránená.',
      actionHtml: `<a href="#invoices" class="btn btn-primary">Späť na faktúry</a>`,
    });
    return;
  }

  const settings = Store.getSettings();
  const status = getInvoiceStatus(invoice);
  const isPaid = status === 'paid';

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Faktúra ${escapeHtml(invoice.number)}</h1>
        <p class="page-subtitle">${statusBadgeHtml(status)}</p>
      </div>
      <div class="row-actions" style="gap:8px;">
        <button class="btn btn-secondary" id="btnPrint">${Icons.printer} Tlačiť / PDF</button>
        <a href="#invoice/edit/${invoice.id}" class="btn btn-secondary">${Icons.edit} Upraviť</a>
        ${!isPaid ? `<button class="btn btn-secondary" id="btnRemind">${Icons.mail} Poslať pripomienku</button>` : ''}
        <button class="btn ${isPaid ? 'btn-secondary' : 'btn-primary'}" id="btnTogglePaid">${Icons.checkCircle} ${isPaid ? 'Označiť ako nezaplatenú' : 'Označiť ako zaplatenú'}</button>
        <button class="btn btn-danger" id="btnDelete">${Icons.trash}</button>
      </div>
    </div>

    <div class="card invoice-paper">
      ${invoiceDocumentHtml(invoice, settings, status)}
    </div>
  `;

  printRoot.innerHTML = invoiceDocumentHtml(invoice, settings, status);

  root.querySelector('#btnPrint').addEventListener('click', () => window.print());

  const remindBtn = root.querySelector('#btnRemind');
  if (remindBtn) {
    remindBtn.addEventListener('click', () => {
      if (!invoice.client || !invoice.client.email) {
        App.toast('Klient nemá uložený e-mail — doplň ho v úprave faktúry.', 'critical');
      }
      window.location.href = buildReminderMailto(invoice, settings);
    });
  }

  root.querySelector('#btnTogglePaid').addEventListener('click', async () => {
    try {
      await Store.setPaid(invoice.id, !isPaid);
      App.toast(isPaid ? 'Faktúra označená ako nezaplatená' : 'Faktúra označená ako zaplatená', 'good');
      App.rerender();
    } catch (err) {
      console.error(err);
      App.toast('Zmenu sa nepodarilo uložiť. Skús to znova.', 'critical');
    }
  });

  root.querySelector('#btnDelete').addEventListener('click', () => {
    const removed = Store.removeFromCache(invoice.id);
    App.navigate('invoices');
    App.toastUndo(`Faktúra ${removed.number} bola odstránená`, {
      onUndo: () => { Store.restoreToCache(removed); App.rerender(); },
      onCommit: async () => {
        try {
          await Store.commitDeleteInvoice(removed.id);
        } catch (err) {
          Store.restoreToCache(removed);
          App.rerender();
          throw err;
        }
      },
    });
  });
};

function invoiceDocumentHtml(invoice, settings, status) {
  const totals = computeInvoiceTotals(invoice);
  const client = invoice.client || {};
  const isPaid = status === 'paid';

  return `
    <div class="invoice-head">
      <div>
        <div class="invoice-doc-title">FAKTÚRA</div>
        <div class="invoice-doc-number">č. ${escapeHtml(invoice.number)}</div>
      </div>
      ${isPaid ? `<div class="paid-stamp">Zaplatené</div>` : ''}
    </div>

    <div class="invoice-parties">
      <div>
        <div class="invoice-party-label">Dodávateľ</div>
        <div class="invoice-party-name">${escapeHtml(settings.companyName) || '—'}</div>
        ${settings.street ? `<div>${escapeHtml(settings.street)}</div>` : ''}
        ${(settings.zip || settings.city) ? `<div>${escapeHtml(settings.zip)} ${escapeHtml(settings.city)}</div>` : ''}
        ${settings.country ? `<div>${escapeHtml(settings.country)}</div>` : ''}
        ${settings.ico ? `<div>IČO: ${escapeHtml(settings.ico)}</div>` : ''}
        ${settings.dic ? `<div>DIČ: ${escapeHtml(settings.dic)}</div>` : ''}
        ${settings.isVatPayer && settings.icDph ? `<div>IČ DPH: ${escapeHtml(settings.icDph)}</div>` : ''}
        ${settings.email ? `<div>${escapeHtml(settings.email)}</div>` : ''}
        ${settings.phone ? `<div>${escapeHtml(settings.phone)}</div>` : ''}
      </div>
      <div>
        <div class="invoice-party-label">Odberateľ</div>
        <div class="invoice-party-name">${escapeHtml(client.name) || '—'}</div>
        ${client.street ? `<div>${escapeHtml(client.street)}</div>` : ''}
        ${(client.zip || client.city) ? `<div>${escapeHtml(client.zip)} ${escapeHtml(client.city)}</div>` : ''}
        ${client.country ? `<div>${escapeHtml(client.country)}</div>` : ''}
        ${client.ico ? `<div>IČO: ${escapeHtml(client.ico)}</div>` : ''}
        ${client.dic ? `<div>DIČ: ${escapeHtml(client.dic)}</div>` : ''}
        ${client.icDph ? `<div>IČ DPH: ${escapeHtml(client.icDph)}</div>` : ''}
        ${client.email ? `<div>${escapeHtml(client.email)}</div>` : ''}
      </div>
    </div>

    <div class="invoice-meta-grid">
      <div><span>Dátum vystavenia</span><strong>${formatDate(invoice.issueDate)}</strong></div>
      <div><span>Dátum dodania</span><strong>${formatDate(invoice.deliveryDate || invoice.issueDate)}</strong></div>
      <div><span>Dátum splatnosti</span><strong>${formatDate(invoice.dueDate)}</strong></div>
      <div><span>Forma úhrady</span><strong>${escapeHtml(invoice.paymentMethod || '—')}</strong></div>
      <div><span>Variabilný symbol</span><strong>${escapeHtml(invoice.variableSymbol || '—')}</strong></div>
      ${settings.iban ? `<div><span>IBAN</span><strong>${escapeHtml(settings.iban)}</strong></div>` : ''}
    </div>

    <table class="invoice-items-table">
      <thead>
        <tr>
          <th>Popis</th><th class="num-cell">Množstvo</th><th>J.</th>
          <th class="num-cell">Cena / ks</th><th class="num-cell">DPH</th><th class="num-cell">Spolu</th>
        </tr>
      </thead>
      <tbody>
        ${(invoice.items || []).map((item) => `
          <tr>
            <td>${escapeHtml(item.description)}</td>
            <td class="num-cell">${Number(item.quantity)}</td>
            <td>${escapeHtml(item.unit || '')}</td>
            <td class="num-cell">${formatCurrency(item.unitPrice)}</td>
            <td class="num-cell">${Number(item.vatRate) || 0}%</td>
            <td class="num-cell">${formatCurrency(computeItemTotal(item))}</td>
          </tr>`).join('')}
      </tbody>
    </table>

    <div class="totals-box">
      <div class="totals-row"><span>Bez DPH</span><span class="num-cell">${formatCurrency(totals.subtotal)}</span></div>
      ${totals.vatBreakdown.map((v) => `<div class="totals-row"><span>DPH ${v.rate}%</span><span class="num-cell">${formatCurrency(v.amount)}</span></div>`).join('')}
      <div class="totals-row grand"><span>Spolu na úhradu</span><span class="num-cell">${formatCurrency(totals.total)}</span></div>
    </div>

    ${!settings.isVatPayer ? `<p class="invoice-vat-note">Dodávateľ nie je platcom DPH.</p>` : ''}
    ${invoice.note ? `<div class="invoice-note"><strong>Poznámka</strong>${escapeHtml(invoice.note)}</div>` : ''}
    ${settings.footerNote ? `<div class="invoice-footer-note">${escapeHtml(settings.footerNote)}</div>` : ''}

    ${(settings.bankName || settings.iban || settings.swift) ? `
    <div class="invoice-footer">
      ${settings.bankName ? `<span>${escapeHtml(settings.bankName)}</span>` : ''}
      ${settings.iban ? `<span>IBAN: ${escapeHtml(settings.iban)}</span>` : ''}
      ${settings.swift ? `<span>SWIFT/BIC: ${escapeHtml(settings.swift)}</span>` : ''}
    </div>` : ''}
  `;
}

function buildReminderMailto(invoice, settings) {
  const totals = computeInvoiceTotals(invoice);
  const clientEmail = (invoice.client && invoice.client.email) || '';
  const subject = `Pripomienka úhrady — faktúra č. ${invoice.number}`;
  const lines = [
    'Dobrý deň,',
    '',
    `dovoľujem si pripomenúť neuhradenú faktúru č. ${invoice.number} so splatnosťou ${formatDate(invoice.dueDate)} na sumu ${formatCurrency(totals.total)}.`,
    '',
    settings.iban ? `Bankové spojenie: ${settings.iban}` : '',
    invoice.variableSymbol ? `Variabilný symbol: ${invoice.variableSymbol}` : '',
    '',
    'Ak platba už prebehla, tento e-mail prosím ignorujte. Ďakujem za spoluprácu.',
    '',
    settings.companyName || '',
  ].filter((line) => line !== null && line !== undefined);
  const body = lines.join('\n');
  return `mailto:${encodeURIComponent(clientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
