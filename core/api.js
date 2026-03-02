/**
 * FLUXS Zeit App — Personio API Client
 * All Personio communication goes through the CGI proxy.
 * Includes offline queue for stempelungen.
 * Max 500 lines.
 */

'use strict';

import * as State from './state.js';
import * as Storage from './storage.js';

// ─── Proxy Endpoint ─────────────────────────────────────────────────────────

const PROXY = './cgi-bin/personio.py';

// ─── Low-Level Call ─────────────────────────────────────────────────────────

async function _call(action, params = {}) {
  const resp = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export async function auth() {
  return _call('auth');
}

export async function login(email, password) {
  return _call('login', { email, password });
}

// ─── Employees ──────────────────────────────────────────────────────────────

export async function getEmployees() {
  return _call('employees');
}

// ─── Attendances ────────────────────────────────────────────────────────────

export async function getAttendances(startDate, endDate, employeeId) {
  return _call('attendances', {
    start_date: startDate,
    end_date: endDate,
    employee_id: employeeId,
  });
}

export async function createAttendance(empId, date, startTime, endTime, breakMin, comment = '') {
  const payload = {
    employee: empId,
    date,
    start_time: startTime,
    end_time: endTime,
    break: breakMin,
    comment,
  };

  // Try online first
  if (navigator.onLine) {
    try {
      return await _call('create_attendance', payload);
    } catch (e) {
      console.warn('[API] Online but call failed, queueing:', e.message);
    }
  }

  // Queue for offline sync
  await Storage.addToOfflineQueue({
    type: 'create_attendance',
    payload,
  });

  return { success: true, queued: true };
}

// ─── Absences ───────────────────────────────────────────────────────────────

export async function getAbsences(employeeId, startDate, endDate) {
  return _call('absences', {
    employee_id: employeeId,
    start_date: startDate,
    end_date: endDate,
  });
}

export async function createAbsence(empId, type, startDate, endDate, halfDay = false, comment = '') {
  const payload = {
    employee: empId,
    absence_type: type,
    start_date: startDate,
    end_date: endDate,
    half_day: halfDay,
    comment,
  };

  if (navigator.onLine) {
    try {
      return await _call('create_absence', payload);
    } catch (e) {
      console.warn('[API] Online but call failed, queueing:', e.message);
    }
  }

  await Storage.addToOfflineQueue({ type: 'create_absence', payload });
  return { success: true, queued: true };
}

// ─── Offline Queue Sync ─────────────────────────────────────────────────────

export async function syncOfflineQueue() {
  const queue = await Storage.getOfflineQueue();
  if (queue.length === 0) return { synced: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      await _call(item.type, item.payload);
      await Storage.removeFromOfflineQueue(item.id);
      synced++;
    } catch (e) {
      console.warn(`[API] Sync failed for ${item.id}:`, e.message);
      failed++;
    }
  }

  return { synced, failed, remaining: queue.length - synced };
}

// ─── Auto-Connect ───────────────────────────────────────────────────────────

export async function autoConnect() {
  try {
    console.log('[API] Auto-connecting to Personio...');
    const authResult = await auth();
    if (!authResult.success) {
      console.warn('[API] Auth failed');
      return { success: false, error: 'Auth failed' };
    }

    const empResult = await getEmployees();
    if (!empResult.success || !empResult.data) {
      return { success: false, error: 'No employees' };
    }

    // Map Personio employee data
    const mapped = empResult.data
      .map(emp => {
        const attrs = emp.attributes || {};
        const firstName = attrs.first_name?.value || '';
        const lastName = attrs.last_name?.value || '';
        const email = attrs.email?.value || '';
        const dept = attrs.department?.value?.attributes?.name || '';
        const role = attrs.position?.value || '';
        const supervisorId = attrs.supervisor?.value?.attributes?.id?.value || null;

        return {
          id: emp.attributes?.id?.value || emp.id,
          name: `${firstName} ${lastName}`.trim(),
          firstName,
          lastName,
          initials: `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase(),
          role,
          dept,
          email,
          supervisorId,
          vacation: { total: 28, used: 0 },
          overtimeMs: 0,
        };
      })
      .sort((a, b) => a.lastName.localeCompare(b.lastName, 'de'));

    // Build team leaders map
    const leaders = {};
    mapped.forEach(emp => {
      leaders[emp.id] = emp.supervisorId;
    });

    State.batch({
      realEmployees: mapped,
      teamLeaders: leaders,
      apiMode: 'real',
    });

    // Cache employees in IndexedDB
    if (Storage.isAvailable()) {
      await Storage.set(Storage.STORES.CACHE, 'employees', mapped);
    }

    return { success: true, count: mapped.length };

  } catch (e) {
    console.warn('[API] Auto-connect failed:', e.message);
    return { success: false, error: e.message };
  }
}
