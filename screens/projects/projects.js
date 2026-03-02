/**
 * FLUXS Zeit App — Projekte Screen
 * Admin: manage projects + evaluate bookings. Employee: own bookings summary.
 * Max 500 lines.
 */

'use strict';

import * as State from '../../core/state.js';
import * as Auth from '../../core/auth.js';
import * as Env from '../../core/env.js';
import { $, showToast } from '../../core/ui.js';

// ─── Load CSS ───────────────────────────────────────────────────────────────

function _loadCSS() {
  if (!document.getElementById('css-projects')) {
    const link = document.createElement('link');
    link.id = 'css-projects';
    link.rel = 'stylesheet';
    link.href = './screens/projects/projects.css';
    document.head.appendChild(link);
  }
}

// ─── Seed Demo Projects (staging) ───────────────────────────────────────────

function _seedDemoProjects() {
  if (!Env.isStaging()) return;
  const existing = State.get('projects') || [];
  if (existing.length > 0) return;
  State.set('projects', [
    { id: 'p-1', title: 'Lager Reorganisation',     createdBy: 'Demo', createdAt: new Date().toISOString(), deleted: false },
    { id: 'p-2', title: 'IT Infrastruktur',          createdBy: 'Demo', createdAt: new Date().toISOString(), deleted: false },
    { id: 'p-3', title: 'Kundenprojekt Müller GmbH', createdBy: 'Demo', createdAt: new Date().toISOString(), deleted: false },
  ]);
}

// ─── Format helpers ─────────────────────────────────────────────────────────

function _fmtDuration(ms) {
  if (!ms || ms < 0) return '0:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}:${String(m).padStart(2, '0')}`;
}

function _msToHours(ms) {
  return (ms / 3600000).toFixed(2);
}

// ─── Template ───────────────────────────────────────────────────────────────

