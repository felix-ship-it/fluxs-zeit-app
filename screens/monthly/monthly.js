/**
 * FLUXS Zeit App — Monthly Overview Screen
 * Calendar grid, month navigation, summary stats, XLSX export.
 * Max 500 lines.
 */

'use strict';

import * as State from '../../core/state.js';
import { $, showToast, formatDate } from '../../core/ui.js';

// ─── Load CSS ───────────────────────────────────────────────────────────────

function _loadCSS() {
  if (!document.getElementById('css-monthly')) {
    const link = document.createElement('link');
    link.id = 'css-monthly';
    link.rel = 'stylesheet';
    link.href = './screens/monthly/monthly.css';
    document.head.appendChild(link);
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const WEEKDAY_SHORT = ['Mo','Di','Mi','Do','Fr','Sa','So'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function _fmtMsShort(ms) {
  if (!ms) return '0:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}:${String(m).padStart(2, '0')}`;
}

function _fmtMsSigned(ms) {
  const sign = ms >= 0 ? '+' : '-';
  return sign + _fmtMsShort(Math.abs(ms));
}

// ─── Template ─────────────────────────────────────────────────────────────────

function _template() {
  return `
    <div class="monthly-screen">
      <!-- Month Navigation -->
      <div class="month-nav">
        <button class="month-nav-btn" id="btnPrevMonth" aria-label="Vormonat">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z"/>
          </svg>
        </button>
        <div class="month-title" id="monthTitle">–</div>
        <button class="month-nav-btn" id="btnNextMonth" aria-label="Nächster Monat">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
          </svg>
        </button>
      </div>

      <!-- Summary Stats -->
      <div class="monthly-stats-row">
        <div class="monthly-stat">
          <div class="monthly-stat-value" id="monthTotalHours">–</div>
          <div class="monthly-stat-label">gesamt</div>
        </div>
        <div class="monthly-stat">
          <div class="monthly-stat-value" id="monthTargetHours">–</div>
          <div class="monthly-stat-label">soll</div>
        </div>
        <div class="monthly-stat">
          <div class="monthly-stat-value" id="monthOvertimeHours">–</div>
          <div class="monthly-stat-label">mehr/minder</div>
        </div>
        <div class="monthly-stat">
          <div class="monthly-stat-value" id="monthVacationDays">–</div>
          <div class="monthly-stat-label">urlaub</div>
        </div>
      </div>

      <!-- Export -->
      <div class="monthly-export-row">
        <button class="btn-export" id="btnExportXLSX">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
          xlsx export
        </button>
      </div>

      <!-- Weekday Headers -->
      <div class="calendar-weekdays">
        ${WEEKDAY_SHORT.map(d => `<div class="calendar-weekday-label">${d}</div>`).join('')}
      </div>

      <!-- Calendar Grid -->
      <div class="calendar-grid" id="calendarGrid"></div>
    </div>

    <!-- Day Detail Modal -->
    <div class="modal-overlay monthly-day-modal" id="modalDayDetail" role="dialog" aria-hidden="true">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title" id="dayDetailTitle">details</div>
        <div class="modal-day-date" id="dayDetailDate"></div>
        <div id="dayDetailContent"></div>
        <div class="form-actions" style="margin-top:16px">
          <button class="btn-secondary" id="btnDayDetailClose">schließen</button>
        </div>
      </div>
    </div>
  `;
}

// ─── Render Calendar ──────────────────────────────────────────────────────────

function _renderCalendar() {
  const m = State.get('viewMonth');
  const y = State.get('viewYear');

  const titleEl = $('monthTitle');
  if (titleEl) titleEl.textContent = `${MONTHS_DE[m].toLowerCase()} ${y}`;

  const today = new Date();
  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);

  // Monday-first offset
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const records = State.get('attendanceRecords') || [];
  const lookup = {};
  records.forEach(r => { lookup[r.date] = r; });

  // Include today's active session
  if (State.get('clockedIn')) {
    const key = _fmtDate(today);
    lookup[key] = {
      date: key,
      type: 'work',
      hours: (State.get('totalWorkMs') || 0) / 3600000,
      breakMin: Math.floor((State.get('totalPauseMs') || 0) / 60000),
    };
  }

  // Absences lookup
  const absLookup = {};
  (State.get('absenceRequests') || []).forEach(abs => {
    if (abs.status !== 'rejected') {
      const start = new Date(abs.start);
      const end = new Date(abs.end);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        absLookup[_fmtDate(d)] = abs.type;
      }
    }
  });

  const settings = State.get('settings') || {};
  const dayHours = settings.dayHours || 8;

  let html = '';
  let totalWorkMs = 0;
  let totalTargetMs = 0;
  let vacDays = 0;

  // Empty leading cells
  for (let i = 0; i < startDow; i++) {
    html += '<div class="calendar-day empty"><div class="day-num"></div></div>';
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(y, m, d);
    const dow = date.getDay(); // 0=Sun 6=Sat
    const isWeekend = dow === 0 || dow === 6;
    const isFuture = date > today;
    const isToday = _fmtDate(date) === _fmtDate(today);
    const dateStr = _fmtDate(date);
    const rec = lookup[dateStr];
    const absType = absLookup[dateStr];

    let cls = '';
    let hoursHtml = '';
    let dotHtml = '';

    if (isWeekend) {
      cls = 'weekend';
    } else if (absType === 'urlaub') {
      cls = 'vacation';
      hoursHtml = 'Urlaub';
      dotHtml = '<div class="day-dot vacation"></div>';
      vacDays++;
    } else if (absType === 'krank' || absType === 'kindkrank') {
      cls = 'sick';
      hoursHtml = absType === 'kindkrank' ? 'Kind' : 'Krank';
      dotHtml = '<div class="day-dot sick"></div>';
    } else if (rec && rec.type === 'work' && rec.hours > 0) {
      cls = 'worked';
      const workMs = Math.round(rec.hours * 3600000);
      hoursHtml = _fmtMsShort(workMs);
      dotHtml = '<div class="day-dot worked"></div>';
      totalWorkMs += workMs;
      if (!isWeekend) totalTargetMs += dayHours * 3600000;
    } else if (!isWeekend && !isFuture && !isToday) {
      cls = 'missing';
      totalTargetMs += dayHours * 3600000;
    } else if (!isWeekend && !isFuture) {
      totalTargetMs += dayHours * 3600000;
    }

    if (isToday) cls += ' today';

    html += `
      <div class="calendar-day ${cls}" data-date="${dateStr}">
        <div class="day-num">${d}</div>
        ${hoursHtml ? `<div class="day-hours">${hoursHtml}</div>` : ''}
        ${dotHtml}
      </div>`;
  }

  const grid = $('calendarGrid');
  if (grid) grid.innerHTML = html;

  // Update stats
  const overMs = totalWorkMs - totalTargetMs;
  const overCls = overMs >= 0 ? 'lime' : 'orange';

  const totalEl = $('monthTotalHours');
  const targetEl = $('monthTargetHours');
  const overEl = $('monthOvertimeHours');
  const vacEl = $('monthVacationDays');

  if (totalEl) totalEl.textContent = _fmtMsShort(totalWorkMs);
  if (targetEl) targetEl.textContent = _fmtMsShort(totalTargetMs);
  if (overEl) {
    overEl.textContent = _fmtMsSigned(overMs);
    overEl.className = `monthly-stat-value ${overCls}`;
  }
  if (vacEl) vacEl.textContent = vacDays;
}

// ─── Day Detail ───────────────────────────────────────────────────────────────

function _showDayDetail(dateStr) {
  const records = State.get('attendanceRecords') || [];
  const rec = records.find(r => r.date === dateStr);

  const titleEl = $('dayDetailTitle');
  const dateEl = $('dayDetailDate');
  const contentEl = $('dayDetailContent');

  if (titleEl) titleEl.textContent = 'tagesdetails';
  if (dateEl) {
    const d = new Date(dateStr + 'T00:00:00');
    dateEl.textContent = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  if (contentEl) {
    if (!rec || rec.type !== 'work') {
      const absType = (State.get('absenceRequests') || []).find(a => {
        return a.status !== 'rejected' && dateStr >= a.start && dateStr <= a.end;
      });
      contentEl.innerHTML = absType
        ? `<div class="day-detail-row"><span class="day-detail-label">art</span><span class="day-detail-value">${absType.label}</span></div>`
        : `<div style="font-size:13px;color:var(--text-muted);padding:8px 0">kein eintrag</div>`;
    } else {
      const workMs = Math.round((rec.hours || 0) * 3600000);
      const breakMin = rec.breakMin || rec.break || 0;
      contentEl.innerHTML = `
        <div class="day-detail-row">
          <span class="day-detail-label">beginn</span>
          <span class="day-detail-value">${rec.start || '–'}</span>
        </div>
        <div class="day-detail-row">
          <span class="day-detail-label">ende</span>
          <span class="day-detail-value">${rec.end || '–'}</span>
        </div>
        <div class="day-detail-row">
          <span class="day-detail-label">pause</span>
          <span class="day-detail-value">${breakMin} Min.</span>
        </div>
        <div class="day-detail-row">
          <span class="day-detail-label">arbeitszeit</span>
          <span class="day-detail-value">${_fmtMsShort(workMs)}</span>
        </div>`;
    }
  }

  const modal = $('modalDayDetail');
  if (modal) { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
}

// ─── XLSX Export ─────────────────────────────────────────────────────────────

function _exportXLSX() {
  if (typeof XLSX === 'undefined') {
    showToast('XLSX Bibliothek nicht geladen', 'error');
    return;
  }

  const m = State.get('viewMonth');
  const y = State.get('viewYear');
  const records = State.get('attendanceRecords') || [];
  const emp = State.get('currentEmployee');

  const monthRecords = records.filter(r => {
    const [ry, rm] = r.date.split('-').map(Number);
    return ry === y && rm === m + 1;
  });

  const rows = [
    ['Datum', 'Wochentag', 'Beginn', 'Ende', 'Pause (Min.)', 'Arbeitszeit (h)', 'Kommentar'],
  ];

  monthRecords.forEach(r => {
    const d = new Date(r.date + 'T00:00:00');
    const weekday = d.toLocaleDateString('de-DE', { weekday: 'long' });
    const hours = r.hours ? r.hours.toFixed(2) : '0.00';
    rows.push([
      r.date,
      weekday,
      r.start || '',
      r.end || '',
      r.breakMin || r.break || 0,
      hours,
      r.comment || '',
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Arbeitszeiten');

  const filename = `fluxs-zeit_${emp ? emp.name.replace(/\s+/g, '_') : 'export'}_${y}-${String(m+1).padStart(2,'0')}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast('XLSX exportiert', 'success');
}

// ─── Event Handling ───────────────────────────────────────────────────────────

function _handleClick(e) {
  if (e.target.closest('#btnPrevMonth')) {
    let m = State.get('viewMonth') - 1;
    let y = State.get('viewYear');
    if (m < 0) { m = 11; y--; }
    State.set('viewMonth', m);
    State.set('viewYear', y);
    _renderCalendar();
    return;
  }

  if (e.target.closest('#btnNextMonth')) {
    let m = State.get('viewMonth') + 1;
    let y = State.get('viewYear');
    if (m > 11) { m = 0; y++; }
    State.set('viewMonth', m);
    State.set('viewYear', y);
    _renderCalendar();
    return;
  }

  if (e.target.closest('#btnExportXLSX')) {
    _exportXLSX();
    return;
  }

  if (e.target.closest('#btnDayDetailClose')) {
    const modal = $('modalDayDetail');
    if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
    return;
  }

  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    e.target.setAttribute('aria-hidden', 'true');
    return;
  }

  const day = e.target.closest('.calendar-day[data-date]');
  if (day) {
    _showDayDetail(day.dataset.date);
    return;
  }
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

let _unsubs = [];

// ─── Mount / Unmount ──────────────────────────────────────────────────────────

export async function mount(container) {
  _loadCSS();
  container.innerHTML = _template();

  _renderCalendar();

  _unsubs = [
    State.subscribe('attendanceRecords', _renderCalendar),
    State.subscribe('absenceRequests', _renderCalendar),
    State.subscribe('viewMonth', _renderCalendar),
    State.subscribe('viewYear', _renderCalendar),
  ];

  container.addEventListener('click', _handleClick);
}

export function unmount() {
  _unsubs.forEach(fn => fn());
  _unsubs = [];
}
