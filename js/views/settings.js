// Obrazovka: Nastavenia
'use strict';

Views.settings = function renderSettings(root) {
  const settings = Store.getSettings();

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Nastavenia</h1>
        <p class="page-subtitle">Fakturačné údaje, ktoré sa použijú na každej novej faktúre</p>
      </div>
    </div>

    <div class="settings-layout">
      <form id="settingsForm" class="card card-pad">
        <div class="form-section">
          <div class="form-section-title">Fakturačné údaje</div>
          <div class="form-grid">
            <div class="field span-2">
              <label for="s-name">Názov firmy / meno *</label>
              <input type="text" id="s-name" value="${escapeHtml(settings.companyName)}">
            </div>
            <div class="field span-2">
              <label for="s-street">Ulica a číslo</label>
              <input type="text" id="s-street" value="${escapeHtml(settings.street)}">
            </div>
            <div class="field">
              <label for="s-city">Mesto</label>
              <input type="text" id="s-city" value="${escapeHtml(settings.city)}">
            </div>
            <div class="field">
              <label for="s-zip">PSČ</label>
              <input type="text" id="s-zip" value="${escapeHtml(settings.zip)}">
            </div>
            <div class="field">
              <label for="s-country">Krajina</label>
              <input type="text" id="s-country" value="${escapeHtml(settings.country || 'Slovensko')}">
            </div>
            <div class="field">
              <label for="s-ico">IČO</label>
              <input type="text" id="s-ico" value="${escapeHtml(settings.ico)}">
            </div>
            <div class="field">
              <label for="s-dic">DIČ</label>
              <input type="text" id="s-dic" value="${escapeHtml(settings.dic)}">
            </div>
            <div class="field span-2">
              <div class="checkbox-row">
                <input type="checkbox" id="s-vat-payer" ${settings.isVatPayer ? 'checked' : ''}>
                <label for="s-vat-payer">Som platca DPH</label>
              </div>
            </div>
            <div class="field" id="s-icdph-wrap" style="${settings.isVatPayer ? '' : 'display:none;'}">
              <label for="s-icdph">IČ DPH</label>
              <input type="text" id="s-icdph" value="${escapeHtml(settings.icDph)}">
            </div>
            <div class="field" id="s-defaultvat-wrap" style="${settings.isVatPayer ? '' : 'display:none;'}">
              <label for="s-defaultvat">Predvolená sadzba DPH (%)</label>
              <input type="number" id="s-defaultvat" min="0" max="100" value="${settings.defaultVatRate}">
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Bankové spojenie</div>
          <div class="form-grid">
            <div class="field span-2">
              <label for="s-bank">Názov banky</label>
              <input type="text" id="s-bank" value="${escapeHtml(settings.bankName)}">
            </div>
            <div class="field">
              <label for="s-iban">IBAN</label>
              <input type="text" id="s-iban" value="${escapeHtml(settings.iban)}">
            </div>
            <div class="field">
              <label for="s-swift">SWIFT / BIC</label>
              <input type="text" id="s-swift" value="${escapeHtml(settings.swift)}">
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Kontakt</div>
          <div class="form-grid">
            <div class="field">
              <label for="s-email">E-mail</label>
              <input type="email" id="s-email" value="${escapeHtml(settings.email)}">
            </div>
            <div class="field">
              <label for="s-phone">Telefón</label>
              <input type="tel" id="s-phone" value="${escapeHtml(settings.phone)}">
            </div>
          </div>
        </div>

        <div class="form-section" style="margin-bottom:0;">
          <div class="form-section-title">Fakturácia</div>
          <div class="form-grid">
            <div class="field">
              <label for="s-prefix">Predpona čísla faktúry</label>
              <input type="text" id="s-prefix" value="${escapeHtml(settings.invoicePrefix)}">
              <span class="hint">Napr. FA → FA-2026-001</span>
            </div>
            <div class="field">
              <label for="s-duedays">Predvolená splatnosť (dní)</label>
              <input type="number" id="s-duedays" min="0" value="${settings.defaultDueDays}">
            </div>
            <div class="field span-2">
              <label for="s-footer">Poznámka pod faktúrou</label>
              <textarea id="s-footer" placeholder="Napr. registrácia v živnostenskom registri...">${escapeHtml(settings.footerNote || '')}</textarea>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${Icons.checkCircle} Uložiť nastavenia</button>
        </div>
      </form>

      <div style="display:flex; flex-direction:column; gap:16px;">
        <div class="card card-pad">
          <div class="section-title" style="margin-bottom:6px;">Záloha dát</div>
          <p class="cell-sub" style="margin-bottom:16px;">Dáta sú uložené v spoločnej databáze appky. Zálohu si aj tak stiahni pravidelne pre istotu.</p>
          <button class="btn btn-secondary" id="btnExport" style="width:100%; margin-bottom:10px;">${Icons.download} Stiahnuť zálohu (JSON)</button>
          <input type="file" id="importFile" accept="application/json" class="visually-hidden">
          <button class="btn btn-secondary" id="btnImport" style="width:100%;">${Icons.upload} Obnoviť zo zálohy</button>
        </div>

        <div class="card card-pad">
          <div class="section-title" style="margin-bottom:6px;">Export pre účtovníka</div>
          <p class="cell-sub" style="margin-bottom:16px;">Jednoduchý peňažný denník (len príjmy zo zaplatených faktúr) ako CSV, otvoríš v Exceli.</p>
          <button class="btn btn-secondary" id="btnExportCsv" style="width:100%;">${Icons.fileText} Stiahnuť peňažný denník (CSV)</button>
        </div>

        <div class="card card-pad">
          <div class="section-title" style="margin-bottom:6px; color: var(--color-critical-text);">Nebezpečná zóna</div>
          <p class="cell-sub" style="margin-bottom:16px;">Natrvalo vymaže všetky faktúry z databázy appky.</p>
          <button class="btn btn-danger" id="btnWipe" style="width:100%;">${Icons.trash} Vymazať všetky faktúry</button>
        </div>
      </div>
    </div>
  `;

  root.querySelector('#s-vat-payer').addEventListener('change', (e) => {
    root.querySelector('#s-icdph-wrap').style.display = e.target.checked ? '' : 'none';
    root.querySelector('#s-defaultvat-wrap').style.display = e.target.checked ? '' : 'none';
  });

  root.querySelector('#settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = root.querySelector('#settingsForm button[type="submit"]');
    const updated = {
      companyName: root.querySelector('#s-name').value.trim(),
      street: root.querySelector('#s-street').value.trim(),
      city: root.querySelector('#s-city').value.trim(),
      zip: root.querySelector('#s-zip').value.trim(),
      country: root.querySelector('#s-country').value.trim() || 'Slovensko',
      ico: root.querySelector('#s-ico').value.trim(),
      dic: root.querySelector('#s-dic').value.trim(),
      isVatPayer: root.querySelector('#s-vat-payer').checked,
      icDph: root.querySelector('#s-icdph').value.trim(),
      defaultVatRate: Number(root.querySelector('#s-defaultvat').value) || 0,
      bankName: root.querySelector('#s-bank').value.trim(),
      iban: root.querySelector('#s-iban').value.trim(),
      swift: root.querySelector('#s-swift').value.trim(),
      email: root.querySelector('#s-email').value.trim(),
      phone: root.querySelector('#s-phone').value.trim(),
      invoicePrefix: root.querySelector('#s-prefix').value.trim() || 'FA',
      defaultDueDays: Number(root.querySelector('#s-duedays').value) || 0,
      footerNote: root.querySelector('#s-footer').value.trim(),
      theme: settings.theme,
    };
    submitBtn.disabled = true;
    submitBtn.textContent = 'Ukladám…';
    try {
      await Store.saveSettings(updated);
      App.toast('Nastavenia boli uložené', 'good');
    } catch (err) {
      console.error(err);
      App.toast('Nastavenia sa nepodarilo uložiť. Skús to znova.', 'critical');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `${Icons.checkCircle} Uložiť nastavenia`;
    }
  });

  root.querySelector('#btnExport').addEventListener('click', () => {
    downloadFile(`fakturacrm-zaloha-${todayISO()}.json`, Store.exportAll(), 'application/json');
    App.toast('Záloha bola stiahnutá', 'good');
  });

  root.querySelector('#btnExportCsv').addEventListener('click', () => {
    if (!Store.getInvoices().some((inv) => inv.paidAt)) {
      App.toast('Zatiaľ nie sú žiadne zaplatené faktúry na export.', 'critical');
      return;
    }
    downloadFile(`fakturacrm-penazny-dennik-${todayISO()}.csv`, Store.exportPenaznyDennikCsv(), 'text/csv;charset=utf-8');
    App.toast('Peňažný denník bol stiahnutý', 'good');
  });

  const importInput = root.querySelector('#importFile');
  root.querySelector('#btnImport').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    if (!file) return;
    const ok = await App.confirm({
      title: 'Obnoviť zo zálohy?',
      message: `Súbor „${file.name}“ nahradí všetky aktuálne faktúry a nastavenia. Táto akcia sa nedá vrátiť späť.`,
      confirmLabel: 'Obnoviť',
      danger: true,
    });
    importInput.value = '';
    if (!ok) return;
    try {
      const text = await file.text();
      await Store.importAll(text);
      App.toast('Dáta boli obnovené zo zálohy', 'good');
      App.rerender();
    } catch (err) {
      console.error(err);
      App.toast('Súbor sa nepodarilo načítať. Skontroluj, či ide o platnú zálohu.', 'critical');
    }
  });

  root.querySelector('#btnWipe').addEventListener('click', async () => {
    const ok = await App.confirm({
      title: 'Vymazať všetky faktúry?',
      message: 'Všetky faktúry v databáze appky budú natrvalo odstránené. Nastavenia zostanú zachované.',
      confirmLabel: 'Vymazať všetko',
      danger: true,
    });
    if (!ok) return;
    try {
      await Store.wipeInvoices();
      App.toast('Všetky faktúry boli vymazané');
      App.navigate('dashboard');
    } catch (err) {
      console.error(err);
      App.toast('Faktúry sa nepodarilo vymazať. Skús to znova.', 'critical');
    }
  });
};
