/**
 * FLUXS Zeit App — Profile Screen
 * Employee info card, settings, API status, logout, version.
 * Max 500 lines.
 */

'use strict';

import * as State from '../../core/state.js';
import * as Auth from '../../core/auth.js';
import * as Env from '../../core/env.js';
import { $, showToast } from '../../core/ui.js';
import { navigate } from '../../core/router.js';

// ─── Load CSS ───────────────────────────────────────────────────────────────

function _loadCSS() {
  if (!document.getElementById('css-profile')) {
    const link = document.createElement('link');
    link.id = 'css-profile';
    link.rel = 'stylesheet';
    link.href = './screens/profile/profile.css';
    document.head.appendChild(link);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _fmtMs(ms) {
  const absMs = Math.abs(ms);
  const h = Math.floor(absMs / 3600000);
  const m = Math.floor((absMs % 3600000) / 60000);
  const sign = ms < 0 ? '-' : '+';
  return `${sign}${h}:${String(m).padStart(2, '0')}`;
}

// ─── Template ────────────────────────────────────────────────────────────────

function _template() {
  return `
    <div class="profile-screen" id="profileScreen">
      <!-- Employee Card placeholder — populated on render -->
      <div id="profileEmpCard"></div>

      <!-- Balance Row -->
      <div class="profile-balance-row" id="profileBalanceRow"></div>

      <!-- Settings Section -->
      <div class="profile-section-title">einstellungen</div>
      <div class="settings-list">
        <div class="settings-row" id="btnWorkTimeSettings">
          <div class="settings-row-left">
            <div class="settings-row-title">arbeitszeitmodell</div>
            <div class="settings-row-sub" id="workModelSub">Vollzeit · 40h / Woche</div>
          </div>
          <svg class="settings-row-chevron" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
          </svg>
        </div>
      </div>

      <!-- API Section -->
      <div class="profile-section-title">personio verbindung</div>
      <div class="api-status-row" id="apiStatusRow">
        <div class="api-status-left">
          <div class="api-status-title">personio</div>
          <div class="api-status-sub" id="apiStatusSub">lädt...</div>
        </div>
        <span class="api-status-badge demo" id="apiStatusBadge">Demo</span>
      </div>

      <!-- Logout -->
      <button class="btn-logout" id="btnLogout">abmelden</button>

      <!-- Version -->
      <div class="profile-version" id="profileVersion">FLUXS Zeit v2.0 · ${Env.getEnv ? Env.getEnv() : 'staging'}</div>
    </div>

    <!-- Work Time Modal -->
    <div class="modal-overlay" id="modalWorkTime" role="dialog" aria-hidden="true">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">arbeitszeitmodell</div>
        <div class="form-row">
          <label class="form-label" for="inputWeekHours">wochenstunden</label>
          <input class="form-input" type="number" id="inputWeekHours" min="1" max="60" step="0.5" value="40" />
        </div>
        <div class="form-row">
          <label class="form-label" for="inputDayHours">tagesstunden (soll)</label>
          <input class="form-input" type="number" id="inputDayHours" min="1" max="12" step="0.5" value="8" />
        </div>
        <div class="form-row">
          <label class="form-label" for="inputYearVacation">urlaubstage pro jahr</label>
          <input class="form-input" type="number" id="inputYearVacation" min="1" max="60" value="28" />
        </div>
        <div class="form-actions">
          <button class="btn-secondary" id="btnWorkTimeCancel">abbrechen</button>
          <button class="btn-primary" id="btnWorkTimeSave">speichern</button>
        </div>
      </div>
    </div>
  `;
}

// ─── Render Employee Card ─────────────────────────────────────────────────────

function _renderEmployeeCard() {
  const cardEl = $('profileEmpCard');
  if (!cardEl) return;

  const emp = State.get('currentEmployee');
  if (!emp) {
    cardEl.innerHTML = '';
    return;
  }

  cardEl.innerHTML = `
    <div class="profile-avatar-card">
      <div class="profile-avatar-lg">${emp.initials}</div>
      <div class="profile-info">
        <div class="profile-name">${emp.name.toLowerCase()}</div>
        <div class="profile-role">${emp.dept ? emp.dept + ' · ' : ''}${emp.role || ''}</div>
        <span class="profile-id">ID #${emp.id}</span>
      </div>
    </div>`;
}

// ─── Render Balance Row ───────────────────────────────────────────────────────

function _renderBalanceRow() {
  const rowEl = $('profileBalanceRow');
  if (!rowEl) return;

  const emp = State.get('currentEmployee');
  if (!emp) { rowEl.innerHTML = ''; return; }

  const settings = State.get('settings') || {};
  const totalWorkMs = State.get('totalWorkMs') || 0;
  const overtimeMs = (emp.overtimeMs || 0) + totalWorkMs - ((settings.dayHours || 8) * 3600000);
  const otStr = _fmtMs(overtimeMs);
  const otCls = overtimeMs < 0 ? 'orange' : '';

  const vac = emp.vacation || { total: settings.yearVacation || 28, used: 0 };
  const vacRemaining = Math.max(0, vac.total - vac.used);

  rowEl.innerHTML = `
    <div class="profile-balance-card">
      <div class="profile-balance-value">${vacRemaining}</div>
      <div class="profile-balance-label">resturlaub</div>
      <div class="profile-balance-sub">von ${vac.total} Tagen</div>
    </div>
    <div class="profile-balance-card">
      <div class="profile-balance-value ${otCls}">${otStr}</div>
      <div class="profile-balance-label">überstunden</div>
      <div class="profile-balance-sub">kumuliert</div>
    </div>`;
}

// ─── Render Work Model Sub ────────────────────────────────────────────────────

function _renderWorkModel() {
  const el = $('workModelSub');
  if (!el) return;
  const settings = State.get('settings') || {};
  const weekH = settings.weekHours || 40;
  const type = weekH >= 35 ? 'Vollzeit' : 'Teilzeit';
  el.textContent = `${type} · ${weekH}h / Woche`;
}

// ─── Render API Status ────────────────────────────────────────────────────────

function _renderApiStatus() {
  const badge = $('apiStatusBadge');
  const sub = $('apiStatusSub');
  const mode = State.get('apiMode');

  if (mode === 'real') {
    if (badge) { badge.textContent = 'Verbunden'; badge.className = 'api-status-badge connected'; }
    if (sub) sub.textContent = 'Personio verbunden';
  } else {
    if (badge) { badge.textContent = 'Demo'; badge.className = 'api-status-badge demo'; }
    if (sub) sub.textContent = 'Demo-Modus aktiv';
  }
}

// ─── Full Render ──────────────────────────────────────────────────────────────

function _render() {
  _renderEmployeeCard();
  _renderBalanceRow();
  _renderWorkModel();
  _renderApiStatus();
}

// ─── Work Time Settings Modal ─────────────────────────────────────────────────

function _openWorkTimeModal() {
  const settings = State.get('settings') || {};
  const wh = $('inputWeekHours');
  const dh = $('inputDayHours');
  const yv = $('inputYearVacation');
  if (wh) wh.value = settings.weekHours || 40;
  if (dh) dh.value = settings.dayHours || 8;
  if (yv) yv.value = settings.yearVacation || 28;

  const modal = $('modalWorkTime');
  if (modal) { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
}

function _saveWorkTimeSettings() {
  const weekHours = parseFloat($('inputWeekHours')?.value) || 40;
  const dayHours = parseFloat($('inputDayHours')?.value) || 8;
  const yearVacation = parseInt($('inputYearVacation')?.value) || 28;

  State.set('settings', { weekHours, dayHours, yearVacation });

  const modal = $('modalWorkTime');
  if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }

  showToast('Arbeitszeitmodell gespeichert', 'success');
  _render();
}

function _closeModal(id) {
  const modal = $(id);
  if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

function _logout() {
  if (!window.confirm('Wirklich abmelden?')) return;
  Auth.logout();
}

// ─── Event Handling ───────────────────────────────────────────────────────────

function _handleClick(e) {
  if (e.target.closest('#btnLogout')) {
    _logout();
    return;
  }

  if (e.target.closest('#btnWorkTimeSettings')) {
    _openWorkTimeModal();
    return;
  }

  if (e.target.closest('#btnWorkTimeSave')) {
    _saveWorkTimeSettings();
    return;
  }

  if (e.target.closest('#btnWorkTimeCancel')) {
    _closeModal('modalWorkTime');
    return;
  }

  // Backdrop close
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    e.target.setAttribute('aria-hidden', 'true');
    return;
  }
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

let _unsubs = [];

// ─── Mount / Unmount ──────────────────────────────────────────────────────────

export async function mount(container) {
  _loadCSS();
  container.innerHTML = _template();

  _render();

  _unsubs = [
    State.subscribe('currentEmployee', _render),
    State.subscribe('apiMode', _renderApiStatus),
    State.subscribe('settings', () => { _renderBalanceRow(); _renderWorkModel(); }),
    State.subscribe('totalWorkMs', _renderBalanceRow),
  ];

  container.addEventListener('click', _handleClick);
}

export function unmount() {
  _unsubs.forEach(fn => fn());
  _unsubs = [];
}
