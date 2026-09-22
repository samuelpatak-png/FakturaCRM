// Hlavná appka: routing, motív, modály, toasty.
'use strict';

const App = {
  navigate(route) {
    if (location.hash.replace(/^#/, '') === route) {
      render();
    } else {
      location.hash = route;
    }
  },

  rerender() {
    render();
  },

  toast(message, type) {
    const root = document.getElementById('toastRoot');
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'good' ? ' toast-good' : type === 'critical' ? ' toast-critical' : '');
    el.setAttribute('role', 'status');
    el.textContent = message;
    root.appendChild(el);
    const remove = () => el.remove();
    el.addEventListener('click', remove);
    setTimeout(remove, 4000);
  },

  confirm({ title, message, confirmLabel, cancelLabel, danger }) {
    return new Promise((resolve) => {
      const modalRoot = document.getElementById('modalRoot');
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML = `
        <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle">
          <h2 id="confirmTitle">${escapeHtml(title)}</h2>
          <p>${escapeHtml(message)}</p>
          <div class="modal-actions">
            <button class="btn btn-secondary" data-act="cancel">${escapeHtml(cancelLabel || 'Zrušiť')}</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="confirm" style="${danger ? 'background:var(--color-critical);color:#fff;border-color:var(--color-critical);' : ''}">${escapeHtml(confirmLabel || 'Potvrdiť')}</button>
          </div>
        </div>`;
      modalRoot.appendChild(backdrop);

      function close(result) {
        document.removeEventListener('keydown', onKey);
        backdrop.remove();
        resolve(result);
      }
      function onKey(e) {
        if (e.key === 'Escape') close(false);
      }
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(false); });
      backdrop.querySelector('[data-act="cancel"]').addEventListener('click', () => close(false));
      backdrop.querySelector('[data-act="confirm"]').addEventListener('click', () => close(true));
      document.addEventListener('keydown', onKey);
      backdrop.querySelector('[data-act="confirm"]').focus();
    });
  },
};

// ---- Routing --------------------------------------------------------

function parseHash() {
  const hash = location.hash.replace(/^#/, '') || 'dashboard';
  return hash.split('/');
}

function render() {
  closeSidebar();
  const parts = parseHash();
  const root = document.getElementById('viewRoot');

  let activeNavRoute = parts[0];
  if (parts[0] === 'invoice') activeNavRoute = parts[1] === 'new' ? 'invoice/new' : 'invoices';
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.route === activeNavRoute);
  });

  window.scrollTo({ top: 0 });

  switch (parts[0]) {
    case 'invoices':
      Views.invoices(root);
      break;
    case 'invoice':
      if (parts[1] === 'new') Views.invoiceForm(root, {});
      else if (parts[1] === 'edit') Views.invoiceForm(root, { id: parts[2] });
      else if (parts[1] === 'view') Views.invoiceView(root, { id: parts[2] });
      else Views.dashboard(root);
      break;
    case 'statistics':
      Views.statistics(root);
      break;
    case 'settings':
      Views.settings(root);
      break;
    default:
      Views.dashboard(root);
  }
}

window.addEventListener('hashchange', render);

// ---- Mobilné menu -----------------------------------------------------

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('open');
  document.getElementById('menuBtn').setAttribute('aria-expanded', 'false');
}

function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const menuBtn = document.getElementById('menuBtn');
  menuBtn.addEventListener('click', () => {
    const willOpen = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', willOpen);
    backdrop.classList.toggle('open', willOpen);
    menuBtn.setAttribute('aria-expanded', String(willOpen));
  });
  backdrop.addEventListener('click', closeSidebar);
}

// ---- Motív (svetlý / tmavý) --------------------------------------------

function effectiveTheme(settings) {
  if (settings.theme === 'light' || settings.theme === 'dark') return settings.theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme() {
  const settings = Store.getSettings();
  const effective = effectiveTheme(settings);
  if (settings.theme === 'light' || settings.theme === 'dark') {
    document.documentElement.setAttribute('data-theme', settings.theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  const icon = document.getElementById('themeIcon');
  const label = document.getElementById('themeToggleLabel');
  if (effective === 'dark') {
    label.textContent = 'Svetlý režim';
    icon.innerHTML = '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>';
  } else {
    label.textContent = 'Tmavý režim';
    icon.innerHTML = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
  }
}

function initThemeToggle() {
  document.getElementById('themeToggle').addEventListener('click', () => {
    const settings = Store.getSettings();
    const next = effectiveTheme(settings) === 'dark' ? 'light' : 'dark';
    Store.saveSettings(Object.assign({}, settings, { theme: next }));
    applyTheme();
    render();
  });

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const settings = Store.getSettings();
      if (settings.theme !== 'light' && settings.theme !== 'dark') applyTheme();
    });
  }
}

// ---- Štart appky --------------------------------------------------------

applyTheme();
initSidebar();
initThemeToggle();
render();
