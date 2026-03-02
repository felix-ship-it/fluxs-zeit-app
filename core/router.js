/**
 * FLUXS Zeit App — SPA Router with Lazy Loading
 * Each screen is loaded on-demand as an ES module.
 * Max 500 lines.
 */

'use strict';

import * as State from './state.js';

// ─── Route Registry ─────────────────────────────────────────────────────────

const routes = {
  login:     () => import('../screens/login/login.js'),
  dashboard: () => import('../screens/dashboard/dashboard.js'),
  absences:  () => import('../screens/absences/absences.js'),
  monthly:   () => import('../screens/monthly/monthly.js'),
  profile:   () => import('../screens/profile/profile.js'),
  projects:  () => import('../screens/projects/projects.js'),
};

// Cache loaded modules
const _moduleCache = {};

// ─── Navigate ───────────────────────────────────────────────────────────────

export async function navigate(screen) {
  if (!routes[screen]) {
    console.warn(`[Router] Unknown screen: ${screen}`);
    return;
  }

  const prev = State.get('activeScreen');
  if (prev === screen) return;

  State.set('previousScreen', prev);
  State.set('activeScreen', screen);

  const container = document.getElementById('screen-container');
  if (!container) return;

  // Unmount previous screen
  if (_moduleCache[prev] && typeof _moduleCache[prev].unmount === 'function') {
    _moduleCache[prev].unmount();
  }

  // Load & cache module
  if (!_moduleCache[screen]) {
    try {
      _moduleCache[screen] = await routes[screen]();
    } catch (e) {
      console.error(`[Router] Failed to load screen: ${screen}`, e);
      container.innerHTML = `<div class="screen-error">Fehler beim Laden</div>`;
      return;
    }
  }

  // Mount new screen
  container.innerHTML = '';
  if (typeof _moduleCache[screen].mount === 'function') {
    await _moduleCache[screen].mount(container);
  }

  // Update nav
  _updateNav(screen);

  // Scroll to top
  container.scrollTop = 0;
}

// ─── Nav Highlighting ───────────────────────────────────────────────────────

function _updateNav(screen) {
  document.querySelectorAll('.nav-item').forEach(item => {
    const target = item.dataset.screen;
    item.classList.toggle('active', target === screen);
  });
}

// ─── Init ───────────────────────────────────────────────────────────────────

export function init() {
  document.addEventListener('click', (e) => {
    const navItem = e.target.closest('[data-screen]');
    if (navItem) {
      e.preventDefault();
      const screen = navItem.dataset.screen;
      if (screen !== 'login') navigate(screen);
    }
  });
}

export function getActiveScreen() {
  return State.get('activeScreen');
}