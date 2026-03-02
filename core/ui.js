/**
 * FLUXS Zeit App — UI Helpers
 * Toast notifications, modals, shared DOM utilities.
 * Max 500 lines.
 */

'use strict';

export function $(id) {
  return document.getElementById(id);
}

export function html(tag, attrs = {}, children = '') {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') el.className = v;
    else if (k === 'onclick') el.addEventListener('click', v);
    else if (k.startsWith('data-')) el.setAttribute(k, v);
    else el.setAttribute(k, v);
  });
  if (typeof children === 'string') el.innerHTML = children;
  else if (children instanceof HTMLElement) el.appendChild(children);
  return el;
}

let _toastTimeout = null;

export function showToast(message, type = 'info', duration = 3000) {
  const existing = $('toast');
  if (existing) existing.remove();

  const toast = html('div', {
    id: 'toast',
    className: `toast toast-${type}`,
  }, `
    <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span class="toast-msg">${message}</span>
  `);

  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));

  clearTimeout(_toastTimeout);
  _toastTimeout = setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export function openModal(id) {
  const modal = $(id);
  if (modal) {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    const input = modal.querySelector('input, select, textarea, button');
    if (input) setTimeout(() => input.focus(), 100);
  }
}

export function closeModal(id) {
  const modal = $(id);
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    e.target.setAttribute('aria-hidden', 'true');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const open = document.querySelector('.modal-overlay.open');
    if (open) {
      open.classList.remove('open');
      open.setAttribute('aria-hidden', 'true');
    }
  }
});

export function formatTime(ms) {
  if (!ms || ms < 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatWeekday(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'short' });
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function updateClock() {
  const el = $('live-clock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function skeleton(lines = 3) {
  return `<div class="skeleton-block">${'<div class="skeleton-line"></div>'.repeat(lines)}</div>`;
}

export function confirm(message) {
  return window.confirm(message);
}