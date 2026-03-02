/**
 * FLUXS Zeit App — Timeline Component
 * Renders today's clock entries with pencil edit for ±5min corrections.
 * Max 500 lines.
 */

'use strict';

import * as State from '../../core/state.js';
import { showToast, formatTime } from '../../core/ui.js';

// ─── Timeline CSS ───────────────────────────────────────────────────────────────

const TIMELINE_CSS = `
.timeline { margin-top: var(--space-4); }
.timeline-title { font-family: 'Adonis', serif; font-size: 17px; text-transform: lowercase; margin-bottom: var(--space-3); }
.timeline-list { display: flex; flex-direction: column; gap: var(--space-2); }
.timeline-entry {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3); background: var(--bg-card);
  border-radius: var(--radius-md); position: relative;
}
.timeline-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.timeline-dot.clock-in { background: var(--color-success); }
.timeline-dot.clock-out { background: var(--color-error); }
.timeline-dot.pause-start, .timeline-dot.pause-end { background: var(--fluxs-orange); }
.timeline-dot.rauch-start, .timeline-dot.rauch-end { background: var(--fluxs-orange); }
.timeline-time { font-size: 13px; font-weight: 800; min-width: 50px; }
.timeline-label { font-size: 12px; color: var(--text-secondary); flex: 1; }
.timeline-edit-btn {
  width: 28px; height: 28px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
  background: transparent; cursor: pointer;
  color: var(--text-muted); transition: all 150ms;
}
.timeline-edit-btn:hover { background: var(--bg-card-hover); color: var(--text-primary); }
.timeline-empty { text-align: center; color: var(--text-muted); font-size: 13px; padding: var(--space-6) 0; }
`;

// ─── Inject CSS ───────────────────────────────────────────────────────────────

function _injectCSS() {
  if (!document.getElementById('css-timeline')) {
    const style = document.createElement('style');
    style.id = 'css-timeline';
    style.textContent = TIMELINE_CSS;
    document.head.appendChild(style);
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────

export function render(container) {
  _injectCSS();

  const entries = State.get('todayEntries') || [];

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="timeline">
        <h3 class="timeline-title">tages-log</h3>
        <div class="timeline-empty">noch keine einträge heute</div>
      </div>
    `;
    return;
  }

  const rows = entries.map((entry, i) => {
    const time = new Date(entry.time);
    const timeStr = time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const pencilSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

    return `
      <div class="timeline-entry" data-index="${i}">
        <div class="timeline-dot ${entry.type}"></div>
        <span class="timeline-time">${timeStr}</span>
        <span class="timeline-label">${entry.label}</span>
        <button class="timeline-edit-btn" data-edit="${i}" title="Korrektur">${pencilSvg}</button>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="timeline">
      <h3 class="timeline-title">tages-log</h3>
      <div class="timeline-list">${rows}</div>
    </div>
  `;
}

// ─── Handle Edit Click ────────────────────────────────────────────────────────────

export function handleEdit(index) {
  const entries = State.get('todayEntries') || [];
  const entry = entries[index];
  if (!entry) return;

  const time = new Date(entry.time);
  const current = time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const newTime = prompt(`Zeit anpassen (±5 Min.):\nAktuell: ${current}`, current);

  if (!newTime || newTime === current) return;

  // Parse new time
  const [h, m] = newTime.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) {
    showToast('Ungültige Zeit', 'error');
    return;
  }

  const adjusted = new Date(time);
  adjusted.setHours(h, m, 0, 0);

  // Enforce ±5 min limit
  const diffMin = (adjusted.getTime() - time.getTime()) / 60000;
  if (Math.abs(diffMin) > 5) {
    showToast('Max. ±5 Min. Korrektur erlaubt', 'error');
    return;
  }

  const updated = [...entries];
  updated[index] = { ...entry, time: adjusted.toISOString() };
  State.set('todayEntries', updated);
  showToast('Zeit korrigiert', 'success');
}
