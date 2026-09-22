// Zdieľané UI pomôcky používané naprieč obrazovkami.
'use strict';

// Jediné miesto, kde sa Views deklaruje — každý views/*.js súbor už len dopĺňa Views.<názov>.
const Views = {};

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pluralInvoices(n) {
  if (n === 1) return 'faktúra';
  if (n >= 2 && n <= 4) return 'faktúry';
  return 'faktúr';
}

function statusBadgeHtml(status) {
  const cls = status === 'paid' ? 'badge-good' : status === 'overdue' ? 'badge-critical' : 'badge-warning';
  return `<span class="badge ${cls}">${STATUS_LABELS[status]}</span>`;
}

function chartEmptyHtml(message) {
  return `<div class="chart-empty">${Icons.inbox}${message}</div>`;
}

function emptyStateHtml({ icon, title, message, actionHtml }) {
  return `
    <div class="empty-state">
      ${icon || Icons.inbox}
      <h3>${title}</h3>
      <p>${message}</p>
      ${actionHtml || ''}
    </div>`;
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
