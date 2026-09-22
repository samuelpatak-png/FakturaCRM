// Obrazovka: Detail faktúry / cenovej ponuky / dobropisu (náhľad + tlač)
'use strict';

const DOC_VIEW_META = {
  invoice: { docLabel: 'Faktúra', docLabelAcc: 'faktúru', printTitle: 'FAKTÚRA' },
  quote: { docLabel: 'Cenová ponuka', docLabelAcc: 'cenovú ponuku', printTitle: 'CENOVÁ PONUKA' },
  credit_note: { docLabel: 'Dobropis', docLabelAcc: 'dobropis', printTitle: 'DOBROPIS' },
};

Views.invoiceView = function renderInvoiceView(root, params) {
  const invoice = Store.getInvoice(params && params.id);
  const printRoot = document.getElementById('printRoot');

  if (!invoice) {
    printRoot.innerHTML = '';
    root.innerHTML = emptyStateHtml({
      icon: Icons.alertTriangle,
      title: 'Dokument sa nenašiel',
      message: 'Tento dokument už možno bol odstránený.',
      actionHtml: `<a href="#invoices" class="btn btn-primary">Späť na faktúry</a>`,
    });
    return;
  }

  const settings = Store.getSettings();
  const docType = invoice.docType || 'invoice';
  const meta = DOC_VIEW_META[docType];
  const status = docType === 'invoice' ? getInvoiceStatus(invoice) : null;
  const isPaid = status === 'paid';
  const remaining = docType === 'invoice' ? getRemainingAmount(invoice) : 0;
  const amountPaid = docType === 'invoice' ? getAmountPaid(invoice) : 0;

  let headerBadge = '';
  if (docType === 'invoice') headerBadge = statusBadgeHtml(status);
  else if (docType === 'quote') headerBadge = invoice.convertedToInvoiceId ? `<span class="badge badge-good">Premenená na ${escapeHtml(invoice.convertedToInvoiceNumber || '')}</span>` : `<span class="badge badge-neutral">Otvorená</span>`;
  else headerBadge = invoice.relatedInvoiceNumber ? `<span class="badge badge-neutral">Opravuje ${escapeHtml(invoice.relatedInvoiceNumber)}</span>` : '';

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${meta.docLabel} ${escapeHtml(invoice.number)}</h1>
        <p class="page-subtitle">${headerBadge}</p>
      </div>
      <div class="row-actions" style="gap:8px; flex-wrap:wrap;">
        <button class="btn btn-secondary" id="btnPrint">${Icons.printer} Tlačiť / PDF</button>
        <a href="#invoice/edit/${invoice.id}" class="btn btn-secondary">${Icons.edit} Upraviť</a>
        <button class="btn btn-secondary" id="btnEmail">${Icons.mail} Odoslať emailom</button>
        ${docType === 'invoice' && !isPaid ? `<button class="btn btn-secondary" id="btnRemind">${Icons.alertTriangle} Pripomienka</button>` : ''}
        ${docType === 'invoice' ? `<a href="#invoice/new/credit-note/${invoice.id}" class="btn btn-secondary">${Icons.fileText} Vytvoriť dobropis</a>` : ''}
        ${docType === 'quote' && !invoice.convertedToInvoiceId ? `<button class="btn btn-primary" id="btnConvert">${Icons.checkCircle} Premeniť na faktúru</button>` : ''}
        <button class="btn btn-danger" id="btnDelete">${Icons.trash}</button>
      </div>
    </div>

    <div class="card invoice-paper">
      ${invoiceDocumentHtml(invoice, settings, status, remaining)}
    </div>

    ${docType === 'invoice' ? paymentsCardHtml(invoice, remaining, amountPaid) : ''}
  `;

  printRoot.innerHTML = invoiceDocumentHtml(invoice, settings, status, remaining);

  root.querySelector('#btnPrint').addEventListener('click', () => window.print());

  root.querySelector('#btnEmail').addEventListener('click', () => {
    if (!invoice.client || !invoice.client.email) {
      App.toast('Klient nemá uložený e-mail — doplň ho v úprave.', 'critical');
    }
    window.location.href = buildInvoiceEmailMailto(invoice, settings);
  });

  const remindBtn = root.querySelector('#btnRemind');
  if (remindBtn) {
    remindBtn.addEventListener('click', () => {
      if (!invoice.client || !invoice.client.email) {
        App.toast('Klient nemá uložený e-mail — doplň ho v úprave faktúry.', 'critical');
      }
      window.location.href = buildReminderMailto(invoice, settings);
    });
  }

  const convertBtn = root.querySelector('#btnConvert');
  if (convertBtn) {
    convertBtn.addEventListener('click', async () => {
      convertBtn.disabled = true;
      try {
        const created = await Store.convertQuoteToInvoice(invoice.id);
        App.toast('Ponuka bola premenená na faktúru', 'good');
        App.navigate(`invoice/view/${created.id}`);
      } catch (err) {
        console.error(err);
        App.toast('Ponuku sa nepodarilo premeniť. Skús to znova.', 'critical');
        convertBtn.disabled = false;
      }
    });
  }

  const addPaymentBtn = root.querySelector('#btnAddPayment');
  if (addPaymentBtn) {
    addPaymentBtn.addEventListener('click', async () => {
      const result = await openPaymentModal(invoice);
      if (!result) return;
      try {
        await Store.addPayment(invoice.id, result.amount, result.date);
        App.toast('Platba bola zaznamenaná', 'good');
        App.rerender();
      } catch (err) {
        console.error(err);
        App.toast('Platbu sa nepodarilo uložiť. Skús to znova.', 'critical');
      }
    });
  }

  root.querySelectorAll('[data-remove-payment]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const idx = Number(btn.dataset.removePayment);
      try {
        await Store.removePayment(invoice.id, idx);
        App.toast('Platba bola odstránená');
        App.rerender();
      } catch (err) {
        console.error(err);
        App.toast('Platbu sa nepodarilo odstrániť. Skús to znova.', 'critical');
      }
    });
  });

  const clearLegacyBtn = root.querySelector('#btnClearLegacyPaid');
  if (clearLegacyBtn) {
    clearLegacyBtn.addEventListener('click', async () => {
      try {
        await Store.markUnpaid(invoice.id);
        App.toast('Faktúra označená ako nezaplatená', 'good');
        App.rerender();
      } catch (err) {
        console.error(err);
        App.toast('Zmenu sa nepodarilo uložiť. Skús to znova.', 'critical');
      }
    });
  }

  root.querySelector('#btnDelete').addEventListener('click', () => {
    const removed = Store.removeFromCache(invoice.id);
    App.navigate('invoices');
    App.toastUndo(`${meta.docLabel} ${removed.number} bola odstránená`, {
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

function paymentsCardHtml(invoice, remaining, amountPaid) {
  const realPayments = invoice.payments || [];
  const legacyPaid = !realPayments.length && invoice.paidAt;

  let bodyHtml;
  if (realPayments.length) {
    bodyHtml = `
      <div class="table-wrap" style="margin-bottom:14px;">
        <table>
          <thead><tr><th>Dátum</th><th class="num-cell">Suma</th><th></th></tr></thead>
          <tbody>
            ${realPayments.map((p, idx) => `
              <tr>
                <td data-label="Dátum">${formatDate(p.date)}</td>
                <td data-label="Suma" class="num-cell">${formatCurrency(p.amount)}</td>
                <td data-label="">
                  <div class="row-actions">
                    <button type="button" class="btn btn-icon btn-ghost btn-sm" data-remove-payment="${idx}" aria-label="Odstrániť platbu" title="Odstrániť platbu">${Icons.trash}</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } else if (legacyPaid) {
    bodyHtml = `<p class="cell-sub" style="margin-bottom:14px;">Zaplatené dňa ${formatDate(invoice.paidAt)} (celá suma). <button type="button" class="btn btn-ghost btn-sm" id="btnClearLegacyPaid">Zrušiť</button></p>`;
  } else {
    bodyHtml = `<p class="cell-sub" style="margin-bottom:14px;">Zatiaľ žiadne zaznamenané platby.</p>`;
  }

  return `
    <div class="card card-pad" style="margin-top:20px;">
      <div class="section-title" style="margin-bottom:14px;">Platby</div>
      <div class="stat-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom:18px;">
        <div class="stat-tile">
          <span class="stat-label">Celková suma</span>
          <span class="stat-value">${formatCurrency(computeInvoiceTotals(invoice).total)}</span>
        </div>
        <div class="stat-tile">
          <span class="stat-label">Zaplatené</span>
          <span class="stat-value" style="color:var(--color-good-text)">${formatCurrency(amountPaid)}</span>
        </div>
        <div class="stat-tile">
          <span class="stat-label">Zostáva</span>
          <span class="stat-value" style="color:${remaining > 0 ? 'var(--color-critical-text)' : 'var(--color-good-text)'}">${formatCurrency(remaining)}</span>
        </div>
      </div>
      ${bodyHtml}
      ${remaining > 0 ? `<button type="button" class="btn btn-primary" id="btnAddPayment">${Icons.plus} Zaznamenať platbu</button>` : ''}
    </div>
  `;
}

function openPaymentModal(invoice) {
  return new Promise((resolve) => {
    const remaining = getRemainingAmount(invoice);
    const modalRoot = document.getElementById('modalRoot');
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="paymentModalTitle">
        <h2 id="paymentModalTitle">Zaznamenať platbu</h2>
        <div class="field" style="margin-bottom:14px;">
          <label for="pm-amount">Suma (€)</label>
          <input type="number" id="pm-amount" min="0.01" step="0.01" value="${remaining.toFixed(2)}">
          <span class="error-text" id="pm-amount-error" hidden>Zadaj sumu väčšiu ako 0.</span>
        </div>
        <div class="field" style="margin-bottom:20px;">
          <label for="pm-date">Dátum platby</label>
          <input type="date" id="pm-date" value="${todayISO()}">
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" type="button" data-act="cancel">Zrušiť</button>
          <button class="btn btn-primary" type="button" data-act="save">Uložiť platbu</button>
        </div>
      </div>`;
    modalRoot.appendChild(backdrop);

    function close(result) {
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      resolve(result);
    }
    function onKey(e) { if (e.key === 'Escape') close(null); }
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(null); });
    backdrop.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
    backdrop.querySelector('[data-act="save"]').addEventListener('click', () => {
      const amountInput = backdrop.querySelector('#pm-amount');
      const amount = Number(amountInput.value);
      const date = backdrop.querySelector('#pm-date').value;
      if (!amount || amount <= 0) {
        amountInput.classList.add('invalid');
        backdrop.querySelector('#pm-amount-error').hidden = false;
        return;
      }
      close({ amount, date: date || todayISO() });
    });
    document.addEventListener('keydown', onKey);
    backdrop.querySelector('#pm-amount').focus();
  });
}