function _templateEmployee() {
  const emp = State.get('currentEmployee');
  const bookings = (State.get('projectBookings') || [])
    .filter(b => b.employeeId === (emp && emp.id));
  const projects = State.get('projects') || [];

  const rows = bookings.length === 0
    ? `<tr><td colspan="5" class="proj-empty">keine buchungen vorhanden</td></tr>`
    : bookings.map(b => `
        <tr>
          <td>${b.date}</td>
          <td>${b.projectTitle || b.projectId}</td>
          <td>${b.startTime}</td>
          <td>${b.endTime}</td>
          <td>${_fmtDuration(b.durationMs)}</td>
        </tr>
      `).join('');

  const totalMs = bookings.reduce((sum, b) => sum + (b.durationMs || 0), 0);

  return `
    <div class="projects-screen">
      <h2 class="proj-screen-title">meine projektstunden</h2>
      <div class="proj-total">gesamt: <strong>${_fmtDuration(totalMs)}</strong></div>
      <div class="proj-table-wrap">
        <table class="proj-table">
          <thead><tr>
            <th>datum</th><th>projekt</th><th>von</th><th>bis</th><th>dauer</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function _templateAdmin(activeTab) {
  return `
    <div class="projects-screen">
      <h2 class="proj-screen-title">projekte</h2>
      <div class="proj-tabs">
        <button class="proj-tab${activeTab === 'manage' ? ' active' : ''}" data-tab="manage">verwalten</button>
        <button class="proj-tab${activeTab === 'eval' ? ' active' : ''}" data-tab="eval">auswertung</button>
      </div>
      <div id="projTabContent"></div>
    </div>
  `;
}

// ─── Manage Tab ─────────────────────────────────────────────────────────────

function _renderManage(container) {
  const projects = (State.get('projects') || []);
  const active = projects.filter(p => !p.deleted);
  const archived = projects.filter(p => p.deleted);

  const activeRows = active.length === 0
    ? `<p class="proj-empty">keine aktiven projekte</p>`
    : active.map(p => `
        <div class="proj-item">
          <span class="proj-item-name">${p.title}</span>
          <button class="proj-item-btn btn-archive" data-archive-id="${p.id}">archivieren</button>
        </div>
      `).join('');

  const archivedRows = archived.length === 0 ? '' : `
    <div class="proj-archived-section">
      <h3 class="proj-section-label">archiviert</h3>
      ${archived.map(p => `
        <div class="proj-item proj-item--archived">
          <span class="proj-item-name">${p.title}</span>
          <button class="proj-item-btn btn-restore" data-restore-id="${p.id}">wiederherstellen</button>
        </div>
      `).join('')}
    </div>
  `;

  container.innerHTML = `
    <div class="proj-manage">
      <form class="proj-create-form" id="projCreateForm">
        <input
          type="text"
          id="projNameInput"
          class="form-input proj-name-input"
          placeholder="neues projekt eingeben..."
          maxlength="80"
        />
        <button type="submit" class="btn-proj-create">+ erstellen</button>
      </form>
      <div class="proj-active-list" id="projActiveList">
        ${activeRows}
      </div>
      ${archivedRows}
    </div>
  `;

  // Bind create form
  document.getElementById('projCreateForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('projNameInput');
    const title = (input?.value || '').trim();
    if (!title) { showToast('Projektname eingeben', 'error'); return; }

    const emp = State.get('currentEmployee');
    const newProject = {
      id: `p-${Date.now()}`,
      title,
      createdBy: emp ? emp.name : 'Admin',
      createdAt: new Date().toISOString(),
      deleted: false,
    };
    State.update('projects', ps => [...ps, newProject]);
    if (input) input.value = '';
    showToast('Projekt erstellt', 'success');
    _renderManage(container);
  });
}

// ─── Eval Tab ───────────────────────────────────────────────────────────────

function _renderEval(container) {
  const projects = (State.get('projects') || []).filter(p => !p.deleted);
  const bookings = State.get('projectBookings') || [];

  const now = new Date();
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
    });
  }

  const projOptions = projects.map(p =>
    `<option value="${p.id}">${p.title}</option>`
  ).join('');
  const monthOptions = months.map(m =>
    `<option value="${m.value}"${m.value === months[0].value ? ' selected' : ''}>${m.label}</option>`
  ).join('');

  container.innerHTML = `
    <div class="proj-eval">
      <div class="proj-eval-filters">
        <select class="form-input proj-select" id="filterProject">
          <option value="">alle projekte</option>
          ${projOptions}
        </select>
        <select class="form-input proj-select" id="filterMonth">
          ${monthOptions}
        </select>
        <button class="btn-proj-export" id="btnExport">xlsx export</button>
      </div>
      <div id="evalTableWrap"></div>
    </div>
  `;

  const runFilter = () => {
    const pid = document.getElementById('filterProject')?.value || '';
    const month = document.getElementById('filterMonth')?.value || '';

    let filtered = bookings.filter(b => {
      const matchProj = !pid || String(b.projectId) === String(pid);
      const matchMonth = !month || (b.date || '').startsWith(month);
      return matchProj && matchMonth;
    });

    _renderEvalTable(document.getElementById('evalTableWrap'), filtered);
  };

  document.getElementById('filterProject')?.addEventListener('change', runFilter);
  document.getElementById('filterMonth')?.addEventListener('change', runFilter);
  document.getElementById('btnExport')?.addEventListener('click', () => {
    const pid = document.getElementById('filterProject')?.value || '';
    const month = document.getElementById('filterMonth')?.value || '';
    let filtered = bookings.filter(b => {
      return (!pid || String(b.projectId) === String(pid)) &&
             (!month || (b.date || '').startsWith(month));
    });
    _exportXLSX(filtered);
  });

  runFilter();
}

function _renderEvalTable(wrap, bookings) {
  if (!wrap) return;
  if (bookings.length === 0) {
    wrap.innerHTML = '<p class="proj-empty">keine buchungen für diesen filter</p>';
    return;
  }

  const totalMs = bookings.reduce((s, b) => s + (b.durationMs || 0), 0);
  const rows = bookings.map(b => `
    <tr>
      <td>${b.date}</td>
      <td>${b.employeeName || '—'}</td>
      <td>${b.projectTitle || b.projectId}</td>
      <td>${b.startTime}</td>
      <td>${b.endTime}</td>
      <td>${_fmtDuration(b.durationMs)}</td>
    </tr>
  `).join('');

  wrap.innerHTML = `
    <div class="proj-eval-total">gesamt: <strong>${_fmtDuration(totalMs)}</strong> (${_msToHours(totalMs)} std)</div>
    <div class="proj-table-wrap">
      <table class="proj-table">
        <thead><tr>
          <th>datum</th><th>mitarbeiter</th><th>projekt</th><th>von</th><th>bis</th><th>dauer</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function _exportXLSX(bookings) {
  if (!window.XLSX) { showToast('XLSX nicht verfügbar', 'error'); return; }
  const rows = bookings.map(b => ({
    Datum: b.date,
    Mitarbeiter: b.employeeName,
    Projekt: b.projectTitle || b.projectId,
    Von: b.startTime,
    Bis: b.endTime,
    'Dauer (h)': _msToHours(b.durationMs),
  }));
  const ws = window.XLSX.utils.json_to_sheet(rows);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Projektbuchungen');
  window.XLSX.writeFile(wb, `fluxs-projekte-${new Date().toISOString().split('T')[0]}.xlsx`);
  showToast('Export erstellt', 'success');
}

// ─── Active tab state ────────────────────────────────────────────────────────

let _activeTab = 'manage';
let _unsubs = [];

// ─── Render ─────────────────────────────────────────────────────────────────

function _render(container) {
  const isAdmin = Auth.isAdmin();

  if (!isAdmin) {
    container.innerHTML = _templateEmployee();
    return;
  }

  container.innerHTML = _templateAdmin(_activeTab);
  const tabContent = $('projTabContent');
  if (_activeTab === 'manage') {
    _renderManage(tabContent);
  } else {
    _renderEval(tabContent);
  }
}

// ─── Event Handling ─────────────────────────────────────────────────────────

let _container = null;

function _handleClick(e) {
  // Tab switch
  const tabBtn = e.target.closest('[data-tab]');
  if (tabBtn) {
    _activeTab = tabBtn.dataset.tab;
    _render(_container);
    return;
  }

  // Archive project
  const archiveBtn = e.target.closest('[data-archive-id]');
  if (archiveBtn) {
    const id = archiveBtn.dataset.archiveId;
    State.update('projects', ps =>
      ps.map(p => p.id === id ? { ...p, deleted: true } : p)
    );
    showToast('Projekt archiviert', 'info');
    _render(_container);
    return;
  }

  // Restore project
  const restoreBtn = e.target.closest('[data-restore-id]');
  if (restoreBtn) {
    const id = restoreBtn.dataset.restoreId;
    State.update('projects', ps =>
      ps.map(p => p.id === id ? { ...p, deleted: false } : p)
    );
    showToast('Projekt wiederhergestellt', 'success');
    _render(_container);
    return;
  }
}

// ─── Mount / Unmount ────────────────────────────────────────────────────────

export async function mount(container) {
  _loadCSS();
  _container = container;
  _seedDemoProjects();
  _render(container);

  _unsubs = [
    State.subscribe('projects', () => _render(container)),
    State.subscribe('projectBookings', () => _render(container)),
  ];

  container.addEventListener('click', _handleClick);
}

export function unmount() {
  _unsubs.forEach(fn => fn());
  _unsubs = [];
  _container = null;
}
