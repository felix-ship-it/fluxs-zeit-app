/**
 * FLUXS Zeit App — Auth Module
 * Login, logout, session persistence, role-based access.
 * Integrates with Personio employee data.
 * Max 500 lines.
 */

'use strict';

import * as State from './state.js';
import * as Storage from './storage.js';
import * as API from './api.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const SESSION_KEY = 'fluxs_session';
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours

// ─── Login ───────────────────────────────────────────────────────────────────

/**
 * Login: find employee by email in Personio data, then save session.
 * @param {string} email
 * @param {string} pin  - 4-digit PIN (stored hashed in localStorage)
 * @returns {Promise<{success: boolean, error?: string, user?: object}>}
 */
export async function login(email, pin) {
  if (!email || !pin) {
    return { success: false, error: 'E-Mail und PIN erforderlich.' };
  }

  // 1. Get employees from state or fetch fresh
  let employees = State.get('employees');
  if (!employees) {
    try {
      const result = await API.getEmployees();
      if (!result.success) throw new Error(result.error || 'Personio nicht erreichbar');
      employees = result.data.map(e => ({
        id: e.attributes.id?.value,
        name: `${e.attributes.first_name?.value} ${e.attributes.last_name?.value}`.trim(),
        email: e.attributes.email?.value?.toLowerCase(),
        position: e.attributes.position?.value,
        department: e.attributes.department?.attributes?.name,
        role: _inferRole(e),
      }));
      State.set('employees', employees);
      await Storage.saveEmployees(employees);
    } catch (e) {
      // Fallback to cached employees
      employees = await Storage.getEmployees();
      if (!employees || employees.length === 0) {
        return { success: false, error: 'Keine Mitarbeiterdaten verfügbar. Bitte Internetverbindung prüfen.' };
      }
    }
  }

  // 2. Find employee by email
  const emp = employees.find(e => e.email === email.toLowerCase().trim());
  if (!emp) {
    return { success: false, error: 'E-Mail nicht gefunden.' };
  }

  // 3. Verify PIN (or set up PIN if first login)
  const pinResult = await _verifyOrSetPin(emp.id, pin);
  if (!pinResult.success) return pinResult;

  // 4. Create session
  const session = {
    userId: emp.id,
    email: emp.email,
    name: emp.name,
    role: emp.role || 'employee',
    loginAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL,
  };

  await Storage.saveSession(session);
  State.set('session', session);
  State.set('currentUser', emp);
  State.emit('auth:login', session);

  return { success: true, user: emp };
}

// ─── Logout ──────────────────────────────────────────────────────────────────

export async function logout() {
  await Storage.clearSession();
  State.set('session', null);
  State.set('currentUser', null);
  State.emit('auth:logout');
}

// ─── Session ────────────────────────────────────────────────────────────────

export async function restoreSession() {
  const session = await Storage.getSession();
  if (!session) return null;

  // Check expiry
  if (session.expiresAt < Date.now()) {
    await Storage.clearSession();
    return null;
  }

  State.set('session', session);

  // Restore current user from employees cache
  const employees = await Storage.getEmployees();
  if (employees) {
    State.set('employees', employees);
    const user = employees.find(e => e.id === session.userId);
    if (user) State.set('currentUser', user);
  }

  return session;
}

export function getSession() {
  return State.get('session');
}

export function getCurrentUser() {
  return State.get('currentUser');
}

export function isLoggedIn() {
  const session = State.get('session');
  return session && session.expiresAt > Date.now();
}

export function hasRole(role) {
  const session = State.get('session');
  if (!session) return false;
  const roleHierarchy = ['employee', 'manager', 'admin'];
  const userLevel = roleHierarchy.indexOf(session.role);
  const requiredLevel = roleHierarchy.indexOf(role);
  return userLevel >= requiredLevel;
}

// ─── PIN Management ─────────────────────────────────────────────────────────

async function _verifyOrSetPin(userId, pin) {
  const storedHash = await Storage.getPinHash(userId);

  if (!storedHash) {
    // First login: set the PIN
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return { success: false, error: 'PIN muss 4-stellig sein.' };
    }
    const hash = await _hashPin(pin);
    await Storage.savePinHash(userId, hash);
    return { success: true };
  }

  // Verify
  const hash = await _hashPin(pin);
  if (hash !== storedHash) {
    return { success: false, error: 'Falscher PIN.' };
  }
  return { success: true };
}

async function _hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'fluxs_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Role Inference ──────────────────────────────────────────────────────────

function _inferRole(employee) {
  const pos = (employee.attributes?.position?.value || '').toLowerCase();
  const dept = (employee.attributes?.department?.attributes?.name || '').toLowerCase();

  if (pos.includes('geschäftsführ') || pos.includes('ceo') || pos.includes('cto') || pos.includes('coo')) {
    return 'admin';
  }
  if (pos.includes('lead') || pos.includes('leiter') || pos.includes('head') || dept.includes('management')) {
    return 'manager';
  }
  return 'employee';
}
