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

// ─── Template ───────────────────────────────────────────────────────────────

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

      <!-- Animated Pictograms -->
      <div class="ring-picto" id="ringPicto">
        <svg class="picto picto-working" id="pictoWorking" viewBox="0 0 64 64" fill="none">
          <!-- Scene 1: Person cleaning a stroller -->
          <g id="scene1" opacity="1">
            <circle cx="20" cy="14" r="5" fill="#E7F883" opacity="0.7"/>
            <line x1="20" y1="19" x2="20" y2="34" stroke="#E7F883" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
            <line x1="20" y1="34" x2="14" y2="48" stroke="#E7F883" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
            <line x1="20" y1="34" x2="26" y2="48" stroke="#E7F883" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
            <line x1="20" y1="24" x2="32" y2="20" stroke="#E7F883" stroke-width="2" stroke-linecap="round" opacity="0.7">
              <animateTransform attributeName="transform" type="rotate" values="0 20 24;-8 20 24;0 20 24;8 20 24;0 20 24" dur="0.8s" repeatCount="indefinite"/>
            </line>
            <rect x="30" y="17" width="5" height="4" rx="1" fill="#E7F883" opacity="0.5">
              <animateTransform attributeName="transform" type="rotate" values="0 20 24;-8 20 24;0 20 24;8 20 24;0 20 24" dur="0.8s" repeatCount="indefinite"/>
            </rect>
            <path d="M38 18 L44 18 L46 32 L36 32 Z" stroke="#E7F883" stroke-width="1.5" fill="none" opacity="0.5"/>
            <line x1="36" y1="32" x2="34" y2="38" stroke="#E7F883" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
            <line x1="46" y1="32" x2="48" y2="38" stroke="#E7F883" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
            <circle cx="34" cy="40" r="3" stroke="#E7F883" stroke-width="1.2" fill="none" opacity="0.5"/>
            <circle cx="48" cy="40" r="3" stroke="#E7F883" stroke-width="1.2" fill="none" opacity="0.5"/>
            <line x1="36" y1="18" x2="34" y2="10" stroke="#E7F883" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
            <line x1="34" y1="10" x2="38" y2="10" stroke="#E7F883" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
            <text x="50" y="16" fill="#E7F883" font-size="6" opacity="0.4">✨<animate attributeName="opacity" values="0.2;0.6;0.2" dur="1.2s" repeatCount="indefinite"/></text>
            <animate attributeName="opacity" values="1;1;1;1;0;0;0;0;0;0;0;0" dur="9s" repeatCount="indefinite"/>
          </g>
          <!-- Scene 2: Bicycle mechanic -->
          <g id="scene2" opacity="0">
            <circle cx="22" cy="20" r="5" fill="#E7F883" opacity="0.7"/>
            <line x1="22" y1="25" x2="22" y2="36" stroke="#E7F883" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
            <line x1="22" y1="36" x2="16" y2="48" stroke="#E7F883" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
            <line x1="22" y1="36" x2="28" y2="46" stroke="#E7F883" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
            <line x1="22" y1="28" x2="34" y2="34" stroke="#E7F883" stroke-width="2" stroke-linecap="round" opacity="0.7">
              <animateTransform attributeName="transform" type="rotate" values="0 22 28;10 22 28;0 22 28;-10 22 28;0 22 28" dur="1s" repeatCount="indefinite"/>
            </line>
            <path d="M33 33 L38 30 L40 32 L35 35 Z" fill="#E7F883" opacity="0.6">
              <animateTransform attributeName="transform" type="rotate" values="0 22 28;10 22 28;0 22 28;-10 22 28;0 22 28" dur="1s" repeatCount="indefinite"/>
            </path>
            <circle cx="38" cy="42" r="8" stroke="#E7F883" stroke-width="1.5" fill="none" opacity="0.5"/>
            <circle cx="56" cy="42" r="8" stroke="#E7F883" stroke-width="1.5" fill="none" opacity="0.5"/>
            <line x1="38" y1="42" x2="47" y2="30" stroke="#E7F883" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
            <line x1="47" y1="30" x2="56" y2="42" stroke="#E7F883" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
            <line x1="38" y1="42" x2="50" y2="42" stroke="#E7F883" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
            <line x1="47" y1="30" x2="50" y2="42" stroke="#E7F883" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
            <line x1="47" y1="30" x2="44" y2="26" stroke="#E7F883" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
            <line x1="44" y1="30" x2="42" y2="28" stroke="#E7F883" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
            <g opacity="0.3">
              <line x1="38" y1="34" x2="38" y2="50" stroke="#E7F883" stroke-width="0.5"><animateTransform attributeName="transform" type="rotate" values="0 38 42;360 38 42" dur="2s" repeatCount="indefinite"/></line>
              <line x1="30" y1="42" x2="46" y2="42" stroke="#E7F883" stroke-width="0.5"><animateTransform attributeName="transform" type="rotate" values="0 38 42;360 38 42" dur="2s" repeatCount="indefinite"/></line>
            </g>
            <animate attributeName="opacity" values="0;0;0;0;1;1;1;0;0;0;0;0" dur="9s" repeatCount="indefinite"/>
          </g>
          <!-- Scene 3: Forklift driver -->
          <g id="scene3" opacity="0">
            <rect x="14" y="28" width="28" height="16" rx="3" stroke="#E7F883" stroke-width="1.5" fill="none" opacity="0.5"/>
            <line x1="28" y1="18" x2="28" y2="28" stroke="#E7F883" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
            <line x1="42" y1="18" x2="42" y2="28" stroke="#E7F883" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
            <line x1="28" y1="18" x2="42" y2="18" stroke="#E7F883" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
            <circle cx="35" cy="24" r="4" fill="#E7F883" opacity="0.7"/>
            <line x1="35" y1="28" x2="35" y2="38" stroke="#E7F883" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
            <line x1="35" y1="31" x2="30" y2="33" stroke="#E7F883" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
            <line x1="35" y1="31" x2="40" y2="33" stroke="#E7F883" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
            <line x1="35" y1="38" x2="31" y2="44" stroke="#E7F883" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
            <line x1="35" y1="38" x2="39" y2="44" stroke="#E7F883" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
            <line x1="14" y1="44" x2="6" y2="44" stroke="#E7F883" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
            <line x1="6" y1="44" x2="6" y2="36" stroke="#E7F883" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
            <line x1="14" y1="42" x2="8" y2="42" stroke="#E7F883" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
            <circle cx="20" cy="48" r="4" stroke="#E7F883" stroke-width="1.5" fill="none" opacity="0.5"><animateTransform attributeName="transform" type="rotate" values="0 20 48;360 20 48" dur="1.5s" repeatCount="indefinite"/></circle>
            <circle cx="36" cy="48" r="4" stroke="#E7F883" stroke-width="1.5" fill="none" opacity="0.5"><animateTransform attributeName="transform" type="rotate" values="0 36 48;360 36 48" dur="1.5s" repeatCount="indefinite"/></circle>
            <line x1="20" y1="44" x2="20" y2="52" stroke="#E7F883" stroke-width="0.5" opacity="0.3"><animateTransform attributeName="transform" type="rotate" values="0 20 48;360 20 48" dur="1.5s" repeatCount="indefinite"/></line>
            <line x1="36" y1="44" x2="36" y2="52" stroke="#E7F883" stroke-width="0.5" opacity="0.3"><animateTransform attributeName="transform" type="rotate" values="0 36 48;360 36 48" dur="1.5s" repeatCount="indefinite"/></line>
            <line x1="46" y1="34" x2="54" y2="34" stroke="#E7F883" stroke-width="1" opacity="0.3"><animate attributeName="opacity" values="0.1;0.4;0.1" dur="0.6s" repeatCount="indefinite"/></line>
            <line x1="48" y1="38" x2="56" y2="38" stroke="#E7F883" stroke-width="1" opacity="0.2"><animate attributeName="opacity" values="0.1;0.3;0.1" dur="0.8s" repeatCount="indefinite"/></line>
            <line x1="46" y1="42" x2="52" y2="42" stroke="#E7F883" stroke-width="1" opacity="0.25"><animate attributeName="opacity" values="0.1;0.35;0.1" dur="0.7s" repeatCount="indefinite"/></line>
            <animate attributeName="opacity" values="0;0;0;0;0;0;0;0;1;1;1;1" dur="9s" repeatCount="indefinite"/>
          </g>
        </svg>

        <svg class="picto picto-pause" id="pictoPause" viewBox="0 0 64 64" fill="none">
          <rect x="8" y="36" width="48" height="4" rx="2" fill="#E7F883" opacity="0.6"/>
          <line x1="12" y1="40" x2="12" y2="52" stroke="#E7F883" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
          <line x1="52" y1="40" x2="52" y2="52" stroke="#E7F883" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
          <rect x="10" y="28" width="14" height="10" rx="4" fill="#E7F883" opacity="0.5"/>
          <circle cx="17" cy="26" r="5" fill="#E7F883" opacity="0.7"/>
          <rect x="20" y="28" width="30" height="8" rx="3" fill="#E7F883" opacity="0.4"/>
          <rect x="18" y="30" width="34" height="7" rx="3" fill="#E7F883" opacity="0.3"/>
          <g class="picto-zzz">
            <text x="40" y="22" fill="#E7F883" opacity="0.6" font-size="9" font-weight="700">z</text>
            <text x="46" y="16" fill="#E7F883" opacity="0.4" font-size="7" font-weight="700">z</text>
            <text x="50" y="11" fill="#E7F883" opacity="0.3" font-size="6" font-weight="700">z</text>
          </g>
        </svg>

        <svg class="picto picto-rauch" id="pictoRauch" viewBox="0 0 64 64" fill="none">
          <circle cx="20" cy="16" r="5" fill="#E7F883" opacity="0.7"/>
          <line x1="20" y1="21" x2="20" y2="36" stroke="#E7F883" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
          <line x1="20" y1="36" x2="14" y2="50" stroke="#E7F883" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
          <line x1="20" y1="36" x2="26" y2="50" stroke="#E7F883" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
          <line x1="20" y1="27" x2="30" y2="20" stroke="#E7F883" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
          <rect x="29" y="17" width="14" height="3" rx="1" fill="#E7F883" opacity="0.7"/>
          <rect x="41" y="17" width="3" height="3" rx="0.5" fill="#ff8844" opacity="0.8"/>
          <g class="picto-smoke">
            <path d="M44 16 Q46 12 44 8 Q42 4 44 0" stroke="#E7F883" stroke-width="1.2" fill="none" opacity="0.3" stroke-linecap="round" class="smoke-wisp s1"/>
            <path d="M47 17 Q49 13 47 9 Q45 5 47 1" stroke="#E7F883" stroke-width="1" fill="none" opacity="0.2" stroke-linecap="round" class="smoke-wisp s2"/>
            <path d="M50 16 Q52 11 50 7 Q48 3 50 -1" stroke="#E7F883" stroke-width="0.8" fill="none" opacity="0.25" stroke-linecap="round" class="smoke-wisp s3"/>
          </g>
        </svg>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <button class="quick-btn" id="btnPause" data-action="pause">pause</button>
        <button class="quick-btn" id="btnRauch" data-action="rauch">raucherpause</button>
      </div>

      <!-- Project Selection (shown when clocked in) -->
      <div id="projectSelection" class="project-selection"></div>

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

