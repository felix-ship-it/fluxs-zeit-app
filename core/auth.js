/**
 * FLUXS Zeit App — Auth Module
 * Email + password login against Personio employee list.
 * Max 500 lines.
 */

'use strict';

import * as State from './state.js';
import * as Storage from './storage.js';
import * as API from './api.js';
import * as Env from './env.js';
import { navigate } from './router.js';
import { showToast } from './ui.js';

// ─── Demo Employee (Staging fallback) ──────────────────────────────────────

const DEMO_EMPLOYEE = {
  id: 9999,
  name: 'Demo Mitarbeiter',
  firstName: 'Demo',
  lastName: 'Mitarbeiter',
  initials: 'DM',
  role: 'Demo',
  dept: 'Test',
  email: 'demo@fluxs.de',
  vacation: { total: 28, used: 5 },
  overtimeMs: 0,
};

// ─── Demo Data Generators ──────────────────────────────────────────────────

function _generateDemoAttendance(employeeId) {
  const records = [];
  const today = new Date();
  for (let d = 1; d <= 20; d++) {
    const date = new Date(today.getFullYear(), today.getMonth(), d);
    if (date > today || date.getDay() === 0 || date.getDay() === 6) continue;
    const ds = date.toISOString().split('T')[0];
    records.push({
      id: `att-${employeeId}-${d}`,
      employeeId,
      date: ds,
      start: '08:00',
      end: '16:30',
      breakMin: 30,
      status: 'approved',
    });
  }
  return records;
}

function _generateDemoAbsences() {
  const year = new Date().getFullYear();
  return [
    { id: 'abs-1', type: 'urlaub', label: 'Urlaub', start: `${year}-01-15`, end: `${year}-01-19`, status: 'approved', comment: '' },
    { id: 'abs-2', type: 'urlaub', label: 'Urlaub', start: `${year}-06-10`, end: `${year}-06-14`, status: 'pending', comment: 'Sommerurlaub' },
    { id: 'abs-3', type: 'krank', label: 'Krankmeldung', start: `${year}-02-05`, end: `${year}-02-07`, status: 'approved', comment: '' },
  ];
}

// ─── MSAL Configuration ────────────────────────────────────────────────────

const MSAL_CONFIG = {
  auth: {
    clientId: 'YOUR_AZURE_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'memoryStorage',
    storeAuthStateInCookie: false,
  },
};

const SSO_SCOPES = ['user.read', 'email'];

let _msalInstance = null;

function _getMSAL() {
  if (!_msalInstance) {
    if (!window.msal) {
      throw new Error('MSAL.js nicht geladen');
    }
    _msalInstance = new window.msal.PublicClientApplication(MSAL_CONFIG);
  }
  return _msalInstance;
}

// ─── SSO Login ──────────────────────────────────────────────────────────────

export async function loginWithSSO() {
  // Staging demo shortcut
  if (Env.isStaging() && !window.msal) {
    Env.log('SSO: MSAL not loaded on staging, falling back to demo');
    _setEmployee(DEMO_EMPLOYEE, 'demo');
    return { success: true };
  }

  try {
    const msalApp = _getMSAL();
    const response = await msalApp.loginPopup({
      scopes: SSO_SCOPES,
      prompt: 'select_account',
    });

    const account = response.account;
    const email = (
      account?.username ||
      account?.idTokenClaims?.email ||
      account?.idTokenClaims?.preferred_username ||
      ''
    ).trim().toLowerCase();

    if (!email) {
      return { success: false, error: 'E-Mail konnte nicht aus Token gelesen werden' };
    }

    Env.log('SSO: logged in as', email);

    // Verify against Personio
    let emp = null;
    try {
      const result = await API.ssoLogin(email);
      if (result.success && result.employee) {
        emp = result.employee;
        emp.vacation = { total: 28, used: 0 };
        emp.overtimeMs = 0;
      } else if (Env.isStaging()) {
        // On staging, if Personio unreachable, use SSO email in demo employee
        Env.warn('SSO: Personio not reachable, using demo employee with SSO email');
        emp = { ...DEMO_EMPLOYEE, email, name: account?.name || email };
      } else {
        return { success: false, error: result.error || 'Mitarbeiter nicht gefunden' };
      }
    } catch (e) {
      if (Env.isStaging()) {
        emp = { ...DEMO_EMPLOYEE, email, name: account?.name || email };
      } else {
        return { success: false, error: 'Personio nicht erreichbar' };
      }
    }

    _setEmployee(emp, 'real');
    return { success: true };

  } catch (e) {
    Env.error('SSO error:', e.message);
    // User cancelled popup
    if (e.errorCode === 'user_cancelled' || (e.message || '').includes('user_cancelled')) {
      return { success: false, error: 'Anmeldung abgebrochen' };
    }
    // Staging fallback if popup blocked / MSAL config missing
    if (Env.isStaging()) {
      showToast('SSO nicht verfügbar – Demo-Modus', 'info');
      _setEmployee(DEMO_EMPLOYEE, 'demo');
      return { success: true };
    }
    return { success: false, error: e.message || 'SSO fehlgeschlagen' };
  }
}

