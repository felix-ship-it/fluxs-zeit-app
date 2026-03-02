/**
 * FLUXS Zeit App — Dashboard Screen
 * Orchestrates clock, quick actions, stats, timeline.
 * Max 500 lines.
 */

'use strict';

import * as State from '../../core/state.js';
import * as Clock from './clock.js';
import * as Timeline from './timeline.js';
import { $, formatTime } from '../../core/ui.js';

// ─── Load CSS ───────────────────────────────────────────────────────────────

function _loadCSS() {
  if (!document.getElementById('css-dashboard')) {
    const link = document.createElement('link');
    link.id = 'css-dashboard';
    link.rel = 'stylesheet';
    link.href = './screens/dashboard/dashboard.css';
    document.head.appendChild(link);
  }
}

// ─── Template ─────────────────────────────────────────────────────────────────

function _template() {
  return `
    <div class="dashboard-screen">
      <!-- Clock Section -->
      <div class="clock-section">
        <div class="live-clock" id="live-clock">--:--:--</div>
        <div class="date-label" id="dateLabel"></div>
        <div class="status-label" id="statusLabel">frei</div>
      </div>

      <!-- Main Clock Button -->
      <button class="clock-btn" id="clockBtn">
        <span class="clock-btn-label" id="clockBtnLabel">einstempeln</span>
        <span class="clock-btn-time" id="clockBtnTime">0:00</span>
      </button>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <button class="quick-btn" id="btnPause" data-action="pause">pause</button>
        <button class="quick-btn" id="btnRauch" data-action="rauch">raucherpause</button>
      </div>

      <!-- Break Warning -->
      <div class="break-warning" id="breakWarning">
        <span>⚠</span>
        <span id="breakWarningMsg"></span>
      </div>

      <!-- Stats Row -->
      <div class="stats-row">
        <div class="stat-item">
          <div class="stat-value" id="statWork">0:00</div>
          <div class="stat-label">arbeitszeit</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" id="statPause">0:00</div>
          <div class="stat-label">pause</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" id="statRauch">0:00</div>
          <div class="stat-label">raucherpause</div>
        </div>
      </div>

      <!-- Timeline -->
      <div id="timelineContainer"></div>
    </div>
  `;
}

// ─── Update UI ────────────────────────────────────────────────────────────────

function _update() {
  const clockedIn = State.get('clockedIn');
  const status = State.get('status');

  // Clock button
  const btn = $('clockBtn');
  const label = $('clockBtnLabel');
  const time = $('clockBtnTime');
  if (btn) btn.classList.toggle('active', clockedIn);
  if (label) label.textContent = clockedIn ? 'ausstempeln' : 'einstempeln';
  if (time) time.textContent = Clock.getWorkTime();

  // Status
  const statusEl = $('statusLabel');
  if (statusEl) {
    statusEl.textContent = status;
    statusEl.className = `status-label ${status}`;
  }

  // Quick buttons
  const btnPause = $('btnPause');
  const btnRauch = $('btnRauch');
  if (btnPause) {
    btnPause.classList.toggle('enabled', clockedIn);
    btnPause.classList.toggle('active-action', status === 'pause');
    btnPause.textContent = status === 'pause' ? 'pause beenden' : 'pause';
  }
  if (btnRauch) {
    btnRauch.classList.toggle('enabled', clockedIn);
    btnRauch.classList.toggle('active-action', status === 'raucherpause');
    btnRauch.textContent = status === 'raucherpause' ? 'raucherpause beenden' : 'raucherpause';
  }

  // Stats
  const statWork = $('statWork');
  const statPause = $('statPause');
  const statRauch = $('statRauch');
  if (statWork) statWork.textContent = Clock.getWorkTime();
  if (statPause) statPause.textContent = Clock.getPauseTime();
  if (statRauch) statRauch.textContent = Clock.getRauchTime();

  // Break warning
  const warning = Clock.checkArbZG();
  const warningEl = $('breakWarning');
  const warningMsg = $('breakWarningMsg');
  if (warningEl) warningEl.classList.toggle('visible', !!warning);
  if (warningMsg && warning) warningMsg.textContent = warning.msg;

  // Date label
  const dateLabel = $('dateLabel');
  if (dateLabel) {
    dateLabel.textContent = new Date().toLocaleDateString('de-DE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  // Timeline
  const tlContainer = $('timelineContainer');
  if (tlContainer) Timeline.render(tlContainer);
}

// ─── Event Handling ──────────────────────────────────────────────────────────────

function _handleClick(e) {
  // Clock button
  if (e.target.closest('#clockBtn')) {
    Clock.toggle();
    return;
  }

  // Quick actions
  const action = e.target.closest('[data-action]');
  if (action) {
    const type = action.dataset.action;
    if (type === 'pause') Clock.togglePause();
    if (type === 'rauch') Clock.toggleRauch();
    return;
  }

  // Timeline edit
  const editBtn = e.target.closest('[data-edit]');
  if (editBtn) {
    Timeline.handleEdit(parseInt(editBtn.dataset.edit, 10));
    return;
  }
}

// ─── Subscriptions ───────────────────────────────────────────────────────────────

let _unsubs = [];

// ─── Mount / Unmount ─────────────────────────────────────────────────────────────

export async function mount(container) {
  _loadCSS();
  container.innerHTML = _template();

  // Initial render
  _update();

  // Subscribe to changes
  _unsubs = [
    State.subscribe('clockedIn', _update),
    State.subscribe('status', _update),
    State.subscribe('todayEntries', _update),
    State.subscribe('_tick', _update),
  ];

  container.addEventListener('click', _handleClick);
}

export function unmount() {
  _unsubs.forEach(fn => fn());
  _unsubs = [];
  Clock.destroy();
}
