/**
 * FLUXS Zeit App — Main Entry Point
 * Initializes the app, sets up event listeners, and kicks off the router.
 * Max 500 lines.
 */

'use strict';

import * as Auth from './auth.js';
import * as Router from './router.js';
import * as State from './state.js';
import * as Storage from './storage.js';
import * as API from './api.js';
import { ENV } from './env.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const SYNC_INTERVAL_MS = 60_000;   // Sync offline queue every 60s
const INSTAGRAM_CHECK_MS = 300_000; // Check Instagram every 5 min

// ─── Boot ────────────────────────────────────────────────────────────────────

async function boot() {
  console.log('[App] Booting FLUXS Zeit', ENV.VERSION);

  // 1. Init state + storage
  await Storage.init();
  State.init();

  // 2. Check auth state
  const session = await Auth.restoreSession();

  if (!session) {
    Router.navigate('/login');
    return;
  }

  // 3. Load employees if not cached
  if (!State.get('employees')) {
    try {
      const result = await API.getEmployees();
      if (result.success && result.data) {
        const employees = result.data.map(e => ({
          id: e.attributes.id?.value,
          name: `${e.attributes.first_name?.value} ${e.attributes.last_name?.value}`.trim(),
          email: e.attributes.email?.value,
          position: e.attributes.position?.value,
          department: e.attributes.department?.attributes?.name,
        }));
        State.set('employees', employees);
        await Storage.saveEmployees(employees);
      }
    } catch (e) {
      console.warn('[App] Could not load employees:', e.message);
      // Try cache
      const cached = await Storage.getEmployees();
      if (cached) State.set('employees', cached);
    }
  }

  // 4. Navigate to default route
  Router.navigate(window.location.hash.replace('#', '') || '/dashboard');

  // 5. Background tasks
  _startBackgroundTasks();
}

// ─── Background Tasks ──────────────────────────────────────────────────────

function _startBackgroundTasks() {
  // Offline queue sync
  setInterval(async () => {
    if (!navigator.onLine) return;
    try {
      const result = await API.syncOfflineQueue();
      if (result.synced > 0) {
        console.log(`[App] Synced ${result.synced} offline item(s)`);
        State.emit('sync:complete', result);
      }
    } catch (e) {
      console.warn('[App] Background sync failed:', e.message);
    }
  }, SYNC_INTERVAL_MS);

  // Instagram checker
  setInterval(async () => {
    try {
      const resp = await fetch('./cgi-bin/instagram.py');
      const data = await resp.json();
      if (data.has_new_post) {
        State.emit('instagram:new_post', data);
      }
    } catch (e) {
      // Silent fail
    }
  }, INSTAGRAM_CHECK_MS);

  // Online/offline state
  window.addEventListener('online', () => {
    State.set('online', true);
    State.emit('network:online');
    API.syncOfflineQueue().catch(() => {});
  });

  window.addEventListener('offline', () => {
    State.set('online', false);
    State.emit('network:offline');
  });
}

// ─── Event Listeners ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  boot().catch(err => {
    console.error('[App] Boot failed:', err);
    // Show error state
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
        <div style="text-align:center;">
          <h2>App konnte nicht geladen werden</h2>
          <p>${err.message}</p>
          <button onclick="location.reload()">Neu laden</button>
        </div>
      </div>`;
  });
});

// ─── Global Error Handler ────────────────────────────────────────────────────

window.addEventListener('unhandledrejection', event => {
  console.error('[App] Unhandled promise rejection:', event.reason);
});

window.addEventListener('error', event => {
  console.error('[App] Global error:', event.message);
});

// ─── Exports (for debugging / shell access) ───────────────────────────────

export { boot };
