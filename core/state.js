/**
 * FLUXS Zeit App — Reactive State Store
 * Central state with pub/sub pattern. All modules subscribe to changes.
 * Max 500 lines.
 */

'use strict';

// ─── Default State ──────────────────────────────────────────────────────────

const _defaults = {
  // Current user
  currentEmployee: null,

  // Session tracking
  clockedIn: false,
  clockInTime: null,
  status: 'frei',           // 'frei' | 'arbeitet' | 'pause' | 'raucherpause'
  pauseStartTime: null,
  rauchStartTime: null,

  // Today's accumulated times (ms)
  totalWorkMs: 0,
  totalPauseMs: 0,
  totalRauchMs: 0,

  // Timeline entries for today
  todayEntries: [],

  // Settings
  settings: {
    weekHours: 40,
    dayHours: 8,
    yearVacation: 28,
  },

  // API
  apiMode: 'demo',          // 'demo' | 'real'
  personioToken: null,
  realEmployees: null,
  teamLeaders: {},

  // Current view month
  viewMonth: new Date().getMonth(),
  viewYear: new Date().getFullYear(),

  // Attendance & absences
  attendanceRecords: [],
  absenceRequests: [],

  // Projects
  projects: [],
  projectBookings: [],

  // Correction requests
  correctionRequests: [],

  // Navigation
  activeScreen: null,
  previousScreen: null,
};

// ─── Internal State ─────────────────────────────────────────────────────────

const _state = {};
const _listeners = new Map();

// Initialize with defaults
Object.keys(_defaults).forEach(key => {
  _state[key] = typeof _defaults[key] === 'object' && _defaults[key] !== null
    ? JSON.parse(JSON.stringify(_defaults[key]))
    : _defaults[key];
});

// ─── Public API ─────────────────────────────────────────────────────────────

export function get(key) {
  return _state[key];
}

export function set(key, value) {
  const old = _state[key];
  _state[key] = value;
  const fns = _listeners.get(key);
  if (fns) fns.forEach(fn => fn(value, old));
}

export function update(key, updater) {
  set(key, updater(get(key)));
}

export function subscribe(key, fn) {
  if (!_listeners.has(key)) _listeners.set(key, []);
  _listeners.get(key).push(fn);
  // Return unsubscribe function
  return () => {
    const arr = _listeners.get(key);
    if (arr) {
      const idx = arr.indexOf(fn);
      if (idx > -1) arr.splice(idx, 1);
    }
  };
}

export function getAll() {
  return { ..._state };
}

export function reset() {
  Object.keys(_defaults).forEach(key => {
    _state[key] = typeof _defaults[key] === 'object' && _defaults[key] !== null
      ? JSON.parse(JSON.stringify(_defaults[key]))
      : _defaults[key];
  });
}

// ─── Batch Update ───────────────────────────────────────────────────────────

export function batch(updates) {
  Object.entries(updates).forEach(([key, value]) => {
    _state[key] = value;
  });
  // Fire listeners after all updates
  Object.entries(updates).forEach(([key, value]) => {
    const fns = _listeners.get(key);
    if (fns) fns.forEach(fn => fn(value));
  });
}