// ─── Update UI ──────────────────────────────────────────────────────────────

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

  // Animated pictograms
  const pictoWorking = $('pictoWorking');
  const pictoPause = $('pictoPause');
  const pictoRauch = $('pictoRauch');
  if (pictoWorking) pictoWorking.classList.toggle('visible', status === 'arbeitet');
  if (pictoPause) pictoPause.classList.toggle('visible', status === 'pause');
  if (pictoRauch) pictoRauch.classList.toggle('visible', status === 'raucherpause');

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

  // Project selection
  _renderProjectSelection(clockedIn, status);

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

// ─── Event Handling ─────────────────────────────────────────────────────────

// ─── Project Selection Render ────────────────────────────────────────────────

function _renderProjectSelection(clockedIn, status) {
  const container = $('projectSelection');
  if (!container) return;

  if (!clockedIn || status !== 'arbeitet') {
    container.innerHTML = '';
    return;
  }

  const projects = (State.get('projects') || []).filter(p => !p.deleted);
  const activeProject = State.get('activeProject');

  if (!projects.length) {
    container.innerHTML = '';
    return;
  }

  // Active project time display
  let activeTimeHtml = '';
  if (activeProject) {
    const accMs = State.get('projectAccMs') || 0;
    const startTime = State.get('projectStartTime');
    const runMs = startTime ? Date.now() - new Date(startTime).getTime() : 0;
    const totalMs = accMs + runMs;
    const h = Math.floor(totalMs / 3600000);
    const m = Math.floor((totalMs % 3600000) / 60000);
    activeTimeHtml = `<span class="proj-active-time">${h}:${String(m).padStart(2, '0')}</span>`;
  }

  const pills = projects.map(p => {
    const isActive = activeProject && activeProject.id === p.id;
    return `<button class="proj-pill${isActive ? ' active' : ''}" data-project-id="${p.id}">${p.title}</button>`;
  }).join('');

  container.innerHTML = `
    <div class="project-selection-inner">
      <div class="proj-header">
        <span class="proj-label">projekt / kunde auswählen</span>
        ${activeTimeHtml}
      </div>
      <div class="proj-pills">${pills}</div>
    </div>
  `;
}


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

  // Project pill selection
  const projPill = e.target.closest('[data-project-id]');
  if (projPill) {
    const projectId = projPill.dataset.projectId;
    const projects = State.get('projects') || [];
    const project = projects.find(p => String(p.id) === String(projectId));
    if (project) {
      const current = State.get('activeProject');
      // Toggle: clicking same project deselects
      if (current && String(current.id) === String(projectId)) {
        Clock.endProjectBlock();
        State.batch({ activeProject: null, projectStartTime: null, projectAccMs: 0 });
      } else {
        if (current) Clock.endProjectBlock();
        State.batch({ activeProject: project, projectStartTime: new Date(), projectAccMs: 0 });
      }
      _update();
    }
    return;
  }
}

// ─── Subscriptions ──────────────────────────────────────────────────────────

let _unsubs = [];

// ─── Mount / Unmount ────────────────────────────────────────────────────────

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
    State.subscribe('projects', _update),
    State.subscribe('activeProject', _update),
  ];

  container.addEventListener('click', _handleClick);
}

export function unmount() {
  _unsubs.forEach(fn => fn());
  _unsubs = [];
  Clock.destroy();
}
