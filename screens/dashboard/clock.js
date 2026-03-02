/**
 * FLUXS Zeit App — Clock Logic
 * Stempeluhr: clock in/out, pause, raucherpause, timer.
 * Max 500 lines.
 */

'use strict';

import * as State from '../../core/state.js';
import * as API from '../../core/api.js';
import * as Env from '../../core/env.js';
import { formatTime, showToast, todayISO, nowTime } from '../../core/ui.js';

let _tickInterval = null;

// ─── Clock In/Out Toggle ────────────────────────────────────────────────────

export function toggle() {
  if (State.get('clockedIn')) {
    clockOut();
  } else {
    clockIn();
  }
}

// ─── Clock In ───────────────────────────────────────────────────────────────

export function clockIn() {
  const now = new Date();
  State.batch({
    clockedIn: true,
    clockInTime: now,
    status: 'arbeitet',
    pauseStartTime: null,
    rauchStartTime: null,
    activeProject: null,
    projectStartTime: null,
    projectAccMs: 0,
  });

  // Add timeline entry
  State.update('todayEntries', entries => [
    ...entries,
    { type: 'clock-in', time: now.toISOString(), label: 'Eingestempelt' },
  ]);

  _startTick();
  showToast('Eingestempelt', 'success');
  Env.log('Clock IN at', nowTime());
}

// ─── Clock Out ──────────────────────────────────────────────────────────────

