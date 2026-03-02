/**
 * FLUXS Zeit App — Absences Screen
 * Vacation, sick leave, time-off overview and request flow.
 * Max 500 lines.
 */

'use strict';

import * as State from '../../core/state.js';
import * as Auth from '../../core/auth.js';
import { $, showToast, formatDate, openModal, closeModal, todayISO } from '../../core/ui.js';
import * as AbsenceForm from './absence-form.js';

// ─── Load CSS ───────────────────────────────────────────────────────────────

function _loadCSS() {
  if (!document.getElementById('css-absences')) {
    const link = document.createElement('link');
    link.id = 'css-absences';
    link.rel = 'stylesheet';
    link.href = './screens/absences/absences.css';
    document.head.appendChild(link);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function _countWeekdays(startStr, endStr) {
  const start = new Date(startStr);
  const end = new Date(endStr);
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
  }
  return count;
}

function _fmtMs(ms) {
  const absMs = Math.abs(ms);
  const h = Math.floor(absMs / 3600000);
  const m = Math.floor((absMs % 3600000) / 60000);
  const sign = ms < 0 ? '-' : '+';
  return `${sign}${h}:${String(m).padStart(2, '0')}`;
}

// ─── Vacation Stats ──────────────────────────────────────────────────────────

function _getVacationStats() {
  const yearStr = String(new Date().getFullYear());
  let used = 0;
  (State.get('absenceRequests') || []).forEach(abs => {
    if (abs.type === 'urlaub' && abs.status !== 'rejected' && abs.start.startsWith(yearStr)) {
      used += _countWeekdays(abs.start, abs.end);
    }
  });
  const settings = State.get('settings') || {};
  const total = settings.yearVacation || 28;
  return { total, used, remaining: Math.max(0, total - used) };
}

function _getOvertimeMs() {
  const emp = State.get('currentEmployee');
  if (!emp) return 0;
  const settings = State.get('settings') || {};
  const totalWorkMs = State.get('totalWorkMs') || 0;
  return (emp.overtimeMs || 0) + totalWorkMs - ((settings.dayHours || 8) * 3600000);
}

// ─── Template ───────────────────────────────────────────────────────────────

function _template() {
  return `
    <div class="absences-screen">
      <h2 class="screen-section-title">abwesenheiten</h2>

      <!-- Status Text Lines -->
      <div class="absence-status-section" id="absenceStatusSection"></div>

      <!-- 4 Absence Type Cards (2x2) -->
      <div class="absence-types-grid">
        <div class="absence-type-card" data-type="urlaub">
          <div class="absence-type-icon urlaub">🌴</div>
          <div class="absence-type-label">urlaub</div>
        </div>
        <div class="absence-type-card" data-type="krank">
          <div class="absence-type-icon krank">🤒</div>
          <div class="absence-type-label">krankmeldung</div>
        </div>
        <div class="absence-type-card" data-type="kindkrank">
          <div class="absence-type-icon kindkrank">👶</div>
          <div class="absence-type-label">kind krank</div>
        </div>
        <div class="absence-type-card" data-type="ueberstundenausgleich">
          <div class="absence-type-icon ueberstunden">⏱</div>
          <div class="absence-type-label">überstunden&shy;ausgleich</div>
        </div>
      </div>

      <!-- History -->
      <div class="absence-list-title">anträge & verlauf</div>
      <div class="absence-list" id="absenceList"></div>
    </div>
  `;
}

// ─── Render Status ───────────────────────────────────────────────────────────

function _renderStatus() {
  const section = $('absenceStatusSection');
  if (!section) return;

  const vac = _getVacationStats();
  const overtimeMs = _getOvertimeMs();
  const overtimeStr = _fmtMs(overtimeMs);
  const overtimeCls = overtimeMs >= 0 ? 'lime' : 'orange';

  section.innerHTML = `
    <div class="absence-status-row">
      <span class="absence-status-row-label">urlaubstage gesamt</span>
      <span class="absence-status-row-value">${vac.total} Tage</span>
    </div>
    <div class="absence-status-row">
      <span class="absence-status-row-label">urlaubstage genommen / geplant</span>
      <span class="absence-status-row-value">${vac.used} Tage</span>
    </div>
    <div class="absence-status-row">
      <span class="absence-status-row-label">überstunden</span>
      <span class="absence-status-row-value ${overtimeCls}">${overtimeStr}</span>
    </div>
  `;
}

// ─── Render List ─────────────────────────────────────────────────────────────

function _renderList() {
  const container = $('absenceList');
  if (!container) return;

  const todayStr = todayISO();
  const now = new Date();
  const pastLimit = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const pastLimitStr = pastLimit.toISOString().split('T')[0];

  const requests = State.get('absenceRequests') || [];
  const future = requests.filter(r => r.end >= todayStr);
  const past = requests.filter(r => r.end < todayStr && r.start >= pastLimitStr);

  const statusLabel = { approved: 'Genehmigt', pending: 'Ausstehend', rejected: 'Abgelehnt' };

  const renderCard = (req, showActions) => {
    const canEdit = showActions && req.type === 'urlaub' && req.start >= todayStr;
    const actions = canEdit ? `
      <div class="absence-request-actions">
        <button class="absence-action-btn" data-edit="${req.id}" title="Bearbeiten">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M20.71 7.04c.39-.39.39-1.04 0-1.41l-2.34-2.34c-.37-.39-1.02-.39-1.41 0l-1.84 1.83 3.75 3.75M3 17.25V21h3.75L17.81 9.93l-3.75-3.75L3 17.25z"/>
          </svg>
        </button>
        <button class="absence-action-btn danger" data-delete="${req.id}" title="Stornieren">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12z"/>
          </svg>
        </button>
      </div>` : '';

    return `
      <div class="absence-request-card">
        <div class="absence-request-indicator ${req.status}"></div>
        <div class="absence-request-info">
          <div class="absence-request-type">${req.label}</div>
          <div class="absence-request-dates">${formatDate(req.start)} – ${formatDate(req.end)}</div>
          ${req.comment ? `<div class="absence-request-comment">${req.comment}</div>` : ''}
          ${actions}
        </div>
        <span class="absence-request-status ${req.status}">${statusLabel[req.status] || req.status}</span>
      </div>`;
  };

  if (future.length === 0 && past.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">keine abwesenheitsanträge</div>
      </div>`;
    return;
  }

  let html = '';
  if (future.length > 0) {
    html += future.slice().reverse().map(r => renderCard(r, true)).join('');
  } else {
    html += `<div style="font-size:13px;color:var(--text-muted);padding:8px 0">keine bevorstehenden abwesenheiten</div>`;
  }
  if (past.length > 0) {
    html += `<div class="absence-past-title">vergangene abwesenheiten</div>`;
    html += past.slice().reverse().map(r => renderCard(r, false)).join('');
  }

  container.innerHTML = html;
}

// ─── Event Handling ──────────────────────────────────────────────────────────

function _handleClick(e) {
  // Type card → open form
  const card = e.target.closest('[data-type]');
  if (card) {
    AbsenceForm.open(card.dataset.type, _onFormSubmit);
    return;
  }

  // Edit absence
  const editBtn = e.target.closest('[data-edit]');
  if (editBtn) {
    AbsenceForm.openEdit(editBtn.dataset.edit, _onFormSubmit);
    return;
  }

  // Delete absence
  const delBtn = e.target.closest('[data-delete]');
  if (delBtn) {
    _deleteAbsence(delBtn.dataset.delete);
    return;
  }
}

function _onFormSubmit() {
  _renderStatus();
  _renderList();
}

function _deleteAbsence(absId) {
  if (!window.confirm('Abwesenheit wirklich stornieren?')) return;
  const requests = State.get('absenceRequests') || [];
  const idx = requests.findIndex(a => a.id === absId);
  if (idx !== -1) {
    requests.splice(idx, 1);
    State.set('absenceRequests', [...requests]);
  }
  _renderList();
  showToast('Abwesenheit storniert', 'info');
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

let _unsubs = [];
let _container = null;

// ─── Mount / Unmount ─────────────────────────────────────────────────────────

export async function mount(container) {
  _loadCSS();
  _container = container;
  container.innerHTML = _template();

  _renderStatus();
  _renderList();

  _unsubs = [
    State.subscribe('absenceRequests', () => { _renderStatus(); _renderList(); }),
    State.subscribe('currentEmployee', () => { _renderStatus(); _renderList(); }),
  ];

  container.addEventListener('click', _handleClick);
}

export function unmount() {
  _unsubs.forEach(fn => fn());
  _unsubs = [];
  _container = null;
  AbsenceForm.destroy();
}