function invoiceDocumentHtml(invoice, settings, status, remaining) {
  const totals = computeInvoiceTotals(invoice);
  const client = invoice.client || {};
  const docType = invoice.docType || 'invoice';
  const meta = DOC_VIEW_META[docType];
  const isPaid = status === 'paid';
  const showQr = docType === 'invoice' && status !== 'paid' && settings.iban && settings.companyName && remaining > 0;

  return `
    <div class="invoice-head">
      <div>
        <div class="invoice-doc-title">${meta.printTitle}</div>
        <div class="invoice-doc-number">č. ${escapeHtml(invoice.number)}</div>
        ${docType === 'credit_note' && invoice.relatedInvoiceNumber ? `<div class="cell-sub" style="margin-top:4px;">Opravuje faktúru č. ${escapeHtml(invoice.relatedInvoiceNumber)}</div>` : ''}
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
      ${docType === 'quote'
        ? `<div><span>Ponuka platná do</span><strong>${formatDate(invoice.validUntil)}</strong></div>`
        : `<div><span>Dátum dodania</span><strong>${formatDate(invoice.deliveryDate || invoice.issueDate)}</strong></div>
           <div><span>Dátum splatnosti</span><strong>${formatDate(invoice.dueDate)}</strong></div>`}
      ${docType !== 'quote' ? `<div><span>Forma úhrady</span><strong>${escapeHtml(invoice.paymentMethod || '—')}</strong></div>
      <div><span>Variabilný symbol</span><strong>${escapeHtml(invoice.variableSymbol || '—')}</strong></div>
      ${settings.iban ? `<div><span>IBAN</span><strong>${escapeHtml(settings.iban)}</strong></div>` : ''}` : ''}
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

    <div style="display:flex; justify-content:${showQr ? 'space-between' : 'flex-end'}; align-items:flex-end; gap:20px; flex-wrap:wrap;">
      ${showQr ? `
      <div class="invoice-qr">
        <img src="/api/pay-by-square?iban=${encodeURIComponent(settings.iban)}&amount=${remaining.toFixed(2)}&vs=${encodeURIComponent(invoice.variableSymbol || '')}&note=${encodeURIComponent(invoice.number)}&name=${encodeURIComponent(settings.companyName)}" alt="QR kód platby" width="120" height="120" onerror="this.closest('.invoice-qr').style.display='none'">
        <span>Naskenuj a zaplať</span>
      </div>` : '<div></div>'}
      <div class="totals-box" style="margin-left:0;">
        <div class="totals-row"><span>Bez DPH</span><span class="num-cell">${formatCurrency(totals.subtotal)}</span></div>
        ${totals.vatBreakdown.map((v) => `<div class="totals-row"><span>DPH ${v.rate}%</span><span class="num-cell">${formatCurrency(v.amount)}</span></div>`).join('')}
        <div class="totals-row grand"><span>${docType === 'quote' ? 'Cena spolu' : docType === 'credit_note' ? 'Suma dobropisu' : 'Spolu na úhradu'}</span><span class="num-cell">${formatCurrency(totals.total)}</span></div>
      </div>
    </div>

    ${docType !== 'quote' && !settings.isVatPayer ? `<p class="invoice-vat-note">Dodávateľ nie je platcom DPH.</p>` : ''}
    ${invoice.note ? `<div class="invoice-note"><strong>Poznámka</strong>${escapeHtml(invoice.note)}</div>` : ''}
    ${settings.footerNote ? `<div class="invoice-footer-note">${escapeHtml(settings.footerNote)}</div>` : ''}

    ${docType !== 'quote' && (settings.bankName || settings.iban || settings.swift) ? `
    <div class="invoice-footer">
      ${settings.bankName ? `<span>${escapeHtml(settings.bankName)}</span>` : ''}
      ${settings.iban ? `<span>IBAN: ${escapeHtml(settings.iban)}</span>` : ''}
      ${settings.swift ? `<span>SWIFT/BIC: ${escapeHtml(settings.swift)}</span>` : ''}
    </div>` : ''}
  `;
}