export async function clockOut() {
  const clockInTime = State.get('clockInTime');
  if (!clockInTime) return;

  // End any active break
  if (State.get('status') === 'pause') _endPause();
  if (State.get('status') === 'raucherpause') _endRauch();

  // End active project block
  endProjectBlock();

  const now = new Date();

  State.update('todayEntries', entries => [
    ...entries,
    { type: 'clock-out', time: now.toISOString(), label: 'Ausgestempelt' },
  ]);

  // Calculate totals
  const workMs = State.get('totalWorkMs') + (now - new Date(State.get('clockInTime')));
  const breakMin = Math.round(State.get('totalPauseMs') / 60000);

  // Save attendance record
  const emp = State.get('currentEmployee');
  if (emp) {
    const startTime = new Date(clockInTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const endTime = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    const record = {
      id: `att-${Date.now()}`,
      employeeId: emp.id,
      date: todayISO(),
      start: startTime,
      end: endTime,
      breakMin,
      status: 'approved',
    };

    State.update('attendanceRecords', recs => [...recs, record]);

    // Push to Personio
    if (State.get('apiMode') === 'real') {
      try {
        await API.createAttendance(emp.id, todayISO(), startTime, endTime, breakMin);
      } catch (e) {
        Env.warn('Failed to push attendance:', e.message);
      }
    }
  }

  State.batch({
    clockedIn: false,
    clockInTime: null,
    status: 'frei',
    totalWorkMs: workMs,
    totalPauseMs: 0,
    totalRauchMs: 0,
    activeProject: null,
    projectStartTime: null,
    projectAccMs: 0,
  });

  _stopTick();
  showToast('Ausgestempelt', 'info');
  Env.log('Clock OUT at', nowTime());
}

// ─── Pause ──────────────────────────────────────────────────────────────────

export function togglePause() {
  if (State.get('status') === 'pause') {
    _endPause();
  } else if (State.get('clockedIn')) {
    _startPause();
  }
}

function _startPause() {
  if (State.get('status') === 'raucherpause') _endRauch();
  _pauseProjectTimer();
  State.batch({ status: 'pause', pauseStartTime: new Date() });
  State.update('todayEntries', e => [...e, { type: 'pause-start', time: new Date().toISOString(), label: 'Pause begonnen' }]);
}

function _endPause() {
  const start = State.get('pauseStartTime');
  if (start) {
    const elapsed = Date.now() - new Date(start).getTime();
    State.set('totalPauseMs', State.get('totalPauseMs') + elapsed);
  }
  State.batch({ status: 'arbeitet', pauseStartTime: null });
  _resumeProjectTimer();
  State.update('todayEntries', e => [...e, { type: 'pause-end', time: new Date().toISOString(), label: 'Pause beendet' }]);
}

// ─── Raucherpause ───────────────────────────────────────────────────────────

export function toggleRauch() {
  if (State.get('status') === 'raucherpause') {
    _endRauch();
  } else if (State.get('clockedIn')) {
    _startRauch();
  }
}

function _startRauch() {
  if (State.get('status') === 'pause') _endPause();
  _pauseProjectTimer();
  State.batch({ status: 'raucherpause', rauchStartTime: new Date() });
  State.update('todayEntries', e => [...e, { type: 'rauch-start', time: new Date().toISOString(), label: 'Raucherpause' }]);
}

function _endRauch() {
  const start = State.get('rauchStartTime');
  if (start) {
    const elapsed = Date.now() - new Date(start).getTime();
    State.set('totalRauchMs', State.get('totalRauchMs') + elapsed);
  }
  State.batch({ status: 'arbeitet', rauchStartTime: null });
  _resumeProjectTimer();
  State.update('todayEntries', e => [...e, { type: 'rauch-end', time: new Date().toISOString(), label: 'Raucherpause Ende' }]);
}

// ─── Timer Tick ─────────────────────────────────────────────────────────────

function _startTick() {
  if (_tickInterval) return;
  _tickInterval = setInterval(_tick, 1000);
}

function _stopTick() {
  clearInterval(_tickInterval);
  _tickInterval = null;
}

function _tick() {
  const clockIn = State.get('clockInTime');
  if (!clockIn) return;
  // Trigger re-render via state update
  State.set('_tick', Date.now());
}

// ─── Get Display Values ─────────────────────────────────────────────────────

export function getWorkTime() {
  let ms = State.get('totalWorkMs');
  const clockIn = State.get('clockInTime');
  if (clockIn && State.get('status') !== 'pause' && State.get('status') !== 'raucherpause') {
    ms += Date.now() - new Date(clockIn).getTime();
  }
  return formatTime(ms);
}

export function getPauseTime() {
  let ms = State.get('totalPauseMs');
  const start = State.get('pauseStartTime');
  if (start) ms += Date.now() - new Date(start).getTime();
  return formatTime(ms);
}

export function getRauchTime() {
  let ms = State.get('totalRauchMs');
  const start = State.get('rauchStartTime');
  if (start) ms += Date.now() - new Date(start).getTime();
  return formatTime(ms);
}

// ─── ArbZG Check ────────────────────────────────────────────────────────────

export function checkArbZG() {
  const clockIn = State.get('clockInTime');
  if (!clockIn) return null;

  const elapsedH = (Date.now() - new Date(clockIn).getTime()) / 3600000;
  const pauseMin = Math.round(State.get('totalPauseMs') / 60000);

  if (elapsedH >= 6 && pauseMin < 30) {
    return { level: 'warning', msg: 'ArbZG: Mind. 30 Min. Pause nach 6 Std. erforderlich' };
  }
  if (elapsedH >= 9 && pauseMin < 45) {
    return { level: 'warning', msg: 'ArbZG: Mind. 45 Min. Pause nach 9 Std. erforderlich' };
  }
  return null;
}


// ─── Project Block Helpers ───────────────────────────────────────────────────

function _pauseProjectTimer() {
  const startTime = State.get('projectStartTime');
  if (!startTime || !State.get('activeProject')) return;
  const elapsed = Date.now() - new Date(startTime).getTime();
  State.set('projectAccMs', (State.get('projectAccMs') || 0) + elapsed);
  State.set('projectStartTime', null);
}

function _resumeProjectTimer() {
  if (!State.get('activeProject')) return;
  State.set('projectStartTime', new Date());
}

export function endProjectBlock() {
  const project = State.get('activeProject');
  if (!project) return;

  // Accumulate any running time
  const startTime = State.get('projectStartTime');
  let accMs = State.get('projectAccMs') || 0;
  if (startTime) {
    accMs += Date.now() - new Date(startTime).getTime();
  }
  if (accMs < 1000) return; // Ignore sub-second blocks

  const emp = State.get('currentEmployee');
  const now = new Date();
  const startDate = startTime ? new Date(startTime) : now;

  const booking = {
    id: `pb-${Date.now()}`,
    projectId: project.id,
    projectTitle: project.title,
    employeeId: emp ? emp.id : null,
    employeeName: emp ? emp.name : 'Unbekannt',
    date: now.toISOString().split('T')[0],
    startTime: startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    endTime: now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    durationMs: accMs,
  };

  State.update('projectBookings', bookings => [...(bookings || []), booking]);
  State.batch({ activeProject: null, projectStartTime: null, projectAccMs: 0 });
  Env.log('Project block ended:', project.title, Math.round(accMs / 60000), 'min');
}

export function destroy() {
  _stopTick();
}