// ─── Login ─────────────────────────────────────────────────────────────────

export async function login(email, password) {
  email = (email || '').trim().toLowerCase();
  password = (password || '').trim();

  if (!email || !password) {
    showToast('E-Mail und Passwort erforderlich', 'error');
    return { success: false };
  }

  // Staging demo login shortcut
  if (Env.isStaging() && email === 'demo@fluxs.de' && password === 'demo') {
    Env.log('Demo login (staging)');
    _setEmployee(DEMO_EMPLOYEE, 'demo');
    return { success: true };
  }

  // Real Personio login via backend
  try {
    const result = await API.login(email, password);

    if (!result.success) {
      showToast(result.error || 'Login fehlgeschlagen', 'error');
      return { success: false };
    }

    const emp = result.employee;
    emp.vacation = { total: 28, used: 0 };
    emp.overtimeMs = 0;

    _setEmployee(emp, 'real');

    // Cache email in IndexedDB for "remember me"
    if (Storage.isAvailable()) {
      await Storage.set(Storage.STORES.SETTINGS, 'lastEmail', email);
    }

    return { success: true };
  } catch (e) {
    Env.error('Login error:', e.message);

    // Staging fallback: if Personio unreachable, allow demo
    if (Env.isStaging()) {
      showToast('Personio nicht erreichbar – Demo-Modus', 'info');
      _setEmployee(DEMO_EMPLOYEE, 'demo');
      return { success: true };
    }

    showToast('Verbindung fehlgeschlagen', 'error');
    return { success: false };
  }
}

// ─── Set Employee & Load Data ──────────────────────────────────────────────

async function _setEmployee(emp, mode) {
  State.batch({
    currentEmployee: emp,
    apiMode: mode,
  });

  // Load data based on mode
  if (mode === 'real') {
    _loadRealData(emp.id);
  } else if (Env.isStaging()) {
    State.set('attendanceRecords', _generateDemoAttendance(emp.id));
    State.set('absenceRequests', _generateDemoAbsences());
  }

  navigate('dashboard');
}

async function _loadRealData(employeeId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = `${today.slice(0, 7)}-01`;
    const yearStart = `${new Date().getFullYear()}-01-01`;
    const yearEnd = `${new Date().getFullYear()}-12-31`;

    const [attResult, absResult] = await Promise.all([
      API.getAttendances(monthStart, today, employeeId),
      API.getAbsences(employeeId, yearStart, yearEnd),
    ]);

    if (attResult.success) {
      const records = (attResult.data || []).map(a => ({
        id: a.id || `att-${Date.now()}`,
        employeeId: a.attributes?.employee?.value || employeeId,
        date: a.attributes?.date?.value || '',
        start: a.attributes?.start_time?.value || '',
        end: a.attributes?.end_time?.value || '',
        breakMin: a.attributes?.break?.value || 0,
        status: a.attributes?.status?.value || 'approved',
      }));
      State.set('attendanceRecords', records);
    }

    if (absResult.success) {
      const absences = (absResult.data || []).map(a => ({
        id: a.id || `abs-${Date.now()}`,
        type: (a.attributes?.time_off_type?.value?.attributes?.name?.value || '').toLowerCase(),
        label: a.attributes?.time_off_type?.value?.attributes?.name?.value || '',
        start: a.attributes?.start_date?.value || '',
        end: a.attributes?.end_date?.value || '',
        status: a.attributes?.status?.value || 'pending',
        comment: a.attributes?.comment?.value || '',
      }));
      State.set('absenceRequests', absences);
    }
  } catch (e) {
    Env.warn('Failed to load real data:', e.message);
  }
}

// ─── Logout ────────────────────────────────────────────────────────────────

export function logout() {
  State.batch({
    currentEmployee: null,
    clockedIn: false,
    clockInTime: null,
    status: 'frei',
    pauseStartTime: null,
    rauchStartTime: null,
    totalWorkMs: 0,
    totalPauseMs: 0,
    totalRauchMs: 0,
    todayEntries: [],
    attendanceRecords: [],
    absenceRequests: [],
    activeProject: null,
    projectStartTime: null,
    projectAccMs: 0,
    apiMode: 'demo',
  });
  navigate('login');
}

// ─── Admin Check ───────────────────────────────────────────────────────────

export function isAdmin() {
  const emp = State.get('currentEmployee');
  if (!emp) return false;
  const role = (emp.role || '').toLowerCase();
  return role.includes('leiter') || role.includes('admin') || role.includes('geschäftsführer');
}

// ─── Get Last Email (for pre-fill) ────────────────────────────────────────

export async function getLastEmail() {
  if (!Storage.isAvailable()) return null;
  try {
    return await Storage.get(Storage.STORES.SETTINGS, 'lastEmail');
  } catch {
    return null;
  }
}