function buildReminderMailto(invoice, settings) {
  const totals = computeInvoiceTotals(invoice);
  const remaining = getRemainingAmount(invoice);
  const clientEmail = (invoice.client && invoice.client.email) || '';
  const subject = `Pripomienka úhrady — faktúra č. ${invoice.number}`;
  const lines = [
    'Dobrý deň,',
    '',
    `dovoľujem si pripomenúť neuhradenú faktúru č. ${invoice.number} so splatnosťou ${formatDate(invoice.dueDate)} na sumu ${formatCurrency(remaining)}${remaining < totals.total ? ` (zostatok z celkovej sumy ${formatCurrency(totals.total)})` : ''}.`,
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

function buildInvoiceEmailMailto(invoice, settings) {
  const docType = invoice.docType || 'invoice';
  const meta = DOC_VIEW_META[docType];
  const totals = computeInvoiceTotals(invoice);
  const clientEmail = (invoice.client && invoice.client.email) || '';
  const subject = `${meta.docLabel} č. ${invoice.number}`;
  const itemLines = (invoice.items || []).map(
    (it) => `- ${it.description}: ${Number(it.quantity)} ${it.unit || ''} × ${formatCurrency(it.unitPrice)} = ${formatCurrency(computeItemTotal(it))}`
  );
  const lines = [
    'Dobrý deň,',
    '',
    `posielam ${meta.docLabelAcc} č. ${invoice.number}` +
      (docType === 'invoice' ? ` so splatnosťou ${formatDate(invoice.dueDate)}.` : docType === 'quote' ? ` platnú do ${formatDate(invoice.validUntil)}.` : '.'),
    '',
    ...itemLines,
    '',
    `Spolu: ${formatCurrency(totals.total)}`,
    '',
    docType === 'invoice' && settings.iban ? `Bankové spojenie: ${settings.iban}` : '',
    docType === 'invoice' && invoice.variableSymbol ? `Variabilný symbol: ${invoice.variableSymbol}` : '',
    '',
    'Poznámka: tento e-mail neobsahuje prílohu — dokument si vieš uložiť ako PDF cez tlačidlo "Tlačiť / PDF" v appke a pripojiť ho sem ručne.',
    '',
    settings.companyName || '',
  ].filter((line) => line !== null && line !== undefined && line !== false);
  const body = lines.join('\n');
  return `mailto:${encodeURIComponent(clientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
