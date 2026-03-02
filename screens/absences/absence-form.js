/**
 * FLUXS Zeit App — Absence Request Form
 * Modal sheet for creating / editing absence requests.
 * Max 500 lines.
 */

'use strict';

import * as State from '../../core/state.js';
import * as Auth from '../../core/auth.js';
import { $, showToast, todayISO } from '../../core/ui.js';

// ─── Internal State ──────────────────────────────────────────────────────────

let _currentType = null;
let _editId = null;
let _onSubmitCb = null;
let _modalEl = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _countWeekdays(startStr, endStr) {
  const start = new Date(startStr);
  const end = new Date(endStr);
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
  }
  return count;
}

function _nextWorkday(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function _getEmployees() {
  const mode = State.get('apiMode');
  const real = State.get('realEmployees');
  return (mode === 'real' && real) ? real : Auth.getEmployees();
}

function _populateVertreter(selectId) {
  const sel = $(selectId);
  if (!sel) return;
  const emp = State.get('currentEmployee');
  const employees = _getEmployees();
  sel.innerHTML = '<option value="">– kein vertreter –</option>' +
    employees
      .filter(e => !emp || e.id !== emp.id)
      .map(e => `<option value="${e.id}">${e.name}</option>`)
      .join('');
}

// ─── Build Modal HTML per Type ────────────────────────────────────────────────

const _typeMeta = {
  urlaub: { label: 'urlaub beantragen', icon: '🌴' },
  krank: { label: 'krankmeldung', icon: '🤒' },
  kindkrank: { label: 'kind krank melden', icon: '👶' },
  ueberstundenausgleich: { label: 'überstundenausgleich', icon: '⏱' },
};

function _buildModalHTML(type, prefill = {}) {
  const meta = _typeMeta[type] || { label: type, icon: '📋' };
  const today = todayISO();
  const start = prefill.start || today;
  const end = prefill.end || today;

  let fieldsHTML = '';

  if (type === 'ueberstundenausgleich') {
    const emp = State.get('currentEmployee');
    const settings = State.get('settings') || {};
    const totalWorkMs = State.get('totalWorkMs') || 0;
    const overtimeMs = (emp?.overtimeMs || 0) + totalWorkMs - ((settings.dayHours || 8) * 3600000);
    const maxH = Math.max(0, Math.floor(overtimeMs / 3600000));
    const overtimeSign = overtimeMs >= 0 ? '+' : '-';
    const overtimeH = Math.floor(Math.abs(overtimeMs) / 3600000);
    const overtimeM = Math.floor((Math.abs(overtimeMs) % 3600000) / 60000);

    fieldsHTML = `
      <div class="form-row">
        <div style="text-align:center;padding:12px;background:var(--bg-card);border-radius:var(--radius-md);margin-bottom:16px;">
          <div style="font-size:24px;font-weight:800;color:var(--fluxs-lime)">${overtimeSign}${overtimeH}:${String(overtimeM).padStart(2,'00')}</div>
          <div style="font-size:12px;color:var(--text-muted)">aktuelle überstunden</div>
        </div>
      </div>
      <div class="form-row">
        <label class="form-label">stunden ausgleichen</label>
        <input class="form-input" type="number" id="absFormHours" min="1" max="${maxH}" value="${Math.min(1, maxH)}" />
      </div>
      <div class="form-row">
        <label class="form-label">datum</label>
        <input class="form-input" type="date" id="absFormStart" value="${start}" min="${today}" />
      </div>`;
  } else if (type === 'krank') {
    fieldsHTML = `
      <div class="form-info">Krankmeldung ohne AU-Bescheinigung max. 2 Tage möglich.</div>
      <div class="form-row">
        <label class="form-label">ab (heute oder nächster arbeitstag)</label>
        <input class="form-input" type="date" id="absFormStart" value="${start}" min="${today}" />
      </div>
      <div class="form-row">
        <label class="form-label">bis</label>
        <input class="form-input" type="date" id="absFormEnd" value="${end}" min="${today}" />
      </div>
      <div id="absFormAuRow" style="display:none">
        <label class="form-checkbox-row" for="absFormAuCheck">
          <input type="checkbox" id="absFormAuCheck" />
          <span class="form-checkbox-label">AU-Bescheinigung liegt vor</span>
        </label>
        <div class="form-info" id="absFormAuHint"></div>
      </div>
      <div class="form-row">
        <label class="form-label">kommentar (optional)</label>
        <input class="form-input" type="text" id="absFormComment" value="${prefill.comment || ''}" placeholder="..." />
      </div>`;
  } else if (type === 'kindkrank') {
    fieldsHTML = `
      <div class="form-row">
        <label class="form-label">von</label>
        <input class="form-input" type="date" id="absFormStart" value="${start}" min="${today}" />
      </div>
      <div class="form-row">
        <label class="form-label">bis</label>
        <input class="form-input" type="date" id="absFormEnd" value="${end}" min="${today}" />
      </div>
      <div class="form-row">
        <label class="form-label">vertreter</label>
        <select class="form-select" id="absFormVertreter"></select>
      </div>
      <div class="form-row">
        <label class="form-label">kommentar (optional)</label>
        <input class="form-input" type="text" id="absFormComment" value="${prefill.comment || ''}" placeholder="..." />
      </div>`;
  } else {
    // urlaub (default)
    fieldsHTML = `
      <div class="form-row-inline">
        <div class="form-row" style="margin-bottom:0">
          <label class="form-label">von</label>
          <input class="form-input" type="date" id="absFormStart" value="${start}" min="${today}" />
        </div>
        <div class="form-row" style="margin-bottom:0">
          <label class="form-label">bis</label>
          <input class="form-input" type="date" id="absFormEnd" value="${end}" min="${today}" />
        </div>
      </div>
      <div class="form-row" style="margin-top:16px">
        <label class="form-label">vertreter</label>
        <select class="form-select" id="absFormVertreter"></select>
      </div>
      <div class="form-row">
        <label class="form-label">kommentar (optional)</label>
        <input class="form-input" type="text" id="absFormComment" value="${prefill.comment || ''}" placeholder="..." />
      </div>`;
  }

  return `
    <div class="modal-overlay" id="absenceFormModal" role="dialog" aria-hidden="true">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">${meta.label}</div>
        ${fieldsHTML}
        <div class="form-actions">
          <button class="btn-secondary" id="absFormCancel">abbrechen</button>
          <button class="btn-primary" id="absFormSubmit">beantragen</button>
        </div>
      </div>
    </div>`;
}

// ─── AU Visibility for Krank ─────────────────────────────────────────────────

function _updateKrankAU() {
  const startEl = $('absFormStart');
  const endEl = $('absFormEnd');
  const auRow = $('absFormAuRow');
  const auCheck = $('absFormAuCheck');
  const auHint = $('absFormAuHint');
  if (!startEl || !endEl || !auRow) return;

  const days = _countWeekdays(startEl.value, endEl.value);
  if (days > 2) {
    auRow.style.display = '';
    if (auCheck) auCheck.checked = true;
    if (auHint) auHint.textContent = 'Bei mehr als 2 Tagen ist eine AU-Bescheinigung erforderlich.';
  } else {
    auRow.style.display = 'none';
    if (auCheck) auCheck.checked = false;
  }
}

// ─── Submit Logic ─────────────────────────────────────────────────────────────

function _submit() {
  const type = _currentType;
  const today = todayISO();

  let request;

  if (type === 'ueberstundenausgleich') {
    const hours = parseInt($('absFormHours')?.value) || 0;
    const start = $('absFormStart')?.value || today;
    if (hours < 1) { showToast('Bitte mindestens 1 Stunde angeben', 'error'); return; }
    if (!start) { showToast('Bitte Datum angeben', 'error'); return; }
    request = {
      id: _editId || ('abs-' + Date.now()),
      type: 'ueberstundenausgleich',
      label: `Überstundenausgleich (${hours}h)`,
      start, end: start,
      hours,
      status: 'pending',
      comment: `${hours} Stunde(n) Überstundenausgleich`,
    };
  } else {
    const start = $('absFormStart')?.value;
    const end = $('absFormEnd')?.value || start;
    const comment = $('absFormComment')?.value?.trim() || '';
    const vertreter = $('absFormVertreter')?.value || '';
    const auVorhanden = $('absFormAuCheck')?.checked || false;

    if (!start) { showToast('Bitte Datum angeben', 'error'); return; }
    if (end < start) { showToast('Enddatum muss nach Startdatum liegen', 'error'); return; }

    const typeLabels = {
      urlaub: 'Urlaub', krank: 'Krankmeldung', kindkrank: 'Kind krank',
      ueberstundenausgleich: 'Überstundenausgleich',
    };

    request = {
      id: _editId || ('abs-' + Date.now()),
      type,
      label: typeLabels[type] || type,
      start, end,
      comment,
      vertreter,
      auVorhanden,
      status: 'pending',
    };
  }

  // Save to state
  const requests = State.get('absenceRequests') || [];
  if (_editId) {
    const idx = requests.findIndex(a => a.id === _editId);
    if (idx !== -1) requests[idx] = request;
    else requests.push(request);
  } else {
    requests.push(request);
  }
  State.set('absenceRequests', [...requests]);

  // AU reminder for krank > 2 days
  if (type === 'krank') {
    const days = _countWeekdays(request.start, request.end);
    if (days > 2) {
      showToast('Denke daran, eine AU-Bescheinigung einzureichen.', 'warning');
      setTimeout(() => showToast('Krankmeldung eingereicht', 'success'), 2000);
    } else {
      showToast('Krankmeldung eingereicht', 'success');
    }
  } else {
    showToast('Antrag eingereicht – ausstehend', 'success');
  }

  _close();
  if (_onSubmitCb) _onSubmitCb();
}

// ─── Open / Close ─────────────────────────────────────────────────────────────

function _attachListeners() {
  const modal = $('absenceFormModal');
  if (!modal) return;

  $('absFormCancel')?.addEventListener('click', _close);
  $('absFormSubmit')?.addEventListener('click', _submit);

  // Backdrop close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) _close();
  });

  // Krank: update AU visibility on date change
  if (_currentType === 'krank') {
    $('absFormStart')?.addEventListener('change', _updateKrankAU);
    $('absFormEnd')?.addEventListener('change', _updateKrankAU);
  }

  // Populate vertreter dropdowns
  if (_currentType === 'urlaub' || _currentType === 'kindkrank') {
    _populateVertreter('absFormVertreter');
  }
}

function _close() {
  const modal = $('absenceFormModal');
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    setTimeout(() => { modal.remove(); _modalEl = null; }, 300);
  }
}

export function open(type, onSubmit) {
  _currentType = type;
  _editId = null;
  _onSubmitCb = onSubmit;
  _inject(_buildModalHTML(type));
  setTimeout(() => {
    const modal = $('absenceFormModal');
    if (modal) { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
  }, 10);
}

export function openEdit(absId, onSubmit) {
  const requests = State.get('absenceRequests') || [];
  const abs = requests.find(a => a.id === absId);
  if (!abs) return;
  _currentType = abs.type;
  _editId = absId;
  _onSubmitCb = onSubmit;
  _inject(_buildModalHTML(abs.type, abs));
  setTimeout(() => {
    const modal = $('absenceFormModal');
    if (modal) { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
  }, 10);
}

function _inject(html) {
  const existing = $('absenceFormModal');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', html);
  _modalEl = $('absenceFormModal');
  _attachListeners();
}

export function destroy() {
  const modal = $('absenceFormModal');
  if (modal) modal.remove();
  _modalEl = null;
  _currentType = null;
  _editId = null;
  _onSubmitCb = null;
}
